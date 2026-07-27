"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays, GraduationCap, Rss, RefreshCw, Loader2, Plus, AlertTriangle,
  Check, Search, Bell,
} from "lucide-react";
import {
  getCalendario, getFuentes, guardarFuente, descubrirCalendario, sincronizarCalendario,
  crearEvento, getAvisosPendientes, getHogar,
  type EventoCalendario, type FuenteCalendario, type Persona,
} from "@/lib/alfred/client";

// Educación y calendario familiar.
//
// La vista anual con colores sirve para planificar en enero. El otro 95% del año lo que
// importa es "qué se viene y qué tengo que hacer al respecto", así que eso va primero y el
// año completo abajo.
//
// Lo que NO se muestra: los 704 eventos del feed del colegio. Solo los que aplican. Un
// calendario con la salida pedagógica de todos los sextos es un calendario que nadie abre.

type Vista = "proximo" | "año" | "fuentes";

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

// Qué hay que hacer, en palabras. El backend manda la clave; acá se dice para qué sirve.
const REQUIERE: Record<string, string> = {
  ropa: "dejar la ropa lista",
  colacion: "preparar colación",
  permiso: "firmar autorización",
  reunion: "hay que ir",
  inscripcion: "hay que inscribir",
  pago: "hay que pagar",
  horario: "cambia el horario",
  evento: "hay que ir",
};

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export default function EducacionPage() {
  const [vista, setVista] = useState<Vista>("proximo");
  const [eventos, setEventos] = useState<EventoCalendario[]>([]);
  const [porCategoria, setPorCategoria] = useState<Record<string, number>>({});
  const [accionables, setAccionables] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [aviso, setAviso] = useState<Awaited<ReturnType<typeof getAvisosPendientes>> | null>(null);
  const [nota, setNota] = useState<string | null>(null);

  const hoy = new Date().toISOString().slice(0, 10);
  const finDeAño = `${hoy.slice(0, 4)}-12-31`;

  const recargar = useCallback(async () => {
    setCargando(true);
    const [c, a] = await Promise.all([getCalendario(hoy, finDeAño), getAvisosPendientes()]);
    setEventos(c.eventos); setPorCategoria(c.por_categoria); setAccionables(c.accionables);
    setAviso(a);
    setCargando(false);
  }, [hoy, finDeAño]);

  useEffect(() => { recargar(); }, [recargar]);

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col">
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-white px-4 py-2">
        <GraduationCap className="h-4 w-4 text-[#0a1628]" />
        <span className="mr-3 text-sm font-semibold text-slate-800">Educación y calendario</span>
        {([["proximo", "Lo que viene", Bell], ["año", "El año", CalendarDays], ["fuentes", "Fuentes", Rss]] as const)
          .map(([k, label, Icon]) => (
            <button key={k} onClick={() => setVista(k)}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                vista === k ? "bg-[#0a1628] text-white" : "text-slate-500 hover:bg-slate-100"
              }`}>
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        <button onClick={recargar} disabled={cargando}
          className="ml-auto flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50">
          {cargando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl space-y-4 p-4">
          {nota && (
            <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> <span>{nota}</span>
            </div>
          )}

          {/* Lo que Alfred va a mandar por WhatsApp, tal cual. Ver el mensaje antes de que
              salga es la única forma de saber si el sistema está avisando bien. */}
          {vista === "proximo" && aviso?.hay && aviso.aviso && (
            <div className="rounded-xl border border-slate-300 bg-white p-4">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                <Bell className="h-3.5 w-3.5" /> Esto es lo que te voy a avisar
              </p>
              <pre className="whitespace-pre-wrap break-words font-sans text-xs text-slate-700">{aviso.aviso.texto}</pre>
              {!aviso.aviso.accionable && (
                <p className="mt-2 text-[11px] text-slate-400">
                  Nada que preparar: puede esperar al resumen de la mañana.
                </p>
              )}
            </div>
          )}

          {vista === "proximo" && <Proximo eventos={eventos} cargando={cargando} accionables={accionables} porCategoria={porCategoria} />}
          {vista === "año" && <VistaAño eventos={eventos} />}
          {vista === "fuentes" && <Fuentes onCambio={recargar} setNota={setNota} />}
        </div>
      </div>
    </div>
  );
}

// ── Lo que viene ─────────────────────────────────────────────────────────────────────

function Proximo({ eventos, cargando, accionables, porCategoria }: {
  eventos: EventoCalendario[]; cargando: boolean; accionables: number; porCategoria: Record<string, number>;
}) {
  // Lo que exige hacer algo va PRIMERO, aunque sea más lejano: es lo único sobre lo que se
  // puede actuar hoy. Un feriado de la semana que viene no compite con una autorización que
  // hay que firmar.
  const conAccion = eventos.filter(e => e.requiere && e.requiere !== "nada");
  const resto = eventos.filter(e => !e.requiere || e.requiere === "nada");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {Object.entries(porCategoria).map(([cat, n]) => (
          <span key={cat} className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] ${color(cat).bg} ${color(cat).texto}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${color(cat).punto}`} /> {color(cat).label} {n}
          </span>
        ))}
        {accionables > 0 && (
          <span className="rounded-full bg-[#0a1628] px-2.5 py-1 text-[11px] text-white">{accionables} con algo que hacer</span>
        )}
      </div>

      {!eventos.length && !cargando && (
        <p className="rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-500">
          No hay eventos cargados. Andá a <strong>Fuentes</strong> y pegá la dirección del calendario del colegio.
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
        <span className="hidden shrink-0 text-[11px] text-slate-500 sm:inline">{e.quienes.join(", ")}</span>
      )}
      {e.hora_inicio && <span className="shrink-0 text-[11px] text-slate-400">{e.hora_inicio.slice(0, 5)}</span>}
      {destacar && e.requiere !== "nada" && (
        <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-700">
          {REQUIERE[e.requiere] ?? e.requiere}
        </span>
      )}
      {/* La confianza solo se muestra cuando NO es alta: marcar todo sería ruido, y no
          marcar lo inferido de una conversación sería hacerlo pasar por dato oficial. */}
      {e.confianza !== "alta" && (
        <span title={e.cita ?? "inferido"} className="shrink-0 rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700">
          {e.confianza === "baja" ? "inferido" : "a confirmar"}
        </span>
      )}
    </div>
  );
}

