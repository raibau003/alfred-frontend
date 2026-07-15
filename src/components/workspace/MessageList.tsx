"use client";

import { useEffect, useRef } from "react";
import { Paperclip, Play, FileText } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatMessage } from "@/stores/workspaceStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { stripWorkflowContext, parseWorkflowRun } from "@/lib/workflow/sync";
import { formatBytes } from "@/lib/opencode/attachments";

interface Props {
  messages: ChatMessage[];
}

export function MessageList({ messages }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const busy = useWorkspaceStore((s) => s.busy);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, messages[messages.length - 1]?.parts, busy]);

  // Check if the last assistant message has only tool parts (no text yet)
  const lastMsg = messages[messages.length - 1];
  const showTyping = busy && (!lastMsg || lastMsg.role === "user" ||
    (lastMsg.role === "assistant" && lastMsg.parts.every((p) => p.type === "tool" || (p.type === "text" && !p.text.trim()))));

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
      {messages.length === 0 && (
        <div className="text-center text-sm text-slate-400 mt-12">
          Escribe un mensaje para hablar con Alfred.
        </div>
      )}
      {messages.map((m) => (
        <MessageBubble key={m.id} message={m} />
      ))}
      {showTyping && (
        <div className="flex justify-start">
          <div className="rounded-lg px-4 py-3 bg-surface-2 border border-surface-4 flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="inline-block w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "150ms" }} />
            <span className="inline-block w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "300ms" }} />
            <span className="ml-2 text-xs text-slate-400">Alfred está pensando...</span>
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}

/**
 * A part is renderable if it produces visible output:
 * - tool parts always render (the tool chip),
 * - text parts render only if, after stripping the invisible
 *   <workflow_context> tag, there's leftover text OR an embedded
 *   <workflow_run> block.
 */
function hasRenderableContent(message: ChatMessage): boolean {
  return message.parts.some((p) => {
    // Tool calls are hidden in the UI (only errors show), so don't count them
    if (p.type === "tool") return p.isError === true;
    if (p.type === "file") return true;
    if (p.type === "text") {
      const stripped = stripWorkflowContext(p.text);
      const { run } = parseWorkflowRun(stripped.cleanText);
      return run !== null || stripped.cleanText.trim().length > 0;
    }
    return false;
  });
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  // Suppress empty shells. A transient duplicate user echo (or a not-yet-
  // populated message) has no renderable content and must NOT show as a pill.
  // An assistant that is still streaming (pending) keeps its bubble so the
  // typing/placeholder state stays visible while parts fill in.
  if (!hasRenderableContent(message)) {
    if (message.role === "assistant" && message.pending) {
      // fall through and render the (empty) streaming bubble
    } else {
      return null;
    }
  }

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
          isUser
            ? "bg-brand-600 text-white"
            : "bg-surface-2 text-slate-900 border border-surface-4"
        }`}
      >
        {message.parts.map((p) => {
          if (p.type === "text") {
            const stripped = stripWorkflowContext(p.text);
            const { before, run, after } = parseWorkflowRun(stripped.cleanText);
            const surroundingText = `${before}${after}`.trim();

            return (
              <div key={p.id} className="space-y-1.5">
                {stripped.hadContext && (
                  <div
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      isUser
                        ? "bg-white/15 text-white/90"
                        : "bg-brand-500/10 text-brand-700"
                    }`}
                    title="El mensaje incluye un snapshot del workflow"
                  >
                    <Paperclip className="h-2.5 w-2.5" />
                    workflow adjunto
                  </div>
                )}

                {run && (
                  <details
                    className={`group rounded-md border ${
                      isUser
                        ? "border-white/25 bg-white/10"
                        : "border-brand-300 bg-brand-50/60"
                    }`}
                  >
                    <summary
                      className={`flex cursor-pointer list-none items-center gap-2 px-2.5 py-1.5 text-xs font-medium ${
                        isUser ? "text-white" : "text-brand-800"
                      }`}
                    >
                      <Play className="h-3 w-3" />
                      <span>Ejecutar workflow «{run.name}»</span>
                      <span className={isUser ? "text-white/70" : "text-brand-600/80"}>
                        · {run.nodes} nodos · {run.edges} conexiones
                      </span>
                      <span className="ml-auto text-[10px] opacity-60 group-open:hidden">ver detalle</span>
                      <span className="ml-auto text-[10px] opacity-60 hidden group-open:inline">ocultar</span>
                    </summary>
                    <pre
                      className={`max-h-64 overflow-auto border-t px-2.5 py-2 text-[11px] leading-snug whitespace-pre-wrap ${
                        isUser
                          ? "border-white/20 bg-white/5 text-white/90"
                          : "border-brand-200 bg-white text-slate-700"
                      }`}
                    >
                      {run.body}
                    </pre>
                  </details>
                )}

                {surroundingText && (
                  <div className="prose prose-sm max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {surroundingText}
                    </ReactMarkdown>
                  </div>
                )}

                {!run && !surroundingText && (
                  <div className="prose prose-sm max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {stripped.cleanText}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            );
          }
          if (p.type === "file") {
            return (
              <div
                key={p.id}
                className={`inline-flex max-w-full items-center gap-1.5 rounded-md border px-2 py-1 text-xs ${
                  isUser
                    ? "border-white/30 bg-white/10 text-white"
                    : "border-surface-4 bg-surface-3 text-slate-700"
                }`}
                title={`${p.filename} (${p.mime})`}
              >
                <FileText className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate font-medium">{p.filename}</span>
                {typeof p.size === "number" && (
                  <span className={isUser ? "text-white/70" : "text-slate-400"}>
                    {formatBytes(p.size)}
                  </span>
                )}
              </div>
            );
          }
          if (p.type === "tool") {
            // Only show errors, hide normal tool calls
            if (p.isError === true) {
              return (
                <div
                  key={p.id}
                  className="font-mono text-xs rounded px-2 py-1 mt-1 border bg-red-50 border-red-300 text-red-800"
                >
                  <span className="text-red-500">Error:</span>{" "}
                  <span>{typeof p.result === "string" ? p.result : String(p.toolName)}</span>
                </div>
              );
            }
            // Hide non-error tool calls completely
            return null;
          }
          return null;
        })}
      </div>
    </div>
  );
}
