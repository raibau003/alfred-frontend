"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  BarChart3,
  Code2,
  FileText,
  GitBranch,
  LayoutTemplate,
  Workflow,
  X,
} from "lucide-react";
import {
  useWorkspaceStore,
  type CanvasArtifact,
} from "@/stores/workspaceStore";
import { useWorkflowStore } from "@/stores/workflowStore";
import type { CanvasType } from "@/lib/opencode/canvas-map";

const MermaidCanvas = dynamic(
  () => import("./MermaidCanvas").then((m) => m.MermaidCanvas),
  { ssr: false, loading: () => <Spinner label="Diagrama..." /> }
);

const CodeCanvas = dynamic(
  () => import("./CodeCanvas").then((m) => m.CodeCanvas),
  { ssr: false, loading: () => <Spinner label="Código..." /> }
);

const RechartsCanvas = dynamic(
  () => import("./RechartsCanvas").then((m) => m.RechartsCanvas),
  { ssr: false, loading: () => <Spinner label="Gráfico..." /> }
);

const MarkdownCanvas = dynamic(
  () => import("./MarkdownCanvas").then((m) => m.MarkdownCanvas),
  { ssr: false, loading: () => <Spinner label="Documento..." /> }
);

const HtmlCanvas = dynamic(
  () => import("./HtmlCanvas").then((m) => m.HtmlCanvas),
  { ssr: false, loading: () => <Spinner label="Reporte..." /> }
);

const WorkflowCanvas = dynamic(
  () => import("./WorkflowCanvas").then((m) => m.WorkflowCanvas),
  { ssr: false, loading: () => <Spinner label="Workflow..." /> }
);

function Spinner({ label }: { label: string }) {
  return (
    <div className="flex h-full items-center justify-center text-sm text-slate-400">
      {label}
    </div>
  );
}

const TYPE_ICON: Record<CanvasType, typeof BarChart3> = {
  mermaid: GitBranch,
  chart: BarChart3,
  code: Code2,
  markdown: FileText,
  html: LayoutTemplate,
  workflow: Workflow,
};

