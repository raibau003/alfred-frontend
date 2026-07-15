import { create } from "zustand";
import type { CanvasType } from "@/lib/opencode/canvas-map";

export type ChatPart =
  | { id: string; type: "text"; text: string }
  | {
      id: string;
      type: "file";
      filename: string;
      mime: string;
      /** Bytes of the underlying file, for the chip's size label. Optional. */
      size?: number;
    }
  | {
      id: string;
      type: "tool";
      toolName: string;
      args: unknown;
      result?: unknown;
      isError?: boolean;
    };

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  parts: ChatPart[];
  pending?: boolean;
}

export interface CanvasState {
  type: CanvasType | null;
  payload: unknown;
}

// One rendered output inside the current turn's canvas. The canvas holds a
// COLLECTION of these (tabs), reset on every new user prompt — so a single
// agent reply that emits a chart + a table + code shows all three as
// navigable tabs instead of overwriting one slot.
export interface CanvasArtifact {
  id: string;
  type: CanvasType;
  payload: unknown;
  label: string;
}

export interface QuestionOption {
  label: string;
  description?: string;
  value?: string;
}

export interface PendingQuestion {
  permissionId: string;
  sessionId: string;
  messageId?: string;
  title: string;
  question?: string;
  options: QuestionOption[];
  allowCustom?: boolean;
}

// "Visual" canvases = anything that's NOT workflow: chart, mermaid, code,
// markdown. Persisted separately so jumping into the workflow doesn't lose
// the last rendered chart/diagram (the user can swap back with one click).
export type VisualCanvasType = Exclude<CanvasType, "workflow">;
export interface VisualCanvasState {
  type: VisualCanvasType;
  payload: unknown;
}

interface WorkspaceState {
  agentId: string | null;
  sessionId: string | null;
  connected: boolean;
  busy: boolean; // true while agent is generating (between prompt and session.idle)
  messages: ChatMessage[];
  // Artifacts of the CURRENT turn (tabs). Reset by send() on every new prompt.
  artifacts: CanvasArtifact[];
  activeArtifactId: string | null;
  // `canvas` is DERIVED from the active artifact (kept as a field for
  // backward-compat with DynamicCanvas / WorkflowCanvas which still read it).
  canvas: CanvasState;
  lastVisualCanvas: VisualCanvasState | null;
  pendingQuestion: PendingQuestion | null;
  // Queue of prompts requested from anywhere in the app (eg. WorkflowCanvas
  // "Ejecutar"). useWorkspace consumes and forwards to session.prompt.
  pendingPrompt: string | null;

  setAgent: (agentId: string | null) => void;
  setSession: (sessionId: string | null) => void;
  setConnected: (connected: boolean) => void;
  setBusy: (busy: boolean) => void;

  appendMessage: (msg: ChatMessage) => void;
  upsertMessage: (msg: ChatMessage) => void;
  replaceOptimistic: (optimisticId: string, real: ChatMessage) => void;
  replaceMessages: (msgs: ChatMessage[]) => void;
  upsertPart: (messageId: string, role: "user" | "assistant", part: ChatPart) => void;

  // --- Canvas as a collection of artifacts (tabs) ---
  // Push a new artifact and make it active (called by show_* tools).
  pushArtifact: (type: CanvasType, payload: unknown, label?: string) => void;
  // Refine the LAST artifact of `type` in place (update_chart/update_code/…).
  // Falls back to pushing one if none of that type exists yet in the turn.
  updateArtifactOfType: (
    type: CanvasType,
    mutator: (current: unknown) => unknown,
  ) => void;
  setActiveArtifact: (id: string) => void;
  // Remove a single artifact by id (user closes a tab with the X button).
  removeArtifact: (id: string) => void;
  // Empty the canvas (called by clear_canvas).
  resetArtifacts: () => void;

