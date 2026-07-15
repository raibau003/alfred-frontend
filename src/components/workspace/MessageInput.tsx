"use client";

import { useRef, useState, useCallback, KeyboardEvent } from "react";
import { Send, Paperclip, X, FileText, Mic, Square } from "lucide-react";
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
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm",
      });
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (timerRef.current) clearInterval(timerRef.current);
        setRecordingTime(0);

        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        if (blob.size < 1000) return; // too short

        const file = new File([blob], `audio-${Date.now()}.webm`, {
          type: "audio/webm",
        });

        // Send as attachment with instruction to transcribe
        const prepared: PreparedAttachment = {
          file,
          filename: file.name,
          mime: file.type,
          size: file.size,
        };
        setBusy(true);
        try {
          await onSend(
            "Transcribe este audio y procesa lo que digo.",
            [prepared]
          );
        } finally {
          setBusy(false);
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(250);
      setRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(
        () => setRecordingTime((t) => t + 1),
        1000
      );
    } catch {
      toast.error("No se pudo acceder al micrófono");
    }
  }, [onSend]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
  }, []);

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
          placeholder="Escribe un mensaje..."
          disabled={disabled || busy}
          className="flex-1 resize-none rounded-md border border-surface-4 bg-surface-2 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none disabled:opacity-50 min-h-[40px] max-h-32"
        />
        {recording ? (
          <button
            type="button"
            onClick={stopRecording}
            className="rounded-md bg-red-600 px-3 py-2 text-white hover:bg-red-700 animate-pulse flex items-center gap-1.5"
            aria-label="Detener grabación"
          >
            <Square className="h-3.5 w-3.5 fill-current" />
            <span className="text-xs font-medium tabular-nums">
              {Math.floor(recordingTime / 60)}:{String(recordingTime % 60).padStart(2, "0")}
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={startRecording}
            disabled={disabled || busy}
            className="rounded-md border border-surface-4 bg-surface-2 p-2 text-slate-500 hover:border-red-400 hover:text-red-600 disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Grabar audio"
            title="Enviar mensaje de voz"
          >
            <Mic className="h-4 w-4" />
          </button>
        )}
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
