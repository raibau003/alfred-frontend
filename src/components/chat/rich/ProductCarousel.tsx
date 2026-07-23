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
}

interface Props {
  products: Product[];
  onAction: (message: string) => void;
  groupLabel?: string;
  onAddToCart?: (product: Product, quantity: number) => void;
  compact?: boolean;
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

export function ProductCarousel({ products, onAction, groupLabel, onAddToCart, compact }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [addedIdx, setAddedIdx] = useState<number | null>(null);

  if (!products || products.length === 0) return null;

  // Sort by price ascending
  const sorted = [...products].sort((a, b) => a.price - b.price);
  const cheapest = sorted[0];

  const scroll = (dir: "left" | "right") => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: dir === "left" ? -220 : 220, behavior: "smooth" });
  };

  const getQty = (idx: number) => quantities[idx] ?? 1;
  const setQty = (idx: number, q: number) => setQuantities(prev => ({ ...prev, [idx]: Math.max(1, Math.min(10, q)) }));

  const handleAdd = (p: Product, idx: number) => {
    const qty = getQty(idx);
    if (onAddToCart) {
      onAddToCart(p, qty);
    } else {
      onAction(`agrega "${p.name}" de ${p.store} a $${p.price} al carro`);
    }
    setAddedIdx(idx);
    setTimeout(() => setAddedIdx(null), 2000);
  };

  return (
    <div className={`${compact ? "mt-1" : "mt-3"} space-y-2`}>
      <div className="flex items-center justify-between px-1">
        <p className="text-xs font-semibold text-slate-700">
          {groupLabel ? groupLabel : `${sorted.length} productos encontrados`}
        </p>
        <div className="flex gap-1">
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
          const isCheapest = p.price === cheapest.price;
          const storeKey = p.store.toLowerCase();
          const color = storeColors[storeKey] || "border-slate-200 bg-white";
          const logo = storeLogos[storeKey] || "🏪";
          const isAdded = addedIdx === i;

          return (
            <div
              key={i}
              className={`flex-shrink-0 w-44 rounded-xl border-2 p-3 transition-shadow hover:shadow-lg ${isCheapest ? "border-green-400 bg-green-50 ring-2 ring-green-200" : color}`}
            >
              {/* Cheapest badge */}
              {isCheapest && (
                <div className="text-center mb-1">
                  <span className="text-[8px] font-bold text-green-700 bg-green-200 px-2 py-0.5 rounded-full">MAS BARATO</span>
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

              {/* Quantity selector */}
              <div className="flex items-center justify-center gap-1.5 mt-2">
                <button
                  onClick={() => setQty(i, getQty(i) - 1)}
                  className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                  disabled={getQty(i) <= 1}
                >
                  <Minus className="h-2.5 w-2.5" />
                </button>
                <span className="text-xs font-bold text-slate-700 w-4 text-center">{getQty(i)}</span>
                <button
                  onClick={() => setQty(i, getQty(i) + 1)}
                  className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                  disabled={getQty(i) >= 10}
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
                  onClick={() => handleAdd(p, i)}
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
