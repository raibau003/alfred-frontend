export interface Profile {
  id: string;
  name: string | null;
  phone: string | null;
  timezone: string;
  created_at: string;
}

export interface ConversationThread {
  id: string;
  user_id: string;
  title: string | null;
  channel: string;
  chat_id: string | null;
  status: "active" | "archived" | "expired";
  created_at: string;
  updated_at: string;
}

export interface ConversationMessage {
  id: number;
  thread_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  agent: string | null;
  classification: string | null;
  duration_ms: number | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface Agent {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  enabled: boolean;
  category: string | null;
  created_by: string | null;
  is_custom: boolean;
  config: Record<string, unknown> | null;
  created_at: string;
}

export interface Connector {
  id: string;
  user_id: string;
  agent_id: string;
  name: string;
  type: string;
  config: Record<string, unknown>;
  credentials: Record<string, unknown>;
  status: "connected" | "disconnected" | "error";
  last_test_at: string | null;
  last_test_result: string | null;
  created_at: string;
}

export interface ShoppingCart {
  id: string;
  user_id: string;
  store: string;
  items: Array<{ name: string; price: number; qty: number; url?: string; image?: string }>;
  total: number;
  status: "active" | "checked_out" | "abandoned";
  created_at: string;
  updated_at: string;
}
