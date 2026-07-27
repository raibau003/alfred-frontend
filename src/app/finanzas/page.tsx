"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Wallet, TrendingUp, AlertTriangle, RefreshCw, Loader2, Download, Repeat, CreditCard,
  Layers, Landmark, ArrowDownRight, ArrowUpRight, PiggyBank, X, Search,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, ReferenceLine, Cell, PieChart, Pie, Legend,
  ComposedChart, Line,
} from "recharts";

const clp = (n: number) => new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(Math.round(n || 0));
const clpShort = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (a >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${Math.round(n)}`;
};
const MES_NOM = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const mesLabel = (k: string) => { const [y, m] = (k || "").split("-"); return `${MES_NOM[Number(m) - 1] ?? m} ${y ?? ""}`.trim(); };

type Cat = { categoria: string; monto: number };
type Mov = { mes: string; fecha: string; comercio: string; monto: number; tipo: string; categoria: string; producto: string; banco: string; fuente?: string; titular?: string | null };
type MesData = {
  santanderCC: { ingresos: number; egresos: number };
  biceCC: { ingresos: number; egresos: number };
  tarjeta: { gasto: number };
  ingresos: number; egresos: number; neto: number;
  categorias: Cat[]; categoriasTarjeta: Cat[];
  // true = el mes no tiene NINGÚN movimiento de cuenta corriente, o sea que la cartola no se
  // ha cargado. Los totales entonces son desconocidos, no cero.
  faltaCartola?: boolean;
  movsCC?: number; movsTarjeta?: number;
};
type Dash = {
  config: { presupuesto: number; moneda: string };
  meses: string[]; mesReferencia: string;
  porMes: Record<string, MesData>;
  evolucion: { mes: string; ingresos: number; egresos: number; neto: number; tarjeta: number }[];
  suscripciones: { nombre: string; monto: number; categoria: string }[];
  totalSuscripciones: number;
  cuotas: { comercio: string; monto: number; cuota_actual: number; cuota_total: number; restantes: number; pendiente: number }[];
  totalCuotasPendiente: number;
  movimientos: Mov[];
  totalMovimientos: number;
  mesActual?: string;
  porTitular?: { titular: string; total: number; esteMes: number; count: number; categorias: { categoria: string; monto: number }[] }[];
};

const PIE = ["#4f46e5", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#64748b"];
const TABS = ["Resumen", "Personas", "Tarjetas", "Cuentas", "Categorías", "Evolución", "Proyección"] as const;
type Tab = typeof TABS[number];

export default function FinanzasPage() {
  const [d, setD] = useState<Dash | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [mes, setMes] = useState<string>("");
  const [tab, setTab] = useState<Tab>("Resumen");
  const [catSel, setCatSel] = useState<string>("");
  const [movQuery, setMovQuery] = useState<string>("");
  const [movTitular, setMovTitular] = useState<string>("");

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/finance/dashboard", { cache: "no-store" });
      const j = await r.json();
      if (!j.error) { setD(j); setMes((prev) => prev || j.mesReferencia || (j.meses?.[j.meses.length - 1] ?? "")); }
    } catch {} finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const importar = async () => {
    setImporting(true);
    try { await fetch("/api/finance/import", { method: "POST" }); } catch {}
    setTimeout(() => { setImporting(false); load(); }, 5000);
  };

  const pm = d?.porMes?.[mes];
  const presupuesto = d?.config.presupuesto ?? 6000000;
  const movsMes = useMemo(() => (d?.movimientos ?? []).filter((m) => m.mes === mes), [d, mes]);
  // TODOS los movimientos de la categoría seleccionada (todos los meses, cuenta + tarjeta).
  const movsCat = useMemo(() => (d?.movimientos ?? []).filter((m) => m.categoria === catSel && m.tipo === "cargo"), [d, catSel]);
  // Totales por categoría sobre TODOS los meses (cuenta + tarjeta) → barras coherentes con el detalle.
  const catsAll = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const t of (d?.movimientos ?? [])) { if (t.tipo !== "cargo") continue; const c = t.categoria || "Otros"; acc[c] = (acc[c] || 0) + t.monto; }
    return Object.entries(acc).map(([categoria, monto]) => ({ categoria, monto })).sort((a, b) => b.monto - a.monto);
  }, [d]);
  // Vista de movimientos: si hay búsqueda → TODAS las categorías; si no → la categoría seleccionada.
  // Filtro por persona: "Javier" = sus wallet + los de cartola (cuentas propias, titular vacío); "Emi" = solo wallet de Emi.
  const movsFiltered = useMemo(() => {
    const q = movQuery.trim().toLowerCase();
    let base = q ? (d?.movimientos ?? []).filter((m) => m.tipo === "cargo") : (catSel ? movsCat : []);
    if (q) base = base.filter((m) => (m.comercio || "").toLowerCase().includes(q) || (m.categoria || "").toLowerCase().includes(q) || (m.banco || "").toLowerCase().includes(q));
    if (movTitular === "Emi") base = base.filter((m) => m.titular === "Emi");
    else if (movTitular === "Javier") base = base.filter((m) => m.titular === "Javier" || !m.titular);
    return base;
  }, [d, movQuery, catSel, movsCat, movTitular]);

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-slate-300" /></div>;

  const sinDatos = !d || (d.totalMovimientos ?? 0) === 0;

  return (
    <div className="mx-auto max-w-5xl p-6">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700"><Wallet className="h-6 w-6" /></div>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-slate-900">Control financiero</h1>
          <p className="text-sm text-slate-500">Santander + BICE · {d?.totalMovimientos ?? 0} movimientos · {d?.meses?.length ?? 0} meses</p>
        </div>
        {(d?.meses?.length ?? 0) > 0 && (
          <select value={mes} onChange={(e) => setMes(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700">
            {[...(d?.meses ?? [])].reverse().map((m) => <option key={m} value={m}>{mesLabel(m)}</option>)}
          </select>
        )}
        <button onClick={load} className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-slate-500 hover:bg-slate-100"><RefreshCw className="h-3.5 w-3.5" /> Actualizar</button>
        <button onClick={importar} disabled={importing} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
          {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} Importar
        </button>
      </div>

      {sinDatos && (
        <div className="mb-6 rounded-xl border border-dashed border-emerald-200 bg-emerald-50/50 p-5 text-center">
          <CreditCard className="mx-auto mb-2 h-9 w-9 text-emerald-500" />
          <p className="font-medium text-emerald-800">Aún no importé tus cartolas.</p>
          <p className="mt-1 text-sm text-emerald-700">Tocá <b>Importar</b> o pedile a Alfred “analizá mis gastos”.</p>
        </div>
      )}

      {/* Sin cartola del mes, los totales de cuenta corriente no son cero: son desconocidos.
          Mostrarlos como $0 hace pensar que los datos se perdieron — que es exactamente lo
          que pasó con julio, que tenía la tarjeta cargada y la cartola no. */}
      {pm?.faltaCartola && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Todavía no tengo la cartola de cuenta corriente de este mes, así que ingresos, egresos y
            neto están sin datos — no en cero. El gasto de tarjeta sí está al día.
          </span>
        </div>
      )}

      {/* KPIs del mes */}
      {pm && (
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi icon={<ArrowUpRight className="h-4 w-4" />} label="Ingresos" value={pm.faltaCartola ? "—" : clp(pm.ingresos)} color={pm.faltaCartola ? "text-slate-300" : "text-emerald-600"} sub={pm.faltaCartola ? "sin cartola" : undefined} />
          <Kpi icon={<ArrowDownRight className="h-4 w-4" />} label="Egresos" value={pm.faltaCartola ? "—" : clp(pm.egresos)} color={pm.faltaCartola ? "text-slate-300" : "text-slate-700"} sub={pm.faltaCartola ? "sin cartola" : undefined} />
          <Kpi icon={<PiggyBank className="h-4 w-4" />} label="Neto" value={pm.faltaCartola ? "—" : clp(pm.neto)} color={pm.faltaCartola ? "text-slate-300" : pm.neto < 0 ? "text-red-600" : "text-emerald-600"} sub={pm.faltaCartola ? "sin cartola" : undefined} />
          <Kpi icon={<CreditCard className="h-4 w-4" />} label="Gasto tarjeta" value={clp(pm.tarjeta.gasto)} color={pm.tarjeta.gasto > presupuesto ? "text-red-600" : "text-indigo-600"} sub={`${Math.round(pm.tarjeta.gasto / presupuesto * 100)}% del tope`} />
        </div>
      )}

      {/* Tabs */}
      <div className="mb-4 flex flex-wrap gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-2 text-sm font-medium -mb-px border-b-2 ${tab === t ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}>{t}</button>
        ))}
      </div>

      {/* ─── RESUMEN ─── */}
      {tab === "Resumen" && pm && (
        <div className="space-y-4">
          <Card title="Flujo del mes">
            <div className="grid grid-cols-3 gap-3 text-center">
              <Big label="Ingresos" value={pm.faltaCartola ? "—" : clp(pm.ingresos)} color={pm.faltaCartola ? "text-slate-300" : "text-emerald-600"} />
              <Big label="Egresos" value={pm.faltaCartola ? "—" : clp(pm.egresos)} color={pm.faltaCartola ? "text-slate-300" : "text-slate-700"} />
              <Big label="Resultado" value={pm.faltaCartola ? "—" : clp(pm.neto)} color={pm.faltaCartola ? "text-slate-300" : pm.neto < 0 ? "text-red-600" : "text-emerald-600"} />
            </div>
          </Card>
          <div className="grid gap-4 md:grid-cols-2">
            <Card title="Por banco (cuenta corriente)">
              <BankRow name="Santander" ing={pm.santanderCC.ingresos} egr={pm.santanderCC.egresos} />
              <BankRow name="BICE" ing={pm.biceCC.ingresos} egr={pm.biceCC.egresos} />
            </Card>
            <Card title="Top categorías (egresos)">
              <CatBars cats={[...pm.categorias].slice(0, 6)} />
            </Card>
          </div>
          <Card title="Evolución · egresos vs ingresos">
            <EvolChart data={d!.evolucion} keys={[{ k: "ingresos", c: "#10b981" }, { k: "egresos", c: "#6366f1" }]} />
          </Card>
        </div>
      )}

      {/* ─── TARJETAS ─── */}
      {tab === "Tarjetas" && (
        <div className="space-y-4">
          <Card title={`Gasto de tarjeta · ${mesLabel(mes)}`}>
            <div className="mb-2 flex items-end justify-between">
              <p className="text-3xl font-bold text-slate-900">{clp(pm?.tarjeta.gasto ?? 0)}</p>
              <p className="text-sm text-slate-500">Tope: {clp(presupuesto)}</p>
            </div>
            <Bar100 value={pm?.tarjeta.gasto ?? 0} max={presupuesto} />
            {(pm?.tarjeta.gasto ?? 0) > presupuesto && (
              <p className="mt-2 flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"><AlertTriangle className="h-4 w-4" /> Superaste el tope en {clp((pm?.tarjeta.gasto ?? 0) - presupuesto)}.</p>
            )}
          </Card>
          <Card title="Gasto de tarjeta · 12 meses">
            <EvolChart data={d!.evolucion} keys={[{ k: "tarjeta", c: "#4f46e5" }]} refLine={presupuesto} />
          </Card>
          <div className="grid gap-4 md:grid-cols-2">
            <Card title={`Suscripciones · ${clp(d!.totalSuscripciones)}/mes`}>
              {d!.suscripciones.length === 0 ? <Empty text="Sin suscripciones detectadas." /> : (
                <div className="space-y-1.5">{d!.suscripciones.map((s, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-1.5 text-sm">
                    <span className="truncate text-slate-700"><Repeat className="mr-1.5 inline h-3.5 w-3.5 text-violet-500" />{s.nombre}</span>
                    <span className="shrink-0 font-medium text-slate-600">{clp(s.monto)}</span>
                  </div>))}
                </div>
              )}
            </Card>
            <Card title={`Cuotas abiertas · pendiente ${clp(d!.totalCuotasPendiente)}`}>
              {d!.cuotas.length === 0 ? <Empty text="Sin cuotas abiertas." /> : (
                <div className="space-y-1.5">{d!.cuotas.map((c, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-1.5 text-sm">
                    <span className="flex-1 truncate text-slate-700"><Layers className="mr-1.5 inline h-3.5 w-3.5 text-sky-500" />{c.comercio}</span>
                    <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[11px] font-semibold text-sky-700">{c.cuota_actual}/{c.cuota_total}</span>
                    <span className="w-24 text-right font-medium text-slate-700">{clp(c.pendiente)}</span>
                  </div>))}
                </div>
              )}
            </Card>
          </div>
          <Card title="Tarjeta · por categoría (este mes)"><CatBars cats={pm?.categoriasTarjeta ?? []} /></Card>
        </div>
      )}

      {/* ─── CUENTAS ─── */}
      {tab === "Cuentas" && pm && (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <AccountCard name="Santander · Cuenta corriente" bank={pm.santanderCC} />
            <AccountCard name="BICE · Cuenta corriente" bank={pm.biceCC} />
          </div>
          <Card title={`Movimientos · ${mesLabel(mes)}`}>
            <MovTable movs={movsMes.filter((m) => m.producto === "cuenta_corriente")} />
          </Card>
        </div>
      )}

      {/* ─── CATEGORÍAS ─── */}
      {tab === "Categorías" && pm && (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card title="Egresos cuenta corriente"><CatPie cats={pm.categorias} /></Card>
            <Card title="Gasto tarjeta"><CatPie cats={pm.categoriasTarjeta} /></Card>
          </div>

          {/* Buscador global + filtro por persona */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={movQuery}
                onChange={(e) => setMovQuery(e.target.value)}
                placeholder="Buscar comercio en TODOS los gastos (ej: Uber, Netflix, farmacia)…"
                className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-8 text-sm outline-none focus:border-indigo-400"
              />
              {movQuery && (
                <button onClick={() => setMovQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>
              )}
            </div>
            <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 bg-white p-0.5 text-xs">
              {[["", "Todos"], ["Javier", "🧑 Javier"], ["Emi", "👩 Emi"]].map(([v, l]) => (
                <button key={v} onClick={() => setMovTitular(v)} className={`rounded-md px-2.5 py-1 font-medium transition-colors ${movTitular === v ? "bg-[#0a1628] text-white" : "text-slate-500 hover:bg-slate-100"}`}>{l}</button>
              ))}
            </div>
          </div>

          {!movQuery && (
            <Card title="Detalle egresos (cuenta + tarjeta) · todos los meses · tocá una categoría">
              <CatBars cats={catsAll} onSelect={setCatSel} selected={catSel} />
            </Card>
          )}

          {(movQuery || catSel) && (
            <Card title={movQuery ? `Resultados · “${movQuery}”` : `Detalle · ${catSel} · todos los meses`}>
              {!movQuery && <p className="mb-2 -mt-1 text-xs text-slate-400">Todos los gastos de esta categoría (cuenta corriente + tarjeta), del más grande al más chico.</p>}
              {movQuery && movsFiltered.length === 0 && <p className="mb-1 text-xs text-slate-400">Sin resultados para “{movQuery}”{movTitular ? ` de ${movTitular}` : ""}.</p>}
              <MovTable movs={movsFiltered} showCat={!!movQuery || !catSel} />
            </Card>
          )}
        </div>
      )}

      {/* ─── EVOLUCIÓN ─── */}
      {tab === "Evolución" && (
        <div className="space-y-4">
          <Card title="Ingresos · Egresos · 12 meses"><EvolChart data={d!.evolucion} keys={[{ k: "ingresos", c: "#10b981" }, { k: "egresos", c: "#6366f1" }]} tall /></Card>
          <Card title="Resultado neto · 12 meses"><EvolChart data={d!.evolucion} keys={[{ k: "neto", c: "#0ea5e9" }]} tall zero /></Card>
          <Card title="Gasto de tarjeta · 12 meses"><EvolChart data={d!.evolucion} keys={[{ k: "tarjeta", c: "#4f46e5" }]} refLine={presupuesto} tall /></Card>
        </div>
      )}

      {/* ─── PERSONAS (quién gasta qué, real-time) ─── */}
      {tab === "Personas" && (
        <div className="space-y-4">
          <p className="text-xs text-slate-400">Gastos en tiempo real por persona (notificaciones del banco vía Wallet).{d!.mesActual ? ` Mes actual: ${d!.mesActual}.` : ""}</p>
          {(!d!.porTitular || d!.porTitular.length === 0) ? (
            <Card title="Sin gastos por persona todavía">
              <p className="text-sm text-slate-500">Cuando lleguen notificaciones del banco (Javier/Emi) vía el Atajo de Wallet, vas a ver acá <b>quién gasta en qué</b>, categorizado y al día.</p>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {d!.porTitular.map((p) => (
                <Card key={p.titular} title={`${p.titular === "Emi" ? "👩" : "🧑"} ${p.titular}`}>
                  <div className="mb-3 flex items-end justify-between">
                    <div><p className="text-[11px] text-slate-400">Este mes</p><p className="text-2xl font-bold text-slate-900">{clp(p.esteMes)}</p></div>
                    <div className="text-right"><p className="text-[11px] text-slate-400">Total · {p.count} mov.</p><p className="text-sm font-medium text-slate-500">{clp(p.total)}</p></div>
                  </div>
                  <div className="space-y-1.5">
                    {p.categorias.slice(0, 8).map((c) => {
                      const pct = p.total ? Math.round((c.monto / p.total) * 100) : 0;
                      return (
                        <div key={c.categoria}>
                          <div className="flex justify-between text-xs"><span className="text-slate-600">{c.categoria}</span><span className="text-slate-500">{clp(c.monto)}</span></div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${pct}%` }} /></div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "Proyección" && <ProyeccionTab />}

      <p className="mt-6 text-center text-xs text-slate-400">
        Alfred ingiere tus cartolas del correo y te avisa por WhatsApp de gastos nuevos o fuera de lo habitual.
      </p>
    </div>
  );
}

