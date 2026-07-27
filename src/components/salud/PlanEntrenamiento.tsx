"use client";

// La semana de entrenamiento en tabla, y las alternativas para elegir.
//
// Dos decisiones que vale la pena explicar:
//
// 1. La tabla muestra SIEMPRE los siete días. El día que el plan no define sale gris y
//    dice "sin definir", en vez de no aparecer: una tabla de cinco filas no deja ver que
//    faltan dos días, y era justo lo que pasaba antes de la vista.
//
// 2. Elegir una alternativa NO es un cambio de pestaña: escribe el plan en el perfil, que
//    es de donde la nutrición saca las calorías. Por eso el efecto ("tu pauta pasa a X
//    kcal/día") se muestra acá mismo, donde se toma la decisión.

import { useCallback, useEffect, useState } from "react";
import {
  Loader2, Check, Sparkles, AlertTriangle, Dumbbell, Moon, Minus, RefreshCw, Salad,
} from "lucide-react";
import {
  getPlanEntrenamiento, generarPlanesEntrenamiento, elegirPlanEntrenamiento,
  type PlanEntrenamiento as Plan, type AlternativaEntrenamiento, type FilaEntrenamiento,
} from "@/lib/alfred/client";

export function PlanEntrenamiento() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [cargando, setCargando] = useState(true);
  const [generando, setGenerando] = useState(false);
  const [eligiendo, setEligiendo] = useState<string | null>(null);
  // Cuál se está MIRANDO, que no es lo mismo que cuál está en uso: se puede comparar las
  // tres sin cambiar la que alimenta la nutrición.
  const [viendo, setViendo] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [pedido, setPedido] = useState("");

  const cargar = useCallback(async (mostrarSpinner = true) => {
    if (mostrarSpinner) setCargando(true);
    const p = await getPlanEntrenamiento();
    setPlan(p);
    setViendo((prev) => prev ?? claveDe(p.vigente) ?? claveDe(p.alternativas[0]));
    setCargando(false);
  }, []);

  useEffect(() => { void cargar(); }, [cargar]);

  const generar = async () => {
    setGenerando(true);
    setAviso(null);
    const r = await generarPlanesEntrenamiento(pedido.trim() || undefined);
    setGenerando(false);
    if (r.error) { setAviso({ tipo: "error", texto: r.error }); return; }
    setPedido("");
    setViendo(null);
    await cargar(false);
    if (r.nota) setAviso({ tipo: "ok", texto: r.nota });
  };

  const elegir = async (alt: AlternativaEntrenamiento) => {
    if (!alt.id) return;
    setEligiendo(alt.id);
    const r = await elegirPlanEntrenamiento(alt.id);
    setEligiendo(null);
    if (r.error) { setAviso({ tipo: "error", texto: r.error }); return; }
    setAviso({
      tipo: "ok",
      texto: r.aviso
        ? `${r.nombre} quedó como tu plan, pero ${r.aviso}`
        : `${r.nombre} es tu plan: la nutrición ahora suma ${r.kcal_entrenamiento} kcal/día por entrenamiento.`,
    });
    await cargar(false);
  };

  if (cargando) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Buscando tu plan…
      </div>
    );
  }

  const opciones: AlternativaEntrenamiento[] = plan
    ? [
        // El plan vigente que no vino de una alternativa (lo escribió el coach por chat) se
        // muestra primero: es el que manda hoy, y esconderlo haría parecer que no hay plan.
        ...(plan.vigente?.fuera_de_lote ? [plan.vigente] : []),
        ...plan.alternativas,
      ]
    : [];
  const actual = opciones.find((o) => claveDe(o) === viendo) ?? opciones[0] ?? null;

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
            <Dumbbell className="h-4 w-4" /> Entrenamiento de la semana
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {plan?.vigente
              ? <>Usás <strong className="text-slate-700">{plan.vigente.nombre}</strong>. Es la base con la que se arma tu nutrición.</>
              : "Todavía no elegiste un plan. La nutrición calcula sin calorías de entrenamiento hasta que elijas uno."}
          </p>
        </div>
        <button
          onClick={generar}
          disabled={generando}
          className="flex items-center gap-1.5 rounded-lg bg-[#0a1628] px-3 py-2 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {generando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {generando ? "El coach está armando 3 opciones…" : opciones.length ? "Generar otras 3" : "Generar 3 alternativas"}
        </button>
      </div>

      {plan?.error && (
        <Banda tipo="error" icono={<AlertTriangle className="h-3.5 w-3.5 shrink-0" />}>
          No pude leer tu plan ({plan.error}).{" "}
          <button onClick={() => void cargar()} className="underline">Reintentar</button>
        </Banda>
      )}
      {aviso && (
        <Banda tipo={aviso.tipo} icono={aviso.tipo === "ok" ? <Check className="h-3.5 w-3.5 shrink-0" /> : <AlertTriangle className="h-3.5 w-3.5 shrink-0" />}>
          {aviso.texto}
        </Banda>
      )}

      {/* Pedido opcional: lo que uno le diría al coach de viva voz ("tengo solo mancuernas",
          "cuatro días máximo"). Sin esto, la única forma de ajustar el plan era el chat. */}
      {!opciones.length && !plan?.error && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center">
          <p className="text-sm text-slate-600">Todavía no hay planes generados.</p>
          <input
            value={pedido}
            onChange={(e) => setPedido(e.target.value)}
            placeholder="Opcional: 4 días, solo mancuernas, cuidando la rodilla…"
            className="mt-3 w-full max-w-md rounded-lg border border-slate-300 px-3 py-2 text-xs"
          />
          <p className="mt-2 text-xs text-slate-500">El coach arma tres opciones con enfoques distintos y elegís una.</p>
        </div>
      )}

      {opciones.length > 0 && (
        <>
          {/* Los chips numerados: "entrenamiento 1, 2 o 3", que es como se piden. */}
          <div className="mb-4 grid gap-2 sm:grid-cols-3">
            {opciones.map((o, i) => {
              const activa = claveDe(o) === claveDe(actual);
              return (
                <button
                  key={claveDe(o) ?? i}
                  onClick={() => setViendo(claveDe(o))}
                  className={`rounded-xl border p-3 text-left transition-colors ${
                    activa ? "border-[#0a1628] bg-slate-50" : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-800">
                      {o.fuera_de_lote ? "Plan actual" : `Entrenamiento ${i + 1 - (plan?.vigente?.fuera_de_lote ? 1 : 0)}`}
                    </span>
                    {o.elegido && (
                      <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                        <Check className="h-3 w-3" /> En uso
                      </span>
                    )}
                  </div>
                  <p className="mt-1 truncate text-xs text-slate-600">{o.nombre}</p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {o.resumen.dias_entrena} día{o.resumen.dias_entrena === 1 ? "" : "s"}
                    {o.resumen.min_semana > 0 && ` · ${o.resumen.min_semana} min/sem`}
                    {o.resumen.min_por_sesion !== null && ` · ${o.resumen.min_por_sesion} min por sesión`}
                  </p>
                </button>
              );
            })}
          </div>

          {actual && (
            <>
              {actual.enfoque && (
                <p className="mb-3 text-xs text-slate-500">{actual.enfoque}</p>
              )}

              {/* Los minutos que faltan cambian las calorías de la pauta, así que se avisa
                  ANTES de elegir y no después. */}
              {actual.resumen.sin_minutos.length > 0 && (
                <Banda tipo="alerta" icono={<AlertTriangle className="h-3.5 w-3.5 shrink-0" />}>
                  Faltan los minutos de {actual.resumen.sin_minutos.join(", ")}: si elegís este plan, la nutrición
                  va a calcular de menos. Pedile al coach que los complete en la pestaña Deporte.
                </Banda>
              )}
              {actual.resumen.dias_sin_definir > 0 && (
                <Banda tipo="alerta" icono={<Minus className="h-3.5 w-3.5 shrink-0" />}>
                  {actual.resumen.dias_sin_definir} día(s) sin definir. No se asumen como descanso: quedan en gris
                  hasta que el coach diga qué toca.
                </Banda>
              )}

              <TablaSemana filas={actual.tabla} />

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="flex items-start gap-2 text-xs text-slate-600">
                  <Salad className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                  {actual.elegido ? (
                    <span>
                      Esta es la base de tu nutrición: suma <strong>{plan?.kcal_entrenamiento ?? 0} kcal/día</strong>{" "}
                      a tu pauta (promediando la semana sobre {plan?.peso ?? 80} kg).
                    </span>
                  ) : (
                    <span>Si elegís este plan, pasa a ser la base con la que se calcula tu pauta de nutrición.</span>
                  )}
                </p>
                {!actual.elegido && actual.id && (
                  <button
                    onClick={() => void elegir(actual)}
                    disabled={eligiendo === actual.id}
                    className="flex items-center gap-1.5 rounded-lg bg-[#0a1628] px-3 py-2 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    {eligiendo === actual.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    Usar este para la nutrición
                  </button>
                )}
              </div>
            </>
          )}

          <div className="mt-4 flex items-center gap-3">
            <input
              value={pedido}
              onChange={(e) => setPedido(e.target.value)}
              placeholder="Ajuste para las próximas: 4 días, solo mancuernas, cuidando la rodilla…"
              className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-xs"
            />
            <button
              onClick={() => void cargar()}
              title="Volver a leer el plan"
              className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// Los planes que todavía no se guardaron no tienen id; el nombre alcanza para distinguirlos
// dentro de una tanda, y usar el índice haría que la selección salte cuando se recarga.
const claveDe = (a: AlternativaEntrenamiento | null | undefined) => (a ? a.id ?? a.nombre : null);

function TablaSemana({ filas }: { filas: FilaEntrenamiento[] }) {
  return (
    // El overflow va en el contenedor de la tabla y no en la página: en el teléfono la
    // tabla se desliza sola y el resto de la vista no se mueve de lado.
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full min-w-[640px] text-left text-xs">
        <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-3 py-2 font-medium">Día</th>
            <th className="px-3 py-2 font-medium">Foco</th>
            <th className="px-3 py-2 font-medium">Duración</th>
            <th className="px-3 py-2 font-medium">Programa</th>
            <th className="px-3 py-2 font-medium">Cardio</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {filas.map((f) => (
            <tr key={f.dia} className={f.estado === "entrena" ? "" : "bg-slate-50/60"}>
              <td className="whitespace-nowrap px-3 py-2 font-medium text-slate-800">{f.nombre}</td>
              <td className="px-3 py-2">
                <span className="flex items-center gap-1.5">
                  {f.estado === "entrena" && <Dumbbell className="h-3 w-3 text-slate-400" />}
                  {f.estado === "descanso" && <Moon className="h-3 w-3 text-slate-400" />}
                  {f.estado === "sin_definir" && <Minus className="h-3 w-3 text-slate-300" />}
                  <span className={f.estado === "sin_definir" ? "text-slate-400" : "text-slate-700"}>{f.foco}</span>
                </span>
              </td>
              {/* Un día sin minutos muestra "—" y no "0 min": decir cero es afirmar que no
                  entrena, y lo que pasa es que no se sabe. */}
              <td className="whitespace-nowrap px-3 py-2 text-slate-600">
                {f.min === null ? <span className="text-slate-400">—</span> : f.min === 0 ? <span className="text-slate-400">—</span> : `${f.min} min`}
              </td>
              <td className="px-3 py-2 text-slate-600">
                {f.bloques.length ? (
                  <ul className="space-y-0.5">
                    {f.bloques.map((b, i) => (
                      <li key={i}>
                        {b.ejercicio}
                        {(b.series || b.reps) && (
                          <span className="text-slate-400">
                            {" "}{b.series ?? ""}{b.series && b.reps ? "×" : ""}{b.reps ?? ""}
                          </span>
                        )}
                        {b.carga && <span className="text-slate-400"> · {b.carga}</span>}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-slate-400">{f.estado === "descanso" ? "Descanso" : "—"}</span>
                )}
              </td>
              <td className="px-3 py-2 text-slate-600">{f.cardio || <span className="text-slate-400">—</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Banda({ tipo, icono, children }: { tipo: "ok" | "error" | "alerta"; icono: React.ReactNode; children: React.ReactNode }) {
  const estilo = {
    ok: "border-emerald-200 bg-emerald-50 text-emerald-800",
    error: "border-red-200 bg-red-50 text-red-800",
    alerta: "border-amber-200 bg-amber-50 text-amber-800",
  }[tipo];
  return (
    <div className={`mb-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${estilo}`}>
      {icono}
      <span>{children}</span>
    </div>
  );
}
