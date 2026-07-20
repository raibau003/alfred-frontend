"use client";

import { ShoppingCart, Trash2, ExternalLink, Download } from "lucide-react";

interface CartItem {
  name: string;
  price: number;
  qty: number;
  store: string;
  image_url?: string;
}

interface Props {
  items: CartItem[];
  onAction: (message: string) => void;
  onCheckout?: (store: string) => void;
}

export function CartView({ items, onAction, onCheckout }: Props) {
  if (!items || items.length === 0) return null;

  // Group by store
  const byStore: Record<string, CartItem[]> = {};
  for (const item of items) {
    if (!byStore[item.store]) byStore[item.store] = [];
    byStore[item.store].push(item);
  }

  const stores = Object.entries(byStore);
  const grandTotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);

  return (
    <div className="mt-2 space-y-3">
      <div className="flex items-center gap-2 px-1">
        <ShoppingCart className="h-4 w-4 text-blue-600" />
        <span className="text-xs font-semibold text-slate-900">
          Tu carro — {items.length} productos — ${grandTotal.toLocaleString("es-CL")}
        </span>
      </div>

      {stores.map(([store, storeItems]) => {
        const storeTotal = storeItems.reduce((sum, i) => sum + i.price * i.qty, 0);
        return (
          <div key={store} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            {/* Store header */}
            <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-200">
              <span className="text-xs font-bold text-slate-900 uppercase">{store}</span>
              <span className="text-xs font-semibold text-blue-600">${storeTotal.toLocaleString("es-CL")}</span>
            </div>

            {/* Items */}
            <div className="divide-y divide-slate-50">
              {storeItems.map((item, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2">
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.name} className="h-10 w-10 rounded object-contain bg-slate-50" />
                  ) : (
                    <div className="h-10 w-10 rounded bg-slate-50 flex items-center justify-center">
                      <ShoppingCart className="h-4 w-4 text-slate-200" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-900 truncate">{item.name}</p>
                    <p className="text-[10px] text-slate-400">x{item.qty}</p>
                  </div>
                  <span className="text-xs font-semibold text-slate-900">${(item.price * item.qty).toLocaleString("es-CL")}</span>
                  <button
                    onClick={() => onAction(`quita "${item.name}" del carro`)}
                    className="text-slate-300 hover:text-red-500"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>

            {/* Checkout button */}
            <div className="px-3 py-2 bg-slate-50 border-t border-slate-200">
              <button
                onClick={() => onAction(`ir a pagar en ${store}`)}
                className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 py-2 text-xs font-medium text-white hover:bg-blue-700"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Ir a pagar en {store} — ${storeTotal.toLocaleString("es-CL")}
              </button>
            </div>
          </div>
        );
      })}

      {stores.length > 1 && (
        <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-blue-50 border border-blue-200">
          <span className="text-xs font-semibold text-blue-900">Total ({stores.length} supers)</span>
          <span className="text-sm font-bold text-blue-600">${grandTotal.toLocaleString("es-CL")}</span>
        </div>
      )}
    </div>
  );
}
