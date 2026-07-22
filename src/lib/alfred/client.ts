const ROUTER_PRIMARY = process.env.NEXT_PUBLIC_ALFRED_ROUTER_URL ?? "https://alfred-router-prod-production.up.railway.app";
const ROUTER_BACKUP = "https://alfred-router-backup-production.up.railway.app";
let ROUTER_URL = ROUTER_PRIMARY;
let lastHealthCheck = 0;

// Auto-failover: check primary, switch to backup if down
async function getRouterUrl(): Promise<string> {
  if (Date.now() - lastHealthCheck < 30000) return ROUTER_URL; // cache 30s
  lastHealthCheck = Date.now();
  try {
    const resp = await fetch(`${ROUTER_PRIMARY}/health`, { signal: AbortSignal.timeout(5000) });
    if (resp.ok) { ROUTER_URL = ROUTER_PRIMARY; return ROUTER_URL; }
  } catch {}
  try {
    const resp = await fetch(`${ROUTER_BACKUP}/health`, { signal: AbortSignal.timeout(5000) });
    if (resp.ok) { ROUTER_URL = ROUTER_BACKUP; console.log("[failover] Using backup router"); return ROUTER_URL; }
  } catch {}
  return ROUTER_PRIMARY; // default
}

export interface AlfredMessage {
  role: "user" | "assistant";
  text: string;
  agent?: string;
  rich?: { type: string; products?: any[]; actions?: any[]; [key: string]: any };
}

export async function createSession(title: string, userId?: string): Promise<string | null> {
  try {
    const url = await getRouterUrl();
    const resp = await fetch(`${url}/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ directory: "/home/agent/sandbox", title, user_id: userId }),
    });
    const data = await resp.json();
    return data?.id ?? null;
  } catch {
    return null;
  }
}

export async function sendPrompt(sessionId: string, text: string): Promise<void> {
  const url = await getRouterUrl();
  await fetch(`${url}/session/${sessionId}/prompt_async`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      directory: "/home/agent/sandbox",
      parts: [{ type: "text", text }],
    }),
  });
}

export async function getMessages(sessionId: string): Promise<{ messages: AlfredMessage[]; status: string }> {
  try {
    const url = await getRouterUrl();
    const resp = await fetch(`${url}/session/${sessionId}/message?directory=/home/agent/sandbox`);
    const data = await resp.json();

    // Support both old format (array) and new format ({ messages, status })
    const rawMessages = Array.isArray(data) ? data : (data.messages || []);
    const status = Array.isArray(data) ? "unknown" : (data.status || "unknown");

    const result: AlfredMessage[] = [];
    for (const msg of rawMessages) {
      const role = (msg.role || msg.info?.role) as "user" | "assistant";
      if (!role) continue;

      let text = "";
      let rich: any = null;

      for (const p of (msg.parts || [])) {
        if (p.type === "text" && p.text) text = p.text;
        if (p.type === "rich" && p.richType) {
          rich = { type: p.richType, ...p.data };
        }
      }

      if (text) {
        result.push({ role, text, rich: rich || undefined });
      }
    }
    return { messages: result, status };
  } catch {
    return { messages: [], status: "error" };
  }
}

export async function stopSession(sessionId: string): Promise<void> {
  const url = await getRouterUrl();
  await fetch(`${url}/session/${sessionId}/stop`, { method: "POST" });
}

export { ROUTER_URL };
