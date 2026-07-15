"use client";

import { Square } from "lucide-react";
import { MessageList } from "./MessageList";
import { MessageInput, type SendAttachment } from "./MessageInput";
import { QuestionPrompt } from "./QuestionPrompt";
import { useWorkspaceStore } from "@/stores/workspaceStore";

interface Props {
  onSend: (
    text: string,
    attachments?: SendAttachment[]
  ) => void | Promise<void>;
  onCancel: () => void | Promise<void>;
  onReplyPermission: (permissionId: string, response: string) => void | Promise<void>;
  bootstrapping?: boolean;
}

export function ChatPanel({
  onSend,
  onCancel,
  onReplyPermission,
  bootstrapping,
}: Props) {
  const messages = useWorkspaceStore((s) => s.messages);
  const connected = useWorkspaceStore((s) => s.connected);
  const busy = useWorkspaceStore((s) => s.busy);

  return (
    <div className="flex h-full flex-col bg-surface-1">
      <div className="flex items-center justify-between border-b border-surface-4 px-4 py-2">
        <h2 className="text-sm font-semibold text-slate-900">Chat</h2>
        <div className="flex items-center gap-3 text-xs">
          {busy && (
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-red-700 hover:border-red-300 hover:bg-red-100"
            >
              <Square className="h-3 w-3 fill-red-700" />
              Cancelar
            </button>
          )}
          <div className="flex items-center gap-1.5">
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${
                connected ? "bg-green-500" : "bg-slate-400"
              }`}
            />
            <span className="text-slate-500">
              {bootstrapping
                ? "Conectando..."
                : connected
                  ? "Conectado"
                  : "Desconectado"}
            </span>
          </div>
        </div>
      </div>

      <MessageList messages={messages} />

      {busy && (
        <div className="border-t border-surface-4 bg-surface-1 px-4 py-1.5 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand-500" />
            </span>
            Pensando...
          </span>
        </div>
      )}

      <QuestionPrompt onReply={onReplyPermission} />

      <MessageInput onSend={onSend} disabled={bootstrapping || !connected} />
    </div>
  );
}