// ── El año completo ──────────────────────────────────────────────────────────────────

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
      <div className="flex flex-wrap gap-2 text-[11px]">
        {Object.entries(COLOR).filter(([k]) => k !== "otro").map(([k, c]) => (
          <span key={k} className="flex items-center gap-1 text-slate-500">
            <span className={`h-2 w-2 rounded-full ${c.punto}`} /> {c.label}
          </span>
        ))}
      </div>

      {/* Cuadrícula por mes. Cada día pintado con el color de su categoría; si un día tiene
          varias, gana la que requiere acción — es la que hay que ver de un vistazo. */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {MESES.map((mes, i) => {
          const mm = String(i + 1).padStart(2, "0");
          const dias = new Date(Date.UTC(año, i + 1, 0)).getUTCDate();
          const primerDia = new Date(Date.UTC(año, i, 1)).getUTCDay();   // 0 = domingo
          const offset = (primerDia + 6) % 7;                            // la semana arranca el lunes
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
                      title={evs.length ? evs.map(e => e.titulo).join(" · ") : undefined}
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
        El borde negro marca los días que requieren preparar algo. Pasá el mouse para ver qué es.
      </p>
    </div>
  );
}

// ── Fuentes ──────────────────────────────────────────────────────────────────────────

function Fuentes({ onCambio, setNota }: { onCambio: () => void; setNota: (s: string | null) => void }) {
  const [fuentes, setFuentes] = useState<FuenteCalendario[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [pagina, setPagina] = useState("https://saintgeorge.cl/familia/calendario/");
  const [feeds, setFeeds] = useState<{ id: string; ics: string }[]>([]);
  const [nombre, setNombre] = useState("Colegio");
  const [curso, setCurso] = useState("");
  const [persona, setPersona] = useState<string>("");
  const [ocupado, setOcupado] = useState(false);

  const recargar = useCallback(async () => {
    const [f, h] = await Promise.all([getFuentes(), getHogar()]);
    setFuentes(f.fuentes);
    setPersonas(h.personas ?? []);
  }, []);
  useEffect(() => { recargar(); }, [recargar]);

  const buscar = async () => {
    setOcupado(true); setFeeds([]);
    const r = await descubrirCalendario(pagina);
    setOcupado(false);
    setNota(r.mensaje ?? r.error ?? null);
    if (r.feeds?.length) setFeeds(r.feeds);
  };

  const agregar = async (ics: string) => {
    setOcupado(true);
    const r = await guardarFuente({
      nombre, tipo: "ics", url: ics,
      persona: persona ? Number(persona) : null,
      curso: curso.trim() || null,
    });
    setOcupado(false);
    if (r.error) { setNota(r.error); return; }
    setNota(null); setFeeds([]);
    await recargar();
    onCambio();
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="mb-1 text-sm font-semibold text-slate-800">Agregar el calendario de un colegio</h3>
        <p className="mb-3 text-[11px] text-slate-500">
          Pegá la dirección de la página del calendario del colegio. Si publica un Google Calendar —como
          Saint George— lo detecto solo y leo el feed, sin depender de que no rediseñen el sitio.
          Un hijo con dos colegios lleva dos fuentes.
        </p>
        <div className="flex flex-wrap gap-2">
          <input value={pagina} onChange={e => setPagina(e.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs"
            placeholder="https://colegio.cl/calendario" />
          <button onClick={buscar} disabled={ocupado || !pagina.trim()}
            className="flex items-center gap-1.5 rounded-lg bg-[#0a1628] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">
            {ocupado ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />} Buscar
          </button>
        </div>

        {feeds.length > 0 && (
          <div className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex flex-wrap gap-2">
              <input value={nombre} onChange={e => setNombre(e.target.value)}
                className="w-40 rounded border border-slate-200 px-2 py-1 text-xs" placeholder="Nombre" />
              <select value={persona} onChange={e => setPersona(e.target.value)}
                className="rounded border border-slate-200 px-2 py-1 text-xs">
                <option value="">¿de quién?</option>
                {personas.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
              <input value={curso} onChange={e => setCurso(e.target.value)}
                className="w-28 rounded border border-slate-200 px-2 py-1 text-xs" placeholder="curso: 4°B" />
            </div>
            {/* El curso es lo que separa 704 eventos de los 60 que importan. Sin él se
                traen solo los generales, que es correcto pero mucho menos útil. */}
            <p className="text-[11px] text-slate-500">
              Sin el curso traigo solo lo general (feriados, jeans day, actos). Con el curso, además
              las reuniones de apoderados y las salidas de ese nivel.
            </p>
            {feeds.map(f => (
              <div key={f.ics} className="flex items-center gap-2">
                <button onClick={() => agregar(f.ics)} disabled={ocupado}
                  className="flex items-center gap-1 rounded bg-[#0a1628] px-2 py-1 text-[11px] text-white disabled:opacity-50">
                  <Plus className="h-3 w-3" /> Agregar
                </button>
                <span className="truncate text-[11px] text-slate-600">{f.id}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
          <span className="text-xs font-semibold text-slate-700">Fuentes configuradas</span>
          <button
            onClick={async () => { setOcupado(true); const r = await sincronizarCalendario(); setOcupado(false); setNota(r.mensaje ?? r.error ?? null); await recargar(); onCambio(); }}
            disabled={ocupado || !fuentes.length}
            className="flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50 disabled:opacity-50">
            {ocupado ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />} Sincronizar
          </button>
        </div>
        {!fuentes.length && <p className="p-3 text-xs text-slate-400">Todavía no hay fuentes.</p>}
        {fuentes.map(f => (
          <div key={f.id} className="border-b border-slate-100 px-3 py-2 last:border-0">
            <div className="flex items-center gap-2">
              <span className="flex-1 text-sm text-slate-800">{f.nombre}</span>
              {f.curso && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">{f.curso}</span>}
              <span className="text-[11px] text-slate-400">
                {f.eventos_ultimo_sync != null ? `${f.eventos_ultimo_sync} eventos` : "sin sincronizar"}
              </span>
              {f.ultimo_error ? <AlertTriangle className="h-3.5 w-3.5 text-amber-600" /> : <Check className="h-3.5 w-3.5 text-emerald-600" />}
            </div>
            {/* El error del último sync se muestra SIEMPRE: una fuente muerta en silencio
                deja el calendario viejo y nadie se enteraría. */}
            {f.ultimo_error && <p className="mt-1 text-[11px] text-amber-700">{f.ultimo_error}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
