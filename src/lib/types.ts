export type AgentStatus = "created" | "pending" | "running" | "restarting" | "deleting";

export interface Agent {
  id: string;
  name: string;
  status: AgentStatus;
  url: string;
  role_id: string | null;
  playbook_id: string | null;
  env: Record<string, string> | null;
  created_at: string;
  updated_at: string;
}

export interface AgentDetail extends Agent {
  ready_replicas?: number;
}

// Live backend contract (AgentHealthResponse): { id, ready, ready_replicas, status }
export interface AgentHealth {
  id: string;
  ready: boolean;
  ready_replicas: number;
  status: AgentStatus;
}

export interface Playbook {
  id: string;
  name: string;
  description: string;
  gcs_path: string;
  created_at?: string;
  updated_at?: string;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  gcs_path: string;
  created_at?: string;
  updated_at?: string;
}

export interface CreateAgentPayload {
  name: string;
  role_id?: string | null;
  playbook_id?: string | null;
  env?: Record<string, string> | null;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}
