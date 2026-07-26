"use client";

import { useState } from "react";
import { Loader2, ExternalLink, Trash2, Minus, Plus, ChevronDown, ChevronRight } from "lucide-react";
import { optimizarCanasta, armarCarroEnTienda, type Optimizacion } from "@/lib/alfred/client";

interface CartItem {
  id?: string;
  name: string;
  price: number;
  store: string;
  quantity: number;
  product_url?: string;
}

interface Props {
  items: CartItem[];
  onAction?: (msg: string) => void;
  /** Todos los productos encontrados en el turno — el optimizador los necesita para comparar. */
  productos?: any[];
}

// Presentación por tienda. El id es CANÓNICO (sin espacios ni acentos), igual que en el
// router: la versión anterior tenía la clave "santa isabel" con espacio, y el store que
// llega es "SANTAISABEL", así que no matcheaba, caía al default con url "#" y el botón
// "Ir a pagar" abría la propia app de Alfred en vez del supermercado.
const TIENDAS: Record<string, { nombre: string; bg: string; text: string; btn: string; emoji: string; url: string }> = {
  jumbo:       { nombre: "Jumbo",        bg: "bg-green-50 border-green-200",   text: "text-green-700",  btn: "bg-green-600 hover:bg-green-700",   emoji: "🟢", url: "https://www.jumbo.cl" },
  santaisabel: { nombre: "Santa Isabel", bg: "bg-red-50 border-red-200",       text: "text-red-700",    btn: "bg-red-600 hover:bg-red-700",       emoji: "🔴", url: "https://www.santaisabel.cl" },
  unimarc:     { nombre: "Unimarc",      bg: "bg-yellow-50 border-yellow-200", text: "text-yellow-700", btn: "bg-yellow-600 hover:bg-yellow-700", emoji: "🟡", url: "https://www.unimarc.cl" },
  lider:       { nombre: "Líder",        bg: "bg-blue-50 border-blue-200",     text: "text-blue-700",   btn: "bg-blue-600 hover:bg-blue-700",     emoji: "🔵", url: "https://www.lider.cl" },
  tottus:      { nombre: "Tottus",       bg: "bg-purple-50 border-purple-200", text: "text-purple-700", btn: "bg-purple-600 hover:bg-purple-700", emoji: "🟣", url: "https://www.tottus.cl" },
  acuenta:     { nombre: "acuenta",      bg: "bg-orange-50 border-orange-200", text: "text-orange-700", btn: "bg-orange-600 hover:bg-orange-700", emoji: "🟠", url: "https://www.acuenta.cl" },
};

/** Misma canonización que el router: "SANTAISABEL", "Santa Isabel" y "santa_isabel" → un solo id. */
function idTienda(s: string): string {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[_\-\s]+/g, "");
}

const clp = (n: number) => `$${Math.round(n || 0).toLocaleString("es-CL")}`;

