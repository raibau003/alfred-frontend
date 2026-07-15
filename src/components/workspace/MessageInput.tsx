"use client";

import { useRef, useState, KeyboardEvent } from "react";
import { Send, Paperclip, X, FileText } from "lucide-react";
import { toast } from "sonner";
import {
  prepareAttachment,
  formatBytes,
  AttachmentError,
  ACCEPTED_ATTACHMENT_EXT,
  type PreparedAttachment,
} from "@/lib/opencode/attachments";

export interface SendAttachment {
  /** Raw browser File — uploaded to the pod workspace on send (NOT inlined). */
  file: File;
  filename: string;
  mime: string;
  size: number;
}

interface Props {
  onSend: (text: string, attachments?: SendAttachment[]) => void | Promise<void>;
  disabled?: boolean;
}

export function MessageInput({ onSend, disabled }: Props) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [attachment, setAttachment] = useState<PreparedAttachment | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleSend() {
    const trimmed = text.trim();
    // Allow sending an attachment with no text (eg. "here's the file").
    if ((!trimmed && !attachment) || busy) return;
    setBusy(true);
    try {
      await onSend(trimmed, attachment ? [attachment] : undefined);
      setText("");
      setAttachment(null);
    } finally {
      setBusy(false);
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  async function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset the input so picking the same file twice still fires onChange.
    e.target.value = "";
    if (!file) return;
    try {
      const prepared = await prepareAttachment(file);
      setAttachment(prepared);
    } catch (err) {
      const msg =
        err instanceof AttachmentError
          ? err.message
          : "No se pudo adjuntar el archivo.";
      toast.error("Adjunto rechazado", { description: msg });
    }
  }

  return (
    <div className="border-t border-surface-4 bg-surface-1 p-3">
      {attachment && (
        <div className="mb-2 flex items-center gap-2">
          <span className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-brand-300 bg-brand-50 px-2 py-1 text-xs text-brand-800">
            <FileText className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate font-medium">{attachment.filename}</span>
            <span className="shrink-0 text-brand-600/80">
              {formatBytes(attachment.size)}
            </span>
            <button
              type="button"
              onClick={() => setAttachment(null)}
              className="ml-0.5 shrink-0 rounded p-0.5 hover:bg-brand-100"
              aria-label="Quitar adjunto"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        </div>
      )}
      <div className="flex items-end gap-2">
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPTED_ATTACHMENT_EXT}
          onChange={handlePick}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={disabled || busy}
          className="rounded-md border border-surface-4 bg-surface-2 p-2 text-slate-500 hover:border-brand-400 hover:text-brand-600 disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Adjuntar archivo"
          title="Adjuntar archivo (CSV, TSV, JSON, Parquet, XLSX…)"
        >
          <Paperclip className="h-4 w-4" />
        </button>
        <textarea
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escribí un mensaje..."
          disabled={disabled || busy}
          className="flex-1 resize-none rounded-md border border-surface-4 bg-surface-2 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none disabled:opacity-50 min-h-[40px] max-h-32"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={disabled || busy || (!text.trim() && !attachment)}
          className="rounded-md bg-brand-600 px-3 py-2 text-white hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Send"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
