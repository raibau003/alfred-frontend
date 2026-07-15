"use client";

interface HtmlPayload {
  title?: string;
  html: string;
}

// Fixed Apple×Claude design system injected into EVERY agent-emitted report.
// The agent emits semantic HTML with these class names; the canvas owns the
// styling so all reports look consistent regardless of what the agent writes.
const THEME_CSS = `:root{--bg:#FBFAF7;--surface:#FFFFFF;--ink:#1D1D1F;--muted:#6E6B66;--accent:#C96442;--accent-soft:#F3E9E3;--border:#ECE8E1;--radius:16px;--shadow:0 1px 2px rgba(0,0,0,.04),0 8px 24px rgba(0,0,0,.05)}
*{box-sizing:border-box}html,body{margin:0}
body{font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",Inter,system-ui,sans-serif;color:var(--ink);background:var(--bg);line-height:1.55;-webkit-font-smoothing:antialiased;font-size:15px}
.report{max-width:880px;margin:0 auto;padding:40px 32px}
.report-header{margin-bottom:28px}
.report-header h1{font-size:30px;line-height:1.15;letter-spacing:-.02em;font-weight:700;margin:0 0 6px}
.subtitle{color:var(--muted);font-size:16px;margin:0}
.card,.section{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:22px 24px;margin:18px 0;box-shadow:var(--shadow)}
h2{font-size:20px;letter-spacing:-.01em;font-weight:650;margin:26px 0 10px}
h3{font-size:16px;font-weight:600;margin:18px 0 8px}
p{margin:8px 0}a{color:var(--accent);text-decoration:none}
ul,ol{margin:8px 0;padding-left:20px}li{margin:4px 0}
.kpi-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px;margin:14px 0}
.kpi{background:var(--accent-soft);border:1px solid var(--border);border-radius:14px;padding:16px 18px}
.kpi-value{font-size:30px;font-weight:700;letter-spacing:-.02em;color:var(--accent);line-height:1}
.kpi-label{color:var(--muted);font-size:13px;margin-top:6px}
.insight{background:var(--accent-soft);border-left:3px solid var(--accent);border-radius:10px;padding:14px 16px;margin:16px 0;color:#5a3a2c}
.badge{display:inline-block;background:var(--accent-soft);color:var(--accent);border-radius:999px;padding:3px 10px;font-size:12px;font-weight:600}
table{width:100%;border-collapse:collapse;margin:12px 0;font-size:14px}
th,td{text-align:left;padding:10px 12px;border-bottom:1px solid var(--border)}
th{color:var(--muted);font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:.04em}
tr:last-child td{border-bottom:none}
code{font-family:"SF Mono",ui-monospace,Menlo,monospace;background:#F4F1EC;padding:2px 6px;border-radius:6px;font-size:13px}
.footer{color:var(--muted);font-size:13px;margin-top:24px;text-align:center}
hr{border:none;border-top:1px solid var(--border);margin:24px 0}`;

export function HtmlCanvas({ payload }: { payload: HtmlPayload }) {
  const html = payload?.html ?? "";

  // Fully sandboxed: `sandbox=""` (empty = NO permissions, NO scripts). Any
  // <script>/onerror/onload in the agent HTML is inert — neutralizes XSS even
  // if the model emits malicious markup. The fixed theme is the ONLY <style>.
  const srcDoc = `<!doctype html><html><head><meta charset="utf-8"><style>${THEME_CSS}</style></head><body>${html}</body></html>`;

  return (
    <div className="flex h-full flex-col bg-surface-1">
      <div className="border-b border-surface-4 px-4 py-2">
        <h2 className="text-sm font-semibold text-slate-900">
          {payload?.title ?? "Reporte"}
        </h2>
      </div>
      <iframe
        title={payload?.title ?? "Reporte"}
        sandbox=""
        srcDoc={srcDoc}
        className="min-h-0 w-full flex-1 border-0 bg-[#FBFAF7]"
      />
    </div>
  );
}