export function ShoppingCart({ items, onAction, productos }: Props) {
  const [opt, setOpt] = useState<Optimizacion | null>(null);
  const [cargando, setCargando] = useState<string | null>(null);
  const [armando, setArmando] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Record<string, string>>({});
  const [abierta, setAbierta] = useState<string | null>(null);
  const [locales, setLocales] = useState<CartItem[]>(items);

  const lista = locales;
  if (!lista || lista.length === 0) return null;

  const porTienda: Record<string, CartItem[]> = {};
  for (const item of lista) {
    const id = idTienda(item.store) || "otro";
    (porTienda[id] = porTienda[id] || []).push(item);
  }
  const total = lista.reduce((s, i) => s + (i.price || 0) * (i.quantity || 1), 0);

  // Los chips ya no mandan texto al chat: preguntan al optimizador, que responde sobre
  // los productos ya buscados. Antes esto disparaba otra búsqueda de 1-4 minutos.
  async function decidir(estrategiaId: "minimo_absoluto" | "una_tienda") {
    const base = productos?.length ? productos : lista;
    setCargando(estrategiaId);
    const r = await optimizarCanasta(base);
    setCargando(null);
    if (!r) {
      onAction?.(estrategiaId === "una_tienda" ? "todo en 1 super" : "lo mas barato");  // fallback al chat
      return;
    }
    setOpt(r);
  }

  async function irAPagar(tiendaId: string, itemsTienda: CartItem[]) {
    setArmando(tiendaId);
    setResultado((r) => ({ ...r, [tiendaId]: "" }));
    const r = await armarCarroEnTienda(tiendaId, itemsTienda.map((i) => ({
      name: i.name, price: i.price, quantity: i.quantity || 1, product_url: i.product_url,
    })));
    setArmando(null);

    if (!r) {
      setResultado((x) => ({ ...x, [tiendaId]: "No pude conectar con Alfred. Intentá de nuevo." }));
      return;
    }
    if (r.ok) {
      setResultado((x) => ({ ...x, [tiendaId]: `Armando el carro en ${TIENDAS[tiendaId]?.nombre ?? tiendaId} — mirá la pestaña que se abrió.` }));
      return;
    }
    // Sin extensión/bridge: se abren las fichas para agregarlas a mano. Antes esto era un
    // 503 silencioso y el botón parecía roto.
    const urls = r.open_urls?.length ? r.open_urls : [r.store_url ?? TIENDAS[tiendaId]?.url].filter(Boolean);
    urls.slice(0, 6).forEach((u) => window.open(u as string, "_blank", "noopener"));
    setResultado((x) => ({
      ...x,
      [tiendaId]: r.motivo === "sin_pc_bridge"
        ? `Abrí ${urls.length} ficha(s): no tengo la extensión conectada para agregarlas solo.`
        : r.mensaje ?? "No pude armar el carro.",
    }));
  }

  function quitar(item: CartItem) {
    setLocales((l) => l.filter((x) => x !== item));
    onAction?.(`quita "${item.name}" del carro`);
  }

  function cambiarCantidad(item: CartItem, delta: number) {
    setLocales((l) => l.map((x) => (x === item ? { ...x, quantity: Math.max(1, (x.quantity || 1) + delta) } : x)));
  }

  return (
    <div className="space-y-3 mt-3">
      <div className="flex gap-3 overflow-x-auto pb-2 snap-x">
        {Object.entries(porTienda).map(([id, itemsTienda]) => {
          const t = TIENDAS[id] ?? { nombre: id, bg: "bg-slate-50 border-slate-200", text: "text-slate-700", btn: "bg-slate-700 hover:bg-slate-800", emoji: "🏪", url: "" };
          const subtotal = itemsTienda.reduce((s, i) => s + (i.price || 0) * (i.quantity || 1), 0);
          const desplegada = abierta === id;
          // Los items visibles se cortan salvo que se abra la tienda: antes solo se veía
          // "1 productos" sin poder mirar qué había dentro.
          const visibles = desplegada ? itemsTienda : itemsTienda.slice(0, 3);

          return (
            <div key={id} className={`flex-shrink-0 w-80 rounded-xl border-2 ${t.bg} p-4 snap-start`}>
              <button
                onClick={() => setAbierta(desplegada ? null : id)}
                className="w-full flex items-center justify-between mb-3"
                aria-expanded={desplegada}
              >
                <span className="flex items-center gap-2">
                  <span className="text-lg">{t.emoji}</span>
                  <span className={`font-bold text-sm uppercase ${t.text}`}>{t.nombre}</span>
                  <span className="text-xs text-slate-500">({itemsTienda.length})</span>
                </span>
                {desplegada ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
              </button>

              <div className="space-y-1.5 mb-3">
                {visibles.map((item, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-xs group">
                    <span className="text-slate-700 truncate flex-1" title={item.name}>{item.name}</span>
                    {desplegada && (
                      <span className="flex items-center gap-0.5 shrink-0">
                        <button onClick={() => cambiarCantidad(item, -1)} className="p-0.5 rounded hover:bg-white/70" aria-label="Menos">
                          <Minus className="h-3 w-3 text-slate-400" />
                        </button>
                        <span className="w-4 text-center text-slate-600">{item.quantity || 1}</span>
                        <button onClick={() => cambiarCantidad(item, 1)} className="p-0.5 rounded hover:bg-white/70" aria-label="Más">
                          <Plus className="h-3 w-3 text-slate-400" />
                        </button>
                      </span>
                    )}
                    {!desplegada && (item.quantity || 1) > 1 && <span className="text-slate-500 shrink-0">x{item.quantity}</span>}
                    <span className={`font-bold shrink-0 ${t.text}`}>{clp((item.price || 0) * (item.quantity || 1))}</span>
                    {desplegada && (
                      <button onClick={() => quitar(item)} className="p-0.5 rounded hover:bg-white/70 shrink-0" aria-label={`Quitar ${item.name}`}>
                        <Trash2 className="h-3 w-3 text-slate-400 hover:text-red-500" />
                      </button>
                    )}
                  </div>
                ))}
                {!desplegada && itemsTienda.length > 3 && (
                  <button onClick={() => setAbierta(id)} className="text-xs text-slate-500 underline">
                    ver los {itemsTienda.length} productos
                  </button>
                )}
              </div>

              <div className="border-t pt-2 flex items-center justify-between">
                <span className="text-xs text-slate-500">{itemsTienda.length} producto{itemsTienda.length > 1 ? "s" : ""}</span>
                <span className={`font-bold text-sm ${t.text}`}>{clp(subtotal)}</span>
              </div>

              <button
                onClick={() => irAPagar(id, itemsTienda)}
                disabled={armando === id}
                className={`mt-2 w-full flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold text-white disabled:opacity-60 ${t.btn}`}
              >
                {armando === id ? <Loader2 className="h-3 w-3 animate-spin" /> : <ExternalLink className="h-3 w-3" />}
                {armando === id ? "Armando el carro…" : `Ir a pagar en ${t.nombre}`}
              </button>
              {resultado[id] && <p className="mt-1.5 text-[11px] leading-snug text-slate-600">{resultado[id]}</p>}
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-2">
        <span className="text-sm text-slate-600">
          {lista.length} producto{lista.length > 1 ? "s" : ""} en {Object.keys(porTienda).length} tienda{Object.keys(porTienda).length > 1 ? "s" : ""}
        </span>
        <span className="text-lg font-bold text-[#0a1628]">{clp(total)}</span>
      </div>

      {/* Resultado del optimizador: el dato que faltaba era el despacho. Repartir puede
          ahorrar en productos y salir más caro en total. */}
      {opt && (
        <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
          {opt.veredicto && opt.veredicto.despacho_extra > 0 && (
            <p className={`text-xs font-medium ${opt.veredicto.conviene_repartir ? "text-green-700" : "text-orange-700"}`}>
              {opt.veredicto.conviene_repartir
                ? `Repartir conviene: ahorrás ${clp(opt.veredicto.ahorro_en_productos)} en productos y pagás ${clp(opt.veredicto.despacho_extra)} de despacho extra.`
                : `Repartir ahorra ${clp(opt.veredicto.ahorro_en_productos)} en productos pero suma ${clp(opt.veredicto.despacho_extra)} de despacho: sale ${clp(Math.abs(opt.veredicto.diferencia_final))} más caro.`}
            </p>
          )}
          {opt.estrategias.slice(0, 4).map((e) => (
            <div key={e.id} className={`flex items-center justify-between text-xs rounded px-2 py-1.5 ${e.recomendada ? "bg-green-50 border border-green-200" : "bg-slate-50"}`}>
              <span className="text-slate-700">
                {e.recomendada && <span className="mr-1">🏆</span>}
                {e.etiqueta}
                {!e.completa && <span className="text-orange-600"> · le faltan {e.faltantes.length}</span>}
              </span>
              <span className="font-bold text-slate-900 ml-2 shrink-0">
                {clp(e.total_final)}
                {e.total_despacho > 0 && <span className="font-normal text-slate-400"> (incl. despacho)</span>}
              </span>
            </div>
          ))}
          {opt.delivery_estimado && (
            <p className="text-[11px] text-slate-400">Despacho estimado — cargá los reales para que el total sea exacto.</p>
          )}
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => decidir("una_tienda")}
          disabled={cargando !== null}
          className="px-3 py-1.5 text-xs border rounded-lg hover:bg-slate-50 disabled:opacity-60 flex items-center gap-1.5"
        >
          {cargando === "una_tienda" ? <Loader2 className="h-3 w-3 animate-spin" /> : "🏪"} Todo en 1 super
        </button>
        <button
          onClick={() => decidir("minimo_absoluto")}
          disabled={cargando !== null}
          className="px-3 py-1.5 text-xs border rounded-lg hover:bg-slate-50 disabled:opacity-60 flex items-center gap-1.5"
        >
          {cargando === "minimo_absoluto" ? <Loader2 className="h-3 w-3 animate-spin" /> : "💰"} Lo más barato
        </button>
        {onAction && (
          <button onClick={() => onAction("ver lista completa")} className="px-3 py-1.5 text-xs border rounded-lg hover:bg-slate-50">
            📋 Ver lista
          </button>
        )}
      </div>
    </div>
  );
}