type Flujo = { nombre: string; monto: number };
function ProyeccionTab() {
  const [ingreso, setIngreso] = useState(0);
  const [saldo0, setSaldo0] = useState(0);
  const [ai, setAi] = useState(0); // % ajuste ingreso mensual
  const [ae, setAe] = useState(0); // % ajuste egresos mensual
  const [egresos, setEgresos] = useState<Flujo[]>([]);
  const [defaults, setDefaults] = useState<{ ingresoMensual: number; egresos: Flujo[]; saldoInicial: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  const applyState = useCallback((s: { ingresoMensual?: number; egresos?: Flujo[]; saldoInicial?: number; ajusteIngreso?: number; ajusteEgreso?: number }) => {
    setIngreso(s.ingresoMensual ?? 0); setEgresos(s.egresos ?? []); setSaldo0(s.saldoInicial ?? 0);
    setAi(s.ajusteIngreso ?? 0); setAe(s.ajusteEgreso ?? 0);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const j = await fetch("/api/finance/projection", { cache: "no-store" }).then((r) => r.json());
        setDefaults(j.defaults);
        applyState(j.guardado || j.defaults);
      } catch {} finally { setLoading(false); }
    })();
  }, [applyState]);

  const totalEgr = egresos.reduce((a, e) => a + (Number(e.monto) || 0), 0);
  const proj = useMemo(() => {
    const now = new Date();
    const rows: { mes: string; ingreso: number; egreso: number; resultado: number; saldo: number }[] = [];
    let saldo = Number(saldo0) || 0;
    for (let i = 0; i < 12; i++) {
      const ing = Math.round((Number(ingreso) || 0) * Math.pow(1 + ai / 100, i));
      const egr = Math.round(totalEgr * Math.pow(1 + ae / 100, i));
      const res = ing - egr; saldo += res;
      const d = new Date(now.getFullYear(), now.getMonth() + 1 + i, 1);
      rows.push({ mes: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, ingreso: ing, egreso: egr, resultado: res, saldo });
    }
    return rows;
  }, [ingreso, saldo0, ai, ae, totalEgr]);

  const resultadoMensual = (Number(ingreso) || 0) - totalEgr;
  const saldoFinal = proj[proj.length - 1]?.saldo ?? 0;

  const save = async () => {
    await fetch("/api/finance/projection", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cashflow: { ingresoMensual: Number(ingreso) || 0, egresos, saldoInicial: Number(saldo0) || 0, ajusteIngreso: ai, ajusteEgreso: ae } }) }).catch(() => {});
    setSaved(true); setTimeout(() => setSaved(false), 2500);
  };
  const reset = () => defaults && applyState(defaults);
  const setEgr = (i: number, patch: Partial<Flujo>) => setEgresos((e) => e.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const addEgr = () => setEgresos((e) => [...e, { nombre: "Nuevo gasto", monto: 0 }]);
  const delEgr = (i: number) => setEgresos((e) => e.filter((_, j) => j !== i));

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="h-5 w-5 animate-spin text-slate-300" /></div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Kpi icon={<ArrowUpRight className="h-4 w-4" />} label="Ingreso mensual" value={clp(Number(ingreso) || 0)} color="text-emerald-600" />
        <Kpi icon={<ArrowDownRight className="h-4 w-4" />} label="Egresos mensuales" value={clp(totalEgr)} color="text-slate-700" />
        <Kpi icon={<PiggyBank className="h-4 w-4" />} label="Resultado / mes" value={clp(resultadoMensual)} color={resultadoMensual < 0 ? "text-red-600" : "text-emerald-600"} />
      </div>

      <Card title="Saldo proyectado · próximos 12 meses">
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={proj} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <XAxis dataKey="mes" tickFormatter={(m) => mesLabel(m).slice(0, 3)} tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={clpShort} tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={44} />
              <Tooltip formatter={(v) => clp(Number(v))} labelFormatter={(l) => mesLabel(String(l))} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <ReferenceLine y={0} stroke="#94a3b8" />
              <Bar dataKey="resultado" radius={[3, 3, 0, 0]}>{proj.map((r, i) => <Cell key={i} fill={r.resultado < 0 ? "#fca5a5" : "#a7f3d0"} />)}</Bar>
              <Line type="monotone" dataKey="saldo" stroke="#4f46e5" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <p className={`mt-2 text-center text-sm font-medium ${saldoFinal < 0 ? "text-red-600" : "text-emerald-600"}`}>
          Saldo proyectado a 12 meses: {clp(saldoFinal)} {resultadoMensual < 0 && <span className="text-red-500">· ojo: gastás más de lo que entra</span>}
        </p>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Supuestos (editá los valores)">
          <div className="space-y-2 text-sm">
            <NumRow label="Ingreso mensual" value={ingreso} onChange={setIngreso} />
            <NumRow label="Saldo inicial" value={saldo0} onChange={setSaldo0} />
            <NumRow label="Ajuste ingreso %/mes" value={ai} onChange={setAi} small />
            <NumRow label="Ajuste egresos %/mes" value={ae} onChange={setAe} small />
          </div>
        </Card>
        <Card title="Egresos recurrentes (editá / agregá / quitá)">
          <div className="space-y-1.5">
            {egresos.map((e, i) => (
              <div key={i} className="flex items-center gap-2">
                <input value={e.nombre} onChange={(ev) => setEgr(i, { nombre: ev.target.value })} className="min-w-0 flex-1 rounded border border-slate-200 px-2 py-1 text-sm" />
                <input value={e.monto} onChange={(ev) => setEgr(i, { monto: Number(ev.target.value.replace(/\D/g, "")) || 0 })} className="w-28 rounded border border-slate-200 px-2 py-1 text-right text-sm" />
                <button onClick={() => delEgr(i)} className="text-slate-300 hover:text-red-500"><X className="h-4 w-4" /></button>
              </div>
            ))}
            <button onClick={addEgr} className="mt-1 text-xs font-medium text-indigo-600 hover:underline">+ Agregar gasto</button>
          </div>
        </Card>
      </div>

      <div className="flex items-center gap-2">
        <button onClick={save} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700">{saved ? "✓ Guardado" : "Guardar escenario"}</button>
        <button onClick={reset} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">Volver a valores reales</button>
        <p className="text-xs text-slate-400">Semilla: ingreso = promedio 3 meses · egresos = promedio 12 meses.</p>
      </div>
    </div>
  );
}
function NumRow({ label, value, onChange, small }: { label: string; value: number; onChange: (n: number) => void; small?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-slate-600">{label}</span>
      <input value={value} onChange={(e) => onChange(Number(e.target.value.replace(small ? /[^\d.-]/g : /\D/g, "")) || 0)}
        className="w-32 rounded border border-slate-200 px-2 py-1 text-right text-sm" />
    </div>
  );
}

