"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownPayload {
  title?: string;
  content: string;
}

// Explicit element styling (no @tailwindcss/typography in this project, so `prose`
// is a no-op — we style each element to match the warm Apple×Claude aesthetic).
const MD: Components = {
  h1: (p) => <h1 className="mb-3 mt-1 text-2xl font-bold tracking-tight text-slate-900" {...p} />,
  h2: (p) => <h2 className="mb-2 mt-5 text-lg font-semibold tracking-tight text-slate-900" {...p} />,
  h3: (p) => <h3 className="mb-1.5 mt-4 text-base font-semibold text-slate-800" {...p} />,
  p: (p) => <p className="my-2 leading-relaxed text-slate-700" {...p} />,
  a: (p) => <a className="font-medium text-[#C96442] hover:underline" {...p} />,
  strong: (p) => <strong className="font-semibold text-slate-900" {...p} />,
  ul: (p) => <ul className="my-2 list-disc space-y-1 pl-5 text-slate-700" {...p} />,
  ol: (p) => <ol className="my-2 list-decimal space-y-1 pl-5 text-slate-700" {...p} />,
  li: (p) => <li className="leading-relaxed" {...p} />,
  blockquote: (p) => (
    <blockquote className="my-3 rounded-r-md border-l-4 border-[#C96442] bg-[#F3E9E3] px-4 py-2 text-slate-700" {...p} />
  ),
  code: (p) => (
    <code className="rounded bg-[#F4F1EC] px-1.5 py-0.5 font-mono text-[13px] text-slate-800" {...p} />
  ),
  hr: () => <hr className="my-5 border-slate-200" />,
  // Tables — the fix: real borders, header band, padding, zebra.
  table: (p) => (
    <div className="my-3 overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full border-collapse text-sm" {...p} />
    </div>
  ),
  thead: (p) => <thead className="bg-[#F3E9E3]" {...p} />,
  th: (p) => (
    <th className="border-b border-slate-200 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600" {...p} />
  ),
  td: (p) => <td className="border-b border-slate-100 px-3 py-2 align-top text-slate-700" {...p} />,
  tr: (p) => <tr className="even:bg-slate-50/50" {...p} />,
};

export function MarkdownCanvas({ payload }: { payload: MarkdownPayload }) {
  return (
    <div className="flex h-full flex-col bg-surface-1">
      <div className="border-b border-surface-4 px-4 py-2">
        <h2 className="text-sm font-semibold text-slate-900">
          {payload.title ?? "Documento"}
        </h2>
      </div>
      <div className="flex-1 overflow-auto px-6 py-4">
        <article className="max-w-3xl mx-auto">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD}>
            {payload.content ?? ""}
          </ReactMarkdown>
        </article>
      </div>
    </div>
  );
}
