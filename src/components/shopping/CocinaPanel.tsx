"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  RefreshCw, Loader2, Check, X, AlertTriangle, Sparkles, Trash2, Search,
} from "lucide-react";
import { ChatInventario } from "./ChatInventario";
import {
  getInventario, getPorAcabarse, moverInventario,
  proponerMenu, guardarMenu, getConLoQueHay, getLista, listaDesdeMenu, marcarItemLista,
  presupuestar, buscarPreciosLista, getSinUsar,
  type ItemInventario, type PorAcabarse, type ComidaMenu, type ItemLista,
  type Presupuesto,
} from "@/lib/alfred/client";

export type Vista = "menu" | "inventario" | "lista";

// Una línea que dice para qué sirve cada vista. Tres pantallas de tablas sin contexto se
// parecen demasiado entre sí.
const BAJADA: Record<Vista, string> = {
  menu: "Qué se cocina esta semana, escalado a quiénes comen en casa.",
  inventario: "Qué hay en la cocina, a qué ritmo se gasta y qué se está por acabar.",
  lista: "Qué falta comprar y cuánto sale, en los tres modos de presupuesto.",
};

// El color de la confianza es la única señal visual de que una fecha es una estimación.
// Pintarlo todo igual convertiría "podría acabarse el jueves, tengo pocos datos" en un
// dato duro, que es exactamente lo que el backend se cuida de no afirmar.
const COLOR_CONFIANZA: Record<string, string> = {
  alta: "bg-rose-50 text-rose-700 border-rose-200",
  media: "bg-amber-50 text-amber-700 border-amber-200",
  baja: "bg-slate-50 text-slate-500 border-slate-200",
  ninguna: "bg-slate-50 text-slate-400 border-slate-200",
};

const pesos = (n: number) => `$${Math.round(n).toLocaleString("es-CL")}`;

