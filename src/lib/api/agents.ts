import { apiFetch } from "./client";
import {
  Agent,
  AgentDetail,
  AgentHealth,
  CreateAgentPayload,
} from "@/lib/types";

export const agentsApi = {
  list: () => apiFetch<Agent[]>("/agents"),

  get: (id: string) => apiFetch<AgentDetail>(`/agents/${id}`),

  health: (id: string) => apiFetch<AgentHealth>(`/agents/${id}/health`),

  // POST /agents body { name, role_id?, playbook_id?, env? }.
  // Backend returns an empty body ({}) — the caller must refetch GET /agents
  // to obtain the generated UUID `id`.
  create: (payload: CreateAgentPayload) =>
    apiFetch<Record<string, never>>("/agents", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  // POST /agents/{id}/start — idempotent.
  start: (id: string) =>
    apiFetch<Record<string, unknown>>(`/agents/${id}/start`, {
      method: "POST",
      body: "{}",
    }),

  delete: (id: string) =>
    apiFetch<void>(`/agents/${id}`, { method: "DELETE" }),

  // PATCH /agents/{id}/playbook body { playbook_id }
  setPlaybook: (id: string, playbookId: string | null) =>
    apiFetch<Record<string, unknown>>(`/agents/${id}/playbook`, {
      method: "PATCH",
      body: JSON.stringify({ playbook_id: playbookId }),
    }),

  // PATCH /agents/{id}/role body { role_id }
  setRole: (id: string, roleId: string | null) =>
    apiFetch<Record<string, unknown>>(`/agents/${id}/role`, {
      method: "PATCH",
      body: JSON.stringify({ role_id: roleId }),
    }),
};
