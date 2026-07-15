"use client";

import { useCallback, useMemo, useState, DragEvent } from "react";
import { toast } from "sonner";
import { ArrowRight, Check, LayoutDashboard, Lock, Pencil, Play, X } from "lucide-react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  applyNodeChanges,
  type Node,
  type Edge,
  type NodeChange,
  type EdgeChange,
  type Connection,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useWorkflowStore } from "@/stores/workflowStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { CatalogSidebar } from "@/components/workspace/workflow/CatalogSidebar";
import { WorkflowNodeView } from "@/components/workspace/workflow/WorkflowNodeView";
import { NodeInspector } from "@/components/workspace/workflow/NodeInspector";
import { buildWorkflowRunPrompt } from "@/lib/workflow/sync";
import type { CatalogBlock, WorkflowNode, WorkflowEdge } from "@/lib/workflow/types";

interface WorkflowPayload {
  workflow_id?: string;
  name?: string;
  nodes?: WorkflowNode[];
  edges?: WorkflowEdge[];
}

type Mode = "read" | "edit";

const nodeTypes = { workflowNode: WorkflowNodeView };

function labelForVisualCanvas(
  type: "chart" | "mermaid" | "code" | "markdown" | "html",
): string {
  switch (type) {
    case "chart": return "Gráfico";
    case "mermaid": return "Diagrama";
    case "code": return "Código";
    case "markdown": return "Documento";
    case "html": return "Reporte";
  }
}

export function WorkflowCanvas({ payload }: { payload?: WorkflowPayload }) {
  return (
    <ReactFlowProvider>
      <WorkflowCanvasInner payload={payload} />
    </ReactFlowProvider>
  );
}

