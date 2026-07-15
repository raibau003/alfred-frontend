"use client";

import { useState, KeyboardEvent } from "react";
import { useWorkspaceStore } from "@/stores/workspaceStore";

interface Props {
  onReply: (permissionId: string, response: string) => void | Promise<void>;
}

export function QuestionPrompt({ onReply }: Props) {
  const pending = useWorkspaceStore((s) => s.pendingQuestion);
  const [custom, setCustom] = useState("");
  const [sending, setSending] = useState(false);

  if (!pending) return null;

  async function submit(value: string) {
    if (!pending || sending) return;
    setSending(true);
    try {
      await onReply(pending.permissionId, value);
      setCustom("");
    } finally {
      setSending(false);
    }
  }

  function handleCustomKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (custom.trim()) submit(custom.trim());
    }
  }

  return (
    <div className="mx-4 my-3 rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-brand-900">{pending.title}</div>
          {pending.question && (
            pending.question.startsWith("{") ? (
              <pre className="mt-1 max-h-40 overflow-auto rounded border border-brand-200 bg-white px-2 py-1.5 text-[10px] text-slate-700">
                {pending.question}
              </pre>
            ) : (
              <div className="mt-0.5 whitespace-pre-wrap text-brand-800">
                {pending.question}
              </div>
            )
          )}
        </div>
      </div>

      {pending.options.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {pending.options.map((opt, i) => (
            <button
              key={i}
              type="button"
              disabled={sending}
              onClick={() => submit(opt.value ?? opt.label)}
              className="block w-full rounded-md border border-brand-300 bg-white px-3 py-2 text-left text-slate-900 hover:border-brand-500 hover:bg-brand-100 disabled:opacity-50"
            >
              <div className="font-medium">{opt.label}</div>
              {opt.description && (
                <div className="mt-0.5 text-xs text-slate-500">
                  {opt.description}
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {pending.allowCustom !== false && (
        <div className="mt-2 flex items-end gap-2">
          <textarea
            rows={1}
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={handleCustomKey}
            placeholder="O escribí una respuesta…"
            disabled={sending}
            className="flex-1 resize-none rounded-md border border-brand-300 bg-white px-2 py-1.5 text-xs text-slate-900 focus:border-brand-500 focus:outline-none disabled:opacity-50"
          />
          <button
            type="button"
            disabled={sending || !custom.trim()}
            onClick={() => submit(custom.trim())}
            className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-40"
          >
            Enviar
          </button>
        </div>
      )}
    </div>
  );
}
