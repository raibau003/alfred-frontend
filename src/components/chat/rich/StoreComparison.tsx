"use client";

import { Store, Check, X, ShoppingCart } from "lucide-react";

interface StoreData {
  store: string;
  total: number;
  available_count: number;
  total_items: number;
  missing: string[];
}

interface Props {
  stores: StoreData[];
  onAction: (message: string) => void;
}

export function StoreComparison({ stores, onAction }: Props) {
  if (!stores || stores.length === 0) return null;

  const sorted = [...stores].sort((a, b) => {
    // Prioritize stores with all items, then by price
    if (a.available_count === a.total_items && b.available_count !== b.total_items) return -1;
    if (b.available_count === b.total_items && a.available_count !== a.total_items) return 1;
    return a.total - b.total;
  });
  const cheapestComplete = sorted.find(s => s.available_count === s.total_items);

  return (
    <div className="mt-2 space-y-2">
      <p className="text-xs font-semibold text-slate-900 px-1">Comparacion por supermercado:</p>
      {sorted.map((s, i) => {
        const isBest = cheapestComplete && s.store === cheapestComplete.store;
        const coverage = Math.round((s.available_count / s.total_items) * 100);
        const hasAll = s.available_count === s.total_items;

        return (
          <div key={i} className={`rounded-xl border p-3 ${isBest ? "border-green-300 bg-green-50" : "border-slate-200 bg-white"}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold uppercase ${isBest ? "text-green-700" : "text-slate-900"}`}>
                  {s.store}
                </span>
                {isBest && <span className="text-[8px] font-bold text-green-600 bg-green-100 px-1.5 py-0.5 rounded">MEJOR OPCION</span>}
              </div>
              <span className={`text-sm font-bold ${isBest ? "text-green-600" : "text-slate-900"}`}>
                ${s.total.toLocaleString("es-CL")}
              </span>
            </div>

            {/* Coverage bar */}
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full rounded-full ${hasAll ? "bg-green-500" : coverage >= 70 ? "bg-yellow-500" : "bg-red-400"}`}
                  style={{ width: `${coverage}%` }}
                />
              </div>
              <span className="text-[10px] text-slate-500">{s.available_count}/{s.total_items} productos</span>
            </div>

            {/* Missing items */}
            {s.missing && s.missing.length > 0 && (
              <div className="flex items-center gap-1 mt-1.5">
                <X className="h-3 w-3 text-red-400" />
                <span className="text-[10px] text-red-500">Falta: {s.missing.join(", ")}</span>
              </div>
            )}

            {/* Action */}
            <button
              onClick={() => onAction(`arma carro en ${s.store} con todos los productos disponibles`)}
              className={`w-full mt-2 rounded-lg py-1.5 text-[10px] font-medium ${
                isBest
                  ? "bg-green-600 text-white hover:bg-green-700"
                  : "border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              <ShoppingCart className="h-3 w-3 inline mr-1" />
              Armar carro en {s.store}
            </button>
          </div>
        );
      })}
    </div>
  );
}
