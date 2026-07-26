"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Wallet, Target, Bell, MessageCircle, Loader2, ChevronRight,
  AlertTriangle, Clock, ArrowUpRight, Sparkles,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";

/* ---------- tipos ---------- */
interface Conv {
  id: number; agent: string; prompt: string; response: string;
  channel: string; created_at: string; thread_id: string | null;
}
interface Reminder {
  id: string; texto: string; remind_at: string | null; estado: string; categoria: string | null;
}
interface Mission { id: string; estado?: string; titulo?: string; objetivo?: string; nombre?: string; last_reply_at?: string | null; intentos_seguimiento?: number }
interface FinanceSummary {
  resumen?: { gastoMes: number; presupuesto: number; pctUsado: number; disponible: number };
  mesReferenciaLabel?: string;
  anomalias?: { texto: string; monto: number }[];
}

const CLP = (n: number) => "$" + Math.round(n || 0).toLocaleString("es-CL");
const agentLabel = (a?: string) => (a || "alfred").replace(/^agent-/, "");

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [convs, setConvs] = useState<Conv[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [finance, setFinance] = useState<FinanceSummary | null>(null);

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user]);

  async function load() {
    const supabase = createClient();
    const [convRes, remRes, misRes, finRes] = await Promise.allSettled([
      supabase.from("conversations").select("id,agent,prompt,response,channel,created_at,thread_id").order("created_at", { ascending: false }).limit(60),
      supabase.from("reminders").select("id,texto,remind_at,estado,categoria").in("estado", ["pendiente", "enviado"]).order("remind_at", { ascending: true, nullsFirst: false }).limit(30),
      fetch("/api/missions", { cache: "no-store" }).then(r => r.json()).catch(() => ({ missions: [] })),
      fetch("/api/finance", { cache: "no-store" }).then(r => r.json()).catch(() => null),
    ]);
    if (convRes.status === "fulfilled") setConvs((convRes.value.data as Conv[]) || []);
    if (remRes.status === "fulfilled") setReminders((remRes.value.data as Reminder[]) || []);
    if (misRes.status === "fulfilled") setMissions((misRes.value?.missions as Mission[]) || []);
    if (finRes.status === "fulfilled") setFinance(finRes.value || null);
    setLoading(false);
  }

  /* ---------- derivados ---------- */
  const hoyChile = new Date().toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Santiago" });
  const nombre = (user?.email?.split("@")[0] ?? "Javier").replace(/^./, c => c.toUpperCase());

  // Actividad reciente: agrupada por hilo (última conversación por thread), abrible.
  const recientes = useMemo(() => {
    const seen = new Set<string>();
    const out: Conv[] = [];
    for (const c of convs) {
      const key = c.thread_id || `c${c.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(c);
      if (out.length >= 12) break;
    }
    return out;
  }, [convs]);

  const remPend = reminders.filter(r => r.estado === "pendiente" || r.estado === "enviado");
  const proximoRem = remPend[0];
  const misActivas = missions.filter(m => (m.estado || "").toLowerCase() === "activa" || (m.estado || "").toLowerCase() === "en_curso");
  // "Esperando respuesta" = misión activa donde Alfred ya escribió (hizo seguimiento) y aún no hay respuesta.
  const misEsperan = missions.filter(m => (m.estado || "").toLowerCase() === "activa" && !m.last_reply_at && (m.intentos_seguimiento || 0) > 0);
  const clDate = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Santiago" });
  const hoyCl = new Date().toLocaleDateString("en-CA", { timeZone: "America/Santiago" });
  const waHoy = convs.filter(c => c.channel === "whatsapp" && c.created_at && clDate(c.created_at) === hoyCl).length;
  const fin = finance?.resumen;
  const anomalias = finance?.anomalias || [];

  // "Para ti": feed accionable combinado
  const paraTi = useMemo(() => {
    const items: { icon: React.ComponentType<{ className?: string }>; tint: string; text: string; sub?: string; href: string }[] = [];
    for (const r of remPend.slice(0, 4)) {
      items.push({ icon: Bell, tint: "text-amber-500", text: r.texto, sub: fmtWhen(r.remind_at), href: "/recordatorios" });
    }
    for (const m of misEsperan.slice(0, 2)) {
      items.push({ icon: Target, tint: "text-violet-500", text: m.titulo || m.objetivo || m.nombre || "Misión", sub: "Esperando tu respuesta", href: "/misiones" });
    }
    for (const a of anomalias.slice(0, 2)) {
      items.push({ icon: AlertTriangle, tint: "text-rose-500", text: a.texto, sub: "Anomalía de gasto", href: "/finanzas" });
    }
    return items.slice(0, 8);
  }, [remPend, misEsperan, anomalias]);

  const pulse = useMemo(() => {
    const parts: string[] = [];
    if (remPend.length) parts.push(`${remPend.length} recordatorio${remPend.length > 1 ? "s" : ""}`);
    if (misActivas.length) parts.push(`${misActivas.length} misión${misActivas.length > 1 ? "es" : ""} activa${misActivas.length > 1 ? "s" : ""}`);
    if (fin?.gastoMes) parts.push(`${CLP(fin.gastoMes)} gastado (${finance?.mesReferenciaLabel || "mes"})`);
    if (anomalias.length) parts.push(`${anomalias.length} alerta${anomalias.length > 1 ? "s" : ""} financiera${anomalias.length > 1 ? "s" : ""}`);
    return parts.length ? parts.join(" · ") : "Todo tranquilo por ahora.";
  }, [remPend, misActivas, fin, anomalias, finance]);

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-[#0a1628] to-[#1e3a5f] p-6 text-white">
        <p className="text-xs font-medium uppercase tracking-wider text-white/50 first-letter:uppercase">{hoyChile}</p>
        <h1 className="mt-1 text-2xl font-semibold">Hola, {nombre}</h1>
        <p className="mt-2 flex items-center gap-1.5 text-sm text-white/70">
          <Sparkles className="h-3.5 w-3.5 text-amber-300" /> {pulse}
        </p>
      </div>

      {/* Tiles de vida */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Finanzas */}
        <Tile onClick={() => router.push("/finanzas")} title="Finanzas" icon={Wallet} tint="text-emerald-600" bg="bg-emerald-50">
          {fin ? (
            <>
              <p className="text-2xl font-bold text-slate-900">{CLP(fin.gastoMes)}</p>
              <p className="text-[11px] text-slate-400">{finance?.mesReferenciaLabel} · {fin.pctUsado}% del presupuesto</p>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div className={`h-full rounded-full ${fin.pctUsado > 100 ? "bg-rose-500" : fin.pctUsado > 85 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(100, fin.pctUsado)}%` }} />
              </div>
              {anomalias.length > 0 && <p className="mt-1.5 text-[10px] font-medium text-rose-500">⚠ {anomalias.length} alerta{anomalias.length > 1 ? "s" : ""}</p>}
            </>
          ) : <p className="text-sm text-slate-400">Sin datos</p>}
        </Tile>

        {/* Misiones */}
        <Tile onClick={() => router.push("/misiones")} title="Misiones" icon={Target} tint="text-violet-600" bg="bg-violet-50">
          <p className="text-2xl font-bold text-slate-900">{misActivas.length}</p>
          <p className="text-[11px] text-slate-400">{misActivas.length === 1 ? "activa" : "activas"}</p>
          {misEsperan.length > 0 && <p className="mt-1.5 text-[10px] font-medium text-violet-600">{misEsperan.length} esperan respuesta</p>}
        </Tile>

        {/* Recordatorios */}
        <Tile onClick={() => router.push("/recordatorios")} title="Recordatorios" icon={Bell} tint="text-amber-600" bg="bg-amber-50">
          <p className="text-2xl font-bold text-slate-900">{remPend.length}</p>
          <p className="text-[11px] text-slate-400">pendientes</p>
          {proximoRem && <p className="mt-1.5 truncate text-[10px] font-medium text-amber-600">Próximo: {proximoRem.texto}</p>}
        </Tile>

        {/* WhatsApp */}
        <Tile onClick={() => router.push("/chat")} title="WhatsApp" icon={MessageCircle} tint="text-green-600" bg="bg-green-50">
          <p className="text-2xl font-bold text-slate-900">{waHoy}</p>
          <p className="text-[11px] text-slate-400">mensajes hoy</p>
          <p className="mt-1.5 text-[10px] font-medium text-green-600">Abrir chat con Alfred →</p>
        </Tile>
      </div>

      {/* Dos columnas */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Actividad reciente — abrible */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <MessageCircle className="h-4 w-4 text-[#0a1628]" /> Actividad reciente
          </h2>
          <div className="space-y-1 max-h-96 overflow-y-auto">
            {recientes.map(c => {
              const time = new Date(c.created_at).toLocaleString("es-CL", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Santiago" });
              // Solo los chats web comparten el sistema de hilos del front (conversation_threads);
              // los de WhatsApp viven en otra tabla y abrirían un chat vacío.
              const openable = !!c.thread_id && c.channel === "web";
              return (
                <button
                  key={c.id}
                  disabled={!openable}
                  onClick={() => openable && router.push(`/chat?thread=${encodeURIComponent(c.thread_id!)}`)}
                  className={`group flex w-full items-center gap-3 rounded-lg border border-transparent px-3 py-2 text-left transition-colors ${openable ? "hover:border-slate-200 hover:bg-slate-50" : "opacity-70"}`}
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold uppercase text-slate-500">
                    {agentLabel(c.agent).slice(0, 2)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium text-slate-700">{agentLabel(c.agent)}</span>
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] text-slate-400">{c.channel}</span>
                    </div>
                    <p className="truncate text-xs text-slate-500">{c.prompt || "(sin texto)"}</p>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-slate-400">
                    <span>{time}</span>
                    {openable && <ArrowUpRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />}
                  </div>
                </button>
              );
            })}
            {recientes.length === 0 && <p className="py-8 text-center text-xs text-slate-400">Sin actividad reciente</p>}
          </div>
        </div>

        {/* Para ti — feed accionable */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Sparkles className="h-4 w-4 text-amber-500" /> Para ti
          </h2>
          <div className="space-y-1.5 max-h-96 overflow-y-auto">
            {paraTi.map((it, i) => {
              const Icon = it.icon;
              return (
                <button key={i} onClick={() => router.push(it.href)}
                  className="group flex w-full items-center gap-3 rounded-lg border border-slate-100 px-3 py-2.5 text-left transition-colors hover:border-slate-200 hover:bg-slate-50">
                  <Icon className={`h-4 w-4 shrink-0 ${it.tint}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-slate-700">{it.text}</p>
                    {it.sub && <p className="text-[10px] text-slate-400">{it.sub}</p>}
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 group-hover:text-slate-400" />
                </button>
              );
            })}
            {paraTi.length === 0 && (
              <div className="flex flex-col items-center py-10 text-center">
                <Clock className="mb-2 h-7 w-7 text-slate-300" />
                <p className="text-xs text-slate-400">Nada pendiente. Alfred está al día ✨</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- helpers UI ---------- */
function Tile({ onClick, title, icon: Icon, tint, bg, children }: {
  onClick: () => void; title: string; icon: React.ComponentType<{ className?: string }>;
  tint: string; bg: string; children: React.ReactNode;
}) {
  return (
    <button onClick={onClick}
      className="group flex flex-col rounded-xl border border-slate-200 bg-white p-4 text-left transition-all hover:-translate-y-0.5 hover:border-[#0a1628]/20 hover:shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${bg} ${tint}`}><Icon className="h-4 w-4" /></span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 group-hover:text-slate-500">{title}</span>
      </div>
      {children}
    </button>
  );
}

function fmtWhen(iso: string | null): string {
  if (!iso) return "Sin fecha";
  try {
    const d = new Date(iso);
    const now = new Date();
    const hora = d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", timeZone: "America/Santiago" });
    if (d.getTime() < now.getTime()) return "Vencido";
    // Comparación por fecha-CALENDARIO en zona Chile (no por horas transcurridas).
    const cl = (x: Date) => x.toLocaleDateString("en-CA", { timeZone: "America/Santiago" });
    const dStr = cl(d);
    if (dStr === cl(now)) return `Hoy ${hora}`;
    if (dStr === cl(new Date(now.getTime() + 86400000))) return `Mañana ${hora}`;
    return d.toLocaleDateString("es-CL", { day: "2-digit", month: "short", timeZone: "America/Santiago" }) + " " + hora;
  } catch { return "—"; }
}
