const ROUTER_URL = process.env.NEXT_PUBLIC_ALFRED_ROUTER_URL ?? "https://alfred-router-prod-production.up.railway.app";

export interface AlfredMessage {
  role: "user" | "assistant";
  text: string;
  agent?: string;
  rich?: { type: string; products?: any[]; actions?: any[]; [key: string]: any };
}

export async function createSession(title: string, userId?: string): Promise<string | null> {
  try {
    const resp = await fetch(`${ROUTER_URL}/session`, {
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
  await fetch(`${ROUTER_URL}/session/${sessionId}/prompt_async`, {
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
    const resp = await fetch(`${ROUTER_URL}/session/${sessionId}/message?directory=/home/agent/sandbox`);
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

export { ROUTER_URL };
