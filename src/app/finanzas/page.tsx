"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  Wallet, TrendingUp, AlertTriangle, RefreshCw, Loader2, Download, Repeat, CreditCard,
  Layers, Landmark, ArrowDownRight, ArrowUpRight, PiggyBank, X, Search, Check, ChevronDown, Zap,
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
// Cómo se nombra la selección de meses. Con un mes elegido dice el mes; con varios dice
// cuántos y desde/hasta, para que ningún total quede sin decir a qué período corresponde.
const rangoLabel = (sel: string[], total: number) => {
  if (!sel.length) return "sin meses";
  if (sel.length === 1) return mesLabel(sel[0]);
  const s = [...sel].sort();
  if (sel.length === total) return `los ${total} meses`;
  return `${sel.length} meses (${mesLabel(s[0])} – ${mesLabel(s[s.length - 1])})`;
};

type Cat = { categoria: string; monto: number };
type PatPacItem = {
  comercio: string; modalidad: "PAT" | "PAC"; producto: string; banco: string;
  categoria: string; monto: number; ultimoMes: string; mesesActivo: number;
  cobros: number; total: number;
};
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
  // Pagos automáticos (PAT = con tarjeta, PAC = de la cuenta). `vigentes` son los que se
  // cobraron en el último mes con datos: el compromiso real del mes que viene. `items`
  // trae también los dados de baja, que sirven para mirar y no para sumar.
  patPac?: {
    items: PatPacItem[]; vigentes: PatPacItem[]; ultimoMes: string;
    totalMensual: number; totalPAT: number; totalPAC: number;
  };
  totalSuscripciones: number;
  cuotas: { comercio: string; monto: number; cuota_actual: number; cuota_total: number; restantes: number; pendiente: number }[];
  totalCuotasPendiente: number;
  movimientos: Mov[];
  totalMovimientos: number;
  mesActual?: string;
  porTitular?: { titular: string; total: number; esteMes: number; count: number; categorias: { categoria: string; monto: number }[] }[];
};

