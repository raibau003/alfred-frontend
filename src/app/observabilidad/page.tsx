"use client";

import { useEffect, useState, useCallback } from "react";
import { Activity, Loader2, AlertTriangle, Clock, RefreshCw, Zap } from "lucide-react";
import { ROUTER_URL } from "@/lib/alfred/client";

interface LatencyRow { name: string; service: string; n: number; avg_ms: number; p50_ms: number; p95_ms: number; p99_ms: number; max_ms: number; }
interface TimeoutRow { agente: string; llamadas: number; timeouts: number; errores: number; pct_fallo: number | null; p95_ms: number | null; }
interface ClassRow { clasificacion: string; metodo: string | null; n: number; }
interface TraceRow { trace_id: string; inicio: string; total_ms: number; channel: string | null; clasificacion: string | null; texto: string | null; spans: number; con_fallo: boolean; }
interface Summary { ok: boolean; latency: LatencyRow[]; timeouts: TimeoutRow[]; classification: ClassRow[]; recent: TraceRow[]; }

function ms(v: number | null | undefined): string {
  if (v == null) return "—";
  return v >= 1000 ? `${(v / 1000).toFixed(1)}s` : `${Math.round(v)}ms`;
}
function msColor(v: number | null | undefined): string {
  if (v == null) return "text-slate-400";
  if (v >= 60000) return "text-red-600 font-semibold";
  if (v >= 15000) return "text-amber-600";
  if (v >= 3000) return "text-slate-700";
  return "text-emerald-600";
}
function hhmm(iso: string): string {
  try { return new Date(new Date(iso).getTime() - 4 * 3600 * 1000).toISOString().slice(11, 16); } catch { return ""; }
}

export default function ObservabilidadPage() {
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);

  const load = useCallback(async () => {
    try {
      // Vía el proxy propio: el endpoint del router exige credencial y el navegador no
      // puede llevar el secreto de servidor sin exponerlo.
      const r = await fetch(`/api/observabilidad`, { signal: AbortSignal.timeout(12000) });
      const d = await r.json();
      if (d.ok) { setData(d); setErr(false); } else setErr(true);
    } catch { setErr(true); }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  const badTimeouts = (data?.timeouts || []).filter(t => (t.pct_fallo || 0) > 0);

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
            <Activity className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Observabilidad</h1>
            <p className="text-sm text-slate-500">Dónde se va el tiempo: latencia, timeouts y clasificación por mensaje.</p>
          </div>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100">
          <RefreshCw className="h-3.5 w-3.5" /> Actualizar
        </button>
      </div>

      {loading && <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-slate-300" /></div>}
      {err && !data && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">No pude cargar los datos del router.</div>}

      {data && (
        <div className="space-y-6">
          {/* Alertas de timeouts */}
          {badTimeouts.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-amber-800">
                <AlertTriangle className="h-4 w-4" /> Agentes con fallos/timeouts (últimos 7 días)
              </div>
              <div className="flex flex-wrap gap-2">
                {badTimeouts.map(t => (
                  <span key={t.agente} className="rounded-full bg-white px-3 py-1 text-xs text-amber-800 ring-1 ring-amber-200">
                    {t.agente}: <b>{t.pct_fallo}%</b> ({t.timeouts + t.errores}/{t.llamadas}) · p95 {ms(t.p95_ms)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Latencia por paso */}
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800"><Clock className="h-4 w-4 text-slate-400" /> Latencia por paso (7 días)</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-slate-400">
                  <th className="pb-2">Paso</th><th className="pb-2 text-right">n</th><th className="pb-2 text-right">p50</th><th className="pb-2 text-right">p95</th><th className="pb-2 text-right">p99</th><th className="pb-2 text-right">máx</th>
                </tr></thead>
                <tbody>
                  {(data.latency || []).map(r => (
                    <tr key={r.name} className="border-t border-slate-100">
                      <td className="py-1.5 font-mono text-xs text-slate-700">{r.name}</td>
                      <td className="py-1.5 text-right text-slate-400">{r.n}</td>
                      <td className="py-1.5 text-right text-slate-600">{ms(r.p50_ms)}</td>
                      <td className={`py-1.5 text-right ${msColor(r.p95_ms)}`}>{ms(r.p95_ms)}</td>
                      <td className={`py-1.5 text-right ${msColor(r.p99_ms)}`}>{ms(r.p99_ms)}</td>
                      <td className="py-1.5 text-right text-slate-400">{ms(r.max_ms)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Clasificación */}
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800"><Zap className="h-4 w-4 text-slate-400" /> Clasificación (7 días)</h2>
            <div className="flex flex-wrap gap-2">
              {(data.classification || []).map((c, i) => (
                <span key={i} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                  {c.clasificacion || "—"} <b>{c.n}</b>{c.metodo ? <span className="text-slate-400"> · {c.metodo}</span> : null}
                </span>
              ))}
            </div>
          </section>

          {/* Traces recientes */}
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-slate-800">Últimos mensajes</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-slate-400">
                  <th className="pb-2">Hora</th><th className="pb-2">Mensaje</th><th className="pb-2">Ruta</th><th className="pb-2 text-right">Total</th>
                </tr></thead>
                <tbody>
                  {(data.recent || []).map(t => (
                    <tr key={t.trace_id} className={`border-t border-slate-100 ${t.con_fallo ? "bg-red-50" : ""}`}>
                      <td className="py-1.5 text-xs text-slate-400">{hhmm(t.inicio)}</td>
                      <td className="py-1.5 max-w-[280px] truncate text-slate-700">{t.texto || "—"}</td>
                      <td className="py-1.5 text-xs text-slate-500">{t.clasificacion || "—"}{t.con_fallo ? " ⚠️" : ""}</td>
                      <td className={`py-1.5 text-right ${msColor(t.total_ms)}`}>{ms(t.total_ms)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
