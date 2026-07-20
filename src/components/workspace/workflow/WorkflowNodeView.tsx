"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { X } from "lucide-react";
import { useWorkflowStore } from "@/stores/workflowStore";
import type { WorkflowNode } from "@/lib/workflow/types";

interface NodeData {
  node: WorkflowNode;
  editable?: boolean;
}

const STATUS_STYLES: Record<NonNullable<WorkflowNode["status"]>, string> = {
  idle: "border-slate-300 bg-white",
  running: "border-amber-400 bg-amber-50 animate-pulse",
  done: "border-emerald-400 bg-emerald-50",
  error: "border-red-400 bg-red-50",
};

const KINDS_REQUIRING_INTENT: Array<WorkflowNode["kind"]> = [
  "semantic_step",
  "mcp_tool",
  "skill",
  "subagent",
  "plugin",
  "builtin_tool",
];

const KIND_BADGES: Record<WorkflowNode["kind"], { label: string; cls: string }> = {
  semantic_step: { label: "Step", cls: "bg-brand-100 text-brand-700" },
  mcp_tool: { label: "MCP", cls: "bg-blue-100 text-[#0a1628]" },
  skill: { label: "Skill", cls: "bg-purple-100 text-purple-700" },
  subagent: { label: "Sub-agent", cls: "bg-pink-100 text-pink-700" },
  plugin: { label: "Plugin", cls: "bg-orange-100 text-orange-700" },
  builtin_tool: { label: "Built-in", cls: "bg-slate-100 text-slate-700" },
  control_flow: { label: "Lógica", cls: "bg-yellow-100 text-yellow-700" },
};

export function WorkflowNodeView({ data }: NodeProps) {
  const d = data as unknown as NodeData;
  const node = d.node;
  const editable = d.editable ?? false;
  const status = node.status ?? "idle";
  const badge = KIND_BADGES[node.kind];
  const removeNode = useWorkflowStore((s) => s.removeNode);

  const needsIntent =
    status === "idle" &&
    KINDS_REQUIRING_INTENT.includes(node.kind) &&
    !(node.intent && node.intent.trim().length > 0);

  const containerCls = needsIntent
    ? "border-amber-400 bg-amber-50/60"
    : STATUS_STYLES[status];

  return (
    <div
      className={`group relative min-w-[180px] rounded-lg border-2 px-3 py-2 shadow-sm transition-all ${containerCls}`}
      title={needsIntent ? "Falta describir la intención" : undefined}
    >
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !bg-slate-400" />

      {editable && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            removeNode(node.id);
          }}
          className="absolute -right-2 -top-2 hidden h-5 w-5 items-center justify-center rounded-full border border-surface-4 bg-white text-slate-500 shadow-sm hover:border-red-400 hover:text-red-600 group-hover:flex"
          title="Borrar nodo"
        >
          <X className="h-3 w-3" />
        </button>
      )}

      <div className="mb-1 flex items-center justify-between gap-2">
        <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase ${badge.cls}`}>
          {badge.label}
        </span>
        {status === "running" && <span className="text-[10px] text-amber-700">⏳</span>}
        {status === "done" && <span className="text-[10px] text-emerald-700">✓</span>}
        {status === "error" && <span className="text-[10px] text-red-700">✗</span>}
        {needsIntent && <span className="text-[10px] text-amber-700" title="Falta intención">⚠</span>}
      </div>

      <div className="text-sm font-medium text-slate-900">{node.label}</div>

      {node.intent && node.intent.trim().length > 0 && (
        <div className="mt-1 max-w-[280px] text-[11px] leading-snug text-slate-600 line-clamp-3">
          {node.intent}
        </div>
      )}

      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !bg-slate-400" />
    </div>
  );
}