const PIE = ["#4f46e5", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#64748b"];
const TABS = ["Resumen", "Personas", "Tarjetas", "PAT / PAC", "Cuentas", "Categorías", "Evolución", "Proyección"] as const;
type Tab = typeof TABS[number];

// Estado del Atajo del celular. Los "golpes" son los intentos que llegaron al router desde el
// último arranque: sirven para distinguir "el Atajo no disparó" de "disparó y algo lo rechazó".
interface AtajoEstado {
  titulares_configurados?: string[];
  guardados_hoy?: number;
  arrancado?: string;
  golpes?: { cuando: string; resultado: string; titular?: string; monto?: number | null; comercio?: string | null; detalle?: string | null; desde?: string }[];
  atajo_sano?: boolean;
  ultimos_guardados?: { fecha: string; titular: string; comercio: string; monto: number; created_at: string }[];
  error?: string;
}

export default function FinanzasPage() {
  const [d, setD] = useState<Dash | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  // Meses ELEGIDOS (uno o varios). Todo lo que se ve abajo —KPIs, categorías, personas y
  // detalle línea a línea— se calcula sobre esta selección: si está julio se ve julio, y si
  // se agregan meses se ve la suma de esos meses. Antes el selector era de un mes solo y el
  // detalle de categorías ignoraba el mes elegido (decía "todos los meses"), así que la
  // pantalla mostraba dos períodos distintos a la vez sin avisarlo.
  const [meses, setMeses] = useState<string[]>([]);
  const [tab, setTab] = useState<Tab>("Resumen");
  const [catSel, setCatSel] = useState<string>("");
  const [movQuery, setMovQuery] = useState<string>("");
  const [movTitular, setMovTitular] = useState<string>("");
  const [fallo, setFallo] = useState<string | null>(null);
  const [atajo, setAtajo] = useState<AtajoEstado | null>(null);

  const load = useCallback(async () => {
    // El `catch {}` que había acá hacía que un router caído se viera EXACTAMENTE igual que
    // "no tenés gastos": la pestaña Personas decía "Sin gastos por persona todavía" mientras
    // los dos gastos del día estaban guardados y el endpoint los devolvía bien. Un error de
    // lectura se dice; si no, se toman decisiones sobre datos que no se leyeron.
    try {
      const r = await fetch("/api/finance/dashboard", { cache: "no-store" });
      const j = await r.json();
      if (j.error) { setFallo(String(j.error)); return; }
      setFallo(null);
      setD(j);
      setMeses((prev) => (prev.length ? prev : [j.mesReferencia || (j.meses?.[j.meses.length - 1] ?? "")].filter(Boolean)));
    } catch (e) {
      setFallo((e as Error).message || "no pude conectarme");
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  // Se pide solo al abrir Personas: es la única vista que lo muestra y no tiene sentido
  // pagar la llamada en las otras cinco pestañas.
  useEffect(() => {
    if (tab !== "Personas") return;
    fetch("/api/finance/wallet-estado", { cache: "no-store" })
      .then((r) => r.json())
      .then(setAtajo)
      .catch((e) => setAtajo({ error: (e as Error).message }));
  }, [tab]);

  const importar = async () => {
    setImporting(true);
    try { await fetch("/api/finance/import", { method: "POST" }); } catch {}
    setTimeout(() => { setImporting(false); load(); }, 5000);
  };

  // Un solo mes → ese mes tal cual; varios → la suma. Se agrega acá y no en el router para
  // que cambiar la selección no cueste una llamada: el dashboard ya trae todos los meses.
  const pm = useMemo(() => aggMeses(d, meses), [d, meses]);
  const presupuesto = d?.config.presupuesto ?? 6000000;
  // El tope de tarjeta es MENSUAL: comparar 3 meses de gasto contra un mes de tope diría que
  // te pasaste cuando no. Con varios meses elegidos el tope se multiplica.
  const topeRango = presupuesto * Math.max(1, meses.length);
  const rango = rangoLabel(meses, d?.meses?.length ?? 0);
  const mesesSet = useMemo(() => new Set(meses), [meses]);
  // Movimientos del período elegido: la base de las pestañas Cuentas, Categorías y Personas.
  const movsSel = useMemo(() => (d?.movimientos ?? []).filter((m) => mesesSet.has(m.mes)), [d, mesesSet]);
  // Meses elegidos que todavía no tienen cartola de cuenta corriente: sus ingresos/egresos
  // son desconocidos, no cero, y eso cambia cómo hay que leer los totales de arriba.
  const mesesSinCartola = useMemo(() => meses.filter((m) => d?.porMes?.[m]?.faltaCartola).sort(), [d, meses]);
  // Movimientos de la categoría elegida, dentro del período elegido (cuenta + tarjeta).
  const movsCat = useMemo(() => movsSel.filter((m) => m.categoria === catSel && m.tipo === "cargo"), [movsSel, catSel]);
  // Totales por categoría del período (cuenta + tarjeta) → barras coherentes con el detalle.
  const catsAll = useMemo(() => catsDeMovs(movsSel), [movsSel]);
  // Vista de movimientos: si hay búsqueda → TODAS las categorías; si no → la categoría seleccionada.
  // Filtro por persona: "Javier" = sus wallet + los de cartola (cuentas propias, titular vacío); "Emi" = solo wallet de Emi.
  const movsFiltered = useMemo(() => {
    const q = movQuery.trim().toLowerCase();
    let base = q ? movsSel.filter((m) => m.tipo === "cargo") : (catSel ? movsCat : []);
    if (q) base = base.filter((m) => coincide(m, q));
    if (movTitular === "Emi") base = base.filter((m) => m.titular === "Emi");
    else if (movTitular === "Javier") base = base.filter((m) => m.titular === "Javier" || !m.titular);
    return base;
  }, [movsSel, movQuery, catSel, movsCat, movTitular]);
  // Cuántos resultados quedaron FUERA del período elegido. Sin este número, buscar "Netflix"
  // en un mes sin compras se lee como "nunca pagué Netflix", que es lo contrario de la verdad.
  const fueraDelRango = useMemo(() => {
    const q = movQuery.trim().toLowerCase();
    if (!q) return 0;
    return (d?.movimientos ?? []).filter((m) => m.tipo === "cargo" && !mesesSet.has(m.mes) && coincide(m, q)
      && (movTitular === "Emi" ? m.titular === "Emi" : movTitular === "Javier" ? (m.titular === "Javier" || !m.titular) : true)).length;
  }, [d, movQuery, mesesSet, movTitular]);

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
          <MesPicker meses={d!.meses} sel={meses} onChange={setMeses} porMes={d!.porMes} />
        )}
        <button onClick={load} className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-slate-500 hover:bg-slate-100"><RefreshCw className="h-3.5 w-3.5" /> Actualizar</button>
        <button onClick={importar} disabled={importing} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
          {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} Importar
        </button>
      </div>

      {fallo && (
        <div className="mb-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            No pude leer tus finanzas ({fallo}). Lo que ves abajo puede estar viejo o incompleto.{" "}
            <button onClick={load} className="underline">Reintentar</button>
          </span>
        </div>
      )}

      {!fallo && sinDatos && (
        <div className="mb-6 rounded-xl border border-dashed border-emerald-200 bg-emerald-50/50 p-5 text-center">
          <CreditCard className="mx-auto mb-2 h-9 w-9 text-emerald-500" />
          <p className="font-medium text-emerald-800">Aún no importé tus cartolas.</p>
          <p className="mt-1 text-sm text-emerald-700">Tocá <b>Importar</b> o pedile a Alfred “analizá mis gastos”.</p>
        </div>
      )}

      {/* Sin cartola del mes, los totales de cuenta corriente no son cero: son desconocidos.
          Mostrarlos como $0 hace pensar que los datos se perdieron — que es exactamente lo
          que pasó con julio, que tenía la tarjeta cargada y la cartola no. */}
      {mesesSinCartola.length > 0 && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            {mesesSinCartola.length === meses.length
              ? `Todavía no tengo la cartola de cuenta corriente ${meses.length === 1 ? "de este mes" : "de ninguno de los meses elegidos"}, así que ingresos, egresos y neto están sin datos — no en cero. El gasto de tarjeta sí está al día.`
              : `${mesesSinCartola.length} de los ${meses.length} meses elegidos ${mesesSinCartola.length === 1 ? "no tiene" : "no tienen"} cartola de cuenta corriente (${mesesSinCartola.map(mesLabel).join(", ")}): ingresos, egresos y neto son de los otros meses, no del total. El gasto de tarjeta sí está completo.`}
          </span>
        </div>
      )}

      {/* KPIs del mes */}
      {pm && (
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi icon={<ArrowUpRight className="h-4 w-4" />} label="Ingresos" value={pm.faltaCartola ? "—" : clp(pm.ingresos)} color={pm.faltaCartola ? "text-slate-300" : "text-emerald-600"} sub={pm.faltaCartola ? "sin cartola" : undefined} />
          <Kpi icon={<ArrowDownRight className="h-4 w-4" />} label="Egresos" value={pm.faltaCartola ? "—" : clp(pm.egresos)} color={pm.faltaCartola ? "text-slate-300" : "text-slate-700"} sub={pm.faltaCartola ? "sin cartola" : undefined} />
          <Kpi icon={<PiggyBank className="h-4 w-4" />} label="Neto" value={pm.faltaCartola ? "—" : clp(pm.neto)} color={pm.faltaCartola ? "text-slate-300" : pm.neto < 0 ? "text-red-600" : "text-emerald-600"} sub={pm.faltaCartola ? "sin cartola" : undefined} />
          <Kpi icon={<CreditCard className="h-4 w-4" />} label="Gasto tarjeta" value={clp(pm.tarjeta.gasto)} color={pm.tarjeta.gasto > topeRango ? "text-red-600" : "text-indigo-600"} sub={`${Math.round(pm.tarjeta.gasto / topeRango * 100)}% del tope${meses.length > 1 ? ` (${meses.length} meses)` : ""}`} />
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
          <Card title={`Flujo · ${rango}`}>
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
          <Card title={`Gasto de tarjeta · ${rango}`}>
            <div className="mb-2 flex items-end justify-between">
              <p className="text-3xl font-bold text-slate-900">{clp(pm?.tarjeta.gasto ?? 0)}</p>
              <p className="text-sm text-slate-500">Tope: {clp(topeRango)}{meses.length > 1 ? ` (${clp(presupuesto)} × ${meses.length} meses)` : ""}</p>
            </div>
            <Bar100 value={pm?.tarjeta.gasto ?? 0} max={topeRango} />
            {(pm?.tarjeta.gasto ?? 0) > topeRango && (
              <p className="mt-2 flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"><AlertTriangle className="h-4 w-4" /> Superaste el tope en {clp((pm?.tarjeta.gasto ?? 0) - topeRango)}.</p>
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
          <Card title={`Tarjeta · por categoría · ${rango}`}><CatBars cats={pm?.categoriasTarjeta ?? []} /></Card>
        </div>
      )}

      {/* ─── PAT / PAC ─── */}
      {tab === "PAT / PAC" && <PatPacTab data={d!.patPac} />}

      {/* ─── CUENTAS ─── */}
      {tab === "Cuentas" && pm && (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <AccountCard name="Santander · Cuenta corriente" bank={pm.santanderCC} />
            <AccountCard name="BICE · Cuenta corriente" bank={pm.biceCC} />
          </div>
          <Card title={`Movimientos · ${rango}`}>
            <MovTable movs={movsSel.filter((m) => m.producto === "cuenta_corriente")} />
          </Card>
        </div>
      )}

      {/* ─── CATEGORÍAS ─── */}
      {tab === "Categorías" && pm && (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Las tortas son el punto de entrada: tocar una porción abre esa categoría y el
                detalle línea a línea aparece abajo, sin tener que buscarla en la lista. */}
            <Card title={`Egresos cuenta corriente · ${rango}`}><CatPie cats={pm.categorias} onSelect={setCatSel} selected={catSel} /></Card>
            <Card title={`Gasto tarjeta · ${rango}`}><CatPie cats={pm.categoriasTarjeta} onSelect={setCatSel} selected={catSel} /></Card>
          </div>

          {/* Buscador global + filtro por persona */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={movQuery}
                onChange={(e) => setMovQuery(e.target.value)}
                placeholder={`Buscar comercio en ${rango} (ej: Uber, Netflix, farmacia)…`}
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
            <Card title={`Detalle egresos (cuenta + tarjeta) · ${rango} · tocá una categoría`}>
              <CatBars cats={catsAll} onSelect={setCatSel} selected={catSel} />
            </Card>
          )}

          {(movQuery || catSel) && (
            <Card title={movQuery ? `Resultados · “${movQuery}” · ${rango}` : `Detalle · ${catSel} · ${rango}`}>
              {!movQuery && <p className="mb-2 -mt-1 text-xs text-slate-400">Todos los gastos de esta categoría (cuenta corriente + tarjeta) en {rango}, del más grande al más chico.</p>}
              {movQuery && movsFiltered.length === 0 && <p className="mb-1 text-xs text-slate-400">Sin resultados para “{movQuery}”{movTitular ? ` de ${movTitular}` : ""} en {rango}.</p>}
              {/* Lo que quedó afuera se dice y se puede traer de un toque: un cero acá sin esta
                  línea se lee como "nunca gastaste en eso" cuando solo es el mes elegido. */}
              {movQuery && fueraDelRango > 0 && (
                <p className="mb-2 text-xs text-slate-500">
                  Hay {fueraDelRango} resultado(s) más en otros meses.{" "}
                  <button onClick={() => setMeses([...(d?.meses ?? [])])} className="font-medium text-indigo-600 underline">Buscar en todos los meses</button>
                </p>
              )}
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

      {/* ─── PERSONAS (quién gasta qué, con drill-down por categoría) ─── */}
      {tab === "Personas" && (
        <div className="space-y-4">
          <EstadoAtajo estado={atajo} />
          {fallo ? (
            // "No pude preguntar" y "no hay gastos" son cosas distintas y se ven iguales si no
            // se dicen. Esta pestaña llegó a mostrar "sin gastos" con dos compras guardadas.
            <Card title="No pude leer los gastos">
              <p className="text-sm text-slate-500">
                El router no respondió ({fallo}). Los gastos que hayan llegado por el Atajo siguen guardados: es la
                lectura la que falló. <button onClick={load} className="underline">Reintentar</button>
              </p>
            </Card>
          ) : (
            <PersonasTab movs={movsSel} rango={rango} />
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

/* ── selección de meses ── */

// ¿Coincide el movimiento con lo buscado? Comercio, categoría o banco.
function coincide(m: Mov, q: string) {
  return (m.comercio || "").toLowerCase().includes(q)
    || (m.categoria || "").toLowerCase().includes(q)
    || (m.banco || "").toLowerCase().includes(q);
}

function catsDeMovs(movs: Mov[]): Cat[] {
  const acc: Record<string, number> = {};
  for (const t of movs) { if (t.tipo !== "cargo") continue; const c = t.categoria || "Otros"; acc[c] = (acc[c] || 0) + t.monto; }
  return Object.entries(acc).map(([categoria, monto]) => ({ categoria, monto })).sort((a, b) => b.monto - a.monto);
}

// Suma los meses elegidos en un bloque con la MISMA forma que un mes suelto, así el resto de
// la página no necesita saber si está mirando uno o diez.
function aggMeses(d: Dash | null, sel: string[]): MesData | undefined {
  if (!d) return undefined;
  const list = sel.map((m) => d.porMes?.[m]).filter(Boolean) as MesData[];
  if (!list.length) return undefined;
  if (list.length === 1) return list[0];
  const out: MesData = {
    santanderCC: { ingresos: 0, egresos: 0 }, biceCC: { ingresos: 0, egresos: 0 }, tarjeta: { gasto: 0 },
    ingresos: 0, egresos: 0, neto: 0, categorias: [], categoriasTarjeta: [], movsCC: 0, movsTarjeta: 0,
  };
  for (const p of list) {
    for (const b of ["santanderCC", "biceCC"] as const) { out[b].ingresos += p[b].ingresos; out[b].egresos += p[b].egresos; }
    out.tarjeta.gasto += p.tarjeta.gasto;
    out.ingresos += p.ingresos; out.egresos += p.egresos;
    out.movsCC = (out.movsCC ?? 0) + (p.movsCC ?? 0);
    out.movsTarjeta = (out.movsTarjeta ?? 0) + (p.movsTarjeta ?? 0);
    out.categorias = mergeCats(out.categorias, p.categorias);
    out.categoriasTarjeta = mergeCats(out.categoriasTarjeta, p.categoriasTarjeta);
  }
  out.neto = out.ingresos - out.egresos;
  // Con varios meses "falta cartola" solo si NINGUNO tiene cuenta corriente. El caso mixto
  // (algunos sí, otros no) lo avisa el banner de arriba, que sí sabe cuáles faltan.
  out.faltaCartola = (out.movsCC ?? 0) === 0;
  return out;
}

// Selector de meses MÚLTIPLE: con julio marcado se ve julio; marcando más meses se ve la
// suma de esos meses, en todas las pestañas.
function MesPicker({ meses, sel, onChange, porMes }: { meses: string[]; sel: string[]; onChange: (s: string[]) => void; porMes: Record<string, MesData> }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const fuera = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, [open]);

  // Destildar el último mes dejaría la pantalla entera sin datos, así que no se permite.
  const toggle = (m: string) => {
    const next = sel.includes(m) ? sel.filter((x) => x !== m) : [...sel, m];
    if (next.length) onChange([...next].sort());
  };
  const label = sel.length === 1 ? mesLabel(sel[0])
    : sel.length === meses.length ? `Todos · ${meses.length} meses`
    : `${sel.length} meses`;

  const atajos: [string, number][] = [["Último", 1], ["Últimos 3", 3], ["Últimos 6", 6], ["Todos", meses.length]];

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
        {label} <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-72 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
          <div className="mb-1 flex flex-wrap gap-1">
            {atajos.filter(([, n]) => n <= meses.length).map(([l, n]) => (
              <button key={l} onClick={() => onChange(meses.slice(-n))}
                className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-200">{l}</button>
            ))}
          </div>
          <div className="max-h-72 overflow-y-auto">
            {[...meses].reverse().map((m) => {
              const on = sel.includes(m);
              const gasto = (porMes[m]?.egresos ?? 0) + (porMes[m]?.tarjeta.gasto ?? 0);
              return (
                <div key={m} className={`group flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${on ? "bg-indigo-50" : "hover:bg-slate-50"}`}>
                  <button onClick={() => toggle(m)} className="flex flex-1 items-center gap-2 text-left">
                    <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${on ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300"}`}>
                      {on && <Check className="h-3 w-3" />}
                    </span>
                    <span className={on ? "font-medium text-indigo-700" : "text-slate-600"}>{mesLabel(m)}</span>
                  </button>
                  <span className="text-[11px] text-slate-400">{clpShort(gasto)}</span>
                  <button onClick={() => onChange([m])} className="text-[10px] text-slate-400 opacity-0 hover:text-indigo-600 group-hover:opacity-100">solo</button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── PERSONAS: quién gastó qué, con drill-down por categoría ── */

// Categorías que mueven plata pero NO son consumo: el pago de la tarjeta ya está contado como
// las compras itemizadas del estado de cuenta, y los traspasos entre cuentas propias no son
// gasto. Sumarlos duplica el total de la persona.
const NO_CONSUMO = new Set(["Tarjeta de crédito", "Transferencia interna", "Línea de crédito"]);

function PersonasTab({ movs, rango }: { movs: Mov[]; rango: string }) {
  const [alcance, setAlcance] = useState<"todo" | "celular">("todo");
  const [sinTraspasos, setSinTraspasos] = useState(true);
  const [persona, setPersona] = useState("");
  const [cat, setCat] = useState("");

  const cargos = useMemo(() => movs.filter((m) =>
    m.tipo === "cargo"
    && (alcance === "todo" || m.fuente === "wallet")
    && (!sinTraspasos || !NO_CONSUMO.has(m.categoria))), [movs, alcance, sinTraspasos]);

  // A quién se le imputa cada gasto. Los movimientos de cartola no traen titular porque son
  // de las cuentas y la tarjeta de Javier; los del Atajo sí lo traen (Javier/Emi).
  const de = useCallback((m: Mov) => m.titular || (alcance === "todo" ? "Javier" : ""), [alcance]);

  const gente = useMemo(() => {
    const acc: Record<string, { titular: string; total: number; count: number; wallet: number; cats: Record<string, number> }> = {};
    for (const m of cargos) {
      const p = de(m); if (!p) continue;
      const g = acc[p] || (acc[p] = { titular: p, total: 0, count: 0, wallet: 0, cats: {} });
      g.total += m.monto; g.count++;
      if (m.fuente === "wallet") g.wallet += m.monto;
      const c = m.categoria || "Otros";
      g.cats[c] = (g.cats[c] || 0) + m.monto;
    }
    return Object.values(acc)
      .map((g) => ({ ...g, categorias: Object.entries(g.cats).map(([categoria, monto]) => ({ categoria, monto })).sort((a, b) => b.monto - a.monto) }))
      .sort((a, b) => b.total - a.total);
  }, [cargos, de]);

  const activo = gente.find((g) => g.titular === persona) ?? gente[0];
  const cats = activo?.categorias ?? [];
  // Si al cambiar de persona esa categoría no existe, se muestra todo en vez de una lista vacía.
  const catActiva = cats.some((c) => c.categoria === cat) ? cat : "";
  const detalle = useMemo(
    () => cargos.filter((m) => activo && de(m) === activo.titular && (!catActiva || (m.categoria || "Otros") === catActiva)),
    [cargos, activo, catActiva, de]);

  const controles = (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 bg-white p-0.5">
        {([["todo", "Cartolas + celular"], ["celular", "Solo celular (Atajo)"]] as const).map(([v, l]) => (
          <button key={v} onClick={() => setAlcance(v)}
            className={`rounded-md px-2.5 py-1 font-medium transition-colors ${alcance === v ? "bg-[#0a1628] text-white" : "text-slate-500 hover:bg-slate-100"}`}>{l}</button>
        ))}
      </div>
      <label className="flex items-center gap-1.5 text-slate-500">
        <input type="checkbox" checked={sinTraspasos} onChange={(e) => setSinTraspasos(e.target.checked)} className="h-3.5 w-3.5 rounded border-slate-300" />
        Sin pagos de tarjeta ni traspasos
      </label>
      <span className="text-slate-400">· {rango}</span>
    </div>
  );

  const nota = (
    <p className="text-xs text-slate-400">
      {alcance === "todo"
        ? "Javier suma sus cartolas (cuentas y tarjeta a su nombre) más lo que llega por el Atajo; Emi, solo lo que llega desde su celular."
        : "Solo lo que llega en tiempo real por el Atajo de Wallet (notificaciones del banco)."}
      {sinTraspasos && " Quedan fuera pagos de tarjeta, línea de crédito y traspasos entre cuentas propias: no son consumo y estarían contados dos veces."}
    </p>
  );

  if (!gente.length) {
    return (
      <div className="space-y-3">
        {controles}
        <Card title={`Sin gastos por persona en ${rango}`}>
          <p className="text-sm text-slate-500">
            No hay movimientos de personas en el período elegido. Probá con otros meses arriba
            {alcance === "celular" ? ", o mirá también las cartolas." : "."}
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {controles}
      {nota}

      <div className="grid gap-4 md:grid-cols-2">
        {gente.map((p) => {
          const on = activo?.titular === p.titular;
          return (
            <button key={p.titular} onClick={() => { setPersona(p.titular); setCat(""); }}
              className={`rounded-2xl border bg-white p-5 text-left transition-colors ${on ? "border-indigo-300 ring-1 ring-indigo-200" : "border-slate-200 hover:border-slate-300"}`}>
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-700">{p.titular === "Emi" ? "👩" : "🧑"} {p.titular}</p>
                  <p className="text-2xl font-bold text-slate-900">{clp(p.total)}</p>
                  <p className="text-[11px] text-slate-400">{rango} · {p.count} mov.{p.wallet ? ` · ${clp(p.wallet)} por el celular` : ""}</p>
                </div>
                <span className={`shrink-0 text-[11px] font-medium ${on ? "text-indigo-600" : "text-slate-300"}`}>{on ? "viendo" : "ver detalle"}</span>
              </div>
              <div className="space-y-1.5">
                {p.categorias.slice(0, 5).map((c) => {
                  const pct = p.total ? Math.round((c.monto / p.total) * 100) : 0;
                  return (
                    <div key={c.categoria}>
                      <div className="flex justify-between text-xs"><span className="text-slate-600">{c.categoria}</span><span className="text-slate-500">{clp(c.monto)}</span></div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${pct}%` }} /></div>
                    </div>
                  );
                })}
              </div>
            </button>
          );
        })}
      </div>

      {activo && (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <Card title={`${activo.titular} · en qué gasta · ${rango}`}>
              <CatPie cats={cats} onSelect={setCat} selected={catActiva} />
              <p className="mt-1 text-center text-[11px] text-slate-400">Tocá una porción para abrir la categoría.</p>
            </Card>
            <Card title="Categorías · tocá una para abrirla">
              <CatBars cats={cats.slice(0, 10)} onSelect={setCat} selected={catActiva} />
            </Card>
          </div>
          <Card title={catActiva ? `${activo.titular} · ${catActiva} · ${rango}` : `${activo.titular} · todos los gastos · ${rango}`}>
            {catActiva
              ? <button onClick={() => setCat("")} className="mb-2 text-xs font-medium text-indigo-600 hover:underline">← ver todas las categorías</button>
              : <p className="mb-2 -mt-1 text-xs text-slate-400">Todos sus gastos del período, del más grande al más chico.</p>}
            <MovTable movs={detalle} showCat={!catActiva} />
          </Card>
        </>
      )}
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
// ── PAT / PAC ────────────────────────────────────────────────────────────────
//
// Lo que se cobra solo, todos los meses, sin que nadie apriete nada: PAT (con la
// tarjeta) y PAC (desde la cuenta). Es la parte del gasto que nadie revisa,
// justamente porque no exige ninguna acción.
//
// Dos decisiones de la pantalla:
//
//   • El número grande es el **compromiso del mes que viene**, no "cuánto llevás
//     gastado". Suma solo los que siguen vivos —cobrados en el último mes con
//     datos— y usa el ÚLTIMO monto de cada uno, no el promedio: si el seguro subió,
//     lo que te van a cobrar es el precio nuevo.
//   • Los dados de baja no desaparecen: van abajo, aparte y sin sumar. Borrarlos
//     esconde justo lo que sirve para entender en qué se te fue la plata.
function PatPacTab({ data }: { data?: Dash["patPac"] }) {
  if (!data || !data.items.length) {
    return <Card title="Pagos automáticos"><Empty text="No detecté cobros PAT ni PAC todavía. Aparecen cuando la cartola trae líneas con «P.A.T.», «PAC» o «pago automático»." /></Card>;
  }
  const { vigentes, items, totalMensual, totalPAT, totalPAC, ultimoMes } = data;
  const dadosDeBaja = items.filter((i) => i.ultimoMes !== ultimoMes);
  const mesLabel = (m: string) => {
    const [y, mm] = (m || "").split("-");
    return `${["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"][Number(mm) - 1] ?? mm} ${y ?? ""}`.trim();
  };

  return (
    <div className="space-y-4">
      <Card title={`Se te va solo, cada mes · ${mesLabel(ultimoMes)}`}>
        <p className="text-3xl font-bold text-slate-900">{clp(totalMensual)}</p>
        <p className="mt-1 text-sm text-slate-500">
          {vigentes.length} cobro{vigentes.length === 1 ? "" : "s"} automático{vigentes.length === 1 ? "" : "s"} vigente{vigentes.length === 1 ? "" : "s"} · al año son {clp(totalMensual * 12)}
        </p>
        <div className="mt-3 flex gap-2">
          <span className="rounded-lg bg-indigo-50 px-3 py-1.5 text-sm text-indigo-700">
            <CreditCard className="mr-1.5 inline h-3.5 w-3.5" />PAT (tarjeta): <b>{clp(totalPAT)}</b>
          </span>
          <span className="rounded-lg bg-emerald-50 px-3 py-1.5 text-sm text-emerald-700">
            <Landmark className="mr-1.5 inline h-3.5 w-3.5" />PAC (cuenta): <b>{clp(totalPAC)}</b>
          </span>
        </div>
      </Card>

      <Card title="Vigentes">
        <PatPacTable items={vigentes} />
      </Card>

      {dadosDeBaja.length > 0 && (
        <Card title={`Ya no se cobran · ${dadosDeBaja.length}`}>
          <p className="mb-2 text-sm text-slate-500">Estuvieron activos y dejaron de aparecer. No suman al compromiso mensual.</p>
          <PatPacTable items={dadosDeBaja} apagados />
        </Card>
      )}
    </div>
  );
}

function PatPacTable({ items, apagados = false }: { items: PatPacItem[]; apagados?: boolean }) {
  const mesLabelCorto = (m: string) => (m || "").split("-").reverse().join("/");
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
            <th className="py-2 pr-3 font-medium">Comercio</th>
            <th className="py-2 pr-3 font-medium">Tipo</th>
            <th className="py-2 pr-3 font-medium">Hace</th>
            <th className="py-2 pr-3 text-right font-medium">{apagados ? "Último" : "Mensual"}</th>
            <th className="py-2 text-right font-medium">{apagados ? "Dejó de cobrarse" : "Al año"}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((i, n) => (
            <tr key={n} className={`border-b border-slate-100 last:border-0 ${apagados ? "text-slate-400" : ""}`}>
              <td className="py-2 pr-3">
                <span className="truncate">
                  <Zap className={`mr-1.5 inline h-3.5 w-3.5 ${apagados ? "text-slate-300" : "text-amber-500"}`} />
                  {i.comercio}
                </span>
                {i.categoria && <span className="ml-1 text-xs text-slate-400">· {i.categoria}</span>}
              </td>
              <td className="py-2 pr-3">
                <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${i.modalidad === "PAT" ? "bg-indigo-100 text-indigo-700" : "bg-emerald-100 text-emerald-700"}`}>
                  {i.modalidad}
                </span>
              </td>
              {/* Hace cuántos meses viene cobrándose. Un cobro que apareció UNA vez no es
                  un compromiso mensual, y sin este dato los dos se ven iguales. */}
              <td className="py-2 pr-3 text-slate-500">{i.mesesActivo} {i.mesesActivo === 1 ? "mes" : "meses"}</td>
              <td className="py-2 pr-3 text-right font-medium">{clp(i.monto)}</td>
              <td className="py-2 text-right text-slate-500">{apagados ? mesLabelCorto(i.ultimoMes) : clp(i.monto * 12)}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
function CatPie({ cats, onSelect, selected }: { cats: Cat[]; onSelect?: (c: string) => void; selected?: string }) {
  const data = cats.slice(0, 8);
  if (!data.length) return <Empty text="Sin datos." />;
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <Pie data={data} dataKey="monto" nameKey="categoria" cx="50%" cy="50%" outerRadius={80} label={(e: any) => String(e?.categoria ?? "")} labelLine={false} fontSize={10}
            className={onSelect ? "cursor-pointer outline-none" : ""}
            onClick={(_, i) => onSelect?.(data[i]?.categoria === selected ? "" : data[i]?.categoria ?? "")}>
            {data.map((c, i) => (
              <Cell key={i} fill={PIE[i % PIE.length]}
                stroke={selected === c.categoria ? "#0f172a" : "#fff"}
                strokeWidth={selected === c.categoria ? 2.5 : 1}
                opacity={selected && selected !== c.categoria ? 0.45 : 1} />
            ))}
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

// ─── Estado del Atajo de Wallet ───────────────────────────────────────────────
//
// Existe por una pregunta concreta: "hice un pago con la tarjeta, ¿te llegó?". Antes había
// que mirar los logs de Railway —que se borran en cada deploy— y aun así el endpoint no
// registraba nada. Acá se ven las tres cosas que se confundían: si llegó y se guardó, si
// llegó y algo lo rechazó, o si nunca llegó.
function EstadoAtajo({ estado }: { estado: AtajoEstado | null }) {
  if (!estado) return null;
  if (estado.error) {
    return (
      <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
        No pude consultar el estado del Atajo ({estado.error}).
      </p>
    );
  }

  const ultimo = estado.ultimos_guardados?.[0];
  const rechazados = (estado.golpes ?? []).filter((g) => g.resultado !== "guardado");

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="font-medium text-slate-700">Atajo del celular</span>
        <span className="text-slate-500">
          {estado.guardados_hoy ? `${estado.guardados_hoy} gasto(s) recibidos hoy` : "todavía no llegó ningún gasto hoy"}
        </span>
        {ultimo && (
          <span className="text-slate-400">
            último: {ultimo.comercio} ${ultimo.monto.toLocaleString("es-CL")} ({fmtHora(ultimo.created_at)})
          </span>
        )}
        <span className="text-slate-400">tokens: {(estado.titulares_configurados ?? []).join(", ") || "ninguno"}</span>
      </div>

      {rechazados.length > 0 && (
        <div className="mt-2 border-t border-slate-100 pt-2">
          {/* La distinción que importa: un intento rechazado que NO vino del iPhone no dice
              nada sobre el Atajo. Sin esto, una prueba con un token falso se leía como "estás
              perdiendo compras", que es la conclusión opuesta. */}
          <p className={estado.atajo_sano === false ? "text-amber-700" : "text-slate-500"}>
            {estado.atajo_sano === false
              ? `${rechazados.length} intento(s) del Atajo no se guardaron — hay algo que revisar:`
              : `${rechazados.length} intento(s) no se guardaron, ninguno del Atajo de tu iPhone (pruebas o llamadas de otro origen):`}
          </p>
          <ul className="mt-1 space-y-0.5 text-slate-500">
            {rechazados.slice(0, 5).map((g, i) => (
              <li key={i}>
                {fmtHora(g.cuando)} · <b>{g.resultado.replace(/_/g, " ")}</b>
                {g.desde ? ` · desde ${g.desde}` : ""}
                {g.comercio ? ` · ${g.comercio}` : ""}
                {g.detalle ? ` · ${g.detalle}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Sin esta línea, "0 intentos" se lee como "el Atajo no disparó" cuando en realidad el
          router se reinició hace un minuto y perdió el registro. */}
      {(estado.golpes ?? []).length === 0 && (
        <p className="mt-2 border-t border-slate-100 pt-2 text-slate-400">
          Sin intentos registrados desde que el router arrancó{estado.arrancado ? ` (${fmtHora(estado.arrancado)})` : ""}.
          Los gastos guardados antes de eso siguen contados arriba.
        </p>
      )}
    </div>
  );
}

function fmtHora(iso: string) {
  try {
    return new Date(iso).toLocaleString("es-CL", { timeZone: "America/Santiago", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });
  } catch { return iso; }
}
