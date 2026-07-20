"use client";

import { ShoppingCart, ArrowDownUp, ExternalLink } from "lucide-react";

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
}

export function ProductCards({ products, onAction }: Props) {
  if (!products || products.length === 0) return null;

  const cheapest = products.reduce((min, p) => (p.available !== false && p.price < min.price) ? p : min, products[0]);

  return (
    <div className="mt-2 space-y-3">
      {/* Product grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {products.slice(0, 9).map((p, i) => {
          const isCheapest = p.store === cheapest.store && p.price === cheapest.price;
          return (
            <div
              key={i}
              className={`rounded-xl border p-2.5 bg-white transition-shadow hover:shadow-md ${
                isCheapest ? "border-green-300 ring-1 ring-green-200" : "border-slate-200"
              }`}
            >
              {/* Image */}
              {p.image_url ? (
                <img src={p.image_url} alt={p.name} className="w-full h-20 object-contain rounded-lg bg-slate-50 mb-2" />
              ) : (
                <div className="w-full h-20 rounded-lg bg-slate-50 mb-2 flex items-center justify-center">
                  <ShoppingCart className="h-6 w-6 text-slate-200" />
                </div>
              )}

              {/* Info */}
              <p className="text-xs font-medium text-slate-900 line-clamp-2 leading-tight">{p.name}</p>
              {p.brand && <p className="text-[9px] text-slate-400 mt-0.5">{p.brand}</p>}

              {/* Price */}
              <div className="flex items-center gap-1.5 mt-1">
                <span className={`text-sm font-bold ${isCheapest ? "text-green-600" : "text-slate-900"}`}>
                  ${p.price.toLocaleString("es-CL")}
                </span>
                {p.original_price && p.original_price > p.price && (
                  <span className="text-[9px] text-slate-400 line-through">${p.original_price.toLocaleString("es-CL")}</span>
                )}
                {p.discount_pct && p.discount_pct > 0 && (
                  <span className="text-[9px] font-bold text-red-600">-{p.discount_pct}%</span>
                )}
              </div>

              {/* Store + badges */}
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-[9px] font-semibold uppercase text-slate-400">{p.store}</span>
                {isCheapest && <span className="text-[8px] font-bold text-green-600 bg-green-50 px-1 rounded">MAS BARATO</span>}
                {p.available === false && <span className="text-[8px] text-red-500">Agotado</span>}
              </div>

              {/* Actions */}
              <div className="flex gap-1 mt-2">
                <button
                  onClick={() => onAction(`compara "${p.name}" en todos los supermercados`)}
                  className="flex-1 flex items-center justify-center gap-0.5 rounded-md border border-slate-200 py-1 text-[9px] text-slate-600 hover:bg-slate-50"
                >
                  <ArrowDownUp className="h-2.5 w-2.5" /> Comparar
                </button>
                <button
                  onClick={() => onAction(`agrega "${p.name}" de ${p.store} a $${p.price} al carro`)}
                  className="flex-1 flex items-center justify-center gap-0.5 rounded-md bg-[#0a1628] py-1 text-[9px] text-white hover:bg-[#1e3a5f]"
                >
                  <ShoppingCart className="h-2.5 w-2.5" /> Agregar
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {products.length > 9 && (
        <p className="text-[10px] text-slate-400 text-center">y {products.length - 9} productos mas...</p>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => onAction("arma el carro mas barato con todos los productos")}
          className="flex items-center gap-1 rounded-lg border border-[#0a1628]/20 bg-[#0a1628]/5 px-3 py-1.5 text-xs text-[#0a1628] hover:bg-blue-100"
        >
          ⚡ Lo mas barato de todo
        </button>
        <button
          onClick={() => onAction("cual supermercado tiene todo mas barato en total y que productos le faltan")}
          className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
        >
          🏪 Todo en 1 super
        </button>
        <button
          onClick={() => onAction("compara los precios de cada producto en todos los supermercados")}
          className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
        >
          📊 Comparar todo
        </button>
      </div>
    </div>
  );
}
