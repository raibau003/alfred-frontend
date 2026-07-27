"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays, GraduationCap, Users, RefreshCw, Loader2, Plus, AlertTriangle,
  Check, Search, Bell, MessageSquare, X, School, BookOpen, Link2,
} from "lucide-react";
import { useAlfred } from "@/hooks/useAlfred";
import { useAuth } from "@/components/auth/AuthProvider";
import { ChatView } from "@/components/chat/ChatView";
import {
  getCalendario, getFuentes, guardarFuente, descubrirCalendario, sincronizarCalendario,
  getAvisosPendientes, getHogar, getChatsWhatsapp,
  type EventoCalendario, type FuenteCalendario, type Persona, type ChatWhatsapp,
} from "@/lib/alfred/client";

// Educación y calendario familiar.
//
// La idea que ordena la pantalla: TODO cuelga de una persona. El calendario del colegio es de
// Bautista, el grupo de apoderados es del curso de Rai, Canvas es de Javier. Sin esa
// asociación un evento no se puede filtrar ni dirigir, y el aviso no sabe a quién le importa.
//
// Por eso la configuración es una tarjeta POR PERSONA con sus fuentes, y no una lista de
// fuentes suelta donde hay que acordarse de quién era cada una.

type Vista = "proximo" | "año" | "personas" | "chat";

const COLOR: Record<string, { bg: string; texto: string; punto: string; label: string }> = {
  colegio:  { bg: "bg-blue-50",    texto: "text-blue-700",    punto: "bg-blue-500",    label: "Colegio" },
  feriado:  { bg: "bg-emerald-50", texto: "text-emerald-700", punto: "bg-emerald-500", label: "Feriado" },
  estudio:  { bg: "bg-violet-50",  texto: "text-violet-700",  punto: "bg-violet-500",  label: "Estudios" },
  familia:  { bg: "bg-amber-50",   texto: "text-amber-700",   punto: "bg-amber-500",   label: "Familia" },
  salida:   { bg: "bg-rose-50",    texto: "text-rose-700",    punto: "bg-rose-500",    label: "Salidas" },
  trabajo:  { bg: "bg-slate-100",  texto: "text-slate-700",   punto: "bg-slate-500",   label: "Trabajo" },
  salud:    { bg: "bg-teal-50",    texto: "text-teal-700",    punto: "bg-teal-500",    label: "Salud" },
  otro:     { bg: "bg-slate-50",   texto: "text-slate-600",   punto: "bg-slate-400",   label: "Otro" },
};
const color = (c: string) => COLOR[c] ?? COLOR.otro;

