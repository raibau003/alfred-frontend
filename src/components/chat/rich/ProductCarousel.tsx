"use client";

import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ShoppingCart, ArrowDownUp, Plus, Minus, Check } from "lucide-react";

interface Product {
  name: string;
  brand?: string;
  price: number;
  original_price?: number;
  discount_pct?: number;
  store: string;
  image_url?: string;
  product_url?: string;
  available?: boolean;
  unit_price?: number;   // precio por unidad de medida (ej: 2800 = $2.800 por Kg/L)
  unit?: string;         // unidad de medida: "Kg" | "L" | "un" | "100 g" ...
  size?: string;         // formato/tamaño del envase (ej: "1 L", "500 g")
}

interface Props {
  products: Product[];
  onAction: (message: string) => void;
  groupLabel?: string;
  onAddToCart?: (product: Product, quantity: number) => void;
  compact?: boolean;
  /** Término de búsqueda de este grupo, para "+ Más alternativas". Si no viene, usa groupLabel. */
  searchTerm?: string;
}

const storeLogos: Record<string, string> = {
  jumbo: "🟢",
  lider: "🔵",
  unimarc: "🟡",
  tottus: "🟠",
  "santa isabel": "🔴",
  santa_isabel: "🔴",
  mercadolibre: "🟣",
};

const storeColors: Record<string, string> = {
  jumbo: "border-green-300 bg-green-50",
  lider: "border-blue-300 bg-blue-50",
  unimarc: "border-yellow-300 bg-yellow-50",
  tottus: "border-orange-300 bg-orange-50",
  "santa isabel": "border-red-300 bg-red-50",
  santa_isabel: "border-red-300 bg-red-50",
  mercadolibre: "border-purple-300 bg-purple-50",
};

type SortKey = "precio" | "unidad" | "relevancia";

