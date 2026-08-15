"use client";

import { useEffect, useState, useCallback } from "react";
import { TrendingUp, AlertTriangle, RefreshCw, Loader2, CalendarClock, ClipboardList, Target, MessageCircleWarning } from "lucide-react";

const usd = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Math.round(n || 0));

type Vendedor = {
  nombre: string;
  chat_id: string;
  deals_abiertos: number;
  monto_abierto: number;
  monto_ponderado: number;
  clientes_sin_reunion: number;
  clientes_sin_plan: number;
  cerca_oc: number;
  respondio_esta_semana: boolean;
};
type Dash = {
  total_open_amount: number;
  weighted_forecast: number;
  open_deals_count: number;
  por_vendedor: Vendedor[];
};

export default function ForecastPage() {
  const [d, setD] = useState<Dash | null>(null);
  const [loading, setLoading] = useState(true);
  const [fallo, setFallo] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/forecast/dashboard", { cache: "no-store" });
      const j = await r.json();
      if (j.error) { setFallo(String(j.error)); return; }
      setFallo(null);
      setD(j);
    } catch (e) {
      setFallo((e as Error).message || "no pude conectarme");
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-slate-300" /></div>;

  return (
    <div className="mx-auto max-w-5xl p-6">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700"><TrendingUp className="h-6 w-6" /></div>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-slate-900">Forecast del equipo</h1>
          <p className="text-sm text-slate-500">Forecast Evolve · cadencia semanal · plan de cuenta · {d?.open_deals_count ?? 0} deals abiertos</p>
        </div>
        <button onClick={load} className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-slate-500 hover:bg-slate-100"><RefreshCw className="h-3.5 w-3.5" /> Actualizar</button>
      </div>

      {fallo && (
        <div className="mb-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{fallo}</span>
        </div>
      )}

      {/* KPIs totales */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Pipeline abierto</div>
          <div className="mt-1 text-2xl font-semibold text-slate-900">{usd(d?.total_open_amount ?? 0)}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Forecast ponderado</div>
          <div className="mt-1 text-2xl font-semibold text-indigo-700">{usd(d?.weighted_forecast ?? 0)}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Deals abiertos</div>
          <div className="mt-1 text-2xl font-semibold text-slate-900">{d?.open_deals_count ?? 0}</div>
        </div>
      </div>

      {/* Por vendedor */}
      <div className="space-y-3">
        {(d?.por_vendedor ?? []).map((v) => (
          <div key={v.chat_id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-semibold text-slate-900">{v.nombre}</div>
                <div className="text-sm text-slate-500">{usd(v.monto_abierto)} · {v.deals_abiertos} deals · ponderado {usd(v.monto_ponderado)}</div>
              </div>
              {!v.respondio_esta_semana && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                  <MessageCircleWarning className="h-3.5 w-3.5" /> Sin responder esta semana
                </span>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-medium ${v.clientes_sin_reunion ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
                <CalendarClock className="h-3.5 w-3.5" /> {v.clientes_sin_reunion} sin reunión +7d
              </span>
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-medium ${v.clientes_sin_plan ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
                <ClipboardList className="h-3.5 w-3.5" /> {v.clientes_sin_plan} sin plan de cuenta
              </span>
              {v.cerca_oc > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 font-medium text-indigo-700">
                  <Target className="h-3.5 w-3.5" /> {v.cerca_oc} cerca de la OC
                </span>
              )}
            </div>
          </div>
        ))}
        {(d?.por_vendedor?.length ?? 0) === 0 && !fallo && (
          <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
            Todavía no hay vendedores registrados en Forecast Evolve.
          </div>
        )}
      </div>
    </div>
  );
}
