import { createOpencodeClient } from "@opencode-ai/sdk/client";

const BASE_DOMAIN =
  process.env.NEXT_PUBLIC_AGENT_BASE_DOMAIN ?? "8-228-225-174.sslip.io";

const BASE_SCHEME =
  process.env.NEXT_PUBLIC_AGENT_BASE_SCHEME ?? "http";

// NEXT_PUBLIC_AGENT_FORCE_URL: when set, every agent — regardless of id —
// points at this URL. Used for local dev when there is only one pod on
// localhost:4096 and DNS subdomains don't exist.
const FORCE_URL = process.env.NEXT_PUBLIC_AGENT_FORCE_URL;

export function agentBaseUrl(agentId: string): string {
  if (FORCE_URL) return FORCE_URL.replace(/\/$/, "");
  return `${BASE_SCHEME}://${agentId}.${BASE_DOMAIN}`;
}

export function clientForAgent(agentId: string) {
  return createOpencodeClient({ baseUrl: agentBaseUrl(agentId) });
}
