"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { toast } from "sonner";
import { clientForAgent, agentBaseUrl } from "@/lib/opencode/client";
import {
  uploadAttachmentToWorkspace,
  formatBytes,
} from "@/lib/opencode/attachments";
import {
  bareToolName,
  canvasTypeForTool,
  isArtifactUpdater,
  isWorkflowMutator,
} from "@/lib/opencode/canvas-map";
import { fetchPodCatalog } from "@/lib/workflow/catalog";
import { attachWorkflowContext } from "@/lib/workflow/sync";
import type { WorkflowEdge, WorkflowNode } from "@/lib/workflow/types";
import {
  useWorkspaceStore,
  type ChatPart,
  type PendingQuestion,
  type QuestionOption,
} from "@/stores/workspaceStore";
import { useWorkflowStore } from "@/stores/workflowStore";
import type { SendAttachment } from "@/components/workspace/MessageInput";

// Workflow-store mutators come from MCP tools (canvas_*). They update
// useWorkflowStore directly and do NOT switch the active canvas slot, so a
// running workflow can keep narrating progress without stealing the canvas
// from a concurrent chart/diagram output.
function applyWorkflowMutation(
  bareName: string,
  args: Record<string, unknown>,
): void {
  const store = useWorkflowStore.getState();
  switch (bareName) {
    case "add_workflow_node":
      store.addNode(args as unknown as WorkflowNode);
      return;
    case "connect_workflow_nodes": {
      const edges = (args.edges as WorkflowEdge[] | undefined) ?? [];
      for (const e of edges) store.addEdge(e);
      return;
    }
    case "update_workflow_node": {
      const id = (args.id ?? args.node_id) as string | undefined;
      if (id) store.updateNode(id, args as Partial<WorkflowNode>);
      return;
    }
    case "remove_workflow_node":
      store.removeNode(args.node_id as string);
      return;
    case "set_workflow_node_status":
      store.setNodeStatus(
        args.node_id as string,
        args.status as WorkflowNode["status"],
        args.result,
      );
      return;
    case "save_workflow":
      // Pure persistence on the pod (/home/agent/sandbox/workflows/{name}.json).
      // Nothing to do on the frontend.
      return;
  }
}

interface UseWorkspaceArgs {
  agentId: string;
  sessionId?: string;
}