/* ── componentes ── */
function Kpi({ icon, label, value, color, sub }: { icon: React.ReactNode; label: string; value: string; color: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="flex items-center gap-1 text-xs text-slate-400">{icon} {label}</p>
      <p className={`mt-0.5 text-lg font-bold ${color}`}>{value}</p>
      {sub && <p className="text-[11px] text-slate-400">{sub}</p>}
    </div>
  );
}
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="mb-3 text-sm font-semibold text-slate-700">{title}</h2>{children}</div>;
}
function Big({ label, value, color }: { label: string; value: string; color: string }) {
  return <div><p className="text-xs text-slate-400">{label}</p><p className={`mt-0.5 text-xl font-bold ${color}`}>{value}</p></div>;
}
function Empty({ text }: { text: string }) { return <p className="text-sm text-slate-400">{text}</p>; }
function BankRow({ name, ing, egr }: { name: string; ing: number; egr: number }) {
  return (
    <div className="mb-2 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm last:mb-0">
      <Landmark className="h-4 w-4 text-slate-400" />
      <span className="flex-1 font-medium text-slate-700">{name}</span>
      <span className="text-emerald-600">+{clpShort(ing)}</span>
      <span className="text-slate-500">−{clpShort(egr)}</span>
    </div>
  );
}
function AccountCard({ name, bank }: { name: string; bank: { ingresos: number; egresos: number } }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700"><Landmark className="h-4 w-4 text-slate-400" /> {name}</h3>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-emerald-50 p-2"><p className="text-xs text-emerald-600">Ingresos</p><p className="text-base font-semibold text-emerald-700">{clp(bank.ingresos)}</p></div>
        <div className="rounded-lg bg-slate-50 p-2"><p className="text-xs text-slate-500">Egresos</p><p className="text-base font-semibold text-slate-700">{clp(bank.egresos)}</p></div>
      </div>
      <p className={`mt-2 text-sm font-medium ${bank.ingresos - bank.egresos < 0 ? "text-red-600" : "text-emerald-600"}`}>Neto: {clp(bank.ingresos - bank.egresos)}</p>
    </div>
  );
}
function Bar100({ value, max }: { value: number; max: number }) {
  const pct = Math.min(100, (value / max) * 100);
  const c = pct >= 100 ? "#dc2626" : pct >= 80 ? "#f59e0b" : "#4f46e5";
  return (
    <div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: c }} /></div>
      <p className="mt-1 text-sm font-medium" style={{ color: c }}>{Math.round((value / max) * 100)}% del tope</p>
    </div>
  );
}
function CatBars({ cats, onSelect, selected }: { cats: Cat[]; onSelect?: (c: string) => void; selected?: string }) {
  if (!cats.length) return <Empty text="Sin datos." />;
  const max = cats[0]?.monto || 1;
  return (
    <div className="space-y-2">{cats.map((c, i) => (
      <div key={c.categoria} onClick={() => onSelect?.(selected === c.categoria ? "" : c.categoria)}
        className={onSelect ? `cursor-pointer rounded-lg p-1 -m-1 ${selected === c.categoria ? "bg-indigo-50 ring-1 ring-indigo-200" : "hover:bg-slate-50"}` : ""}>
        <div className="flex justify-between text-sm"><span className="text-slate-700">{c.categoria}</span><span className="font-medium text-slate-600">{clp(c.monto)}</span></div>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full" style={{ width: `${(c.monto / max) * 100}%`, backgroundColor: PIE[i % PIE.length] }} /></div>
      </div>))}
    </div>
  );
}
function CatPie({ cats }: { cats: Cat[] }) {
  const data = cats.slice(0, 8);
  if (!data.length) return <Empty text="Sin datos." />;
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <Pie data={data} dataKey="monto" nameKey="categoria" cx="50%" cy="50%" outerRadius={80} label={(e: any) => String(e?.categoria ?? "")} labelLine={false} fontSize={10}>
            {data.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}
          </Pie>
          <Tooltip formatter={(v) => clp(Number(v))} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
function EvolChart({ data, keys, refLine, tall, zero }: { data: { mes: string }[]; keys: { k: string; c: string }[]; refLine?: number; tall?: boolean; zero?: boolean }) {
  return (
    <div className={tall ? "h-72 w-full" : "h-56 w-full"}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <XAxis dataKey="mes" tickFormatter={(m) => mesLabel(m).slice(0, 3)} tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={clpShort} tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={44} />
          <Tooltip formatter={(v) => clp(Number(v))} labelFormatter={(l) => mesLabel(String(l))} contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
          {refLine != null && <ReferenceLine y={refLine} stroke="#dc2626" strokeDasharray="4 4" />}
          {zero && <ReferenceLine y={0} stroke="#94a3b8" />}
          {keys.map((k) => (
            <Bar key={k.k} dataKey={k.k} radius={[3, 3, 0, 0]} fill={k.c}>
              {zero && data.map((row, i) => <Cell key={i} fill={((row as unknown as Record<string, number>)[k.k] ?? 0) < 0 ? "#ef4444" : "#10b981"} />)}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
function MovTable({ movs, showCat = true }: { movs: Mov[]; showCat?: boolean }) {
  if (!movs.length) return <Empty text="Sin movimientos." />;
  const sorted = [...movs].sort((a, b) => b.monto - a.monto);
  const total = sorted.reduce((a, m) => a + (m.tipo === "abono" ? -m.monto : m.monto), 0);
  const fmtF = (f?: string) => { const s = (f || "").slice(0, 10).split("-"); return s.length === 3 ? `${s[2]}/${s[1]}` : ""; };
  return (
    <div>
      <div className="max-h-[28rem] overflow-y-auto">
        <table className="w-full text-sm">
          <tbody>
            {sorted.map((m, i) => (
              <tr key={i} className="border-b border-slate-50">
                <td className="py-1.5 pr-2 align-top text-[11px] text-slate-400 whitespace-nowrap">{fmtF(m.fecha)}</td>
                <td className="py-1.5"><span className={`mr-1.5 inline-block h-2 w-2 rounded-full ${m.tipo === "abono" ? "bg-emerald-500" : "bg-slate-300"}`} />{m.comercio}{m.fuente === "wallet" && <span className="ml-1.5 rounded bg-orange-100 px-1 py-0.5 text-[10px] font-medium text-orange-600">📱 {m.titular ?? "celular"}</span>}
                  <span className="block text-[10px] text-slate-400">{m.banco}{showCat ? ` · ${m.categoria}` : ""}{m.producto === "tarjeta_credito" ? " · T.Crédito" : ""}</span>
                </td>
                <td className={`py-1.5 text-right font-medium whitespace-nowrap ${m.tipo === "abono" ? "text-emerald-600" : "text-slate-700"}`}>{m.tipo === "abono" ? "+" : "−"}{clp(m.monto)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-2 text-sm font-semibold text-slate-700">
        <span>Total ({sorted.length})</span><span>{clp(total)}</span>
      </div>
    </div>
  );
}
function mergeCats(a: Cat[], b: Cat[]): Cat[] {
  const map: Record<string, number> = {};
  for (const c of [...a, ...b]) map[c.categoria] = (map[c.categoria] || 0) + c.monto;
  return Object.entries(map).map(([categoria, monto]) => ({ categoria, monto })).sort((x, y) => y.monto - x.monto);
}
