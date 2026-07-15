import { AgentStatus } from "./types";

export const BASE_DOMAIN = "8-228-225-174.sslip.io";
export const POLL_INTERVAL_MS = 4000;
// Statuses that trigger list re-polling
export const ACTIVE_STATUSES: AgentStatus[] = ["created", "pending", "restarting", "deleting"];

// Statuses that need GET /agents/{id} to drive backend status transitions (polling-on-read)
// "deleting" is excluded — the doc disappears from Firestore after K8s cleanup, no transition to drive
export const TRANSITION_STATUSES: AgentStatus[] = ["created", "pending", "restarting"];

export const STATUS_CONFIG: Record<
  AgentStatus,
  { label: string; color: string; bg: string; pulse: boolean }
> = {
  created: {
    label: "Created",
    color: "#475569",
    bg: "rgba(71,85,105,0.08)",
    pulse: false,
  },
  pending: {
    label: "Pending",
    color: "#d97706",
    bg: "rgba(217,119,6,0.10)",
    pulse: true,
  },
  running: {
    label: "Running",
    color: "#16a34a",
    bg: "rgba(22,163,74,0.10)",
    pulse: false,
  },
  restarting: {
    label: "Restarting",
    color: "#7c3aed",
    bg: "rgba(124,58,237,0.10)",
    pulse: true,
  },
  deleting: {
    label: "Deleting",
    color: "#dc2626",
    bg: "rgba(220,38,38,0.10)",
    pulse: true,
  },
};

export const AGENT_ID_REGEX = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
