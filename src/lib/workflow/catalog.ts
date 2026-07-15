import type { CatalogBlock } from "./types";

// Semantic steps — building blocks de alto nivel que el agente interpreta
// libremente. El campo "intent" en cada nodo es texto natural; el agente
// decide qué tool/MCP usar internamente. Mostrados al principio del sidebar.
const SEMANTIC_STEPS: CatalogBlock[] = [
  {
    id: "step:db-connect",
    kind: "semantic_step",
    label: "Conectar a base de datos",
    icon: "🔌",
    group: "Datos",
    description: "Establece o registra una conexión que pasos siguientes pueden usar.",
    intentPlaceholder:
      "Ej.: Postgres en postgres://user:pass@host:5432/db — usá esta conexión para los próximos pasos",
  },
  {
    id: "step:db-query",
    kind: "semantic_step",
    label: "Consultar datos",
    icon: "🔎",
    group: "Datos",
    description: "Recupera información de la conexión establecida en un paso previo.",
    intentPlaceholder:
      "Ej.: traé los 10 productos más vendidos de mayo, ordenados por revenue",
  },
  {
    id: "step:transform",
    kind: "semantic_step",
    label: "Transformar / resumir",
    icon: "🧪",
    group: "Procesamiento",
    description: "Aplica una transformación o resumen sobre el resultado del paso previo.",
    intentPlaceholder:
      "Ej.: agrupá por categoría y calculá el % de cada una sobre el total",
  },
  {
    id: "step:visualize",
    kind: "semantic_step",
    label: "Visualizar en el lienzo",
    icon: "📊",
    group: "Presentación",
    description: "Renderiza el resultado en el canvas (gráfico, tabla, diagrama o documento).",
    intentPlaceholder:
      "Ej.: gráfico de barras horizontales con top 10 productos por revenue",
  },
  {
    id: "step:notify",
    kind: "semantic_step",
    label: "Notificar",
    icon: "📨",
    group: "Comunicación",
    description: "Envía el resultado por email, WhatsApp, Telegram, etc.",
    intentPlaceholder:
      "Ej.: enviar resumen por email a bryan@evolveds.ai con el gráfico adjunto",
  },
  {
    id: "step:ask-user",
    kind: "semantic_step",
    label: "Pedir input al usuario",
    icon: "🙋",
    group: "Interacción",
    description: "Pausa el workflow y le pide al usuario que confirme o complete algo.",
    intentPlaceholder:
      "Ej.: pedir confirmación antes de enviar el email final",
  },
  {
    id: "step:web-search",
    kind: "semantic_step",
    label: "Buscar en internet",
    icon: "🌎",
    group: "Investigación",
    description: "Buscá información actualizada en la web.",
    intentPlaceholder:
      "Ej.: buscar las últimas noticias sobre tarifas de electricidad en Argentina mayo 2026",
  },
  {
    id: "step:generate",
    kind: "semantic_step",
    label: "Generar contenido",
    icon: "✨",
    group: "Procesamiento",
    description: "Generá texto, código, JSON, prompt, etc. a partir de los pasos previos.",
    intentPlaceholder:
      "Ej.: redactá un email cordial de 100 palabras con los resultados del paso anterior",
  },
];

// Control-flow nodes — synthetic, no equivalen a un tool real pero el agente
// los interpreta al ejecutar el grafo.
const CONTROL_FLOW: CatalogBlock[] = [
  { id: "cf:branch", kind: "control_flow", label: "Branch (if/else)", icon: "🔀", group: "Lógica" },
  { id: "cf:loop", kind: "control_flow", label: "Loop", icon: "🔁", group: "Lógica" },
  { id: "cf:wait", kind: "control_flow", label: "Wait", icon: "⏱️", group: "Lógica" },
  { id: "cf:hitl", kind: "control_flow", label: "Aprobación humana", icon: "✋", group: "Lógica" },
];

