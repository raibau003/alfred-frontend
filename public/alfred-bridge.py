#!/usr/bin/env python3
"""
Alfred PC Bridge — Connects your computer to Alfred so agents can browse the web
using your local browser (bypasses Cloudflare, accesses local network, etc.)

Usage:
    python3 alfred-bridge.py --token YOUR_TOKEN

The bridge:
1. Connects to Alfred Router via WebSocket
2. Receives commands (navigate, click, fill, screenshot, extract)
3. Executes them using Playwright on your local browser
4. Returns results to Alfred
"""

import asyncio
import json
import sys
import argparse
import signal
from datetime import datetime

try:
    from playwright.async_api import async_playwright
except ImportError:
    print("Installing playwright...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "playwright"])
    subprocess.check_call([sys.executable, "-m", "playwright", "install", "chromium"])
    from playwright.async_api import async_playwright

try:
    import websockets
except ImportError:
    print("Installing websockets...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "websockets"])
    import websockets

ROUTER_URL = "wss://alfred-router-prod-production.up.railway.app"
ROUTER_HTTP = "https://alfred-router-prod-production.up.railway.app"

class AlfredBridge:
    def __init__(self, token: str):
        self.token = token
        self.browser = None
        self.page = None
        self.running = True
        self.command_count = 0

    async def start(self):
        print(f"[bridge] Alfred PC Bridge v1.0")
        print(f"[bridge] Starting Chromium browser...")

        pw = await async_playwright().start()
        self.browser = await pw.chromium.launch(
            headless=False,  # Show browser so user can see what Alfred does
            args=["--disable-blink-features=AutomationControlled"]
        )
        self.page = await self.browser.new_page()
        await self.page.set_viewport_size({"width": 1280, "height": 800})

        print(f"[bridge] Browser ready. Connecting to Alfred...")

        # Register with Router
        try:
            import urllib.request
            req = urllib.request.Request(
                f"{ROUTER_HTTP}/bridge/register",
                data=json.dumps({"token": self.token}).encode(),
                headers={"Content-Type": "application/json"},
                method="POST"
            )
            resp = urllib.request.urlopen(req, timeout=10)
            data = json.loads(resp.read())
            if data.get("ok"):
                print(f"[bridge] Connected to Alfred! Bridge ID: {data.get('bridge_id', 'ok')}")
            else:
                print(f"[bridge] Warning: registration response: {data}")
        except Exception as e:
            print(f"[bridge] Could not register with Router (will use polling): {e}")

        # Poll for commands
        print(f"[bridge] Waiting for commands from Alfred...")
        print(f"[bridge] Press Ctrl+C to stop")
        print()

        while self.running:
            try:
                cmd = await self.poll_command()
                if cmd:
                    result = await self.execute(cmd)
                    await self.send_result(cmd.get("id"), result)
            except KeyboardInterrupt:
                break
            except Exception as e:
                print(f"[bridge] Error: {e}")
                await asyncio.sleep(5)

        await self.browser.close()
        print("[bridge] Bridge stopped.")

    async def poll_command(self):
        """Poll Router for pending commands"""
        try:
            import urllib.request
            req = urllib.request.Request(
                f"{ROUTER_HTTP}/bridge/poll?token={self.token}",
                method="GET"
            )
            resp = urllib.request.urlopen(req, timeout=30)
            data = json.loads(resp.read())
            if data.get("command"):
                return data
            return None
        except Exception:
            await asyncio.sleep(2)
            return None

    async def execute(self, cmd: dict) -> dict:
        """Execute a browser command"""
        action = cmd.get("action", "")
        params = cmd.get("params", {})
        self.command_count += 1

        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] #{self.command_count} {action}: {json.dumps(params)[:80]}")

        try:
            if action == "navigate":
                url = params.get("url", "")
                await self.page.goto(url, wait_until="domcontentloaded", timeout=30000)
                title = await self.page.title()
                content = await self.page.content()
                # Extract text content (stripped HTML)
                text = await self.page.evaluate("() => document.body?.innerText || ''")
                return {"ok": True, "title": title, "text": text[:5000], "url": self.page.url}

            elif action == "click":
                selector = params.get("selector", "")
                await self.page.click(selector, timeout=10000)
                await self.page.wait_for_load_state("domcontentloaded")
                return {"ok": True, "url": self.page.url}

            elif action == "fill":
                selector = params.get("selector", "")
                value = params.get("value", "")
                await self.page.fill(selector, value)
                return {"ok": True}

            elif action == "screenshot":
                screenshot = await self.page.screenshot(type="png")
                import base64
                b64 = base64.b64encode(screenshot).decode()
                return {"ok": True, "screenshot_b64": b64[:50000]}  # Cap size

            elif action == "extract":
                selector = params.get("selector", "body")
                elements = await self.page.query_selector_all(selector)
                texts = []
                for el in elements[:50]:  # Max 50 elements
                    text = await el.inner_text()
                    if text.strip():
                        texts.append(text.strip()[:200])
                return {"ok": True, "elements": texts}

            elif action == "scroll":
                direction = params.get("direction", "down")
                amount = params.get("amount", 500)
                if direction == "down":
                    await self.page.evaluate(f"window.scrollBy(0, {amount})")
                else:
                    await self.page.evaluate(f"window.scrollBy(0, -{amount})")
                return {"ok": True}

            elif action == "search":
                # Google search shortcut
                query = params.get("query", "")
                await self.page.goto(f"https://www.google.com/search?q={query}", wait_until="domcontentloaded")
                # Extract search results
                results = await self.page.evaluate("""() => {
                    const items = document.querySelectorAll('.g');
                    return Array.from(items).slice(0, 10).map(el => ({
                        title: el.querySelector('h3')?.textContent || '',
                        url: el.querySelector('a')?.href || '',
                        snippet: el.querySelector('.VwiC3b')?.textContent || ''
                    })).filter(r => r.title && r.url);
                }""")
                return {"ok": True, "results": results, "count": len(results)}

            elif action == "get_page_contacts":
                # Extract contact info from current page
                contacts = await self.page.evaluate("""() => {
                    const text = document.body.innerText;
                    const phones = text.match(/(\+?56\s?\d[\s.-]?\d{4}[\s.-]?\d{4})/g) || [];
                    const emails = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
                    const whatsapp = Array.from(document.querySelectorAll('a[href*="wa.me"], a[href*="whatsapp"]'))
                        .map(a => a.href);
                    return { phones: [...new Set(phones)], emails: [...new Set(emails)], whatsapp: [...new Set(whatsapp)] };
                }""")
                return {"ok": True, "contacts": contacts}

            else:
                return {"ok": False, "error": f"Unknown action: {action}"}

        except Exception as e:
            print(f"[bridge] Command failed: {e}")
            return {"ok": False, "error": str(e)}

    async def send_result(self, cmd_id: str, result: dict):
        """Send command result back to Router"""
        try:
            import urllib.request
            req = urllib.request.Request(
                f"{ROUTER_HTTP}/bridge/result",
                data=json.dumps({"token": self.token, "id": cmd_id, "result": result}).encode(),
                headers={"Content-Type": "application/json"},
                method="POST"
            )
            urllib.request.urlopen(req, timeout=10)
        except Exception as e:
            print(f"[bridge] Could not send result: {e}")


def main():
    parser = argparse.ArgumentParser(description="Alfred PC Bridge")
    parser.add_argument("--token", required=True, help="Bridge token from Alfred web app")
    args = parser.parse_args()

    bridge = AlfredBridge(args.token)

    def handle_signal(sig, frame):
        bridge.running = False
        print("\n[bridge] Stopping...")

    signal.signal(signal.SIGINT, handle_signal)
    signal.signal(signal.SIGTERM, handle_signal)

    asyncio.run(bridge.start())


if __name__ == "__main__":
    main()
