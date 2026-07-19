const ROUTER_URL = process.env.NEXT_PUBLIC_ALFRED_ROUTER_URL ?? "https://alfred-router-prod-production.up.railway.app";

export interface AlfredMessage {
  role: "user" | "assistant";
  text: string;
  agent?: string;
}

export async function createSession(title: string): Promise<string | null> {
  try {
    const resp = await fetch(`${ROUTER_URL}/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ directory: "/home/agent/sandbox", title }),
    });
    const data = await resp.json();
    return data?.id ?? null;
  } catch {
    return null;
  }
}

export async function sendPrompt(sessionId: string, text: string): Promise<void> {
  await fetch(`${ROUTER_URL}/session/${sessionId}/prompt_async`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      directory: "/home/agent/sandbox",
      parts: [{ type: "text", text }],
    }),
  });
}

export async function getMessages(sessionId: string): Promise<AlfredMessage[]> {
  try {
    const resp = await fetch(`${ROUTER_URL}/session/${sessionId}/message?directory=/home/agent/sandbox`);
    const messages = await resp.json();
    if (!Array.isArray(messages)) return [];

    const result: AlfredMessage[] = [];
    for (const msg of messages) {
      const role = (msg.role || msg.info?.role) as "user" | "assistant";
      if (!role) continue;
      for (const p of (msg.parts || [])) {
        if (p.type === "text" && p.text) {
          result.push({ role, text: p.text });
        }
      }
    }
    return result;
  } catch {
    return [];
  }
}

export async function getSessionStatus(sessionId: string): Promise<"processing" | "done" | "error"> {
  try {
    const resp = await fetch(`${ROUTER_URL}/session/${sessionId}/message?directory=/home/agent/sandbox`);
    if (!resp.ok) return "error";
    // Check if router is still processing by looking at the session
    // The router sets status = "done" when finished
    return "done"; // We'll check via polling in the hook
  } catch {
    return "error";
  }
}

export { ROUTER_URL };