export function useWorkspace({ agentId, sessionId: incomingSid }: UseWorkspaceArgs) {
  const [bootstrapping, setBootstrapping] = useState(true);

  const {
    setAgent,
    setSession,
    setConnected,
    setBusy,
    appendMessage,
    upsertMessage,
    upsertPart,
    replaceOptimistic,
    replaceMessages,
    pushArtifact,
    updateArtifactOfType,
    updateCanvas,
    resetArtifacts,
    setPendingQuestion,
    resetSession,
  } = useWorkspaceStore();

  const sidRef = useRef<string | null>(null);
  const clientRef = useRef<ReturnType<typeof clientForAgent> | null>(null);

  useEffect(() => {
    let cancelled = false;
    // P1-9: wipe any session-scoped state inherited from a previously mounted
    // agent BEFORE we start bootstrapping this one. Otherwise B would inherit
    // A's messages/canvas/pending HITL (and a reply could hit the wrong pod).
    resetSession();
    sidRef.current = null;
    // P1-4: own abort controller for the SSE stream + reconnect loop so the
    // detached fetch is actually torn down on remount / agent change.
    const abort = new AbortController();
    setAgent(agentId);
    const client = clientForAgent(agentId);
    clientRef.current = client;

    (async () => {
      try {
        setBootstrapping(true);

        // Catalog of building blocks for the workflow canvas — fetched in
        // parallel with session bootstrap. Failures are non-fatal.
        fetchPodCatalog(client as never, agentBaseUrl(agentId))
          .then((catalog) => {
            if (!cancelled) useWorkflowStore.getState().setCatalog(catalog);
          })
          .catch(() => {
            /* sidebar will stay empty — non-blocking */
          });

        let sid = incomingSid ?? null;
        if (!sid) {
          const created = await client.session.create({
            body: { title: `Workspace ${new Date().toISOString()}` },
          });
          sid = pickId(created);
        }
        if (!sid) throw new Error("Could not resolve a session id from the pod");
        if (cancelled) return;
        sidRef.current = sid;
        setSession(sid);

        try {
          const history = await client.session.messages({ path: { id: sid } });
          const items = unwrapData<unknown[]>(history) ?? [];
          replaceMessages(
            items
              .map((raw) => normaliseHistoryItem(raw))
              .filter((m): m is NonNullable<typeof m> => m !== null)
          );
        } catch {
          /* empty session OK */
        }

        const evt = (await client.global.event({
          signal: abort.signal,
        } as never)) as unknown as {
          stream: AsyncIterable<{
            directory?: string;
            payload?: {
              type: string;
              properties?: Record<string, unknown>;
            };
          }>;
        };
        setConnected(true);
        setBootstrapping(false);

        for await (const wrapper of evt.stream) {
          if (cancelled) break;
          const e = wrapper?.payload;
          if (!e?.type) continue;
          handleEvent(e, sidRef.current);
        }
      } catch (e) {
        // P1-4: an AbortController.abort() can surface as an AbortError /
        // DOMException through the awaited fetch or the for-await loop. That's
        // an intentional teardown, not a failure — swallow it.
        const isAbort =
          abort.signal.aborted ||
          (e instanceof Error && e.name === "AbortError");
        if (!cancelled && !isAbort) {
          const msg = e instanceof Error ? e.message : String(e);
          toast.error("No se pudo conectar con el agente", { description: msg });
        }
        if (!cancelled) {
          setConnected(false);
          // P1-3: the stream died (network drop / abort) before session.idle.
          // Don't leave the UI stuck on "Pensando…" forever.
          setBusy(false);
          setBootstrapping(false);
        }
      } finally {
        if (!cancelled) {
          // P1-3: same guard for the normal end-of-stream path.
          setConnected(false);
          setBusy(false);
        }
      }
    })();

    function handleEvent(
      e: { type: string; properties?: Record<string, unknown> },
      currentSid: string | null
    ) {
      const props = (e.properties ?? {}) as Record<string, unknown>;
      const eventSid =
        (props.sessionID as string | undefined) ??
        ((props.info as { sessionID?: string } | undefined)?.sessionID) ??
        ((props.part as { sessionID?: string } | undefined)?.sessionID);
      if (eventSid && currentSid && eventSid !== currentSid) return;

      switch (e.type) {
        case "message.updated":
          handleMessageUpdated(props);
          break;
        case "message.part.updated":
        case "message.part.delta":
          handleMessagePart(props);
          break;
        case "tool.execution":
        case "tool.execution.completed":
          handleToolCall(props);
          break;
        case "permission.updated":
        case "permission.asked":
          handlePermission(props);
          break;
        case "permission.replied":
          if (
            (props.permissionID as string | undefined) ===
            useWorkspaceStore.getState().pendingQuestion?.permissionId
          ) {
            setPendingQuestion(null);
          }
          break;
        case "question.asked":
          handleQuestionAsked(props);
          break;
        case "question.replied":
        case "question.rejected":
          if (
            (props.id as string | undefined) ===
            useWorkspaceStore.getState().pendingQuestion?.permissionId
          ) {
            setPendingQuestion(null);
          }
          break;
        case "session.status":
          handleSessionStatus(props);
          break;
        case "session.idle":
          setBusy(false);
          break;
        case "session.error":
          setBusy(false);
          toast.error("Error en la sesión", {
            description: String(props.message ?? "ver logs del pod"),
          });
          break;
        default:
          break;
      }
    }

    function handleSessionStatus(props: Record<string, unknown>) {
      // status payload: { type: "idle" | "retry" | "generating" | ... }
      const status =
        (props.type as string | undefined) ??
        ((props.status as { type?: string } | undefined)?.type);
      if (!status) return;
      setBusy(status !== "idle");
    }

    function handleMessageUpdated(props: Record<string, unknown>) {
      const info = (props.info ?? props) as {
        id?: string;
        role?: "user" | "assistant";
      };
      if (!info?.id) return;
      const role = info.role ?? "assistant";
      if (role === "user") {
        replaceOptimistic(info.id, { id: info.id, role, parts: [] });
      } else {
        upsertMessage({ id: info.id, role, parts: [] });
        setBusy(true);
      }
    }

    function handleMessagePart(props: Record<string, unknown>) {
      const part = props.part as
        | {
            id?: string;
            messageID?: string;
            type?: string;
            text?: string;
            tool?: string;
            state?: {
              status?: "pending" | "running" | "completed" | "error";
              input?: unknown;
              output?: unknown;
              error?: unknown;
            };
          }
        | undefined;
      if (!part?.id || !part.messageID) return;

      if (part.type === "text" && typeof part.text === "string") {
        // The server echoes a text-part for the USER turn too. The optimistic
        // user message (see send()) already holds the canonical text-part with
        // a client-side id that will NEVER match this server part id, so a
        // blind upsert appends a SECOND identical text-part -> the user bubble
        // renders the message twice. Guard: if the target message is a user
        // turn that already has a text-part, drop the server echo (the
        // optimistic part is canonical and identical -> no flicker, no dup).
        const target = useWorkspaceStore
          .getState()
          .messages.find((m) => m.id === part.messageID);
        if (target?.role === "user") {
          const hasText = target.parts.some((p) => p.type === "text");
          if (hasText) return;
          // No optimistic text-part (e.g. history/reconnect): keep it, but as a
          // user part — never relabel a user turn as assistant.
          upsertPart(part.messageID, "user", {
            id: part.id,
            type: "text",
            text: part.text,
          });
          return;
        }
        upsertPart(part.messageID, "assistant", {
          id: part.id,
          type: "text",
          text: part.text,
        });
        return;
      }
      if (part.type === "tool" && part.tool) {
        const status = part.state?.status;
        const args =
          (part.state?.input as Record<string, unknown> | undefined) ?? {};

        // Built-in `question` tool: the HITL widget is driven by the
        // `question.asked` event below, not the tool render. Suppress here.
        if (part.tool === "question") return;

        const canvasType = canvasTypeForTool(part.tool);
        if (canvasType !== null) {
          // P1-1: message.part.updated fires on every tool state transition.
          // On `pending`/`running` the `input` is empty or partial, so
          // mounting the canvas then makes it flicker and re-renders Mermaid
          // with half-written code. Only paint the canvas once the tool's
          // input is final.
          if (status === "completed") {
            applyCanvasUpdate(part.tool, args, canvasType);
          }
          return;
        }

        // P1-2: on error the payload lives in state.error (NOT state.output).
        const isError = status === "error";
        upsertPart(part.messageID, "assistant", {
          id: part.id,
          type: "tool",
          toolName: part.tool,
          args,
          result: isError ? part.state?.error : part.state?.output,
          isError,
        });
      }
    }

    function handlePermission(props: Record<string, unknown>) {
      // PermissionRequest shape: { id, sessionID, permission, patterns: string[],
      // metadata: {...}, always: string[], tool?: {messageID, callID} }
      // Older API also exposes { type, title, metadata.{header,question,options} }
      // for the `question` permission. We accept both.
      const id = props.id as string | undefined;
      if (!id) return;

      const meta = (props.metadata ?? {}) as Record<string, unknown>;
      const permissionType =
        (props.permission as string | undefined) ??
        (props.type as string | undefined);
      const patterns = (props.patterns as string[] | undefined) ?? [];
      const tool = (props.tool as { messageID?: string } | undefined) ?? undefined;

      // Options first: prefer ones provided in metadata, otherwise generate
      // the standard once/always/reject set used by OpenCode permissions.
      const rawOptions =
        (meta.options as unknown[] | undefined) ??
        (meta.choices as unknown[] | undefined) ??
        [];
      const options: QuestionOption[] = [];
      for (const o of rawOptions) {
        if (typeof o === "string") {
          options.push({ label: o, value: o });
        } else if (o && typeof o === "object") {
          const obj = o as { label?: string; description?: string; value?: string };
          if (obj.label) {
            options.push({
              label: obj.label,
              description: obj.description,
              value: obj.value ?? obj.label,
            });
          }
        }
      }
      if (options.length === 0 && permissionType && permissionType !== "question") {
        options.push(
          { label: "Permitir una vez", value: "once" },
          { label: "Permitir siempre", value: "always" },
          { label: "Rechazar", value: "reject" },
        );
      }

      // Build human-friendly title + body.
      const friendlyTypeLabel: Record<string, string> = {
        bash: "Ejecutar comando bash",
        write: "Escribir archivo",
        edit: "Editar archivo",
        webfetch: "Acceder a URL externa",
        websearch: "Búsqueda web",
        skill: "Invocar skill",
        task: "Sub-agente",
      };

      const title =
        (props.title as string | undefined) ??
        (meta.header as string | undefined) ??
        (permissionType ? (friendlyTypeLabel[permissionType] ?? `Permiso: ${permissionType}`) : "Permiso requerido");

      // For bash/write/etc., patterns[0] is the command or file path.
      // For `question` permission, body lives in metadata.question.
      const bodyFromMeta =
        (meta.question as string | undefined) ??
        (meta.prompt as string | undefined) ??
        (meta.message as string | undefined) ??
        (meta.text as string | undefined);
      const bodyFromPatterns = patterns.length > 0 ? patterns.join("\n") : undefined;

      const question = bodyFromMeta ?? bodyFromPatterns ??
        (Object.keys(meta).length > 0 ? JSON.stringify(meta, null, 2) : undefined);

      const pending: PendingQuestion = {
        permissionId: id,
        sessionId: (props.sessionID as string | undefined) ?? "",
        messageId:
          tool?.messageID ?? (props.messageID as string | undefined) ?? undefined,
        title,
        question,
        options,
        allowCustom: permissionType === "question" && meta.allowCustom !== false,
      };
      setPendingQuestion(pending);
    }

    function handleQuestionAsked(props: Record<string, unknown>) {
      // QuestionRequest: { id: que_…, sessionID, questions: [QuestionInfo] }
      const id = props.id as string | undefined;
      const questions = props.questions as
        | Array<Record<string, unknown>>
        | undefined;
      if (!id || !questions?.length) return;
      const first = questions[0] ?? {};

      // Tolerant extraction — server fields can be header/question or
      // alternate names depending on the source (skill/tool/permission).
      const header =
        (first.header as string | undefined) ??
        (first.title as string | undefined) ??
        (first.label as string | undefined);
      const questionText =
        (first.question as string | undefined) ??
        (first.prompt as string | undefined) ??
        (first.message as string | undefined) ??
        (first.text as string | undefined);

      const rawOptions = (first.options as Array<Record<string, unknown>> | undefined) ?? [];
      const options: QuestionOption[] = [];
      for (const o of rawOptions) {
        const label = (o.label as string | undefined) ?? (o.value as string | undefined);
        if (!label) continue;
        options.push({
          label,
          description: o.description as string | undefined,
          value: (o.value as string | undefined) ?? label,
        });
      }

      // Last-resort fallback: surface the raw payload so the user can still
      // answer even when the server omitted header/question fields.
      const fallbackBody = !header && !questionText
        ? JSON.stringify(first, null, 2)
        : undefined;

      setPendingQuestion({
        permissionId: id, // que_… — used to call POST /question/{id}/reply
        sessionId: sidRef.current ?? "",
        title: header ?? "Pregunta del agente",
        question: questionText ?? fallbackBody,
        options,
        allowCustom: first.custom !== false,
      });
    }

    function handleToolCall(props: Record<string, unknown>) {
      const toolName =
        (props.name as string | undefined) ??
        (props.tool as string | undefined) ??
        ((props.info as { name?: string } | undefined)?.name);
      if (!toolName) return;
      const args =
        (props.args as Record<string, unknown> | undefined) ??
        ((props.info as { args?: Record<string, unknown> } | undefined)?.args) ??
        {};

      // Workflow mutators update useWorkflowStore in place without switching
      // canvas. Intercept BEFORE the canvas-type lookup so the active slot
      // (e.g. a chart just rendered) survives status/node updates.
      if (isWorkflowMutator(toolName)) {
        applyWorkflowMutation(bareToolName(toolName), args);
        return;
      }

      const canvasType = canvasTypeForTool(toolName);
      if (canvasType === null) {
        appendMessage({
          id: `tool-${Date.now()}`,
          role: "assistant",
          parts: [{ id: `tp-${Date.now()}`, type: "tool", toolName, args }],
        });
        return;
      }
      applyCanvasUpdate(toolName, args, canvasType);
    }

    function applyCanvasUpdate(
      toolName: string,
      args: Record<string, unknown>,
      canvasType: ReturnType<typeof canvasTypeForTool>
    ) {
      const bare = bareToolName(toolName);

      // clear_canvas → wipe the whole turn's canvas.
      if (bare === "clear_canvas") {
        resetArtifacts();
        return;
      }

      // update_canvas → universal updater: refine the ACTIVE artifact in place
      // (shallow-merge the new args onto its payload).
      if (bare === "update_canvas") {
        updateCanvas((current) =>
          typeof current === "object" && current !== null
            ? { ...(current as object), ...args }
            : args
        );
        return;
      }

      // Typed in-place updaters (update_chart / update_code /
      // highlight_code_lines) refine the LAST artifact of their type so a
      // streamed refinement of one chart/code block doesn't create duplicates.
      if (isArtifactUpdater(toolName) && canvasType !== "*" && canvasType) {
        updateArtifactOfType(canvasType, (current) =>
          typeof current === "object" && current !== null
            ? { ...(current as object), ...args }
            : args
        );
        return;
      }

      // show_* tools → push a NEW artifact (a new tab) and activate it.
      if (canvasType && canvasType !== "*") {
        pushArtifact(canvasType, args);
      }
    }

    return () => {
      cancelled = true;
      // P1-4: tear down the live SSE fetch + reconnect loop so we don't leak
      // detached streams (each leak = duplicated events/messages).
      abort.abort();
      setConnected(false);
      setBusy(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId, incomingSid]);

  const send = useCallback(
    async (text: string, attachments?: SendAttachment[]) => {
      if (!clientRef.current || !sidRef.current) return;
      const workflow = useWorkflowStore.getState().workflow;
      const enriched = workflow ? attachWorkflowContext(text, workflow) : text;
      const now = Date.now();
      const optimisticId = `u-${now}`;

      // Optimistic user bubble: the text part (canonical — the server echo is
      // deduped against it) plus a chip per attachment. The file part is a
      // DIFFERENT part type, so it doesn't break the "1 text-part per user
      // bubble" invariant the dedup guard relies on.
      const optimisticParts: ChatPart[] = [];
      if (enriched.trim().length > 0) {
        optimisticParts.push({ id: `part-${now}`, type: "text", text: enriched });
      } else if (attachments && attachments.length > 0) {
        // Attachment-only message: the server STILL echoes a text part (the
        // invisible "[Archivo adjunto guardado en …]" reference we send). Seed
        // an empty canonical text-part so the dedup guard drops that echo and
        // the bubble shows only the file chip — not the path reference.
        optimisticParts.push({ id: `part-${now}`, type: "text", text: "" });
      }
      attachments?.forEach((a, i) => {
        optimisticParts.push({
          id: `file-${now}-${i}`,
          type: "file",
          filename: a.filename,
          mime: a.mime,
          size: a.size,
        });
      });
      appendMessage({ id: optimisticId, role: "user", parts: optimisticParts });

      // Artifacts persist across turns — the user closes tabs manually via the
      // X button. This way previous results (correos, gastos, listas) stay
      // visible while the user keeps chatting.

      setBusy(true);

      // Attachments are written to the pod workspace via the shell channel
      // (0 LLM tokens), NOT inlined into the prompt. The prompt only carries a
      // text reference to each saved path so the agent reads it with pandas.
      const refLines: string[] = [];
      if (attachments && attachments.length > 0) {
        const baseUrl = agentBaseUrl(agentId);
        for (const a of attachments) {
          try {
            const uploaded = await uploadAttachmentToWorkspace(
              baseUrl,
              sidRef.current,
              a,
            );
            refLines.push(
              `\n\n[Archivo adjunto guardado en ./${uploaded.path} ` +
                `(${formatBytes(uploaded.size)}). Leelo con pandas/duckdb desde esa ` +
                `ruta para analizarlo — su contenido NO está en este mensaje.]`,
            );
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            toast.error(`No se pudo subir ${a.filename}`, { description: msg });
            // Surface the failure in-chat without killing the session.
            appendMessage({
              id: `upload-err-${Date.now()}`,
              role: "assistant",
              parts: [
                {
                  id: `uep-${Date.now()}`,
                  type: "text",
                  text: `⚠️ No pude guardar el adjunto **${a.filename}** en el workspace (${msg}). Probá de nuevo.`,
                },
              ],
            });
            setBusy(false);
            return;
          }
        }
      }

      // Build the prompt parts: ONLY text (user text + a reference line per
      // uploaded file). No FilePart — the file lives on disk now.
      const promptText = enriched + refLines.join("");
      if (promptText.trim().length === 0) {
        // Nothing to send (no text, no successful uploads). Bail gracefully.
        setBusy(false);
        return;
      }

      try {
        await clientRef.current.session.promptAsync({
          path: { id: sidRef.current },
          body: { parts: [{ type: "text", text: promptText }] },
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        toast.error("No se pudo enviar el mensaje", { description: msg });
        setBusy(false);
      }
    },
    [appendMessage, setBusy]
  );

  // Consume any pending prompt (eg. from WorkflowCanvas "Ejecutar") once the
  // session is ready. Subscribes to workspaceStore.pendingPrompt changes.
  useEffect(() => {
    const tryConsume = () => {
      const { pendingPrompt, sessionId: sid, busy, consumePendingPrompt } =
        useWorkspaceStore.getState();
      if (!pendingPrompt || !sid || busy) return;
      const text = consumePendingPrompt();
      if (text) void send(text);
    };
    tryConsume();
    const unsub = useWorkspaceStore.subscribe(tryConsume);
    return () => unsub();
  }, [send]);

  const cancel = useCallback(async () => {
    if (!clientRef.current || !sidRef.current) return;
    try {
      await clientRef.current.session.abort({ path: { id: sidRef.current } });
      setBusy(false);
      toast.success("Generación cancelada");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error("No se pudo cancelar", { description: msg });
    }
  }, [setBusy]);

  const replyPermission = useCallback(
    async (permissionId: string, response: string) => {
      if (!clientRef.current || !sidRef.current) return;
      try {
        if (permissionId.startsWith("que_")) {
          // OpenCode's question subsystem: POST /question/{requestID}/reply
          // with body { answers: [[label]] } — one nested array per question.
          // The SDK doesn't surface this endpoint, so we hit the pod directly.
          const url = `${agentBaseUrl(agentId)}/question/${permissionId}/reply`;
          const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ answers: [[response]] }),
          });
          if (!res.ok) {
            throw new Error(`question reply ${res.status}: ${await res.text()}`);
          }
        } else {
          await (
            clientRef.current as unknown as {
              postSessionIdPermissionsPermissionId: (opts: {
                path: { id: string; permissionID: string };
                body: { response: string };
              }) => Promise<unknown>;
            }
          ).postSessionIdPermissionsPermissionId({
            path: { id: sidRef.current, permissionID: permissionId },
            body: { response },
          });
        }
        setPendingQuestion(null);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        toast.error("No se pudo enviar la respuesta", { description: msg });
      }
    },
    [agentId, setPendingQuestion]
  );

  return { send, cancel, replyPermission, bootstrapping };
}

