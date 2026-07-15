import type { Workflow } from "./types";

const TAG_OPEN = "<workflow_context>";
const TAG_CLOSE = "</workflow_context>";
const BLOCK_RE = /<workflow_context>[\s\S]*?<\/workflow_context>\n?/g;

const RUN_OPEN = "<workflow_run";
const RUN_BLOCK_RE = /<workflow_run\s+name="([^"]*)"\s+nodes="(\d+)"\s+edges="(\d+)">([\s\S]*?)<\/workflow_run>\n?/;

/** Serialize the workflow for the agent and prepend it to the user text. */
export function attachWorkflowContext(text: string, workflow: Workflow): string {
  const snapshot = {
    id: workflow.id,
    name: workflow.name,
    nodes: workflow.nodes.map((n) => ({
      id: n.id,
      kind: n.kind,
      blockId: n.blockId,
      label: n.label,
      intent: n.intent,
      config: n.config,
    })),
    edges: workflow.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
    })),
  };
  return `${TAG_OPEN}\n${JSON.stringify(snapshot, null, 2)}\n${TAG_CLOSE}\n\n${text}`;
}

/** Strip the workflow context block before rendering the message to the user. */
export function stripWorkflowContext(text: string): {
  cleanText: string;
  hadContext: boolean;
} {
  if (!text.includes(TAG_OPEN)) return { cleanText: text, hadContext: false };
  return {
    cleanText: text.replace(BLOCK_RE, "").trimStart(),
    hadContext: true,
  };
}

/** Build a workflow-run prompt with a header tag the UI can collapse. */
export function buildWorkflowRunPrompt(
  workflow: Workflow,
  body: string
): string {
  const meta = `name="${escapeAttr(workflow.name)}" nodes="${workflow.nodes.length}" edges="${workflow.edges.length}"`;
  return `<workflow_run ${meta}>\n${body}\n</workflow_run>`;
}

/** Detect and pull the collapsible workflow_run block out of a text part. */
export function parseWorkflowRun(text: string): {
  before: string;
  run: { name: string; nodes: number; edges: number; body: string } | null;
  after: string;
} {
  if (!text.includes(RUN_OPEN)) {
    return { before: text, run: null, after: "" };
  }
  const m = text.match(RUN_BLOCK_RE);
  if (!m) return { before: text, run: null, after: "" };
  const start = text.indexOf(m[0]);
  const before = text.slice(0, start);
  const after = text.slice(start + m[0].length);
  return {
    before,
    run: {
      name: m[1],
      nodes: Number(m[2]),
      edges: Number(m[3]),
      body: m[4].trim(),
    },
    after,
  };
}

function escapeAttr(s: string): string {
  return s.replace(/"/g, "&quot;");
}
