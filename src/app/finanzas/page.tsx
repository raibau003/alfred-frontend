"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Wallet, TrendingUp, AlertTriangle, RefreshCw, Loader2, Download, Repeat, CreditCard,
  ArrowUpRight, Pencil, Check, X, Layers,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, ReferenceLine, Cell,
} from "recharts";

const clp = (n: number) =>
  new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(Math.round(n || 0));
const clpShort = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (a >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${Math.round(n)}`;
};

type Summary = {
  config: { presupuesto: number; moneda: string };
  resumen: {
    gastoMes: number; presupuesto: number; pctUsado: number; disponible: number;
    proyeccion: number; proyeccionSobrepasa: boolean; promedioMensual: number;
    mesActual: string; diaDelMes: number; diasMes: number;
  };
  tendencia: { mes: string; total: number }[];
  categorias: { categoria: string; esteMes: number; promedio: number; sobrePromedio: boolean }[];
  suscripciones: { nombre: string; monto: number; categoria: string }[];
  totalSuscripciones: number;
  cuotas: { comercio: string; monto: number; cuota_actual: number; cuota_total: number; restantes: number; pendiente: number }[];
  totalCuotasPendiente: number;
  anomalias: { tipo: string; texto: string; monto: number }[];
  ultimaImportacion: { imported_at: string; periodo: string; banco: string } | null;
  totalMovimientos: number;
};

const MES_LABEL = (k: string) => {
  const [, m] = k.split("-");
  return ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"][Number(m) - 1] ?? k;
};

export default function FinanzasPage() {
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [editBudget, setEditBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/finance", { cache: "no-store" });
      const j = await r.json();
      if (!j.error) setData(j);
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [load]);

  const importar = async () => {
    setImporting(true);
    try {
      await fetch("/api/finance/import", { method: "POST" });
    } catch {}
    setTimeout(() => { setImporting(false); load(); }, 4000);
  };


  const saveBudget = async () => {
    const v = Number(budgetInput.replace(/\D/g, ""));
    if (v > 0) {
      await fetch("/api/finance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ presupuesto_tc: v }) }).catch(() => {});
      await load();
    }
    setEditBudget(false);
  };

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-slate-300" /></div>;
  }

  const r = data?.resumen;
  const sinDatos = !data || (data.totalMovimientos ?? 0) === 0;
  const pct = Math.min(100, r?.pctUsado ?? 0);
  const barColor = pct >= 90 ? "#dc2626" : pct >= 70 ? "#f59e0b" : "#4f46e5";

  return (
    <div className="mx-auto max-w-4xl p-6">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
          <Wallet className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-slate-900">Control financiero</h1>
          <p className="text-sm text-slate-500">
            Tarjeta de crédito Santander · {data?.ultimaImportacion ? `cartola al ${new Date(data.ultimaImportacion.imported_at).toLocaleDateString("es-CL")}` : "sin cartola importada"}
          </p>
        </div>
        <button onClick={load} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-slate-500 hover:bg-slate-100">
          <RefreshCw className="h-3.5 w-3.5" /> Actualizar
        </button>
        <button onClick={importar} disabled={importing}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
          {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          Importar cartola
        </button>
      </div>

      {sinDatos && (
        <div className="mb-6 rounded-xl border border-dashed border-emerald-200 bg-emerald-50/50 p-5 text-center">
          <CreditCard className="mx-auto mb-2 h-9 w-9 text-emerald-500" />
          <p className="font-medium text-emerald-800">Aún no importé tu cartola.</p>
          <p className="mt-1 text-sm text-emerald-700">
            Tocá <b>Importar cartola</b> y Alfred busca el PDF del Santander en tu correo, lo desencripta con tu RUT y analiza todo.
            También podés pedírselo por WhatsApp: <i>“analizá mis gastos del Santander”</i>.
          </p>
        </div>
      )}

      {/* HERO — Presupuesto */}
      <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="mb-3 flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Gasto del mes</p>
            <p className="mt-0.5 text-3xl font-bold text-slate-900">{clp(r?.gastoMes ?? 0)}</p>
          </div>
          <div className="text-right">
            <div className="flex items-center justify-end gap-1 text-xs font-medium uppercase tracking-wide text-slate-400">
              Presupuesto
              {!editBudget && (
                <button onClick={() => { setEditBudget(true); setBudgetInput(String(r?.presupuesto ?? 6000000)); }} className="text-slate-300 hover:text-slate-500">
                  <Pencil className="h-3 w-3" />
                </button>
              )}
            </div>
            {editBudget ? (
              <div className="mt-1 flex items-center gap-1">
                <input value={budgetInput} onChange={(e) => setBudgetInput(e.target.value)} autoFocus
                  className="w-28 rounded border border-slate-300 px-2 py-0.5 text-right text-lg font-semibold" />
                <button onClick={saveBudget} className="text-emerald-600"><Check className="h-4 w-4" /></button>
                <button onClick={() => setEditBudget(false)} className="text-slate-400"><X className="h-4 w-4" /></button>
              </div>
            ) : (
              <p className="mt-0.5 text-2xl font-semibold text-slate-500">{clp(r?.presupuesto ?? 6000000)}</p>
            )}
          </div>
        </div>

        {/* Barra de progreso */}
        <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: barColor }} />
        </div>
        <div className="mt-2 flex items-center justify-between text-sm">
          <span className="font-medium" style={{ color: barColor }}>{r?.pctUsado ?? 0}% usado</span>
          <span className="text-slate-500">Disponible: <b className="text-slate-700">{clp(r?.disponible ?? 0)}</b></span>
        </div>

        {/* Proyección */}
        <div className="mt-4 grid grid-cols-3 gap-3 border-t border-slate-100 pt-4">
          <Metric label="Proyección cierre" value={clp(r?.proyeccion ?? 0)} danger={r?.proyeccionSobrepasa}
            hint={r?.proyeccionSobrepasa ? "supera el tope" : "dentro del tope"} />
          <Metric label="Promedio mensual" value={clp(r?.promedioMensual ?? 0)} hint="últimos 12m" />
          <Metric label="Día del mes" value={`${r?.diaDelMes ?? 0} / ${r?.diasMes ?? 30}`} hint="del período" />
        </div>
        {r?.proyeccionSobrepasa && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Al ritmo actual cerrarías en <b>{clp(r.proyeccion)}</b>, {clp(r.proyeccion - r.presupuesto)} sobre el tope.
          </div>
        )}
      </div>

      {/* Anomalías */}
      {(data?.anomalias?.length ?? 0) > 0 && (
        <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-800">
            <AlertTriangle className="h-4 w-4" /> Gastos fuera de lo habitual
          </h2>
          <div className="space-y-1.5">
            {data!.anomalias.map((a, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-amber-900">
                <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                {a.texto}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tendencia 12 meses */}
      <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
          <TrendingUp className="h-4 w-4 text-indigo-500" /> Tendencia 12 meses
        </h2>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data?.tendencia ?? []} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <XAxis dataKey="mes" tickFormatter={MES_LABEL} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={clpShort} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={44} />
              <Tooltip formatter={(v) => clp(Number(v))} labelFormatter={(l) => MES_LABEL(String(l))}
                contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
              <ReferenceLine y={r?.presupuesto ?? 6000000} stroke="#dc2626" strokeDasharray="4 4" />
              <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                {(data?.tendencia ?? []).map((m, i) => (
                  <Cell key={i} fill={m.total > (r?.presupuesto ?? 6000000) ? "#dc2626" : i === (data!.tendencia.length - 1) ? "#4f46e5" : "#c7d2fe"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-1 text-center text-xs text-slate-400">Línea roja = tope de {clpShort(r?.presupuesto ?? 6000000)}</p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {/* Categorías */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Por categoría · este mes</h2>
          {(data?.categorias?.length ?? 0) === 0 ? (
            <p className="text-sm text-slate-400">Sin datos aún.</p>
          ) : (
            <div className="space-y-2.5">
              {data!.categorias.slice(0, 8).map((c) => {
                const max = data!.categorias[0].esteMes || 1;
                return (
                  <div key={c.categoria}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-700">{c.categoria}</span>
                      <span className={`font-medium ${c.sobrePromedio ? "text-red-600" : "text-slate-600"}`}>
                        {clp(c.esteMes)}
                        {c.promedio > 0 && <span className="ml-1 text-xs text-slate-400">/ prom {clpShort(c.promedio)}</span>}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full" style={{ width: `${Math.min(100, (c.esteMes / max) * 100)}%`, backgroundColor: c.sobrePromedio ? "#dc2626" : "#818cf8" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Suscripciones */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 flex items-center justify-between text-sm font-semibold text-slate-700">
            <span className="flex items-center gap-2"><Repeat className="h-4 w-4 text-violet-500" /> Suscripciones</span>
            {data?.totalSuscripciones ? <span className="text-xs text-slate-400">{clp(data.totalSuscripciones)}/mes</span> : null}
          </h2>
          {(data?.suscripciones?.length ?? 0) === 0 ? (
            <p className="text-sm text-slate-400">No detecté suscripciones recurrentes todavía.</p>
          ) : (
            <div className="space-y-1.5">
              {data!.suscripciones.map((s, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-1.5 text-sm">
                  <span className="truncate text-slate-700">{s.nombre}</span>
                  <span className="shrink-0 font-medium text-slate-600">{clp(s.monto)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Cuotas */}
      {(data?.cuotas?.length ?? 0) > 0 && (
        <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 flex items-center justify-between text-sm font-semibold text-slate-700">
            <span className="flex items-center gap-2"><Layers className="h-4 w-4 text-sky-500" /> Compras en cuotas</span>
            <span className="text-xs text-slate-400">pendiente: {clp(data!.totalCuotasPendiente)}</span>
          </h2>
          <div className="space-y-1.5">
            {data!.cuotas.map((c, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <span className="flex-1 truncate text-slate-700">{c.comercio}</span>
                <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[11px] font-semibold text-sky-700">{c.cuota_actual}/{c.cuota_total}</span>
                <span className="w-24 text-right text-slate-500">{clp(c.monto)}/mes</span>
                <span className="w-28 text-right font-medium text-slate-700">{clp(c.pendiente)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="mt-6 text-center text-xs text-slate-400">
        Alfred controla tu tope y te avisa por WhatsApp si te acercás al límite, aparece una suscripción nueva o hay un gasto anómalo.
      </p>
    </div>
  );
}

function Metric({ label, value, hint, danger }: { label: string; value: string; hint?: string; danger?: boolean }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className={`mt-0.5 text-lg font-semibold ${danger ? "text-red-600" : "text-slate-800"}`}>{value}</p>
      {hint && <p className={`text-[11px] ${danger ? "text-red-400" : "text-slate-400"}`}>{hint}</p>}
    </div>
  );
}