// Map well-known MCP tool prefixes to nicer labels and groups.
const MCP_LABELS: Record<string, { label: string; group: string; icon?: string }> = {
  // canvas (merlina-canvas-mcp) — see merlina-sandbox-agent/mcp-server-canvas/src/index.ts
  canvas_show_diagram: { label: "Mostrar diagrama", group: "Canvas", icon: "📊" },
  canvas_show_code: { label: "Mostrar código", group: "Canvas", icon: "💻" },
  canvas_show_code_files: { label: "Mostrar múltiples archivos", group: "Canvas", icon: "🗂️" },
  canvas_update_code: { label: "Actualizar código", group: "Canvas", icon: "✏️" },
  canvas_highlight_code_lines: { label: "Resaltar líneas", group: "Canvas", icon: "🖍️" },
  canvas_show_chart: { label: "Mostrar gráfico", group: "Canvas", icon: "📈" },
  canvas_update_chart: { label: "Actualizar gráfico", group: "Canvas", icon: "📊" },
  canvas_show_markdown: { label: "Mostrar documento", group: "Canvas", icon: "📝" },
  canvas_show_workflow: { label: "Mostrar workflow", group: "Workflow", icon: "🧩" },
  canvas_add_workflow_node: { label: "Agregar nodo", group: "Workflow", icon: "➕" },
  canvas_connect_workflow_nodes: { label: "Conectar nodos", group: "Workflow", icon: "🔗" },
  canvas_set_workflow_node_status: { label: "Estado de nodo", group: "Workflow", icon: "🚦" },
  canvas_remove_workflow_node: { label: "Borrar nodo", group: "Workflow", icon: "🗑️" },
  canvas_save_workflow: { label: "Guardar workflow", group: "Workflow", icon: "💾" },
  canvas_update_canvas: { label: "Actualizar lienzo", group: "Canvas", icon: "🔄" },
  canvas_clear_canvas: { label: "Limpiar lienzo", group: "Canvas", icon: "🧹" },

  // canales
  resend_send: { label: "Enviar email (Resend)", group: "Canales", icon: "📧" },
  whatsapp_send: { label: "WhatsApp", group: "Canales", icon: "💬" },
  telegram_send: { label: "Telegram", group: "Canales", icon: "✈️" },
  linkedin_post: { label: "Post LinkedIn", group: "Canales", icon: "🔗" },
  bluesky_post: { label: "Post Bluesky", group: "Canales", icon: "🦋" },

  // databases
  postgres_query: { label: "Postgres query", group: "Bases de datos", icon: "🐘" },
  mysql_query: { label: "MySQL query", group: "Bases de datos", icon: "🐬" },
  bigquery_query: { label: "BigQuery query", group: "Bases de datos", icon: "🅱️" },
  snowflake_query: { label: "Snowflake query", group: "Bases de datos", icon: "❄️" },
  duckdb_query: { label: "DuckDB query", group: "Bases de datos", icon: "🦆" },

  // web
  firecrawl_scrape: { label: "Scraping pesado", group: "Web", icon: "🕷️" },
  brave_search: { label: "Brave search", group: "Web", icon: "🦁" },
  weather_get: { label: "Clima", group: "Web", icon: "🌤️" },

  // productivity
  notion_query: { label: "Notion", group: "Productividad", icon: "📓" },
  github_pr: { label: "GitHub PR", group: "Productividad", icon: "🐙" },
  todoist_task: { label: "Todoist", group: "Productividad", icon: "✅" },

  // opencode plugins
  "opencode-reminders_create": { label: "Schedule reminder", group: "Plugins", icon: "🔔" },
  "opencode-ntfy.sh_send": { label: "Push notif celular", group: "Plugins", icon: "📱" },
  "opencode-mem_recall": { label: "Recordar de memoria", group: "Plugins", icon: "🧠" },
};

// OpenCode does not expose MCP tools through any HTTP endpoint, only their
// connection status via /mcp. So we hardcode the tools we know each MCP server
// publishes, keyed by server name. Anything connected but absent here falls
// back to a single generic "query" placeholder so the user at least sees the
// server is available.
const MCP_SERVER_TOOLS: Record<string, string[]> = {
  canvas: [
    "canvas_show_diagram",
    "canvas_show_code",
    "canvas_show_code_files",
    "canvas_update_code",
    "canvas_highlight_code_lines",
    "canvas_show_chart",
    "canvas_update_chart",
    "canvas_show_markdown",
    "canvas_show_workflow",
    "canvas_add_workflow_node",
    "canvas_connect_workflow_nodes",
    "canvas_set_workflow_node_status",
    "canvas_remove_workflow_node",
    "canvas_save_workflow",
    "canvas_update_canvas",
    "canvas_clear_canvas",
  ],
  duckdb: ["duckdb_query"],
  postgres: ["postgres_query"],
  mysql: ["mysql_query"],
  mssql: ["mssql_query"],
  sqlite: ["sqlite_query"],
  mongodb: ["mongodb_query"],
  redis: ["redis_query"],
  bigquery: ["bigquery_query"],
  snowflake: ["snowflake_query"],
};

interface PodTool {
  id: string;
  description?: string;
  inputSchema?: unknown;
}

// OpenCode internals we don't want to expose as draggable nodes.
const INTERNAL_TOOLS = new Set(["invalid", "question", "todowrite", "task", "apply_patch"]);

// Map OpenCode built-in tool ids → metadata for the catalog UI.
const BUILTIN_META: Record<string, { label: string; icon: string; group: string }> = {
  read: { label: "Read file", icon: "📄", group: "Archivos" },
  write: { label: "Write file", icon: "✏️", group: "Archivos" },
  edit: { label: "Edit file", icon: "🛠️", group: "Archivos" },
  bash: { label: "Bash command", icon: "🖥️", group: "Sistema" },
  grep: { label: "Grep", icon: "🔎", group: "Búsqueda" },
  glob: { label: "Find files", icon: "📂", group: "Búsqueda" },
  webfetch: { label: "Web fetch", icon: "🌐", group: "Web" },
  websearch: { label: "Web search", icon: "🔍", group: "Web" },
  skill: { label: "Invocar skill", icon: "🎯", group: "Skills" },
};