export function ProductCarousel({ products, onAction, groupLabel, onAddToCart, compact, searchTerm }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  // Estado por PRODUCTO (id estable), no por índice: al reordenar no se mezcla cantidad/"agregado".
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [addedId, setAddedId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>("precio");

  if (!products || products.length === 0) return null;

  const pid = (p: Product) => `${p.store}::${p.name}`;
  // El "más barato" siempre se calcula por precio absoluto, sin importar el orden elegido.
  const cheapest = [...products].reduce((min, p) => (p.price < min.price ? p : min), products[0]);
  const hasUnit = products.some((p) => p.unit_price && p.unit_price > 0);
  // Orden visible según el control. En "x unidad" los productos SIN unit_price van al final
  // (no se pueden comparar por unidad), evitando mezclar escalas ($/kg vs total).
  const sorted =
    sortBy === "relevancia"
      ? [...products]
      : sortBy === "unidad"
        ? [...products].sort((a, b) => (a.unit_price || Infinity) - (b.unit_price || Infinity))
        : [...products].sort((a, b) => a.price - b.price);
  // Qué producto buscar más alternativas: el término del grupo, o el nombre del más barato.
  const moreQuery = (searchTerm || groupLabel || sorted[0]?.name || "").replace(/^\d+\s+productos.*/i, "").trim() || sorted[0]?.name || "";

  const scroll = (dir: "left" | "right") => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: dir === "left" ? -220 : 220, behavior: "smooth" });
  };

  const getQty = (id: string) => quantities[id] ?? 1;
  const setQty = (id: string, q: number) => setQuantities(prev => ({ ...prev, [id]: Math.max(1, Math.min(10, q)) }));

  const handleAdd = (p: Product) => {
    const id = pid(p);
    const qty = getQty(id);
    if (onAddToCart) {
      onAddToCart(p, qty);
    } else {
      onAction(`agrega "${p.name}" de ${p.store} a $${p.price} al carro`);
    }
    setAddedId(id);
    setTimeout(() => setAddedId((cur) => (cur === id ? null : cur)), 2000);
  };

  return (
    <div className={`${compact ? "mt-1" : "mt-3"} space-y-2`}>
      <div className="flex items-center justify-between px-1">
        <p className="text-xs font-semibold text-slate-700">
          {groupLabel ? groupLabel : `${sorted.length} productos encontrados`}
        </p>
        <div className="flex items-center gap-1.5">
          {/* Orden: precio / precio por unidad / relevancia */}
          {products.length > 1 && (
            <div className="flex items-center rounded-full border border-slate-200 bg-white p-0.5 text-[9px]">
              {([
                { k: "precio", label: "Precio" },
                ...(hasUnit ? [{ k: "unidad", label: "x unidad" }] : []),
                { k: "relevancia", label: "Relevancia" },
              ] as { k: SortKey; label: string }[]).map(({ k, label }) => (
                <button
                  key={k}
                  onClick={() => setSortBy(k)}
                  className={`rounded-full px-1.5 py-0.5 font-semibold transition-colors ${sortBy === k ? "bg-[#0a1628] text-white" : "text-slate-500 hover:bg-slate-100"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          <button onClick={() => scroll("left")} className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 hover:bg-slate-100">
            <ChevronLeft className="h-3.5 w-3.5 text-slate-500" />
          </button>
          <button onClick={() => scroll("right")} className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 hover:bg-slate-100">
            <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
          </button>
        </div>
      </div>

      {/* Carousel */}
      <div ref={scrollRef} className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide" style={{ scrollbarWidth: "none" }}>
        {sorted.map((p, i) => {
          const id = pid(p);
          const isCheapest = p === cheapest;
          // El backend (marcarDestacados en basket.js) manda `destaque` y `aviso`: cuál es
          // el mejor por unidad y cuánto más cuesta que el más barato en total. Tu cálculo
          // por precio absoluto se mantiene como fuente del verde; esto suma el celeste.
          const destaque = (p as any).destaque as "precio" | "unidad" | null | undefined;
          const aviso = (p as any).aviso as string | null | undefined;
          const isBestUnit = destaque === "unidad" && !isCheapest;
          const storeKey = p.store.toLowerCase();
          const color = storeColors[storeKey] || "border-slate-200 bg-white";
          const logo = storeLogos[storeKey] || "🏪";
          const isAdded = addedId === id;

          return (
            <div
              key={`${id}-${i}`}
              className={`flex-shrink-0 w-44 rounded-xl border-2 p-3 transition-shadow hover:shadow-lg ${
                isCheapest ? "border-green-400 bg-green-50 ring-2 ring-green-200"
                : isBestUnit ? "border-sky-300 bg-sky-50 ring-1 ring-sky-200"
                : color
              }`}
            >
              {/* Cheapest badge */}
              {isCheapest && (
                <div className="text-center mb-1">
                  <span className="text-[8px] font-bold text-green-700 bg-green-200 px-2 py-0.5 rounded-full">MAS BARATO</span>
                </div>
              )}
              {/* Verde = más barato EN TOTAL. Celeste = mejor por unidad, que puede costar
                  mucho más: distinguirlos evita el caso del papel de $17.143. */}
              {isBestUnit && (
                <div className="text-center mb-1">
                  <span className="text-[8px] font-bold text-sky-700 bg-sky-200 px-2 py-0.5 rounded-full">MEJOR X UNIDAD</span>
                </div>
              )}

              {/* Image */}
              {p.image_url ? (
                <img src={p.image_url} alt={p.name} className="w-full h-28 object-contain rounded-lg bg-white mb-2" />
              ) : (
                <div className="w-full h-28 rounded-lg bg-white mb-2 flex items-center justify-center border border-slate-100">
                  <ShoppingCart className="h-8 w-8 text-slate-200" />
                </div>
              )}

              {/* Store badge */}
              <div className="flex items-center gap-1 mb-1">
                <span className="text-sm">{logo}</span>
                <span className="text-[9px] font-bold uppercase text-slate-500">{p.store}</span>
              </div>

              {/* Product name */}
              <p className="text-[11px] font-medium text-slate-900 line-clamp-2 leading-tight h-8">{p.name}</p>
              {p.brand && <p className="text-[9px] text-slate-400">{p.brand}</p>}
              {aviso && (
                <p className="mt-0.5 rounded bg-orange-50 px-1 py-0.5 text-[9px] leading-snug text-orange-700" title={aviso}>
                  ⚠️ {aviso}
                </p>
              )}

              {/* Price */}
              <div className="flex items-center gap-1.5 mt-1.5">
                <span className={`text-base font-bold ${isCheapest ? "text-green-600" : "text-slate-900"}`}>
                  ${p.price.toLocaleString("es-CL")}
                </span>
                {p.original_price && p.original_price > p.price && (
                  <span className="text-[9px] text-slate-400 line-through">${p.original_price.toLocaleString("es-CL")}</span>
                )}
              </div>
              {p.discount_pct && p.discount_pct > 0 && (
                <span className="text-[9px] font-bold text-red-600">-{p.discount_pct}% OFF</span>
              )}

              {/* Precio por unidad de medida (para comparar tamaños distintos) + formato */}
              {(p.unit_price || p.size) && (
                <p className="mt-0.5 text-[9px] text-slate-500">
                  {p.unit_price ? <span className="font-semibold">${p.unit_price.toLocaleString("es-CL")}{p.unit ? ` / ${p.unit}` : ""}</span> : null}
                  {p.unit_price && p.size ? " · " : null}
                  {p.size ? <span className="text-slate-400">{p.size}</span> : null}
                </p>
              )}

              {/* Quantity selector */}
              <div className="flex items-center justify-center gap-1.5 mt-2">
                <button
                  onClick={() => setQty(id, getQty(id) - 1)}
                  className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                  disabled={getQty(id) <= 1}
                >
                  <Minus className="h-2.5 w-2.5" />
                </button>
                <span className="text-xs font-bold text-slate-700 w-4 text-center">{getQty(id)}</span>
                <button
                  onClick={() => setQty(id, getQty(id) + 1)}
                  className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                  disabled={getQty(id) >= 10}
                >
                  <Plus className="h-2.5 w-2.5" />
                </button>
              </div>

              {/* Actions */}
              <div className="flex gap-1 mt-1.5">
                <button
                  onClick={() => onAction(`compara "${p.name}" en todos los supermercados`)}
                  className="flex-1 flex items-center justify-center gap-0.5 rounded-md border border-slate-200 py-1.5 text-[8px] text-slate-600 hover:bg-white"
                >
                  <ArrowDownUp className="h-2.5 w-2.5" /> Comparar
                </button>
                <button
                  onClick={() => handleAdd(p)}
                  disabled={isAdded}
                  className={`flex-1 flex items-center justify-center gap-0.5 rounded-md py-1.5 text-[8px] text-white transition-colors ${isAdded ? "bg-green-500" : "bg-[#0a1628] hover:bg-[#1e3a5f]"}`}
                >
                  {isAdded ? (
                    <><Check className="h-2.5 w-2.5" /> Agregado</>
                  ) : (
                    <><ShoppingCart className="h-2.5 w-2.5" /> Agregar</>
                  )}
                </button>
              </div>
            </div>
          );
        })}

        {/* Card "+ Más alternativas": pide al agente más opciones del mismo producto */}
        {moreQuery && (
          <button
            onClick={() => onAction(`busca más alternativas de "${moreQuery}" en los supermercados`)}
            className="flex-shrink-0 w-44 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-3 flex flex-col items-center justify-center gap-2 text-slate-500 hover:border-[#0a1628]/40 hover:bg-slate-100 transition-colors"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white border border-slate-200">
              <Plus className="h-5 w-5" />
            </span>
            <span className="text-[11px] font-semibold text-center leading-tight">Más alternativas</span>
            <span className="text-[9px] text-slate-400 text-center leading-tight">Otras marcas y tamaños de {moreQuery.length > 16 ? moreQuery.slice(0, 16) + "…" : moreQuery}</span>
          </button>
        )}
      </div>

      {/* Action buttons — only show when not in grouped/compact mode */}
      {!compact && (
        <div className="flex flex-wrap gap-2 pt-1">
          <button onClick={() => onAction("arma el carro mas barato con todos los productos")} className="flex items-center gap-1 rounded-lg border border-[#0a1628]/20 bg-[#0a1628]/5 px-3 py-1.5 text-xs text-[#0a1628] hover:bg-slate-100">
            Lo mas barato
          </button>
          <button onClick={() => onAction("cual supermercado tiene todo mas barato en total")} className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50">
            Todo en 1 super
          </button>
          <button onClick={() => onAction("compara los precios de cada producto en todos los supermercados")} className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50">
            Comparar precios
          </button>
        </div>
      )}
    </div>
  );
}
