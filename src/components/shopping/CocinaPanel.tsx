"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CalendarDays, Refrigerator, ListChecks, Camera, RefreshCw, Loader2, Check, X,
  AlertTriangle, Sparkles, Trash2, Search,
} from "lucide-react";
import {
  getInventario, getPorAcabarse, moverInventario, escanearFoto, aplicarEscaneo,
  proponerMenu, guardarMenu, getConLoQueHay, getLista, listaDesdeMenu, marcarItemLista,
  presupuestar, buscarPreciosLista, getSinUsar,
  type ItemInventario, type PorAcabarse, type ComidaMenu, type ItemLista,
  type Presupuesto, type PropuestaEscaneo,
} from "@/lib/alfred/client";

type Vista = "menu" | "inventario" | "lista";

const VISTAS = [
  { k: "menu" as const, t: "Menú", icon: CalendarDays, hint: "qué se cocina esta semana" },
  { k: "inventario" as const, t: "Inventario", icon: Refrigerator, hint: "qué hay en casa y qué se acaba" },
  { k: "lista" as const, t: "Lista", icon: ListChecks, hint: "qué comprar y cuánto sale" },
];

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

export function CocinaPanel() {
  const [vista, setVista] = useState<Vista>("menu");

  return (
    <div className="mx-auto max-w-4xl p-4">
      <div className="mb-4 flex items-center gap-1">
        {VISTAS.map(({ k, t, icon: Icon, hint }) => (
          <button
            key={k}
            onClick={() => setVista(k)}
            title={hint}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              vista === k ? "bg-[#0a1628] text-white" : "text-slate-500 hover:bg-slate-100"
            }`}
          >
            <Icon className="h-3.5 w-3.5" /> {t}
          </button>
        ))}
      </div>

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
  const [propuesta, setPropuesta] = useState<PropuestaEscaneo[] | null>(null);
  const [escaneo, setEscaneo] = useState<Awaited<ReturnType<typeof escanearFoto>> | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const recargar = useCallback(async () => {
    setCargando(true);
    const [inv, aca, par] = await Promise.all([getInventario(), getPorAcabarse(7), getSinUsar()]);
    setItems(inv.items); setAcabarse(aca); setParados(par);
    setCargando(false);
  }, []);

  useEffect(() => { recargar(); }, [recargar]);

  const subirFoto = async (f: File) => {
    setSubiendo(true); setPropuesta(null);
    const b64 = await new Promise<string>((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(String(fr.result).split(",")[1] ?? "");
      fr.onerror = rej;
      fr.readAsDataURL(f);
    });
    const r = await escanearFoto(b64, f.type || "image/jpeg");
    setSubiendo(false);
    setEscaneo(r);
    if (r.ok && r.propuesta) setPropuesta(r.propuesta);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={recargar} disabled={cargando}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
          {cargando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Actualizar
        </button>
        <button onClick={() => fileRef.current?.click()} disabled={subiendo}
          className="flex items-center gap-1.5 rounded-lg bg-[#0a1628] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">
          {subiendo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />} Foto del refri
        </button>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) subirFoto(f); e.target.value = ""; }} />
        <span className="ml-auto text-xs text-slate-400">{items.length} cosa(s) anotadas</span>
      </div>

      {/* La foto propone; hasta que no se confirme, nada se escribe. */}
      {escaneo && !escaneo.ok && <Aviso tono="alerta">{escaneo.error ?? "No pude leer la foto."}</Aviso>}
      {propuesta && (
        <div className="rounded-xl border border-slate-300 bg-white p-4">
          <p className="mb-2 text-sm font-medium text-slate-800">{escaneo?.mensaje}</p>
          <div className="mb-3 space-y-1">
            {propuesta.map(p => (
              <div key={p.ingrediente} className="flex items-center gap-2 text-xs">
                <span className={`rounded px-1.5 py-0.5 text-[10px] ${
                  p.estado === "nuevo" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                }`}>{p.estado === "nuevo" ? "nuevo" : "actualiza"}</span>
                <span className="text-slate-800">{p.ingrediente}</span>
                <span className="text-slate-500">{p.mostrar || "cantidad desconocida"}</span>
                {p.antes && <span className="text-slate-400">(antes: {p.antes})</span>}
                {p.duda && <span className="text-amber-600">· no está seguro</span>}
              </div>
            ))}
          </div>
          {!!escaneo?.no_vistos?.length && (
            <p className="mb-3 text-xs text-slate-500">
              No aparecen en la foto y los dejo como estaban: {escaneo.no_vistos.join(", ")}.
            </p>
          )}
          <div className="flex gap-2">
            <button
              onClick={async () => {
                const body = escaneo?.para_aplicar?.body as { items?: unknown[]; zona?: string } | undefined;
                if (body?.items) await aplicarEscaneo(body.items, body.zona ?? "refri");
                setPropuesta(null); setEscaneo(null); recargar();
              }}
              className="flex items-center gap-1.5 rounded-lg bg-[#0a1628] px-3 py-1.5 text-xs font-medium text-white">
              <Check className="h-3.5 w-3.5" /> Confirmar
            </button>
            <button onClick={() => { setPropuesta(null); setEscaneo(null); }}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600">
              <X className="h-3.5 w-3.5" /> Descartar
            </button>
          </div>
        </div>
      )}

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
            El inventario está vacío. Sacale una foto al refri o contale a Alfred qué hay.
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
