"use client";

import { Check, X, ShoppingCart } from "lucide-react";

interface Comparison {
  store: string;
  name?: string;
  price: number;
  available: boolean;
  product_url?: string;
}

interface Props {
  product: string;
  comparisons: Comparison[];
  onAction: (message: string) => void;
}

export function ComparisonTable({ product, comparisons, onAction }: Props) {
  if (!comparisons || comparisons.length === 0) return null;

  const sorted = [...comparisons].sort((a, b) => {
    if (!a.available) return 1;
    if (!b.available) return -1;
    return a.price - b.price;
  });
  const cheapest = sorted.find(c => c.available);

  return (
    <div className="mt-2 rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-3 py-2 bg-slate-50 border-b border-slate-200">
        <p className="text-xs font-semibold text-slate-900">Comparacion: {product}</p>
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-slate-400 border-b border-slate-100">
            <th className="text-left py-1.5 px-3">Super</th>
            <th className="text-right px-3">Precio</th>
            <th className="text-center px-2">Stock</th>
            <th className="text-center px-2"></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((c, i) => {
            const isCheapest = cheapest && c.store === cheapest.store && c.price === cheapest.price;
            return (
              <tr key={i} className={`border-b border-slate-50 ${isCheapest ? "bg-green-50" : ""}`}>
                <td className="py-2 px-3">
                  <span className="font-medium text-slate-900 uppercase">{c.store}</span>
                </td>
                <td className="text-right px-3">
                  <span className={`font-bold ${isCheapest ? "text-green-600" : "text-slate-900"}`}>
                    ${c.price.toLocaleString("es-CL")}
                  </span>
                  {isCheapest && <span className="ml-1 text-[8px] text-green-600">MEJOR</span>}
                </td>
                <td className="text-center px-2">
                  {c.available ? <Check className="h-3.5 w-3.5 text-green-500 inline" /> : <X className="h-3.5 w-3.5 text-red-400 inline" />}
                </td>
                <td className="text-center px-2">
                  {c.available && (
                    <button
                      onClick={() => onAction(`agrega "${product}" de ${c.store} a $${c.price} al carro`)}
                      className="rounded bg-[#0a1628] px-2 py-0.5 text-[9px] text-white hover:bg-[#1e3a5f]"
                    >
                      <ShoppingCart className="h-2.5 w-2.5 inline mr-0.5" />Agregar
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
