export type CanvasType =
  | "mermaid"
  | "code"
  | "chart"
  | "markdown"
  | "html"
  | "workflow";

// Tool name → canvas type. The agent's tools come prefixed with `canvas_`
// because that's the MCP namespace declared in the playbook's opencode.json.
//
// Only "show_*" tools (and universal updaters) switch the active canvas slot.
// Workflow mutators (add_node, set_status, etc.) update the workflow store
// in place — see WORKFLOW_MUTATOR_TOOLS below — so they don't steal the canvas
// from a concurrent chart/diagram/markdown output.
export const CANVAS_TOOL_MAP: Record<string, CanvasType | "*"> = {
  show_diagram: "mermaid",

  show_code: "code",
  show_code_files: "code",
  update_code: "code",
  highlight_code_lines: "code",

  show_chart: "chart",
  update_chart: "chart",

  show_markdown: "markdown",

  show_html: "html",
  update_html: "html",

  show_workflow: "workflow",

  // Universal updaters (any canvas type)
  update_canvas: "*",
  clear_canvas: "*",
};

// Workflow store mutators — these update useWorkflowStore directly and never
// switch the active canvas. The user sees them only when the workflow canvas
// is already the active slot (which happens via show_workflow or via the
// manual "Abrir Workflow" entry point).
export const WORKFLOW_MUTATOR_TOOLS: ReadonlySet<string> = new Set([
  "add_workflow_node",
  "connect_workflow_nodes",
  "update_workflow_node",
  "remove_workflow_node",
  "set_workflow_node_status",
  "save_workflow",
]);

function bareToolName(toolName: string): string {
  return toolName.startsWith("canvas_")
    ? toolName.slice("canvas_".length)
    : toolName;
}

export function canvasTypeForTool(toolName: string): CanvasType | "*" | null {
  const bare = bareToolName(toolName);
  return CANVAS_TOOL_MAP[bare] ?? CANVAS_TOOL_MAP[toolName] ?? null;
}

export function isWorkflowMutator(toolName: string): boolean {
  return WORKFLOW_MUTATOR_TOOLS.has(bareToolName(toolName));
}

// In-place updaters: they refine the LAST artifact of their type instead of
// pushing a new one (so streaming/refinement of one chart/code block doesn't
// spawn duplicate tabs). `update_canvas` is universal (updates whatever
// artifact is currently active).
const ARTIFACT_UPDATER_TOOLS: ReadonlySet<string> = new Set([
  "update_code",
  "highlight_code_lines",
  "update_chart",
  "update_html",
  "update_canvas",
]);

export function isArtifactUpdater(toolName: string): boolean {
  return ARTIFACT_UPDATER_TOOLS.has(bareToolName(toolName));
}

export { bareToolName };
