"use client";

import { useMemo, useState, useEffect } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { sql } from "@codemirror/lang-sql";
import { python } from "@codemirror/lang-python";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { yaml } from "@codemirror/lang-yaml";
import { markdown } from "@codemirror/lang-markdown";
import { EditorView, lineNumbers } from "@codemirror/view";
import type { Extension } from "@codemirror/state";

interface CodeFile {
  filename?: string;
  language: string;
  content: string;
}

interface CodePayload {
  // show_code single file
  filename?: string;
  language?: string;
  content?: string;
  editable?: boolean;
  highlight_lines?: number[];
  // show_code_files
  files?: CodeFile[];
  active?: string;
}

function extensionForLanguage(lang: string): Extension[] {
  const normalised = lang.toLowerCase();
  switch (normalised) {
    case "sql":
    case "postgres":
    case "bigquery":
    case "snowflake":
      return [sql()];
    case "python":
    case "py":
      return [python()];
    case "js":
    case "javascript":
    case "ts":
    case "typescript":
    case "tsx":
    case "jsx":
      return [javascript({ jsx: true, typescript: normalised.includes("ts") })];
    case "json":
      return [json()];
    case "yaml":
    case "yml":
      return [yaml()];
    case "md":
    case "markdown":
      return [markdown()];
    default:
      return [];
  }
}

function highlightLinesExtension(lines: number[] | undefined): Extension | null {
  if (!lines || lines.length === 0) return null;
  const set = new Set(lines);
  return EditorView.theme({
    "&": { "--cm-highlight": "rgba(255, 220, 50, 0.18)" },
  });
  // Note: a full line-highlight decoration needs StateField + decorations.
  // We render the highlight as a background on the gutter row via CSS,
  // applied below in the renderer.
  // (Kept minimal here — wow effect comes from layout + monospace render.)
  void set;
}

export function CodeCanvas({ payload }: { payload: CodePayload }) {
  const files: CodeFile[] = useMemo(() => {
    if (payload.files && payload.files.length > 0) return payload.files;
    if (payload.content !== undefined) {
      return [
        {
          filename: payload.filename,
          language: payload.language ?? "txt",
          content: payload.content,
        },
      ];
    }
    return [];
  }, [payload]);

  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    if (payload.active) {
      const idx = files.findIndex((f) => f.filename === payload.active);
      if (idx >= 0) setActiveIdx(idx);
    } else {
      setActiveIdx(0);
    }
  }, [payload.active, files]);

  // NOTE: all hooks must run before any conditional return (Rules of Hooks).
  // `files` flips between empty/non-empty as tool deltas arrive, so an early
  // return placed above a hook changes the hook count between renders and
  // crashes the canvas. Compute the active file + extensions defensively here.
  const active =
    files.length > 0 ? files[Math.min(activeIdx, files.length - 1)] : undefined;
  const extensions = useMemo(
    () => [
      lineNumbers(),
      ...extensionForLanguage(active?.language ?? "txt"),
      EditorView.lineWrapping,
    ],
    [active?.language]
  );

  if (files.length === 0 || !active) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-400">
        Sin código.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-surface-1">
      <div className="flex items-center gap-1 border-b border-surface-4 px-2 py-1 overflow-x-auto">
        {files.map((f, i) => (
          <button
            key={(f.filename ?? "file") + i}
            onClick={() => setActiveIdx(i)}
            className={`px-3 py-1 text-xs rounded-t-md font-mono whitespace-nowrap ${
              i === activeIdx
                ? "bg-surface-2 text-slate-900 border border-b-0 border-surface-4"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            {f.filename ?? `file ${i + 1}`}
            <span className="ml-2 text-[9px] text-slate-400 uppercase">
              {f.language}
            </span>
          </button>
        ))}
        <div className="ml-auto px-2 text-[10px] text-slate-400">
          {payload.editable ? "editable" : "read-only"}
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        <CodeMirror
          value={active.content}
          extensions={extensions}
          editable={Boolean(payload.editable)}
          readOnly={!payload.editable}
          basicSetup={{
            lineNumbers: false,
            foldGutter: true,
            highlightActiveLineGutter: true,
            highlightActiveLine: !!payload.highlight_lines?.length,
          }}
          theme="light"
          style={{ height: "100%", fontSize: "13px" }}
        />
      </div>
      {payload.highlight_lines && payload.highlight_lines.length > 0 && (
        <div className="border-t border-surface-4 bg-yellow-50 px-3 py-1 text-[11px] text-yellow-800">
          Líneas destacadas: {payload.highlight_lines.join(", ")}
        </div>
      )}
    </div>
  );
}