const REQUIERE: Record<string, string> = {
  ropa: "dejar la ropa lista", colacion: "preparar colación", permiso: "firmar autorización",
  reunion: "hay que ir", inscripcion: "hay que inscribir", pago: "hay que pagar",
  horario: "cambia el horario", evento: "hay que ir",
};

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export default function EducacionPage() {
  const { user } = useAuth();
  const alfred = useAlfred();
  const [vista, setVista] = useState<Vista>("proximo");
  const [eventos, setEventos] = useState<EventoCalendario[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [cargando, setCargando] = useState(true);
  const [aviso, setAviso] = useState<Awaited<ReturnType<typeof getAvisosPendientes>> | null>(null);
  const [nota, setNota] = useState<string | null>(null);

  // Los filtros viven acá y no dentro de cada vista: pasar de "lo que viene" a "el año" con
  // los filtros puestos es lo natural, porque se está mirando lo mismo desde otro ángulo.
  const [filtroPersona, setFiltroPersona] = useState<number | null>(null);
  const [filtroCategoria, setFiltroCategoria] = useState<string | null>(null);
  const [soloAccionables, setSoloAccionables] = useState(false);

  const hoy = new Date().toISOString().slice(0, 10);
  const finDeAño = `${hoy.slice(0, 4)}-12-31`;

  const recargar = useCallback(async () => {
    setCargando(true);
    const [c, a, h] = await Promise.all([getCalendario(hoy, finDeAño), getAvisosPendientes(), getHogar()]);
    setEventos(c.eventos); setAviso(a); setPersonas(h.personas ?? []);
    setCargando(false);
  }, [hoy, finDeAño]);

  useEffect(() => { recargar(); }, [recargar]);

  const filtrados = useMemo(() => eventos.filter(e => {
    if (filtroCategoria && e.categoria !== filtroCategoria) return false;
    if (soloAccionables && (!e.requiere || e.requiere === "nada")) return false;
    if (filtroPersona !== null) {
      const nombre = personas.find(p => p.id === filtroPersona)?.nombre;
      // Un evento sin gente asignada (un feriado, un acto del colegio) le toca a todos: si se
      // escondiera al filtrar por una persona, el filtro mentiría por omisión.
      if (e.quienes.length && nombre && !e.quienes.includes(nombre)) return false;
    }
    return true;
  }), [eventos, filtroCategoria, filtroPersona, soloAccionables, personas]);

  const porCategoria = useMemo(() => {
    const m: Record<string, number> = {};
    for (const e of eventos) m[e.categoria] = (m[e.categoria] ?? 0) + 1;
    return m;
  }, [eventos]);

  const accionables = eventos.filter(e => e.requiere && e.requiere !== "nada").length;

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col">
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-white px-4 py-2">
        <GraduationCap className="h-4 w-4 text-[#0a1628]" />
        <span className="mr-3 text-sm font-semibold text-slate-800">Educación y calendario</span>
        {([["proximo", "Lo que viene", Bell], ["año", "El año", CalendarDays],
           ["personas", "Personas y fuentes", Users], ["chat", "Preguntar", MessageSquare]] as const)
          .map(([k, label, Icon]) => (
            <button key={k} onClick={() => setVista(k)}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                vista === k ? "bg-[#0a1628] text-white" : "text-slate-500 hover:bg-slate-100"
              }`}>
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        {vista !== "chat" && (
          <button onClick={recargar} disabled={cargando}
            className="ml-auto rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50">
            {cargando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>

      {vista === "chat" ? (
        <div className="min-h-0 flex-1 flex flex-col">
          <p className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs text-slate-500">
            Preguntale del colegio: notas, asistencia, pruebas de Bautista o Rai. Consulta SchoolNet de
            verdad — no adivina.
          </p>
          <div className="min-h-0 flex-1">
            <ChatView
              messages={alfred.messages} busy={alfred.busy} connected={alfred.connected}
              // Se prefija el dominio para que el router lo mande a SchoolNet y no al chat
              // genérico, que inventaría notas.
              onSend={(t) => alfred.send(`[colegio] ${t}`)}
              userName={user?.email?.split("@")[0] ?? "Usuario"}
              onNewThread={() => alfred.newThread()}
            />
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-5xl space-y-4 p-4">
            {nota && (
              <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> <span>{nota}</span>
              </div>
            )}

            {vista !== "personas" && (
              <Filtros
                personas={personas} porCategoria={porCategoria} accionables={accionables}
                filtroPersona={filtroPersona} setFiltroPersona={setFiltroPersona}
                filtroCategoria={filtroCategoria} setFiltroCategoria={setFiltroCategoria}
                soloAccionables={soloAccionables} setSoloAccionables={setSoloAccionables}
                mostrando={filtrados.length} total={eventos.length}
              />
            )}

            {vista === "proximo" && (
              <>
                {aviso?.hay && aviso.aviso && (
                  <div className="rounded-xl border border-slate-300 bg-white p-4">
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                      <Bell className="h-3.5 w-3.5" /> Esto es lo que les voy a avisar por WhatsApp
                    </p>
                    <pre className="whitespace-pre-wrap break-words font-sans text-xs text-slate-700">{aviso.aviso.texto}</pre>
                  </div>
                )}
                <Proximo eventos={filtrados} cargando={cargando} />
              </>
            )}
            {vista === "año" && <VistaAño eventos={filtrados} />}
            {vista === "personas" && <Personas personas={personas} onCambio={recargar} setNota={setNota} />}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Filtros ──────────────────────────────────────────────────────────────────────────

function Filtros({
  personas, porCategoria, accionables, filtroPersona, setFiltroPersona,
  filtroCategoria, setFiltroCategoria, soloAccionables, setSoloAccionables, mostrando, total,
}: {
  personas: Persona[]; porCategoria: Record<string, number>; accionables: number;
  filtroPersona: number | null; setFiltroPersona: (v: number | null) => void;
  filtroCategoria: string | null; setFiltroCategoria: (v: string | null) => void;
  soloAccionables: boolean; setSoloAccionables: (v: boolean) => void;
  mostrando: number; total: number;
}) {
  const hayFiltro = filtroPersona !== null || filtroCategoria !== null || soloAccionables;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] uppercase tracking-wide text-slate-400">Quién</span>
        {personas.map(p => (
          <button key={p.id} onClick={() => setFiltroPersona(filtroPersona === p.id ? null : p.id)}
            className={`rounded-full px-2.5 py-1 text-[11px] transition-colors ${
              filtroPersona === p.id ? "bg-[#0a1628] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}>{p.nombre}</button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] uppercase tracking-wide text-slate-400">Qué</span>
        {Object.entries(porCategoria).map(([cat, n]) => {
          const c = color(cat);
          const activo = filtroCategoria === cat;
          return (
            <button key={cat} onClick={() => setFiltroCategoria(activo ? null : cat)}
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] transition-colors ${
                activo ? "bg-[#0a1628] text-white" : `${c.bg} ${c.texto} hover:brightness-95`
              }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${activo ? "bg-white" : c.punto}`} /> {c.label} {n}
            </button>
          );
        })}
        {accionables > 0 && (
          <button onClick={() => setSoloAccionables(!soloAccionables)}
            className={`rounded-full px-2.5 py-1 text-[11px] transition-colors ${
              soloAccionables ? "bg-[#0a1628] text-white" : "border border-slate-300 text-slate-700 hover:bg-slate-50"
            }`}>
            {accionables} con algo que hacer
          </button>
        )}
        {hayFiltro && (
          <button onClick={() => { setFiltroPersona(null); setFiltroCategoria(null); setSoloAccionables(false); }}
            className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800">
            <X className="h-3 w-3" /> limpiar
          </button>
        )}
      </div>

      {hayFiltro && (
        <p className="text-[11px] text-slate-400">
          Mostrando {mostrando} de {total}. Lo que no tiene persona asignada (feriados, actos) aparece
          siempre: le toca a todos.
        </p>
      )}
    </div>
  );
}

// ── Lo que viene ─────────────────────────────────────────────────────────────────────

function Proximo({ eventos, cargando }: { eventos: EventoCalendario[]; cargando: boolean }) {
  const conAccion = eventos.filter(e => e.requiere && e.requiere !== "nada");
  const resto = eventos.filter(e => !e.requiere || e.requiere === "nada");

  return (
    <div className="space-y-4">
      {!eventos.length && !cargando && (
        <p className="rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-500">
          No hay eventos con esos filtros. Si el calendario está vacío, andá a <strong>Personas y fuentes</strong>.
        </p>
      )}
      {conAccion.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Requiere algo</h3>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            {conAccion.map(e => <Fila key={e.id} e={e} destacar />)}
          </div>
        </div>
      )}
      {resto.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Para saber</h3>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            {resto.slice(0, 40).map(e => <Fila key={e.id} e={e} />)}
          </div>
          {resto.length > 40 && <p className="mt-1 text-[11px] text-slate-400">… y {resto.length - 40} más.</p>}
        </div>
      )}
    </div>
  );
}

function Fila({ e, destacar = false }: { e: EventoCalendario; destacar?: boolean }) {
  const c = color(e.categoria);
  return (
    <div className="flex items-center gap-3 border-b border-slate-100 px-3 py-2 last:border-0">
      <span className={`h-2 w-2 shrink-0 rounded-full ${c.punto}`} title={c.label} />
      <span className="w-24 shrink-0 text-[11px] text-slate-400">{e.dia_relativo}</span>
      <span className="min-w-0 flex-1 truncate text-sm text-slate-800">{e.titulo}</span>
      {e.quienes.length > 0 && (
        <span className="hidden shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600 sm:inline">
          {e.quienes.join(", ")}
        </span>
      )}
      {e.hora_inicio && <span className="shrink-0 text-[11px] text-slate-400">{e.hora_inicio.slice(0, 5)}</span>}
      {destacar && e.requiere !== "nada" && (
        <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-700">
          {REQUIERE[e.requiere] ?? e.requiere}
        </span>
      )}
      {/* La confianza se marca solo cuando NO es alta. Un evento sacado de un grupo de
          apoderados no puede verse igual que uno del .ics oficial del colegio. */}
      {e.confianza !== "alta" && (
        <span title={e.cita ?? "inferido"}
          className="shrink-0 rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700">
          {e.estado === "propuesto" ? "a confirmar" : "inferido"}
        </span>
      )}
    </div>
  );
}

// ── El año ───────────────────────────────────────────────────────────────────────────

function VistaAño({ eventos }: { eventos: EventoCalendario[] }) {
  const año = Number((eventos[0]?.fecha ?? new Date().toISOString()).slice(0, 4));
  const porDia = useMemo(() => {
    const m = new Map<string, EventoCalendario[]>();
    for (const e of eventos) {
      if (!m.has(e.fecha)) m.set(e.fecha, []);
      m.get(e.fecha)!.push(e);
    }
    return m;
  }, [eventos]);

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {MESES.map((mes, i) => {
          const mm = String(i + 1).padStart(2, "0");
          const dias = new Date(Date.UTC(año, i + 1, 0)).getUTCDate();
          const offset = (new Date(Date.UTC(año, i, 1)).getUTCDay() + 6) % 7;
          return (
            <div key={mes} className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="mb-2 text-xs font-semibold capitalize text-slate-700">{mes}</p>
              <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-slate-300">
                {["L", "M", "M", "J", "V", "S", "D"].map((d, k) => <span key={k}>{d}</span>)}
                {Array.from({ length: offset }, (_, k) => <span key={`v${k}`} />)}
                {Array.from({ length: dias }, (_, k) => {
                  const f = `${año}-${mm}-${String(k + 1).padStart(2, "0")}`;
                  const evs = porDia.get(f) ?? [];
                  const conAccion = evs.find(e => e.requiere && e.requiere !== "nada");
                  const cat = (conAccion ?? evs[0])?.categoria;
                  return (
                    <span key={f}
                      title={evs.length ? evs.map(e => `${e.titulo}${e.quienes.length ? ` (${e.quienes.join(", ")})` : ""}`).join(" · ") : undefined}
                      className={`flex h-5 items-center justify-center rounded ${
                        cat ? `${color(cat).punto} font-medium text-white` : "text-slate-400"
                      } ${conAccion ? "ring-1 ring-slate-900 ring-offset-1" : ""}`}>
                      {k + 1}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-slate-400">
        El borde negro marca los días que requieren preparar algo. Los filtros de arriba también
        aplican acá: elegí a Bauti y el año queda con lo suyo.
      </p>
    </div>
  );
}

// ── Personas y fuentes ───────────────────────────────────────────────────────────────

const TIPOS: Record<string, { label: string; icon: typeof School; ayuda: string }> = {
  ics:       { label: "Calendario del colegio", icon: School,        ayuda: "El .ics del colegio: feriados, jeans day, reuniones y salidas." },
  whatsapp:  { label: "Grupo de WhatsApp",      icon: MessageSquare, ayuda: "Leo el grupo y saco los compromisos con fecha. Entran como «a confirmar», con la cita del mensaje." },
  schoolnet: { label: "SchoolNet",              icon: BookOpen,      ayuda: "Notas, asistencia y fechas de pruebas." },
  canvas:    { label: "MIT Canvas",             icon: GraduationCap, ayuda: "Las entregas de tus cursos, con su fecha." },
};

function Personas({ personas, onCambio, setNota }: {
  personas: Persona[]; onCambio: () => void; setNota: (s: string | null) => void;
}) {
  const [fuentes, setFuentes] = useState<FuenteCalendario[]>([]);
  const [chats, setChats] = useState<ChatWhatsapp[]>([]);
  const [errorChats, setErrorChats] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const recargar = useCallback(async () => {
    const [f, c] = await Promise.all([getFuentes(), getChatsWhatsapp()]);
    setFuentes(f.fuentes);
    setChats(c.chats);
    setErrorChats(c.error ?? null);
  }, []);
  useEffect(() => { recargar(); }, [recargar]);

  const sincronizar = async () => {
    setOcupado(true);
    const r = await sincronizarCalendario();
    setOcupado(false);
    setNota(r.mensaje ?? r.error ?? null);
    await recargar(); onCambio();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="min-w-0 flex-1 text-xs text-slate-500">
          Cada fuente cuelga de una persona. Así el calendario se puede filtrar por hijo y el aviso
          sabe a quién le importa.
        </p>
        <button onClick={sincronizar} disabled={ocupado || !fuentes.length}
          className="flex items-center gap-1.5 rounded-lg bg-[#0a1628] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">
          {ocupado ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Sincronizar todo
        </button>
      </div>

      {errorChats && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
          No pude leer tus chats de WhatsApp ({errorChats}). El selector de grupos va a estar vacío
          hasta que WAHA responda.
        </p>
      )}

      {personas.map(p => (
        <TarjetaPersona key={p.id} persona={p} fuentes={fuentes.filter(f => f.persona === p.id)}
          chats={chats} onCambio={async () => { await recargar(); onCambio(); }} setNota={setNota} />
      ))}

      {/* Las fuentes sin dueño quedan visibles: si no, una fuente mal configurada
          desaparecería de la pantalla y seguiría trayendo eventos sin que nadie sepa de dónde. */}
      {fuentes.some(f => !f.persona) && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="mb-1 text-xs font-semibold text-slate-700">Sin persona asignada</p>
          <p className="mb-2 text-[11px] text-slate-500">
            Traen eventos que le aplican a todos. Si alguna es de un hijo en particular, conviene
            volver a agregarla desde su tarjeta para poder filtrar.
          </p>
          {fuentes.filter(f => !f.persona).map(f => <FilaFuente key={f.id} f={f} />)}
        </div>
      )}
    </div>
  );
}

function TarjetaPersona({ persona, fuentes, chats, onCambio, setNota }: {
  persona: Persona; fuentes: FuenteCalendario[]; chats: ChatWhatsapp[];
  onCambio: () => void; setNota: (s: string | null) => void;
}) {
  const [agregando, setAgregando] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [pagina, setPagina] = useState("https://saintgeorge.cl/familia/calendario/");
  const [feeds, setFeeds] = useState<{ id: string; ics: string }[]>([]);
  const [curso, setCurso] = useState(persona.curso ?? "");
  const [chatElegido, setChatElegido] = useState("");
  const [buscarChat, setBuscarChat] = useState("");

  const edad = Number(persona.edad);
  const esNiño = Number.isFinite(edad) && edad < 18;
  // A un adulto no se le ofrece SchoolNet y a un niño no se le ofrece Canvas del MIT: son
  // opciones que no aplican, y llenar la pantalla de cosas imposibles la vuelve ilegible.
  const disponibles = esNiño ? ["ics", "whatsapp", "schoolnet"] : ["whatsapp", "canvas", "ics"];

  const gruposFiltrados = useMemo(() => {
    const q = buscarChat.toLowerCase().trim();
    return chats.filter(c => c.grupo && (!q || c.nombre.toLowerCase().includes(q))).slice(0, 40);
  }, [chats, buscarChat]);

  const agregar = async (tipo: string, url?: string) => {
    setOcupado(true);
    const nombreChat = chats.find(c => c.id === url)?.nombre;
    const r = await guardarFuente({
      nombre: tipo === "whatsapp" ? `${persona.nombre} · ${nombreChat ?? "grupo"}`
        : tipo === "schoolnet" ? `SchoolNet · ${persona.nombre}`
        : tipo === "canvas" ? `MIT · ${persona.nombre}`
        : `Colegio · ${persona.nombre}`,
      tipo, url, persona: persona.id,
      curso: tipo === "ics" ? (curso.trim() || null) : (tipo === "schoolnet" ? persona.nombre : null),
    });
    setOcupado(false);
    if (r.error) { setNota(r.error); return; }
    setNota(null); setAgregando(null); setFeeds([]); setChatElegido("");
    onCambio();
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-slate-800">{persona.nombre}</span>
        {Number.isFinite(edad) && <span className="text-[11px] text-slate-400">{edad} años</span>}
        {persona.curso && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">{persona.curso}</span>}
        <span className="ml-auto text-[11px] text-slate-400">
          {fuentes.length ? `${fuentes.length} fuente(s)` : "sin fuentes"}
        </span>
      </div>

      {fuentes.length > 0 && (
        <div className="mb-3 space-y-1">{fuentes.map(f => <FilaFuente key={f.id} f={f} />)}</div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {disponibles.map(t => {
          const T = TIPOS[t];
          // De WhatsApp se pueden asociar varios grupos (el del curso y el de mamás avisan
          // cosas distintas), así que ese botón nunca se deshabilita.
          const yaTiene = t !== "whatsapp" && fuentes.some(f => f.tipo === t);
          return (
            <button key={t} onClick={() => setAgregando(agregando === t ? null : t)}
              disabled={yaTiene}
              title={yaTiene ? "Ya está configurada" : T.ayuda}
              className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] ${
                agregando === t ? "border-slate-900 bg-slate-900 text-white"
                : yaTiene ? "border-slate-100 text-slate-300"
                : "border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}>
              {yaTiene ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />} {T.label}
            </button>
          );
        })}
      </div>

      {agregando && <p className="mt-2 text-[11px] text-slate-500">{TIPOS[agregando].ayuda}</p>}

      {agregando === "whatsapp" && (
        <div className="mt-2 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <input value={buscarChat} onChange={e => setBuscarChat(e.target.value)}
            className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
            placeholder="buscar grupo (ej: 3E, PKA, apoderados)" />
          <div className="max-h-48 space-y-1 overflow-y-auto">
            {!gruposFiltrados.length && <p className="text-[11px] text-slate-400">Ningún grupo con ese nombre.</p>}
            {gruposFiltrados.map(c => (
              <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-xs hover:bg-white">
                <input type="radio" name={`chat-${persona.id}`} checked={chatElegido === c.id}
                  onChange={() => setChatElegido(c.id)} />
                <span className="min-w-0 flex-1 truncate text-slate-700">{c.nombre}</span>
                {fuentes.some(f => f.url === c.id) && <span className="text-[10px] text-emerald-600">ya está</span>}
              </label>
            ))}
          </div>
          <button onClick={() => agregar("whatsapp", chatElegido)} disabled={ocupado || !chatElegido}
            className="flex items-center gap-1 rounded bg-[#0a1628] px-2.5 py-1 text-[11px] text-white disabled:opacity-50">
            {ocupado ? <Loader2 className="h-3 w-3 animate-spin" /> : <Link2 className="h-3 w-3" />} Asociar a {persona.nombre}
          </button>
        </div>
      )}

      {agregando === "ics" && (
        <div className="mt-2 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="flex flex-wrap gap-2">
            <input value={pagina} onChange={e => setPagina(e.target.value)}
              className="min-w-0 flex-1 rounded border border-slate-200 px-2 py-1 text-xs"
              placeholder="https://colegio.cl/calendario" />
            <input value={curso} onChange={e => setCurso(e.target.value)}
              className="w-24 rounded border border-slate-200 px-2 py-1 text-xs" placeholder="4°B" />
            <button onClick={async () => {
              setOcupado(true); const r = await descubrirCalendario(pagina); setOcupado(false);
              setNota(r.mensaje ?? r.error ?? null);
              if (r.feeds?.length) setFeeds(r.feeds);
            }} disabled={ocupado}
              className="flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600">
              {ocupado ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />} Buscar
            </button>
          </div>
          {/* El curso es lo que separa 704 eventos de los 60 que importan. */}
          <p className="text-[11px] text-slate-500">
            Sin el curso traigo solo lo general (feriados, jeans day, actos). Con el curso, además las
            reuniones de apoderados y las salidas de ese nivel.
          </p>
          {feeds.map(f => (
            <button key={f.ics} onClick={() => agregar("ics", f.ics)} disabled={ocupado}
              className="flex items-center gap-1 rounded bg-[#0a1628] px-2.5 py-1 text-[11px] text-white disabled:opacity-50">
              <Plus className="h-3 w-3" /> Usar {f.id}
            </button>
          ))}
        </div>
      )}

      {(agregando === "schoolnet" || agregando === "canvas") && (
        <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <button onClick={() => agregar(agregando)} disabled={ocupado}
            className="flex items-center gap-1 rounded bg-[#0a1628] px-2.5 py-1 text-[11px] text-white disabled:opacity-50">
            {ocupado ? <Loader2 className="h-3 w-3 animate-spin" /> : <Link2 className="h-3 w-3" />}
            Conectar {TIPOS[agregando].label} a {persona.nombre}
          </button>
          <p className="mt-1 text-[11px] text-slate-500">
            Usa el agente que ya tiene las credenciales. Si el agente está en pausa, la sincronización
            lo va a decir en vez de fallar en silencio.
          </p>
        </div>
      )}
    </div>
  );
}

function FilaFuente({ f }: { f: FuenteCalendario }) {
  const T = TIPOS[f.tipo] ?? { label: f.tipo, icon: Link2, ayuda: "" };
  const Icon = T.icon;
  return (
    <div className="rounded-lg bg-slate-50 px-2.5 py-1.5">
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        <span className="min-w-0 flex-1 truncate text-xs text-slate-700">{f.nombre}</span>
        {f.curso && <span className="rounded bg-white px-1.5 py-0.5 text-[10px] text-slate-600">{f.curso}</span>}
        <span className="shrink-0 text-[11px] text-slate-400">
          {f.eventos_ultimo_sync != null ? `${f.eventos_ultimo_sync} ev.` : "sin sincronizar"}
        </span>
        {f.ultimo_error
          ? <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600" />
          : <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" />}
      </div>
      {/* El error del último sync se muestra SIEMPRE: una fuente muerta en silencio deja el
          calendario viejo y nadie se enteraría. */}
      {f.ultimo_error && <p className="mt-1 text-[11px] text-amber-700">{f.ultimo_error}</p>}
    </div>
  );
}