// Plugin tool ids exposed by OpenCode plugins (opencode-mem, opencode-reminders).
const PLUGIN_META: Record<string, { label: string; icon: string; group: string }> = {
  memory: { label: "Recordar de memoria", icon: "🧠", group: "Plugins" },
  reminderadd: { label: "Crear recordatorio", icon: "🔔", group: "Plugins" },
  reminderlist: { label: "Listar recordatorios", icon: "📋", group: "Plugins" },
  reminderremove: { label: "Borrar recordatorio", icon: "🗑️", group: "Plugins" },
};

export function buildCatalogFromTools(tools: PodTool[]): CatalogBlock[] {
  const blocks: CatalogBlock[] = [...SEMANTIC_STEPS, ...CONTROL_FLOW];

  for (const t of tools) {
    if (INTERNAL_TOOLS.has(t.id)) continue;

    const builtin = BUILTIN_META[t.id];
    const plugin = PLUGIN_META[t.id];
    const knownMcp = MCP_LABELS[t.id];

    if (builtin) {
      blocks.push({
        id: `tool:${t.id}`,
        kind: "builtin_tool",
        label: builtin.label,
        description: t.description,
        group: builtin.group,
        icon: builtin.icon,
        inputSchema: t.inputSchema,
      });
      continue;
    }

    if (plugin) {
      blocks.push({
        id: `tool:${t.id}`,
        kind: "plugin",
        label: plugin.label,
        description: t.description,
        group: plugin.group,
        icon: plugin.icon,
        inputSchema: t.inputSchema,
      });
      continue;
    }

    // MCP tool (canvas_*, postgres_*, etc.) or unknown — categorize by prefix.
    blocks.push({
      id: `tool:${t.id}`,
      kind: t.id.startsWith("opencode-") ? "plugin" : "mcp_tool",
      label: knownMcp?.label ?? humanize(t.id),
      description: t.description,
      group: knownMcp?.group ?? guessGroup(t.id),
      icon: knownMcp?.icon,
      inputSchema: t.inputSchema,
    });
  }

  return blocks;
}

function humanize(toolId: string): string {
  return toolId
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function guessGroup(toolId: string): string {
  if (toolId.startsWith("canvas_")) return "Canvas";
  if (toolId.startsWith("opencode-")) return "Plugins";
  const [namespace] = toolId.split("_");
  return namespace.charAt(0).toUpperCase() + namespace.slice(1);
}

// SDK shape: client.tool.ids() returns { data: string[] }. Older versions return
// the array directly. We accept both. `tool.list()` requires provider+model
// query params so we don't use it here — `ids` is enough for catalog building.
type ToolsClient = {
  tool?: {
    ids?: (opts?: unknown) => Promise<unknown>;
  };
};

function unwrap(resp: unknown): string[] {
  if (Array.isArray(resp)) return resp as string[];
  if (resp && typeof resp === "object" && "data" in resp) {
    const data = (resp as { data: unknown }).data;
    if (Array.isArray(data)) return data as string[];
  }
  return [];
}

interface McpServerStatus {
  status: "connected" | "failed" | "disabled" | string;
  error?: string;
}

async function fetchMcpToolIds(baseUrl: string): Promise<string[]> {
  try {
    const resp = await fetch(`${baseUrl.replace(/\/$/, "")}/mcp`);
    if (!resp.ok) return [];
    const servers = (await resp.json()) as Record<string, McpServerStatus>;
    const ids: string[] = [];
    for (const [name, info] of Object.entries(servers)) {
      if (info?.status !== "connected") continue;
      const known = MCP_SERVER_TOOLS[name];
      if (known) {
        ids.push(...known);
      } else {
        // Unknown server but connected — surface a generic entry so the user
        // can see something is there. Tool id matches OpenCode's namespacing.
        ids.push(`${name}_query`);
      }
    }
    return ids;
  } catch {
    return [];
  }
}

export async function fetchPodCatalog(
  client: ToolsClient | null,
  baseUrl?: string
): Promise<CatalogBlock[]> {
  // Synthetic baseline always available: semantic steps + control flow.
  const baseline = [...SEMANTIC_STEPS, ...CONTROL_FLOW];

  const [builtinIds, mcpIds] = await Promise.all([
    (async () => {
      if (!client?.tool?.ids) return [] as string[];
      try {
        return unwrap(await client.tool.ids());
      } catch {
        return [] as string[];
      }
    })(),
    baseUrl ? fetchMcpToolIds(baseUrl) : Promise.resolve([] as string[]),
  ]);

  const allIds = [...builtinIds, ...mcpIds];
  if (allIds.length === 0) return baseline;
  return buildCatalogFromTools(allIds.map((id) => ({ id })));
}
