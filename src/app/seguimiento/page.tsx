"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Users, RefreshCw, Loader2, TrendingUp, TrendingDown, Minus, AlertTriangle,
  CalendarDays, BookOpen, Clock,
} from "lucide-react";
import {
  getSeguimiento, sincronizarNotas,
  type SeguimientoPersona, type NotaRamo, type EventoCalendario,
} from "@/lib/alfred/client";

// Seguimiento: una ficha por persona con sus notas y lo que se le viene.
//
// Es la pantalla que responde "¿cómo va cada uno?" sin tener que cruzar tres secciones. Por
// eso junta cosas de distinto origen —SchoolNet, el calendario del colegio, los grupos de
// WhatsApp, Canvas— pero organizadas por PERSONA, que es como uno piensa el problema.
//
// Dos decisiones de honestidad:
//   · Una nota sola no dice nada. Se muestra la tendencia al lado, y cuando hay menos de
//     tres lecturas se dice "sin datos" en vez de dibujar una flecha inventada.
//   · El tono describe el cambio, no a la persona. Un rojo se marca porque pide hacer algo
//     hoy, no para señalar a un niño de 8 años.

const REQUIERE: Record<string, string> = {
  ropa: "dejar la ropa lista", colacion: "preparar colación", permiso: "firmar autorización",
  reunion: "hay que ir", inscripcion: "hay que inscribir", pago: "hay que pagar",
  horario: "cambia el horario", evento: "hay que ir",
};

const fmtNota = (n: number | null) => (n === null ? "—" : String(n).replace(".", ","));

// Bajo 4,0 es reprobatorio en Chile. Es lo único que pide hacer algo el mismo día.
const esRoja = (n: number | null) => n !== null && n < 4;