// Wrapper for visual canvases (chart / mermaid / code / markdown). Renders a
// thin header above the canvas with a "← Workflow" jump button when a
// workflow is alive in the store. Header-based (not overlay) so it never
// covers the canvas content (chart title, etc.).
function CanvasWithBack({ children }: { children: ReactNode }) {
  const workflow = useWorkflowStore((s) => s.workflow);
  const setCanvas = useWorkspaceStore((s) => s.setCanvas);

  if (!workflow) {
    return <div className="h-full">{children}</div>;
  }

  return (
    <div className="flex h-full flex-col bg-surface-1">
      <div className="flex items-center justify-between border-b border-surface-4 bg-surface-2 px-3 py-1.5">
        <button
          type="button"
          onClick={() =>
            setCanvas("workflow", {
              workflow_id: workflow.id,
              name: workflow.name,
              nodes: workflow.nodes,
              edges: workflow.edges,
            })
          }
          className="inline-flex items-center gap-1 rounded-md border border-surface-4 bg-white px-2 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-surface-3 hover:text-slate-900"
          title="Volver al Workflow Builder"
        >
          <ArrowLeft className="h-3 w-3" />
          <Workflow className="h-3 w-3" />
          Workflow
        </button>
        <span className="text-[10px] uppercase tracking-wider text-slate-400">
          Lienzo
        </span>
      </div>
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}

// Strip of tabs — one per artifact of the current turn. Highlights the active
// one and lets the user click back to any previous artifact of THIS turn.
// Hidden when there's a single artifact (nothing to navigate).
function ArtifactTabs({
  artifacts,
  activeId,
  onSelect,
  onClose,
}: {
  artifacts: CanvasArtifact[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
}) {
  if (artifacts.length === 0) return null;
  return (
    <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-surface-4 bg-surface-2 px-2 py-1.5">
      {artifacts.map((a, i) => {
        const Icon = TYPE_ICON[a.type] ?? FileText;
        const active = a.id === activeId;
        return (
          <div
            key={a.id}
            className={`group inline-flex max-w-[220px] items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
              active
                ? "border-brand-500 bg-brand-500/10 text-brand-700"
                : "border-surface-4 bg-white text-slate-600 hover:bg-surface-3 hover:text-slate-900"
            }`}
          >
            <button
              type="button"
              onClick={() => onSelect(a.id)}
              title={a.label}
              className="inline-flex items-center gap-1.5 min-w-0"
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{a.label}</span>
              <span
                className={`shrink-0 text-[10px] tabular-nums ${
                  active ? "text-brand-500" : "text-slate-400"
                }`}
              >
                {i + 1}
              </span>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose(a.id);
              }}
              title="Cerrar pestaña"
              className="ml-1 shrink-0 rounded p-0.5 opacity-0 group-hover:opacity-100 hover:bg-red-100 hover:text-red-600 transition-all"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

function ArtifactBody({ artifact }: { artifact: CanvasArtifact }) {
  const p = (artifact.payload ?? {}) as Record<string, unknown>;
  switch (artifact.type) {
    case "mermaid":
      return (
        <CanvasWithBack>
          <MermaidCanvas payload={p as never} />
        </CanvasWithBack>
      );
    case "code":
      return (
        <CanvasWithBack>
          <CodeCanvas payload={p as never} />
        </CanvasWithBack>
      );
    case "chart":
      return (
        <CanvasWithBack>
          <RechartsCanvas payload={p as never} />
        </CanvasWithBack>
      );
    case "markdown":
      return (
        <CanvasWithBack>
          <MarkdownCanvas payload={p as never} />
        </CanvasWithBack>
      );
    case "html":
      return (
        <CanvasWithBack>
          <HtmlCanvas payload={p as never} />
        </CanvasWithBack>
      );
    case "workflow":
      return <WorkflowCanvas payload={p as never} />;
    default:
      return (
        <div className="flex h-full items-center justify-center text-sm text-slate-400">
          Tipo de canvas no soportado: {String(artifact.type)}
        </div>
      );
  }
}

export function DynamicCanvas() {
  const artifacts = useWorkspaceStore((s) => s.artifacts);
  const activeArtifactId = useWorkspaceStore((s) => s.activeArtifactId);
  const setActiveArtifact = useWorkspaceStore((s) => s.setActiveArtifact);
  const removeArtifact = useWorkspaceStore((s) => s.removeArtifact);
  const setCanvas = useWorkspaceStore((s) => s.setCanvas);

  const active =
    artifacts.find((a) => a.id === activeArtifactId) ?? artifacts[0] ?? null;

  if (!active) {
    return (
      <div className="flex h-full flex-col bg-surface-1">
        <div className="flex items-center justify-between border-b border-surface-4 px-4 py-2">
          <h2 className="text-sm font-semibold text-slate-900">Lienzo</h2>
          <button
            type="button"
            onClick={() =>
              setCanvas("workflow", { name: "Workflow nuevo", nodes: [], edges: [] })
            }
            className="inline-flex items-center gap-1 rounded-md border border-surface-4 bg-surface-2 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-surface-3 hover:text-slate-900 transition-colors"
            title="Abrir un workflow vacío para editar"
          >
            <Workflow className="h-3 w-3" />
            Abrir Workflow
          </button>
        </div>
        <div className="flex flex-1 items-center justify-center bg-surface-2 text-center text-sm text-slate-400">
          <div>
            <div className="mb-1 font-medium">El lienzo está en espera</div>
            <div className="text-xs">
              El agente lo activa cuando lo necesite (diagrama, código, gráfico, documento).
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-surface-1">
      <ArtifactTabs
        artifacts={artifacts}
        activeId={active.id}
        onSelect={setActiveArtifact}
        onClose={removeArtifact}
      />
      <div className="min-h-0 flex-1">
        <ArtifactBody artifact={active} />
      </div>
    </div>
  );
}
