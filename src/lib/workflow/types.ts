// Building-block types — qué cosas del playbook se pueden arrastrar al canvas.
export type BlockKind =
  | "semantic_step"  // step semántico de alto nivel — el agente decide cómo cumplirlo
  | "mcp_tool"       // ej. postgres_query, resend_send
  | "skill"          // ej. email-triage
  | "subagent"       // ej. researcher (declarado en opencode.json)
  | "plugin"         // ej. opencode-reminders.create
  | "builtin_tool"   // ej. read, write, bash
  | "control_flow";  // ej. branch, loop, wait, hitl_approval

// Una "pieza" del catálogo que aparece en la sidebar.
export interface CatalogBlock {
  id: string;          // unique key — ej. "mcp:postgres:query"
  kind: BlockKind;
  label: string;       // display name — ej. "Postgres query"
  description?: string;
  icon?: string;       // emoji o lucide icon name
  group?: string;      // section en sidebar — ej. "Bases de datos"
  inputSchema?: unknown; // JSON Schema (sólo informativo — el panel usa intent libre)
  intentPlaceholder?: string; // hint que aparece en el textarea del NodeInspector
}

// Un nodo del workflow (instancia de un CatalogBlock en el canvas).
export interface WorkflowNode {
  id: string;          // ej. "node-1"
  blockId: string;     // referencia al CatalogBlock.id
  kind: BlockKind;
  label: string;
  intent?: string;     // intención libre que el agente interpreta al ejecutar
  config: Record<string, unknown>; // (legacy/reservado para futuros forms guiados)
  position: { x: number; y: number };
  status?: "idle" | "running" | "done" | "error";
  result?: unknown;
}

export interface WorkflowEdge {
  id: string;
  source: string;      // node.id
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  version: number;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  createdAt: number;
  updatedAt: number;
}
