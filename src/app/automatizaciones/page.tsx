"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Zap, Loader2, Plus, Play, Pause, Trash2, FlaskConical, AlertTriangle, Check, ShieldAlert,
} from "lucide-react";
import {
  getReglas, crearRegla, cambiarRegla, borrarRegla, probarRegla, type Regla,
} from "@/lib/alfred/client";

// Automatizaciones: "cuando pase esto, hacé esto".
//
// La idea de la pantalla es que se pueda VER la diferencia entre una regla que te avisa a
// vos y una que le manda un correo a un tercero. Son cosas distintas: la primera, si se
// equivoca, es una molestia; la segunda es irreversible y sale con tu nombre.
//
// Por eso toda regla nace en simulación y la pantalla lo muestra como el estado normal, no
// como un modo de prueba escondido. Activar es una decisión aparte, que se toma después de
// ver qué habría hecho.

const DISPARADORES = [
  { k: "correo", label: "Llega un correo" },
  { k: "mensaje_whatsapp", label: "Llega un WhatsApp" },
  { k: "evento_proximo", label: "Se acerca un evento del calendario" },
  { k: "evento_nuevo", label: "Aparece un evento nuevo" },
  { k: "hora", label: "A una hora del día" },
];

const ACCIONES = [
  { k: "avisar", label: "Avisarme", afuera: false },
  { k: "correo", label: "Mandar un correo", afuera: true },
  { k: "whatsapp", label: "Mandar un WhatsApp", afuera: true },
  { k: "crear_evento", label: "Crear un evento", afuera: false },
  { k: "crear_recordatorio", label: "Crear un recordatorio", afuera: false },
  { k: "llamar_agente", label: "Pedirle algo a un agente", afuera: false },
];

export default function AutomatizacionesPage() {
  const [reglas, setReglas] = useState<Regla[]>([]);
  const [enSimulacion, setEnSimulacion] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [nota, setNota] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);

  const recargar = useCallback(async () => {
    setCargando(true);
    const r = await getReglas();
    setReglas(r.reglas); setEnSimulacion(r.en_simulacion);
    setCargando(false);
  }, []);
  useEffect(() => { recargar(); }, [recargar]);

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col">
      <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-2">
        <Zap className="h-4 w-4 text-[#0a1628]" />
        <span className="text-sm font-semibold text-slate-800">Automatizaciones</span>
        {enSimulacion > 0 && (
          <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] text-violet-700">
            {enSimulacion} en simulación
          </span>
        )}
        <button onClick={() => setCreando(v => !v)}
          className="ml-auto flex items-center gap-1.5 rounded-lg bg-[#0a1628] px-3 py-1.5 text-xs font-medium text-white">
          <Plus className="h-3.5 w-3.5" /> Nueva
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl space-y-4 p-4">
          {nota && (
            <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> <span>{nota}</span>
            </div>
          )}

          <p className="text-xs text-slate-500">
            Toda regla nueva arranca <strong>en simulación</strong>: cuando pase lo que describe, te digo
            «esto habría hecho» sin hacerlo. Cuando veas que acierta, la activás.
          </p>

          {creando && <Formulario onListo={async () => { setCreando(false); await recargar(); }} setNota={setNota} />}

          {cargando && !reglas.length && (
            <p className="flex items-center gap-2 text-xs text-slate-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Cargando…
            </p>
          )}
          {!cargando && !reglas.length && (
            <p className="rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-500">
              Todavía no hay reglas. Un ejemplo de lo que se puede pedir: «cuando llegue un correo de
              Anthropic que diga <em>invoice</em> y traiga adjunto, mandale un correo a Patricio con la factura».
            </p>
          )}

          {reglas.map(r => (
            <Tarjeta key={r.id} r={r} onCambio={recargar} setNota={setNota} />
          ))}
        </div>
      </div>
    </div>
  );
}