function WorkflowCanvasInner({ payload }: { payload?: WorkflowPayload }) {
  const workflow = useWorkflowStore((s) => s.workflow);
  const setWorkflow = useWorkflowStore((s) => s.setWorkflow);
  const addNode = useWorkflowStore((s) => s.addNode);
  const removeNode = useWorkflowStore((s) => s.removeNode);
  const addEdge = useWorkflowStore((s) => s.addEdge);
  const removeEdge = useWorkflowStore((s) => s.removeEdge);
  const updateNode = useWorkflowStore((s) => s.updateNode);
  const clearCanvas = useWorkspaceStore((s) => s.clearCanvas);
  const setCanvas = useWorkspaceStore((s) => s.setCanvas);
  const lastVisualCanvas = useWorkspaceStore((s) => s.lastVisualCanvas);
  const requestPrompt = useWorkspaceStore((s) => s.requestPrompt);

  const [mode, setMode] = useState<Mode>("read");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const isEdit = mode === "edit";

  const startRename = useCallback(() => {
    if (!workflow) return;
    setNameDraft(workflow.name);
    setEditingName(true);
  }, [workflow]);

  const commitRename = useCallback(() => {
    if (!workflow) return;
    const next = nameDraft.trim() || workflow.name;
    if (next !== workflow.name) {
      setWorkflow({ ...workflow, name: next, updatedAt: Date.now() });
    }
    setEditingName(false);
  }, [workflow, nameDraft, setWorkflow]);

  const toggleMode = useCallback(() => {
    setMode((prev) => {
      const next: Mode = prev === "read" ? "edit" : "read";
      toast.info(
        next === "edit" ? "Modo edición activado" : "Modo lectura activado",
        {
          description:
            next === "edit"
              ? "Arrastrá bloques desde el sidebar y conectalos."
              : "Sólo lectura. El agente puede seguir modificando el flujo.",
          duration: 1800,
        }
      );
      return next;
    });
  }, []);

  // If the agent emits a `show_workflow` payload, hydrate the store with it.
  useMemo(() => {
    if (payload?.workflow_id && (!workflow || workflow.id !== payload.workflow_id)) {
      // El schema del MCP descarta el `intent` top-level; el agente lo manda dentro
      // de `config.intent` (campo pass-through). Lo promovemos a `node.intent` para
      // que el nodo sea ejecutable y no quede en amber "falta intención".
      const nodes = (payload.nodes ?? []).map((n) => {
        const cfg = (n.config ?? {}) as Record<string, unknown>;
        const cfgIntent = typeof cfg.intent === "string" ? (cfg.intent as string) : undefined;
        const intent = n.intent && n.intent.trim().length > 0 ? n.intent : cfgIntent;
        return intent ? { ...n, intent } : n;
      });
      setWorkflow({
        id: payload.workflow_id,
        name: payload.name ?? "Workflow",
        version: 1,
        nodes,
        edges: payload.edges ?? [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload?.workflow_id]);

  // ── React Flow proxies ─────────────────────────────────────────────────

  const rfNodes: Node[] = useMemo(
    () =>
      (workflow?.nodes ?? []).map((n) => ({
        id: n.id,
        type: "workflowNode",
        position: n.position,
        data: { node: n, editable: isEdit },
        draggable: isEdit,
        selectable: true,
        deletable: isEdit,
      })),
    [workflow?.nodes, isEdit]
  );

  const rfEdges: Edge[] = useMemo(
    () =>
      (workflow?.edges ?? []).map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.label,
      })),
    [workflow?.edges]
  );

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      if (!isEdit) return;
      const updated = applyNodeChanges(changes, rfNodes);
      for (const change of changes) {
        if (change.type === "remove") {
          removeNode(change.id);
        } else if (change.type === "position" && change.position) {
          const next = updated.find((n) => n.id === change.id);
          if (next) updateNode(change.id, { position: next.position });
        }
      }
    },
    [rfNodes, removeNode, updateNode, isEdit]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      if (!isEdit) return;
      for (const change of changes) {
        if (change.type === "remove") removeEdge(change.id);
      }
    },
    [removeEdge, isEdit]
  );

  const onConnect = useCallback(
    (conn: Connection) => {
      if (!isEdit) return;
      if (!conn.source || !conn.target) return;
      const id = `edge-${Date.now()}`;
      addEdge({
        id,
        source: conn.source,
        target: conn.target,
        sourceHandle: conn.sourceHandle ?? undefined,
        targetHandle: conn.targetHandle ?? undefined,
      });
    },
    [addEdge, isEdit]
  );

  // ── Drag & drop desde la sidebar ───────────────────────────────────────

  const onDragOver = useCallback(
    (e: DragEvent) => {
      if (!isEdit) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    },
    [isEdit]
  );

  const onDrop = useCallback(
    (e: DragEvent, rfInstance?: ReactFlowInstance) => {
      if (!isEdit) return;
      e.preventDefault();
      const raw = e.dataTransfer.getData("application/merlina-block");
      if (!raw) return;
      const block: CatalogBlock = JSON.parse(raw);

      const flowPos = rfInstance?.screenToFlowPosition
        ? rfInstance.screenToFlowPosition({ x: e.clientX, y: e.clientY })
        : { x: e.clientX, y: e.clientY };

      const newNode: WorkflowNode = {
        id: `node-${Date.now()}`,
        blockId: block.id,
        kind: block.kind,
        label: block.label,
        config: {},
        position: flowPos,
        status: "idle",
      };

      if (!workflow) {
        setWorkflow({
          id: `wf-${Date.now()}`,
          name: "Workflow nuevo",
          version: 1,
          nodes: [newNode],
          edges: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      } else {
        addNode(newNode);
      }
    },
    [workflow, addNode, setWorkflow, isEdit]
  );

  const handleRun = useCallback(() => {
    if (!workflow || workflow.nodes.length === 0) {
      toast.warning("No hay nodos para ejecutar");
      return;
    }
    const missing = workflow.nodes.filter(
      (n) => !n.intent || n.intent.trim().length === 0
    );
    if (missing.length > 0) {
      toast.warning(
        `Falta intención en ${missing.length} nodo${missing.length > 1 ? "s" : ""}`,
        { description: "Hacé click en cada nodo en amber y describí qué tiene que hacer." }
      );
      return;
    }

    // El workflow completo (nodos con intent/kind/config + edges) ya llega como
    // <workflow_context> JSON en cada mensaje (ver attachWorkflowContext en useWorkspace).
    // El playbook explica cómo interpretar <workflow_run>. El body queda mínimo.
    const body =
      "Ejecutá este workflow. Respetá el orden de las conexiones. " +
      "Si falta info → `question`, no asumas. Reportá el estado de cada nodo " +
      "con `set_workflow_node_status` y resumí en 2 líneas al final.";

    requestPrompt(buildWorkflowRunPrompt(workflow, body));
    toast.info("Ejecución pedida", {
      description: "Mirá el chat para ver el progreso.",
      duration: 2000,
    });
  }, [workflow, requestPrompt]);

  return (
    <div
      className={`flex h-full flex-col bg-surface-1 transition-all duration-200 ease-out ${
        isEdit ? "ring-1 ring-inset ring-brand-500/40" : ""
      }`}
    >
      <div className="flex items-center justify-between border-b border-surface-4 px-4 py-2">
        <div className="flex items-center gap-3">
          {editingName && workflow ? (
            <div className="flex items-center gap-1">
              <input
                autoFocus
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitRename();
                  if (e.key === "Escape") setEditingName(false);
                }}
                className="w-56 rounded-md border border-brand-500 bg-surface-1 px-2 py-0.5 text-sm font-semibold text-slate-900 focus:outline-none"
              />
              <button
                type="button"
                onClick={commitRename}
                className="inline-flex h-6 w-6 items-center justify-center rounded-md text-brand-600 hover:bg-brand-500/10"
                title="Aceptar"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <h2
              onClick={isEdit ? startRename : undefined}
              className={`text-sm font-semibold text-slate-900 ${
                isEdit ? "cursor-text rounded-md px-1 hover:bg-surface-3" : ""
              }`}
              title={isEdit ? "Click para renombrar" : undefined}
            >
              {workflow?.name ?? "Workflow Builder"}
            </h2>
          )}
          {isEdit && (
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-700 animate-pulse">
              <Pencil className="h-3 w-3" />
              Editando
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="text-[10px] uppercase tracking-wider text-slate-400">
            {workflow
              ? `${workflow.nodes.length} nodos · ${workflow.edges.length} conexiones`
              : "Vacío"}
          </div>

          {lastVisualCanvas && (
            <button
              type="button"
              onClick={() =>
                setCanvas(lastVisualCanvas.type, lastVisualCanvas.payload)
              }
              className="inline-flex items-center gap-1 rounded-md border border-surface-4 bg-surface-2 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-surface-3 hover:text-slate-900 transition-colors"
              title={`Volver al último ${labelForVisualCanvas(lastVisualCanvas.type)}`}
            >
              <LayoutDashboard className="h-3 w-3" />
              {labelForVisualCanvas(lastVisualCanvas.type)}
              <ArrowRight className="h-3 w-3" />
            </button>
          )}

          <button
            type="button"
            onClick={handleRun}
            disabled={!workflow || workflow.nodes.length === 0}
            className="inline-flex items-center gap-1 rounded-md border border-surface-4 bg-surface-2 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-surface-3 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
            title="Ejecutar workflow"
          >
            <Play className="h-3 w-3" />
            Ejecutar
          </button>

          <button
            type="button"
            onClick={toggleMode}
            className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors ${
              isEdit
                ? "border-brand-500 bg-brand-500/10 text-brand-700 hover:bg-brand-500/20"
                : "border-surface-4 bg-surface-2 text-slate-600 hover:bg-surface-3 hover:text-slate-900"
            }`}
            title={isEdit ? "Cambiar a modo lectura" : "Cambiar a modo edición"}
          >
            {isEdit ? (
              <>
                <Pencil className="h-3 w-3" />
                Edición
              </>
            ) : (
              <>
                <Lock className="h-3 w-3" />
                Lectura
              </>
            )}
          </button>

          <button
            type="button"
            onClick={clearCanvas}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-surface-3 hover:text-slate-900 transition-colors"
            title="Cerrar workflow"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        <div
          className={`flex h-full shrink-0 overflow-hidden border-r border-surface-4 transition-all duration-200 ease-out ${
            isEdit ? "w-64" : "w-0 border-r-0"
          }`}
        >
          {isEdit && <CatalogSidebar />}
        </div>

        <div
          className={`relative flex-1 ${isEdit ? "cursor-grab" : ""}`}
          onDragOver={onDragOver}
          onDrop={(e) => onDrop(e)}
        >
          <ReactFlow
            nodes={rfNodes}
            edges={rfEdges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodesDraggable={isEdit}
            nodesConnectable={isEdit}
            edgesFocusable={isEdit}
            elementsSelectable={true}
            deleteKeyCode={isEdit ? ["Backspace", "Delete"] : null}
            onNodeClick={(_, n) => setSelectedNodeId(n.id)}
            onPaneClick={() => setSelectedNodeId(null)}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={16} />
            <Controls showInteractive={false} />
            <MiniMap pannable zoomable />
          </ReactFlow>

          {workflow && workflow.nodes.length === 0 && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-center text-sm text-slate-400">
              <div>
                <div className="mb-1 font-medium">Lienzo vacío</div>
                <div className="text-xs">
                  {isEdit
                    ? "Arrastrá building blocks desde el sidebar."
                    : "Pedile al agente que arme el flujo, o activá Edición."}
                </div>
              </div>
            </div>
          )}

          {!workflow && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-center text-sm text-slate-400">
              <div>
                <div className="mb-1 font-medium">Workflow Builder</div>
                <div className="text-xs">
                  {isEdit ? (
                    <>
                      Arrastrá un bloque desde el sidebar para empezar.<br />
                      El agente también puede armar el flujo desde el chat.
                    </>
                  ) : (
                    <>
                      Pedile al agente que arme el flujo desde el chat,<br />
                      o activá Edición para armarlo vos.
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {isEdit && selectedNodeId && workflow?.nodes.some((n) => n.id === selectedNodeId) && (
          <NodeInspector nodeId={selectedNodeId} onClose={() => setSelectedNodeId(null)} />
        )}
      </div>
    </div>
  );
}