  // --- Back-compat surface (still used by DynamicCanvas/WorkflowCanvas) ---
  // setCanvas now upserts a single artifact of that type and activates it.
  setCanvas: (type: CanvasType | null, payload: unknown) => void;
  // updateCanvas refines the ACTIVE artifact in place.
  updateCanvas: (mutator: (current: unknown) => unknown) => void;
  clearCanvas: () => void;

  setPendingQuestion: (q: PendingQuestion | null) => void;
  requestPrompt: (text: string) => void;
  consumePendingPrompt: () => string | null;

  // Atomic per-agent reset. The store is a global singleton, so navigating
  // A→B must wipe all session-scoped state (messages, canvas, pending HITL,
  // session id) to avoid a zombie answer being routed to the wrong pod.
  // pendingPrompt is preserved (it's a cross-app request queue, not session
  // state).
  resetSession: () => void;
}

// Human-readable, numbered label for a new artifact. If the tool args carry a
// title/name/caption we use it; otherwise we name it by type and number it
// when there's already another artifact of the same type in the turn.
const TYPE_LABEL: Record<CanvasType, string> = {
  mermaid: "Diagrama",
  chart: "Gráfico",
  code: "Código",
  markdown: "Documento",
  html: "Reporte",
  workflow: "Workflow",
};

function deriveLabel(
  type: CanvasType,
  payload: unknown,
  existing: CanvasArtifact[],
): string {
  const p = (payload ?? {}) as Record<string, unknown>;
  const explicit = p.title ?? p.name ?? p.caption;
  if (typeof explicit === "string" && explicit.trim().length > 0) {
    return explicit.trim();
  }
  const base = TYPE_LABEL[type];
  const sameType = existing.filter((a) => a.type === type).length;
  return sameType > 0 ? `${base} ${sameType + 1}` : base;
}

// Project the active artifact onto the legacy `canvas` field + lastVisualCanvas
// so every consumer that still reads `canvas` keeps working unchanged.
function deriveCanvas(
  artifacts: CanvasArtifact[],
  activeId: string | null,
  prevLastVisual: VisualCanvasState | null,
): Pick<WorkspaceState, "canvas" | "lastVisualCanvas"> {
  const active = artifacts.find((a) => a.id === activeId) ?? null;
  if (!active) {
    return { canvas: { type: null, payload: null }, lastVisualCanvas: prevLastVisual };
  }
  const canvas: CanvasState = { type: active.type, payload: active.payload };
  const lastVisualCanvas =
    active.type !== "workflow"
      ? { type: active.type as VisualCanvasType, payload: active.payload }
      : prevLastVisual;
  return { canvas, lastVisualCanvas };
}