function unwrapData<T>(resp: unknown): T | undefined {
  if (resp && typeof resp === "object" && "data" in resp) {
    return (resp as { data: T }).data;
  }
  return resp as T;
}

function pickId(resp: unknown): string | null {
  const body = unwrapData<unknown>(resp);
  if (body && typeof body === "object" && "id" in body) {
    return String((body as { id: string }).id);
  }
  return null;
}

function normaliseHistoryItem(raw: unknown): {
  id: string;
  role: "user" | "assistant";
  parts: ChatPart[];
} | null {
  const item = raw as { info?: Record<string, unknown>; parts?: unknown[] };
  const info = item.info ?? {};
  const id = (info as { id?: string }).id;
  const role = ((info as { role?: string }).role ?? "assistant") as
    | "user"
    | "assistant";
  if (!id) return null;
  const rawParts = (item.parts ?? []) as Array<{
    id?: string;
    type: string;
    text?: string;
    tool?: string;
    state?: {
      status?: "pending" | "running" | "completed" | "error";
      input?: unknown;
      output?: unknown;
      error?: unknown;
    };
  }>;
  const parts: ChatPart[] = rawParts
    .map((p, i): ChatPart | null => {
      const pid = p.id ?? `${id}-p${i}`;
      if (p.type === "text" && typeof p.text === "string") {
        return { id: pid, type: "text", text: p.text };
      }
      if (p.type === "tool" && p.tool) {
        // P1-2: error tools carry their payload in state.error, not output.
        const isError = p.state?.status === "error";
        return {
          id: pid,
          type: "tool",
          toolName: p.tool,
          args: p.state?.input ?? {},
          result: isError ? p.state?.error : p.state?.output,
          isError,
        };
      }
      return null;
    })
    .filter((p): p is ChatPart => p !== null);
  return { id, role, parts };
}