function Aviso({ children, tono = "neutro" }: { children: React.ReactNode; tono?: "neutro" | "alerta" }) {
  return (
    <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${
      tono === "alerta" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-slate-200 bg-slate-50 text-slate-600"
    }`}>
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

// La vista la manda la página: las pestañas viven en la barra de Compras, no acá adentro.
// Tener una segunda fila de pestañas dentro de una pestaña escondía "Inventario" de la
// única barra que la gente mira.
export function CocinaPanel({ vista }: { vista: Vista }) {
  return (
    <div className="mx-auto max-w-4xl p-4">
      <p className="mb-4 text-xs text-slate-500">{BAJADA[vista]}</p>
      {vista === "menu" && <VistaMenu />}
      {vista === "inventario" && <VistaInventario />}
      {vista === "lista" && <VistaLista />}
    </div>
  );
}

// ── Menú ─────────────────────────────────────────────────────────────────────────────

function VistaMenu() {
  const [comidas, setComidas] = useState<ComidaMenu[]>([]);
  const [resumen, setResumen] = useState<{ cocinas?: string[]; minutos_totales?: number; aviso?: string } | null>(null);
  const [personas, setPersonas] = useState<string[]>([]);
  const [cargando, setCargando] = useState(false);
  const [nota, setNota] = useState<string | null>(null);
  const [conLoQueHay, setConLoQueHay] = useState<Awaited<ReturnType<typeof getConLoQueHay>> | null>(null);

  const proponer = useCallback(async (modo?: string) => {
    setCargando(true); setNota(null);
    const r = await proponerMenu(undefined, 7, modo);
    setCargando(false);
    if (r.vacio) { setNota(r.mensaje ?? "No hay con qué armar el menú."); setComidas([]); return; }
    setComidas(r.comidas ?? []);
    setResumen(r.resumen ?? null);
    setPersonas(r.personas ?? []);
  }, []);

  useEffect(() => { proponer(); }, [proponer]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => proponer()} disabled={cargando}
          className="flex items-center gap-1.5 rounded-lg bg-[#0a1628] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">
          {cargando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Proponer semana
        </button>
        <button onClick={() => proponer("con_lo_que_hay")} disabled={cargando}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">
          Solo con lo que hay
        </button>
        <button
          onClick={async () => {
            setCargando(true);
            const r = await guardarMenu();
            setCargando(false);
            setNota(r.error ? `No se pudo guardar: ${r.error}` : "Menú guardado. Ya podés sacar la lista de compras.");
          }}
          disabled={cargando || !comidas.length}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">
          Guardar
        </button>
        {personas.length > 0 && (
          <span className="ml-auto text-xs text-slate-400">Para {personas.join(", ")}</span>
        )}
      </div>

      {nota && <Aviso>{nota}</Aviso>}

      {comidas.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          {comidas.map((c, i) => (
            <div key={`${c.dia}-${i}`} className="flex items-center gap-3 border-b border-slate-100 px-4 py-2.5 last:border-0">
              <span className="w-20 shrink-0 text-xs font-medium capitalize text-slate-400">{c.dia}</span>
              <span className="flex-1 text-sm text-slate-800">{c.plato_nombre}</span>
              <span className="text-xs text-slate-400">{c.porciones} porc.</span>
              {c.minutos != null && <span className="w-14 text-right text-xs text-slate-400">{c.minutos} min</span>}
              {/* El aviso de repetición viaja por comida: si el motor tuvo que relajar una
                  regla, se ve en la fila que la relajó y no solo en un resumen abajo. */}
              {c.relajado && (
                <span title={c.relajado} className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700">
                  relajado
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {resumen?.aviso && <Aviso tono="alerta">{resumen.aviso}</Aviso>}
      {resumen && (
        <p className="text-xs text-slate-400">
          {resumen.cocinas?.join(", ")} · {resumen.minutos_totales} min de cocina en la semana
        </p>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
            <Sparkles className="h-4 w-4 text-slate-400" /> ¿Qué puedo cocinar ahora?
          </h3>
          <button onClick={async () => setConLoQueHay(await getConLoQueHay())}
            className="text-xs text-slate-500 hover:text-slate-800">Ver</button>
        </div>
        {conLoQueHay ? (
          <div className="space-y-2 text-xs">
            <p className="text-slate-600">{conLoQueHay.mensaje}</p>
            {conLoQueHay.listos.map(p => (
              <div key={p.plato} className="flex items-center gap-2 text-slate-700">
                <Check className="h-3.5 w-3.5 text-emerald-600" /> {p.plato}
                {p.minutos != null && <span className="text-slate-400">· {p.minutos} min</span>}
              </div>
            ))}
            {conLoQueHay.casi.map(p => (
              <div key={p.plato} className="flex items-start gap-2 text-slate-500">
                <span className="mt-0.5 text-slate-300">○</span>
                <span>{p.plato} — falta {p.faltan.map(f => f.ingrediente).join(", ")}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400">Cruza el recetario con lo que hay en el inventario.</p>
        )}
      </div>
    </div>
  );
}

// ── Inventario ───────────────────────────────────────────────────────────────────────

function VistaInventario() {
  const [items, setItems] = useState<ItemInventario[]>([]);
  const [acabarse, setAcabarse] = useState<Awaited<ReturnType<typeof getPorAcabarse>> | null>(null);
  const [parados, setParados] = useState<Awaited<ReturnType<typeof getSinUsar>> | null>(null);
  const [cargando, setCargando] = useState(true);
  const recargar = useCallback(async () => {
    setCargando(true);
    const [inv, aca, par] = await Promise.all([getInventario(), getPorAcabarse(7), getSinUsar()]);
    setItems(inv.items); setAcabarse(aca); setParados(par);
    setCargando(false);
  }, []);

  useEffect(() => { recargar(); }, [recargar]);

  return (
    <div className="space-y-4">
      {/* El chat va PRIMERO: con el inventario vacío es lo único que se puede hacer, y
          antes la pantalla mostraba "está vacío" con un botón de foto como única salida. */}
      <ChatInventario onAplicado={recargar} />

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={recargar} disabled={cargando}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
          {cargando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Actualizar
        </button>
        <span className="ml-auto text-xs text-slate-400">{items.length} cosa(s) anotadas</span>
      </div>

      {acabarse && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="mb-2 text-sm font-semibold text-slate-800">Se está acabando</h3>
          <p className="mb-2 text-xs text-slate-600">{acabarse.mensaje}</p>
          <div className="space-y-1">
            {acabarse.criticos.map(c => <FilaPrediccion key={c.ingrediente} c={c} />)}
          </div>
          {acabarse.nota_sin_datos && (
            <p className="mt-2 text-xs text-slate-400">{acabarse.nota_sin_datos}</p>
          )}
        </div>
      )}

      {!!parados?.parados.length && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="mb-2 text-sm font-semibold text-slate-800">Lleva rato en la casa</h3>
          <p className="text-xs text-slate-600">{parados.mensaje}</p>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {items.length === 0 && !cargando && (
          <p className="p-4 text-xs text-slate-400">
            Todavía no tengo nada anotado. Contame arriba qué hay: por voz, con una foto o escribiéndolo.
          </p>
        )}
        {items.map(it => (
          <div key={it.id ?? it.ingrediente} className="flex items-center gap-3 border-b border-slate-100 px-4 py-2 last:border-0">
            <span className="flex-1 text-sm text-slate-800">{it.ingrediente}</span>
            <span className="text-xs text-slate-500">{it.mostrar || "no sé cuánto"}</span>
            <span className="w-20 text-right text-[10px] uppercase tracking-wide text-slate-300">{it.zona}</span>
            <button
              title="Marcar como agotado"
              onClick={async () => {
                await moverInventario({
                  ingrediente: it.ingrediente, delta: -(it.cantidad ?? 0), unidad: it.unidad, motivo: "declarado",
                });
                recargar();
              }}
              className="text-slate-300 hover:text-rose-500">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function FilaPrediccion({ c }: { c: PorAcabarse }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={`rounded border px-1.5 py-0.5 text-[10px] ${COLOR_CONFIANZA[c.confianza] ?? COLOR_CONFIANZA.ninguna}`}>
        {c.confianza === "ninguna" ? "sin datos" : c.confianza}
      </span>
      <span className="flex-1 text-slate-700">{c.frase ?? c.ingrediente}</span>
      {/* Cuántas observaciones hay detrás. Sin esto, "se acaba el jueves" con 2 datos y con
          20 se ven igual, y no son lo mismo. */}
      {c.n_observaciones != null && (
        <span className="text-slate-400">{c.n_observaciones} obs.</span>
      )}
    </div>
  );
}

// ── Lista ────────────────────────────────────────────────────────────────────────────

function VistaLista() {
  const [items, setItems] = useState<ItemLista[]>([]);
  const [presu, setPresu] = useState<Presupuesto | null>(null);
  const [modo, setModo] = useState<"libre" | "techo" | "comparado">("libre");
  const [techo, setTecho] = useState<string>("80000");
  const [cargando, setCargando] = useState(true);
  const [nota, setNota] = useState<string | null>(null);

  const recargar = useCallback(async () => {
    setCargando(true);
    setItems((await getLista()).items);
    setCargando(false);
  }, []);

  useEffect(() => { recargar(); }, [recargar]);

  // Llegar desde el menú con `?buscar=1` arranca la búsqueda sola.
  //
  // Antes, "Buscar lista en supermercados" solo abría esta pestaña y dejaba la
  // lista quieta: había que darse cuenta de que faltaba apretar "Buscar precios"
  // acá adentro. Un botón que promete buscar y solo navega es un botón que
  // miente, y el que lo aprieta se queda esperando algo que nunca arranca.
  const [yaBusque, setYaBusque] = useState(false);
  useEffect(() => {
    if (yaBusque) return;
    if (new URLSearchParams(window.location.search).get("buscar") !== "1") return;
    setYaBusque(true);
    (async () => {
      setCargando(true);
      // Primero se trae lo del menú: si el usuario vino directo, la lista puede
      // estar vacía y buscar precios de nada no diría nada útil.
      await listaDesdeMenu();
      const r = await buscarPreciosLista(8);
      setNota(r.mensaje ?? r.error ?? "Busqué los precios de tu lista.");
      setCargando(false);
      await recargar();
      // Se saca el parámetro para que recargar la página no vuelva a disparar
      // una búsqueda que cuesta minutos.
      const u = new URL(window.location.href);
      u.searchParams.delete("buscar");
      window.history.replaceState({}, "", u);
    })();
  }, [yaBusque, recargar]);

  const calcular = async () => {
    setCargando(true);
    setPresu(await presupuestar(modo, modo === "techo" ? Number(techo) || undefined : undefined));
    setCargando(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={async () => { const r = await listaDesdeMenu(); setNota(r.mensaje ?? null); recargar(); }}
          className="rounded-lg bg-[#0a1628] px-3 py-1.5 text-xs font-medium text-white">
          Traer del menú
        </button>
        <button onClick={async () => { setCargando(true); const r = await buscarPreciosLista(8); setNota(r.mensaje ?? r.error ?? null); setCargando(false); }}
          disabled={cargando}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">
          {cargando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />} Buscar precios
        </button>
        <span className="ml-auto text-xs text-slate-400">{items.length} pendiente(s)</span>
      </div>

      {nota && <Aviso>{nota}</Aviso>}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {items.length === 0 && !cargando && (
          <p className="p-4 text-xs text-slate-400">La lista está vacía. Traé lo que falta del menú de la semana.</p>
        )}
        {items.map(it => (
          <div key={it.id} className="flex items-center gap-3 border-b border-slate-100 px-4 py-2 last:border-0">
            <button title="Marcar como comprado"
              onClick={async () => { await marcarItemLista(it.id, "comprado"); recargar(); }}
              className="text-slate-300 hover:text-emerald-600">
              <Check className="h-4 w-4" />
            </button>
            <span className="flex-1 text-sm text-slate-800">{it.ingrediente}</span>
            <span className="text-xs text-slate-500">{it.mostrar}</span>
            {it.esencial && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">esencial</span>}
            <span className="w-24 text-right text-[10px] text-slate-300">{it.origen}</span>
            <button title="Sacar de la lista"
              onClick={async () => { await marcarItemLista(it.id, "descartado"); recargar(); }}
              className="text-slate-300 hover:text-rose-500">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {(["libre", "techo", "comparado"] as const).map(m => (
            <button key={m} onClick={() => setModo(m)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize ${
                modo === m ? "bg-[#0a1628] text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}>{m}</button>
          ))}
          {modo === "techo" && (
            <input value={techo} onChange={e => setTecho(e.target.value)} inputMode="numeric"
              className="w-28 rounded-lg border border-slate-200 px-2 py-1.5 text-xs" placeholder="80000" />
          )}
          <button onClick={calcular} disabled={cargando || !items.length}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">
            Calcular
          </button>
        </div>

        {presu && (
          <div className="space-y-2 text-xs">
            <p className="text-sm font-medium text-slate-800">
              {presu.mensaje ?? `${pesos(presu.total)}`}
            </p>

            {/* Lo recortado se muestra SIEMPRE y con su motivo. Un techo que esconde lo que
                dejó afuera manda a la persona al super con la lista incompleta. */}
            {!!presu.recortados?.length && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-2">
                <p className="mb-1 font-medium text-amber-800">Quedó afuera:</p>
                {presu.recortados.map(r => (
                  <p key={r.ingrediente} className="text-amber-700">· {r.ingrediente} — {r.motivo}</p>
                ))}
              </div>
            )}
            {presu.alerta_esenciales && <Aviso tono="alerta">{presu.alerta_esenciales}</Aviso>}
            {presu.nota_sin_precio && <p className="text-slate-500">{presu.nota_sin_precio}</p>}
            {!!presu.unidades_inciertas?.length && (
              <div className="text-slate-500">
                {presu.unidades_inciertas.map(u => <p key={u}>· {u}</p>)}
              </div>
            )}
            {presu.nota && <p className="text-slate-500">{presu.nota}</p>}

            {!!presu.items?.length && modo !== "comparado" && (
              <div className="pt-1">
                {presu.items.filter(i => i.costo != null).map(i => (
                  <div key={i.ingrediente} className="flex justify-between text-slate-600">
                    <span>{i.ingrediente}{i.envases && i.envases > 1 ? ` ×${i.envases}` : ""}</span>
                    <span>{pesos(i.costo as number)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