let artifactSeq = 0;
function nextArtifactId(): string {
  artifactSeq += 1;
  return `art-${Date.now()}-${artifactSeq}`;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  agentId: null,
  sessionId: null,
  connected: false,
  busy: false,
  messages: [],
  artifacts: [],
  activeArtifactId: null,
  canvas: { type: null, payload: null },
  lastVisualCanvas: null,
  pendingQuestion: null,
  pendingPrompt: null,

  setAgent: (agentId) => set({ agentId }),
  setSession: (sessionId) => set({ sessionId }),
  setConnected: (connected) => set({ connected }),
  setBusy: (busy) => set({ busy }),

  appendMessage: (msg) =>
    set((s) => ({ messages: [...s.messages, msg] })),

  upsertMessage: (msg) =>
    set((s) => {
      const idx = s.messages.findIndex((m) => m.id === msg.id);
      if (idx === -1) return { messages: [...s.messages, msg] };
      const next = s.messages.slice();
      next[idx] = { ...next[idx], ...msg, parts: msg.parts.length ? msg.parts : next[idx].parts };
      return { messages: next };
    }),

  // Reconciles the optimistic user message (id starts with "u-") with the echo
  // emitted by the server. The server's `message.updated` for a user turn
  // arrives with EMPTY parts (text comes later, or never, for the user echo),
  // so matching by text is unreliable and used to spawn a duplicate empty
  // "shell" bubble. Instead we adopt the server id onto the LAST pending
  // optimistic user message and PRESERVE its text parts (unless the server
  // actually sent content, in which case the server wins).
  replaceOptimistic: (_optimisticId, real) =>
    set((s) => {
      // If this server id is already in the list, just merge onto it.
      const existing = s.messages.findIndex((m) => m.id === real.id);
      if (existing !== -1) {
        const next = s.messages.slice();
        next[existing] = {
          ...next[existing],
          ...real,
          parts: real.parts.length ? real.parts : next[existing].parts,
        };
        return { messages: next };
      }

      // Find the most recent un-reconciled optimistic user message.
      let idx = -1;
      for (let i = s.messages.length - 1; i >= 0; i--) {
        const m = s.messages[i];
        if (m.role === "user" && m.id.startsWith("u-")) {
          idx = i;
          break;
        }
      }
      if (idx === -1) {
        // No optimistic to reconcile — only append if the echo has content,
        // otherwise drop it so we never render an empty shell.
        if (!real.parts.length) return s;
        return { messages: [...s.messages, real] };
      }
      const next = s.messages.slice();
      next[idx] = {
        ...next[idx],
        id: real.id, // adopt the canonical server id
        role: real.role,
        // Keep the optimistic text unless the server echo carries content.
        parts: real.parts.length ? real.parts : next[idx].parts,
      };
      return { messages: next };
    }),

  replaceMessages: (messages) => set({ messages }),

  upsertPart: (messageId, role, part) =>
    set((s) => {
      const msgIdx = s.messages.findIndex((m) => m.id === messageId);
      let messages = s.messages;
      if (msgIdx === -1) {
        messages = [...messages, { id: messageId, role, parts: [part] }];
        return { messages };
      }
      const msg = messages[msgIdx];
      const partIdx = msg.parts.findIndex((p) => p.id === part.id);
      const nextParts =
        partIdx === -1
          ? [...msg.parts, part]
          : msg.parts.map((p, i) => (i === partIdx ? part : p));
      messages = messages.map((m, i) =>
        i === msgIdx ? { ...m, parts: nextParts } : m
      );
      return { messages };
    }),

  pushArtifact: (type, payload, label) =>
    set((s) => {
      const artifact: CanvasArtifact = {
        id: nextArtifactId(),
        type,
        payload,
        label: label ?? deriveLabel(type, payload, s.artifacts),
      };
      const artifacts = [...s.artifacts, artifact];
      const activeArtifactId = artifact.id;
      return {
        artifacts,
        activeArtifactId,
        ...deriveCanvas(artifacts, activeArtifactId, s.lastVisualCanvas),
      };
    }),

  updateArtifactOfType: (type, mutator) =>
    set((s) => {
      // Find the LAST artifact of this type and refine it in place.
      let idx = -1;
      for (let i = s.artifacts.length - 1; i >= 0; i--) {
        if (s.artifacts[i].type === type) {
          idx = i;
          break;
        }
      }
      if (idx === -1) {
        // No artifact of this type yet in the turn — promote the update to a
        // push so the refinement still becomes visible.
        const artifact: CanvasArtifact = {
          id: nextArtifactId(),
          type,
          payload: mutator(undefined),
          label: deriveLabel(type, undefined, s.artifacts),
        };
        const artifacts = [...s.artifacts, artifact];
        return {
          artifacts,
          activeArtifactId: artifact.id,
          ...deriveCanvas(artifacts, artifact.id, s.lastVisualCanvas),
        };
      }
      const artifacts = s.artifacts.slice();
      const target = artifacts[idx];
      artifacts[idx] = { ...target, payload: mutator(target.payload) };
      // Activate the refined artifact so the user sees the update land.
      const activeArtifactId = artifacts[idx].id;
      return {
        artifacts,
        activeArtifactId,
        ...deriveCanvas(artifacts, activeArtifactId, s.lastVisualCanvas),
      };
    }),

  setActiveArtifact: (id) =>
    set((s) => {
      if (!s.artifacts.some((a) => a.id === id)) return s;
      return {
        activeArtifactId: id,
        ...deriveCanvas(s.artifacts, id, s.lastVisualCanvas),
      };
    }),

  removeArtifact: (id) =>
    set((s) => {
      const artifacts = s.artifacts.filter((a) => a.id !== id);
      // If we removed the active tab, activate the last remaining one (or null).
      let activeArtifactId = s.activeArtifactId;
      if (activeArtifactId === id) {
        activeArtifactId = artifacts.length > 0 ? artifacts[artifacts.length - 1].id : null;
      }
      return {
        artifacts,
        activeArtifactId,
        ...deriveCanvas(artifacts, activeArtifactId, s.lastVisualCanvas),
      };
    }),

  resetArtifacts: () =>
    set((s) => ({
      artifacts: [],
      activeArtifactId: null,
      canvas: { type: null, payload: null },
      lastVisualCanvas: s.lastVisualCanvas,
    })),

  // --- Back-compat surface ---
  // Upsert a single artifact of `type` (used to open/return-to the workflow
  // and the "back to last visual" jump). If an artifact of this type already
  // exists in the turn we update it in place rather than stacking duplicates.
  setCanvas: (type, payload) =>
    set((s) => {
      if (type === null) {
        return {
          artifacts: [],
          activeArtifactId: null,
          canvas: { type: null, payload: null },
          lastVisualCanvas: s.lastVisualCanvas,
        };
      }
      let idx = -1;
      for (let i = s.artifacts.length - 1; i >= 0; i--) {
        if (s.artifacts[i].type === type) {
          idx = i;
          break;
        }
      }
      let artifacts: CanvasArtifact[];
      let activeArtifactId: string;
      if (idx === -1) {
        const artifact: CanvasArtifact = {
          id: nextArtifactId(),
          type,
          payload,
          label: deriveLabel(type, payload, s.artifacts),
        };
        artifacts = [...s.artifacts, artifact];
        activeArtifactId = artifact.id;
      } else {
        artifacts = s.artifacts.slice();
        artifacts[idx] = { ...artifacts[idx], payload };
        activeArtifactId = artifacts[idx].id;
      }
      return {
        artifacts,
        activeArtifactId,
        ...deriveCanvas(artifacts, activeArtifactId, s.lastVisualCanvas),
      };
    }),

  updateCanvas: (mutator) =>
    set((s) => {
      if (!s.activeArtifactId) return s;
      const idx = s.artifacts.findIndex((a) => a.id === s.activeArtifactId);
      if (idx === -1) return s;
      const artifacts = s.artifacts.slice();
      artifacts[idx] = {
        ...artifacts[idx],
        payload: mutator(artifacts[idx].payload),
      };
      return {
        artifacts,
        ...deriveCanvas(artifacts, s.activeArtifactId, s.lastVisualCanvas),
      };
    }),

  clearCanvas: () =>
    set((s) => ({
      artifacts: [],
      activeArtifactId: null,
      canvas: { type: null, payload: null },
      lastVisualCanvas: s.lastVisualCanvas,
    })),

  setPendingQuestion: (pendingQuestion) => set({ pendingQuestion }),

  resetSession: () =>
    set({
      sessionId: null,
      connected: false,
      busy: false,
      messages: [],
      artifacts: [],
      activeArtifactId: null,
      canvas: { type: null, payload: null },
      lastVisualCanvas: null,
      pendingQuestion: null,
    }),

  requestPrompt: (text) => set({ pendingPrompt: text }),
  consumePendingPrompt: (): string | null => {
    let captured: string | null = null;
    set((s) => {
      captured = s.pendingPrompt;
      return s.pendingPrompt ? { pendingPrompt: null } : s;
    });
    return captured;
  },
}));
