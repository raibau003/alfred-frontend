"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, AlertTriangle, Check, Users, Utensils } from "lucide-react";
import {
  getHogar, guardarPersona, agregarRestriccion, quitarRestriccion,
  calcularPauta, guardarPauta,
  type Hogar, type Persona, type Pauta,
} from "@/lib/alfred/client";

const ROLES = [
  { v: "residente", t: "Vive acá" },
  { v: "cocina", t: "Cocina" },
  { v: "apoyo", t: "Apoyo" },
] as const;

export function HogarPanel() {
  const [hogar, setHogar] = useState<Hogar>({ personas: [], completo: false });
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [nuevo, setNuevo] = useState({ nombre: "", tipo: "adulto" as "adulto" | "nino", edad: "", rol: "residente", whatsapp: "" });
  const [efecto, setEfecto] = useState<string | null>(null);

  useEffect(() => { (async () => { setHogar(await getHogar()); setCargando(false); })(); }, []);

  async function agregarPersona() {
    if (!nuevo.nombre.trim()) return;
    setGuardando(true);
    const h = await guardarPersona({
      nombre: nuevo.nombre.trim(),
      tipo: nuevo.tipo,
      edad: nuevo.edad ? Number(nuevo.edad) : undefined,
      rol: nuevo.rol as Persona["rol"],
      whatsapp: nuevo.whatsapp || undefined,
      // El consentimiento se sella solo si hay teléfono: sin número no hay a quién avisarle.
      consentimiento: !!nuevo.whatsapp,
    });
    setGuardando(false);
    if (h) {
      setHogar(h);
      setNuevo({ nombre: "", tipo: "adulto", edad: "", rol: "residente", whatsapp: "" });
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-8">
      <header>
        <h1 className="text-xl font-bold text-[#0a1628] flex items-center gap-2">
          <Users className="h-5 w-5 text-slate-400" /> Quiénes comen en casa
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          El nutricionista usa esto para armar las pautas, y el planificador para saber para cuántos cocinar.
        </p>
        {hogar.resumen && (
          <p className="text-xs text-slate-400 mt-2">
            {hogar.resumen.total} personas · {hogar.resumen.adultos} adultos · {hogar.resumen.ninos} niños
            {hogar.resumen.alergias > 0 && ` · ${hogar.resumen.alergias} alergia(s) registrada(s)`}
          </p>
        )}
      </header>

      {cargando ? (
        <div className="flex items-center gap-2 text-slate-400 py-10">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
        </div>
      ) : (
        <>
          <section className="space-y-3">
            {hogar.personas.map((p) => (
              <PersonaCard
                key={p.id}
                persona={p}
                onCambio={setHogar}
                onEfecto={setEfecto}
              />
            ))}
            {hogar.personas.length === 0 && (
              <p className="text-sm text-slate-400 border border-dashed border-slate-200 rounded-lg p-6 text-center">
                Todavía no hay nadie. Agregá a los que comen en casa, o decíselo a Alfred por chat.
              </p>
            )}
          </section>

          {/* Agregar persona */}
          <section className="rounded-xl border border-slate-200 p-4 space-y-3">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
              <Plus className="h-4 w-4 text-slate-400" /> Agregar persona
            </h2>
            <div className="grid sm:grid-cols-2 gap-2">
              <input
                value={nuevo.nombre}
                onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })}
                placeholder="Nombre"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a1628]/20"
              />
              <div className="flex gap-2">
                <select
                  value={nuevo.tipo}
                  onChange={(e) => setNuevo({ ...nuevo, tipo: e.target.value as "adulto" | "nino" })}
                  className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="adulto">Adulto</option>
                  <option value="nino">Niño</option>
                </select>
                <input
                  value={nuevo.edad}
                  onChange={(e) => setNuevo({ ...nuevo, edad: e.target.value })}
                  placeholder="Edad"
                  inputMode="numeric"
                  className="w-20 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  title="La edad define el tamaño de la porción"
                />
              </div>
              <select
                value={nuevo.rol}
                onChange={(e) => setNuevo({ ...nuevo, rol: e.target.value })}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                {ROLES.map((r) => <option key={r.v} value={r.v}>{r.t}</option>)}
              </select>
              <input
                value={nuevo.whatsapp}
                onChange={(e) => setNuevo({ ...nuevo, whatsapp: e.target.value })}
                placeholder="WhatsApp (opcional)"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <p className="text-xs text-slate-500">
              El rol <b>Cocina</b> es quien recibe el menú del día y a quien Alfred le pregunta si se cocinó.
              Es un rol, no una persona: si cambia, cambiás el teléfono y nada más.
            </p>
            <button
              onClick={agregarPersona}
              disabled={guardando || !nuevo.nombre.trim()}
              className="flex items-center gap-1.5 rounded-lg bg-[#0a1628] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
            >
              {guardando ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />} Agregar
            </button>
          </section>

          {efecto && (
            <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-900 flex-1">{efecto}</p>
              <button onClick={() => setEfecto(null)} className="text-amber-400 text-xs">✕</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PersonaCard({
  persona, onCambio, onEfecto,
}: {
  persona: Persona;
  onCambio: (h: Hogar) => void;
  onEfecto: (s: string) => void;
}) {
  const [abierta, setAbierta] = useState(false);
  const [nueva, setNueva] = useState({ que: "", tipo: "dura" as "dura" | "blanda" });
  const [ocupado, setOcupado] = useState(false);
  const [pauta, setPauta] = useState<Pauta | null>(persona.pauta ?? null);
  const [datos, setDatos] = useState({ peso: "", altura: "", edad: String(persona.edad ?? ""), objetivo: "bajar_grasa" });

  const duras = persona.restricciones.filter((r) => r.tipo === "dura");

  async function addRestriccion() {
    if (!nueva.que.trim()) return;
    setOcupado(true);
    const r = await agregarRestriccion(persona.id, nueva.tipo, nueva.que.trim());
    setOcupado(false);
    if (r) { onCambio(r.hogar); onEfecto(r.efecto); setNueva({ que: "", tipo: "dura" }); }
  }

  async function delRestriccion(id: number) {
    setOcupado(true);
    if (await quitarRestriccion(id)) onCambio(await getHogar());
    setOcupado(false);
  }

  async function verPauta() {
    setOcupado(true);
    const p = await calcularPauta({
      peso: Number(datos.peso) || undefined,
      altura: Number(datos.altura) || undefined,
      edad: Number(datos.edad) || undefined,
      objetivo: datos.objetivo,
    });
    setOcupado(false);
    setPauta(p);
  }

  async function fijarPauta() {
    if (!pauta || pauta.incompleta) return;
    setOcupado(true);
    if (await guardarPauta(persona.id, pauta)) onCambio(await getHogar());
    setOcupado(false);
  }

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <button onClick={() => setAbierta(!abierta)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 text-left">
        <span className="text-sm font-semibold text-slate-900">{persona.nombre}</span>
        <span className="text-xs text-slate-400">
          {persona.tipo === "nino" ? "niño" : "adulto"}{persona.edad ? ` · ${persona.edad} años` : ""}
          {persona.rol !== "residente" && ` · ${persona.rol}`}
        </span>
        {duras.length > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700">
            <AlertTriangle className="h-3 w-3" /> {duras.map((r) => r.que).join(", ")}
          </span>
        )}
        {persona.pauta?.kcal_objetivo && (
          <span className="rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-700">
            {persona.pauta.kcal_objetivo} kcal
          </span>
        )}
        <span className="ml-auto text-slate-300 text-xs">{abierta ? "▲" : "▼"}</span>
      </button>

      {abierta && (
        <div className="border-t border-slate-100 p-4 space-y-4">
          {/* Restricciones */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-slate-700">Restricciones</h3>
            {persona.restricciones.length === 0 && <p className="text-xs text-slate-400">Ninguna registrada.</p>}
            {persona.restricciones.map((r) => (
              <div key={r.id} className="flex items-center gap-2 text-xs">
                <span className={`rounded px-1.5 py-0.5 font-bold ${r.tipo === "dura" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"}`}>
                  {r.tipo === "dura" ? "BLOQUEA" : "avisa"}
                </span>
                <span className="text-slate-700 flex-1">{r.que}</span>
                <button onClick={() => delRestriccion(r.id)} disabled={ocupado} className="text-slate-300 hover:text-red-500">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
            <div className="flex gap-2 pt-1">
              <select
                value={nueva.tipo}
                onChange={(e) => setNueva({ ...nueva, tipo: e.target.value as "dura" | "blanda" })}
                className="rounded border border-slate-200 px-2 py-1 text-xs"
              >
                <option value="dura">Alergia / no puede (bloquea)</option>
                <option value="blanda">No le gusta (avisa)</option>
              </select>
              <input
                value={nueva.que}
                onChange={(e) => setNueva({ ...nueva, que: e.target.value })}
                placeholder="maní, gluten, cilantro…"
                className="flex-1 rounded border border-slate-200 px-2 py-1 text-xs"
              />
              <button onClick={addRestriccion} disabled={ocupado || !nueva.que.trim()} className="rounded bg-slate-900 px-2 py-1 text-xs text-white disabled:opacity-40">
                {ocupado ? <Loader2 className="h-3 w-3 animate-spin" /> : "Agregar"}
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              Una restricción <b>dura</b> hace que Alfred descarte el plato con código, no con criterio — incluidos los
              derivados (una alergia al maní bloquea &quot;mantequilla de maní&quot;).
            </p>
          </div>

          {/* Pauta */}
          <div className="space-y-2 border-t border-slate-100 pt-3">
            <h3 className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <Utensils className="h-3.5 w-3.5 text-slate-400" /> Pauta nutricional
            </h3>
            <div className="flex flex-wrap gap-2">
              {[
                { k: "peso", ph: "Peso kg" },
                { k: "altura", ph: "Altura cm" },
                { k: "edad", ph: "Edad" },
              ].map((f) => (
                <input
                  key={f.k}
                  value={(datos as Record<string, string>)[f.k]}
                  onChange={(e) => setDatos({ ...datos, [f.k]: e.target.value })}
                  placeholder={f.ph}
                  inputMode="numeric"
                  className="w-24 rounded border border-slate-200 px-2 py-1 text-xs"
                />
              ))}
              <select
                value={datos.objetivo}
                onChange={(e) => setDatos({ ...datos, objetivo: e.target.value })}
                className="rounded border border-slate-200 px-2 py-1 text-xs"
              >
                <option value="bajar_grasa">Bajar grasa</option>
                <option value="mantener">Mantener</option>
                <option value="ganar_musculo">Ganar músculo</option>
              </select>
              <button onClick={verPauta} disabled={ocupado} className="rounded border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50">
                Calcular
              </button>
            </div>

            {pauta && !pauta.incompleta && (
              <div className="rounded-lg bg-slate-50 p-3 space-y-1.5">
                <p className="text-xs text-slate-700">{pauta.explicacion}</p>
                <p className="text-xs font-medium text-slate-900">
                  {pauta.kcal_objetivo} kcal · {pauta.proteina_g}g proteína · {pauta.carbo_g}g carbo · {pauta.grasa_g}g grasa
                </p>
                {pauta.viene_del_coach && (
                  <p className="text-[11px] text-green-700">
                    Incluye {pauta.kcal_entrenamiento} kcal/día de tu plan de entrenamiento.
                  </p>
                )}
                <button onClick={fijarPauta} disabled={ocupado} className="flex items-center gap-1 rounded bg-green-600 px-2 py-1 text-xs text-white">
                  <Check className="h-3 w-3" /> Fijar esta pauta
                </button>
              </div>
            )}
            {pauta?.incompleta && (
              <p className="text-xs text-amber-700">Faltan datos: {pauta.faltan?.join(", ")}.</p>
            )}
            {!pauta && (
              <p className="text-[11px] text-slate-500">
                Si esta persona no necesita pauta propia, dejala vacía: come del menú balanceado del hogar.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