function Tarjeta({ r, onCambio, setNota }: { r: Regla; onCambio: () => void; setNota: (s: string | null) => void }) {
  const [ocupado, setOcupado] = useState(false);
  const disparador = DISPARADORES.find(d => d.k === r.cuando)?.label ?? r.cuando;

  const cambiar = async (cambios: Parameters<typeof cambiarRegla>[1]) => {
    setOcupado(true);
    const res = await cambiarRegla(r.id, cambios);
    setOcupado(false);
    setNota(res.error ?? res.aviso ?? null);
    onCambio();
  };

  return (
    <div className={`rounded-xl border bg-white p-4 ${r.activa ? "border-slate-200" : "border-slate-200 opacity-60"}`}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-slate-800">{r.nombre}</span>

        {r.simulacion ? (
          <span className="flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[10px] text-violet-700">
            <FlaskConical className="h-3 w-3" /> simulación
          </span>
        ) : (
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-700">activa</span>
        )}

        {/* La marca que más importa de la pantalla: esta regla manda algo con tu nombre a
            alguien que no sos vos. Si se equivoca, no hay cómo deshacerlo. */}
        {r.hacia_afuera && (
          <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] text-amber-800">
            <ShieldAlert className="h-3 w-3" /> sale hacia afuera
          </span>
        )}

        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">{r.nivel}</span>
        {r.veces > 0 && <span className="text-[11px] text-slate-400">{r.veces} vez/veces</span>}
      </div>

      <p className="text-xs text-slate-600">
        <span className="text-slate-400">Cuando</span> {disparador}
        {Object.keys(r.condicion || {}).length > 0 && (
          <span className="text-slate-500"> · {resumirCondicion(r.condicion)}</span>
        )}
      </p>
      <p className="mt-0.5 text-xs text-slate-600">
        <span className="text-slate-400">Entonces</span> {r.descripcion_accion}
      </p>
      {r.descripcion && <p className="mt-1 text-[11px] italic text-slate-400">«{r.descripcion}»</p>}

      {/* El historial es lo que permite decidir si activarla: sin ver qué hizo (o qué habría
          hecho) las últimas veces, activar es un acto de fe. */}
      {r.ultimas?.length > 0 && (
        <div className="mt-3 space-y-1 rounded-lg bg-slate-50 p-2">
          <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Últimas veces</p>
          {r.ultimas.map((u, i) => (
            <p key={i} className="text-[11px] text-slate-600">
              <span className="text-slate-400">{new Date(u.cuando_at).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
              {u.simulado && <span className="ml-1 text-violet-600">[simulado]</span>}{" "}
              {u.hizo ?? u.resultado}
            </p>
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {r.simulacion ? (
          <button onClick={() => cambiar({ simulacion: false })} disabled={ocupado}
            className="flex items-center gap-1 rounded-lg bg-[#0a1628] px-2.5 py-1 text-[11px] text-white disabled:opacity-50">
            <Check className="h-3 w-3" /> Activar de verdad
          </button>
        ) : (
          <button onClick={() => cambiar({ simulacion: true })} disabled={ocupado}
            className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] text-slate-600 disabled:opacity-50">
            <FlaskConical className="h-3 w-3" /> Volver a simulación
          </button>
        )}
        <button onClick={() => cambiar({ activa: !r.activa })} disabled={ocupado}
          className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] text-slate-600 disabled:opacity-50">
          {r.activa ? <><Pause className="h-3 w-3" /> Pausar</> : <><Play className="h-3 w-3" /> Reanudar</>}
        </button>
        {/* "ejecutar" es lo único que deja correr sola una acción hacia afuera. Se pide
            explícito y con el aviso al lado, no escondido en un desplegable. */}
        {r.hacia_afuera && !r.simulacion && r.nivel !== "ejecutar" && (
          <button onClick={() => cambiar({ nivel: "ejecutar" })} disabled={ocupado}
            className="rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] text-amber-800 disabled:opacity-50">
            Dejarla correr sin pedirme OK
          </button>
        )}
        <button
          onClick={async () => { setOcupado(true); await borrarRegla(r.id); setOcupado(false); onCambio(); }}
          disabled={ocupado}
          className="ml-auto text-slate-300 hover:text-rose-500">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function resumirCondicion(c: Record<string, unknown>) {
  const partes: string[] = [];
  if (c.de) partes.push(`de "${c.de}"`);
  if (c.contiene) partes.push(`dice "${Array.isArray(c.contiene) ? c.contiene.join('" y "') : c.contiene}"`);
  if (c.no_contiene) partes.push(`sin "${c.no_contiene}"`);
  if (c.con_adjunto) partes.push("con adjunto");
  if (c.categoria) partes.push(`categoría ${c.categoria}`);
  if (c.requiere) partes.push(`requiere ${c.requiere}`);
  if (c.dias_antes !== undefined) partes.push(`${c.dias_antes} días antes`);
  return partes.join(", ");
}

// ── Crear una regla ──────────────────────────────────────────────────────────────────

function Formulario({ onListo, setNota }: { onListo: () => void; setNota: (s: string | null) => void }) {
  const [nombre, setNombre] = useState("");
  const [cuando, setCuando] = useState("correo");
  const [de, setDe] = useState("");
  const [contiene, setContiene] = useState("");
  const [conAdjunto, setConAdjunto] = useState(false);
  const [accion, setAccion] = useState("avisar");
  const [a, setA] = useState("");
  const [asunto, setAsunto] = useState("");
  const [texto, setTexto] = useState("");
  const [adjuntar, setAdjuntar] = useState("");
  const [prueba, setPrueba] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const haciaAfuera = ACCIONES.find(x => x.k === accion)?.afuera ?? false;

  const armar = () => ({
    nombre: nombre.trim(),
    cuando,
    condicion: {
      ...(de.trim() ? { de: de.trim() } : {}),
      ...(contiene.trim() ? { contiene: contiene.split(",").map(s => s.trim()).filter(Boolean) } : {}),
      ...(conAdjunto ? { con_adjunto: true } : {}),
    },
    accion,
    parametros: {
      ...(a.trim() ? { a: a.trim() } : {}),
      ...(asunto.trim() ? { asunto: asunto.trim() } : {}),
      ...(texto.trim() ? { texto: texto.trim() } : {}),
      ...(adjuntar.trim() ? { adjuntar: adjuntar.trim() } : {}),
    },
    nivel: haciaAfuera ? "preparar" : "avisar",
  });

  return (
    <div className="rounded-xl border border-slate-300 bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-800">Nueva automatización</h3>

      <div className="space-y-3">
        <input value={nombre} onChange={e => setNombre(e.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs"
          placeholder="Nombre corto, para poder pausarla después (ej: factura-anthropic)" />

        <div>
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">Cuando</p>
          <select value={cuando} onChange={e => setCuando(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs">
            {DISPARADORES.map(d => <option key={d.k} value={d.k}>{d.label}</option>)}
          </select>
          <div className="mt-2 flex flex-wrap gap-2">
            <input value={de} onChange={e => setDe(e.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs"
              placeholder="de (ej: anthropic)" />
            <input value={contiene} onChange={e => setContiene(e.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs"
              placeholder="que diga (separá con comas)" />
            <label className="flex items-center gap-1.5 text-xs text-slate-600">
              <input type="checkbox" checked={conAdjunto} onChange={e => setConAdjunto(e.target.checked)} />
              con adjunto
            </label>
          </div>
        </div>

        <div>
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">Entonces</p>
          <select value={accion} onChange={e => setAccion(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs">
            {ACCIONES.map(x => <option key={x.k} value={x.k}>{x.label}</option>)}
          </select>
          <div className="mt-2 flex flex-wrap gap-2">
            {haciaAfuera && (
              <input value={a} onChange={e => setA(e.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs"
                placeholder={accion === "correo" ? "a quién (correo)" : "a quién (número o nombre)"} />
            )}
            {accion === "correo" && (
              <>
                <input value={asunto} onChange={e => setAsunto(e.target.value)}
                  className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs" placeholder="asunto" />
                <input value={adjuntar} onChange={e => setAdjuntar(e.target.value)}
                  className="w-40 rounded-lg border border-slate-200 px-3 py-1.5 text-xs" placeholder="adjuntar (ej: la factura)" />
              </>
            )}
            {accion !== "correo" && (
              <input value={texto} onChange={e => setTexto(e.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs" placeholder="texto" />
            )}
          </div>
          {haciaAfuera && (
            <p className="mt-2 flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-800">
              <ShieldAlert className="mt-0.5 h-3 w-3 shrink-0" />
              Esto sale con tu nombre hacia alguien que no sos vos. Va a pedirte el OK cada vez, hasta
              que decidas explícitamente lo contrario.
            </p>
          )}
        </div>

        {prueba && (
          <div className="rounded-lg bg-slate-50 p-2 text-[11px] text-slate-700">{prueba}</div>
        )}

        <div className="flex flex-wrap gap-2">
          {/* Probar antes de guardar. Sin esto, escribir una regla es escribir a ciegas y
              esperar semanas a ver si acierta con algo real. */}
          <button
            onClick={async () => {
              setOcupado(true);
              const r = await probarRegla({ ...armar(), activa: true, simulacion: true }, {
                tipo: cuando,
                de: de.trim() || "ejemplo@dominio.cl",
                asunto: contiene.split(",")[0]?.trim() || "un asunto de ejemplo",
                texto: contiene.split(",")[0]?.trim() || "",
                adjuntos: conAdjunto ? [{ nombre: "archivo.pdf" }] : [],
              });
              setOcupado(false);
              setPrueba(r.error ? r.error
                : r.coincide
                  ? `✅ Con un caso de ejemplo coincide, y ${r.decision?.habria ?? r.decision?.propuesta ?? r.decision?.descripcion ?? "haría la acción"}.`
                  : `No coincidiría: ${r.motivo}. Revisá las condiciones.`);
            }}
            disabled={ocupado || !cuando}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 disabled:opacity-50">
            {ocupado ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FlaskConical className="h-3.5 w-3.5" />} Probar
          </button>
          <button
            onClick={async () => {
              if (!nombre.trim()) { setNota("Ponele un nombre corto: es con lo que la vas a pausar después."); return; }
              setOcupado(true);
              const r = await crearRegla(armar());
              setOcupado(false);
              if (r.error) { setNota(r.error); return; }
              setNota(r.mensaje ?? null);
              onListo();
            }}
            disabled={ocupado}
            className="rounded-lg bg-[#0a1628] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">
            Guardar en simulación
          </button>
        </div>
      </div>
    </div>
  );
}