export default function SeguimientoPage() {
  const [datos, setDatos] = useState<Awaited<ReturnType<typeof getSeguimiento>> | null>(null);
  const [cargando, setCargando] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);
  const [nota, setNota] = useState<string | null>(null);

  const recargar = useCallback(async () => {
    setCargando(true);
    setDatos(await getSeguimiento());
    setCargando(false);
  }, []);
  useEffect(() => { recargar(); }, [recargar]);

  const personas = datos?.personas ?? [];

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-4 py-2">
        <Users className="h-4 w-4 text-[#0a1628]" />
        <span className="text-sm font-semibold text-slate-800">Seguimiento</span>
        <span className="text-xs text-slate-400">notas y lo que viene, por persona</span>
        <button
          onClick={async () => {
            setSincronizando(true);
            const r = await sincronizarNotas();
            setSincronizando(false);
            setNota(r.mensaje ?? r.error ?? null);
          }}
          disabled={sincronizando}
          className="ml-auto flex items-center gap-1.5 rounded-lg bg-[#0a1628] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">
          {sincronizando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BookOpen className="h-3.5 w-3.5" />}
          Actualizar notas
        </button>
        <button onClick={recargar} disabled={cargando}
          className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50">
          {cargando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl space-y-4 p-4">
          {nota && (
            <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
              <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" /> <span>{nota}</span>
            </div>
          )}
          {datos?.error && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              No pude cargar el seguimiento ({datos.error}).
            </div>
          )}

          {cargando && !personas.length && (
            <p className="flex items-center gap-2 text-xs text-slate-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Cargando…
            </p>
          )}

          {personas.map(p => <Ficha key={p.id} p={p} />)}

          {/* Se dice quién queda fuera y por qué. Una ficha vacía sin explicación parece un
              error del sistema cuando en realidad falta configurar algo. */}
          {!!datos?.sin_curso?.length && (
            <p className="text-[11px] text-slate-400">
              Sin curso configurado, así que no les busco notas: {datos.sin_curso.join(", ")}.
              Se agrega en Educación → Personas y fuentes.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Ficha({ p }: { p: SeguimientoPersona }) {
  const conNota = p.notas.filter(n => n.nota !== null);
  const rojas = conNota.filter(n => esRoja(n.nota));

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-slate-800">{p.nombre}</span>
        {p.edad != null && <span className="text-[11px] text-slate-400">{p.edad} años</span>}
        {p.curso && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">{p.curso}</span>}
        {p.promedio !== null && (
          <span className="rounded-full bg-slate-900 px-2.5 py-0.5 text-[11px] text-white">
            promedio {fmtNota(p.promedio)}
          </span>
        )}
        {p.ultima_lectura && (
          <span className="ml-auto text-[11px] text-slate-400">
            notas leídas {new Date(p.ultima_lectura).toLocaleDateString("es-CL", { day: "2-digit", month: "short" })}
          </span>
        )}
      </div>

      {/* Un rojo primero y aparte: es lo único que pide hacer algo hoy. */}
      {rojas.length > 0 && (
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{rojas.map(r => `${r.asignatura} está en ${fmtNota(r.nota)}`).join(" · ")}.</span>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Notas</h3>
          {!p.notas.length ? (
            <p className="text-xs text-slate-400">
              {p.curso
                ? "Todavía no tengo notas. Dale a «Actualizar notas» — entrar al portal toma unos minutos."
                : "Sin curso configurado."}
            </p>
          ) : (
            <div className="space-y-0.5">
              {p.notas.map(nn => <FilaNota key={`${nn.asignatura}-${nn.periodo}`} n={nn} />)}
            </div>
          )}
        </div>

        <div>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Lo que viene</h3>
          {!p.proximos.length ? (
            <p className="text-xs text-slate-400">Nada anotado para los próximos días.</p>
          ) : (
            <div className="space-y-1">
              {/* Lo que exige preparar algo va primero: es sobre lo único que se puede
                  actuar hoy, y mezclarlo con los feriados lo entierra. */}
              {p.pendientes.map(e => <FilaEvento key={`p-${e.id}`} e={e} destacar />)}
              {p.proximos
                .filter(e => !p.pendientes.some(x => x.id === e.id))
                .slice(0, 6)
                .map(e => <FilaEvento key={e.id} e={e} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FilaNota({ n }: { n: NotaRamo }) {
  const roja = esRoja(n.nota);
  return (
    <div className="flex items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-slate-50">
      <span className="min-w-0 flex-1 truncate text-slate-700">{n.asignatura}</span>
      {n.periodo && <span className="hidden shrink-0 text-[10px] text-slate-300 sm:inline">{n.periodo}</span>}
      <Tendencia t={n.tendencia} />
      <span className={`w-10 shrink-0 text-right font-medium tabular-nums ${
        roja ? "text-rose-600" : n.nota === null ? "text-slate-300" : "text-slate-800"
      }`}>
        {fmtNota(n.nota)}
      </span>
    </div>
  );
}

// La flecha solo se dibuja cuando hay con qué. Con dos lecturas es una línea, no una
// tendencia, y una flecha inventada se lee como un dato.
function Tendencia({ t }: { t: NotaRamo["tendencia"] }) {
  if (!t || t.direccion === "sin_datos") {
    return (
      <span title={t?.motivo ?? "sin suficientes lecturas"} className="w-4 shrink-0 text-center text-[10px] text-slate-200">
        ·
      </span>
    );
  }
  const Icon = t.direccion === "subiendo" ? TrendingUp : t.direccion === "bajando" ? TrendingDown : Minus;
  const color = t.direccion === "subiendo" ? "text-emerald-600"
    : t.direccion === "bajando" ? "text-amber-600" : "text-slate-300";
  return (
    <span title={`${t.direccion} (${t.lecturas} lecturas${t.dif ? `, ${t.dif > 0 ? "+" : ""}${String(t.dif).replace(".", ",")}` : ""})`}
      className={`w-4 shrink-0 ${color}`}>
      <Icon className="h-3.5 w-3.5" />
    </span>
  );
}

function FilaEvento({ e, destacar = false }: { e: EventoCalendario; destacar?: boolean }) {
  return (
    <div className={`flex items-center gap-2 rounded px-1.5 py-1 text-xs ${destacar ? "bg-slate-50" : ""}`}>
      <CalendarDays className="h-3 w-3 shrink-0 text-slate-300" />
      <span className="w-20 shrink-0 text-[10px] text-slate-400">{e.dia_relativo}</span>
      <span className="min-w-0 flex-1 truncate text-slate-700">{e.titulo}</span>
      {destacar && e.requiere && e.requiere !== "nada" && (
        <span className="shrink-0 rounded bg-slate-900 px-1.5 py-0.5 text-[10px] text-white">
          {REQUIERE[e.requiere] ?? e.requiere}
        </span>
      )}
      {e.confianza !== "alta" && (
        <span title={e.cita ?? "inferido"} className="shrink-0 text-[10px] text-amber-600">a confirmar</span>
      )}
    </div>
  );
}
