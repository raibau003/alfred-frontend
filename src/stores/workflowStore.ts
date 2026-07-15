import { create } from "zustand";
import type {
  Workflow,
  WorkflowNode,
  WorkflowEdge,
  CatalogBlock,
} from "@/lib/workflow/types";

interface WorkflowState {
  // Catálogo de building blocks disponibles (poblado al cargar el workspace).
  catalog: CatalogBlock[];
  setCatalog: (blocks: CatalogBlock[]) => void;

  // Workflow actual en el canvas. Si null, el canvas está en estado vacío.
  workflow: Workflow | null;
  setWorkflow: (wf: Workflow | null) => void;

  // Mutaciones granulares — usadas por handlers de React Flow y por el agent.
  addNode: (node: WorkflowNode) => void;
  updateNode: (id: string, patch: Partial<WorkflowNode>) => void;
  removeNode: (id: string) => void;

  addEdge: (edge: WorkflowEdge) => void;
  removeEdge: (id: string) => void;

  // Status per-node — para visualizar ejecución.
  setNodeStatus: (id: string, status: WorkflowNode["status"], result?: unknown) => void;

  // Reset
  clear: () => void;
}

export const useWorkflowStore = create<WorkflowState>((set) => ({
  catalog: [],
  setCatalog: (catalog) => set({ catalog }),

  workflow: null,
  setWorkflow: (workflow) => set({ workflow }),

  addNode: (node) =>
    set((s) => {
      if (!s.workflow) return s;
      return {
        workflow: {
          ...s.workflow,
          nodes: [...s.workflow.nodes, node],
          updatedAt: Date.now(),
        },
      };
    }),

  updateNode: (id, patch) =>
    set((s) => {
      if (!s.workflow) return s;
      return {
        workflow: {
          ...s.workflow,
          nodes: s.workflow.nodes.map((n) =>
            n.id === id ? { ...n, ...patch } : n
          ),
          updatedAt: Date.now(),
        },
      };
    }),

  removeNode: (id) =>
    set((s) => {
      if (!s.workflow) return s;
      return {
        workflow: {
          ...s.workflow,
          nodes: s.workflow.nodes.filter((n) => n.id !== id),
          edges: s.workflow.edges.filter(
            (e) => e.source !== id && e.target !== id
          ),
          updatedAt: Date.now(),
        },
      };
    }),

  addEdge: (edge) =>
    set((s) => {
      if (!s.workflow) return s;
      return {
        workflow: {
          ...s.workflow,
          edges: [...s.workflow.edges, edge],
          updatedAt: Date.now(),
        },
      };
    }),

  removeEdge: (id) =>
    set((s) => {
      if (!s.workflow) return s;
      return {
        workflow: {
          ...s.workflow,
          edges: s.workflow.edges.filter((e) => e.id !== id),
          updatedAt: Date.now(),
        },
      };
    }),

  setNodeStatus: (id, status, result) =>
    set((s) => {
      if (!s.workflow) return s;
      return {
        workflow: {
          ...s.workflow,
          nodes: s.workflow.nodes.map((n) =>
            n.id === id ? { ...n, status, result } : n
          ),
          updatedAt: Date.now(),
        },
      };
    }),

  clear: () => set({ workflow: null }),
}));
