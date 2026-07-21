"use client";

interface CartItem {
  name: string;
  price: number;
  store: string;
  quantity: number;
  product_url?: string;
}

interface Props {
  items: CartItem[];
  onAction?: (msg: string) => void;
}

const STORE_COLORS: Record<string, { bg: string; text: string; emoji: string; url: string }> = {
  jumbo: { bg: "bg-green-50 border-green-200", text: "text-green-700", emoji: "🟢", url: "https://www.jumbo.cl" },
  "santa isabel": { bg: "bg-red-50 border-red-200", text: "text-red-700", emoji: "🔴", url: "https://www.santaisabel.cl" },
  unimarc: { bg: "bg-yellow-50 border-yellow-200", text: "text-yellow-700", emoji: "🟡", url: "https://www.unimarc.cl" },
  lider: { bg: "bg-blue-50 border-blue-200", text: "text-blue-700", emoji: "🔵", url: "https://www.lider.cl" },
  tottus: { bg: "bg-purple-50 border-purple-200", text: "text-purple-700", emoji: "🟣", url: "https://www.tottus.cl" },
};

export function ShoppingCart({ items, onAction }: Props) {
  if (!items || items.length === 0) return null;

  // Group by store
  const byStore: Record<string, CartItem[]> = {};
  for (const item of items) {
    const store = (item.store || "otro").toLowerCase();
    if (!byStore[store]) byStore[store] = [];
    byStore[store].push(item);
  }

  const grandTotal = items.reduce((s, i) => s + (i.price || 0) * (i.quantity || 1), 0);

  return (
    <div className="space-y-3 mt-3">
      {/* Store cards — horizontal scroll */}
      <div className="flex gap-3 overflow-x-auto pb-2 snap-x">
        {Object.entries(byStore).map(([store, storeItems]) => {
          const sc = STORE_COLORS[store] || { bg: "bg-slate-50 border-slate-200", text: "text-slate-700", emoji: "🏪", url: "#" };
          const storeTotal = storeItems.reduce((s, i) => s + (i.price || 0) * (i.quantity || 1), 0);
          const coverage = Math.round(storeItems.length / items.length * 100);

          return (
            <div key={store} className={`flex-shrink-0 w-72 rounded-xl border-2 ${sc.bg} p-4 snap-start`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{sc.emoji}</span>
                  <span className={`font-bold text-sm uppercase ${sc.text}`}>{store}</span>
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${coverage === 100 ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>
                  {coverage}%
                </span>
              </div>

              <div className="space-y-1.5 mb-3">
                {storeItems.map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-slate-700 truncate flex-1">{item.quantity > 1 ? `${item.quantity}x ` : ""}{item.name}</span>
                    <span className={`font-bold ml-2 ${sc.text}`}>${((item.price || 0) * (item.quantity || 1)).toLocaleString("es-CL")}</span>
                  </div>
                ))}
              </div>

              <div className="border-t pt-2 flex items-center justify-between">
                <span className="text-xs text-slate-500">{storeItems.length} productos</span>
                <span className={`font-bold text-sm ${sc.text}`}>${storeTotal.toLocaleString("es-CL")}</span>
              </div>

              <a
                href={sc.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`mt-2 block w-full text-center rounded-lg py-2 text-xs font-bold text-white ${store === "jumbo" ? "bg-green-600 hover:bg-green-700" : store === "santa isabel" ? "bg-red-600 hover:bg-red-700" : store === "unimarc" ? "bg-yellow-600 hover:bg-yellow-700" : "bg-blue-600 hover:bg-blue-700"}`}
              >
                Ir a pagar en {store.charAt(0).toUpperCase() + store.slice(1)}
              </a>
            </div>
          );
        })}
      </div>

      {/* Total + actions */}
      <div className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-2">
        <span className="text-sm text-slate-600">{items.length} productos en {Object.keys(byStore).length} tienda{Object.keys(byStore).length > 1 ? "s" : ""}</span>
        <span className="text-lg font-bold text-[#0a1628]">${grandTotal.toLocaleString("es-CL")}</span>
      </div>

      {onAction && (
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => onAction("todo en 1 super")} className="px-3 py-1.5 text-xs border rounded-lg hover:bg-slate-50">
            🏪 Todo en 1 super
          </button>
          <button onClick={() => onAction("lo mas barato")} className="px-3 py-1.5 text-xs border rounded-lg hover:bg-slate-50">
            💰 Lo mas barato
          </button>
          <button onClick={() => onAction("ver lista completa")} className="px-3 py-1.5 text-xs border rounded-lg hover:bg-slate-50">
            📋 Ver lista
          </button>
        </div>
      )}
    </div>
  );
}
