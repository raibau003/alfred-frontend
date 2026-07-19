"use client";

import { useState } from "react";
import { Search, ShoppingCart, Zap, ArrowDownUp, Store, Loader2 } from "lucide-react";
import { ROUTER_URL } from "@/lib/alfred/client";

interface Product {
  id?: string;
  store: string;
  name: string;
  brand?: string;
  price: number;
  original_price?: number;
  discount_pct?: number;
  image_url?: string;
  product_url?: string;
  available: boolean;
  sku?: string;
}

// Backwards compat
type Comparison = Product;

export default function ShoppingPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [shoppingList, setShoppingList] = useState<string[]>([]);
  const [newItem, setNewItem] = useState("");
  const [comparisons, setComparisons] = useState<Comparison[]>([]);
  const [comparing, setComparing] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [optimalResult, setOptimalResult] = useState<string | null>(null);
  const [strategy, setStrategy] = useState<"cheapest_total" | "single_store_cheapest">("cheapest_total");

  const [cacheSource, setCacheSource] = useState<string>("");

  const searchProduct = async () => {
    if (!searchQuery.trim()) return;
    setComparing(true);
    setComparisons([]);
    setCacheSource("");

    try {
      // Try cache first (instant)
      const cacheResp = await fetch(`${ROUTER_URL}/products/search?q=${encodeURIComponent(searchQuery)}&country=CL`);
      const cacheData = await cacheResp.json();

      if (cacheData.products?.length > 0) {
        setComparisons(cacheData.products);
        setCacheSource(cacheData.source);
        setComparing(false);
        return;
      }

      // Cache miss — wait and retry
      setCacheSource("scraping");
      await new Promise(r => setTimeout(r, 15000));

      const retryResp = await fetch(`${ROUTER_URL}/products/search?q=${encodeURIComponent(searchQuery)}&country=CL`);
      const retryData = await retryResp.json();
      if (retryData.products?.length > 0) {
        setComparisons(retryData.products);
        setCacheSource(retryData.source);
      } else {
        // Fallback to agent-compras direct
        const agentResp = await fetch(`${ROUTER_URL}/shopping/compare`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ product: searchQuery }),
        });
        const agentData = await agentResp.json();
        if (agentData.comparisons?.length > 0) {
          setComparisons(agentData.comparisons);
          setCacheSource("agent");
        }
      }
    } catch {}
    setComparing(false);
  };

  const addItem = () => {
    if (!newItem.trim()) return;
    setShoppingList(prev => [...prev, newItem.trim()]);
    setNewItem("");
  };

  const removeItem = (idx: number) => {
    setShoppingList(prev => prev.filter((_, i) => i !== idx));
  };

  const generateOptimalCart = async () => {
    if (shoppingList.length === 0) return;
    setOptimizing(true);
    setOptimalResult(null);
    try {
      const resp = await fetch(`${ROUTER_URL}/shopping/optimal-cart`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: shoppingList, strategy }),
      });
      const data = await resp.json();
      setOptimalResult(data.result || "No se pudo generar el carro optimo");
    } catch {
      setOptimalResult("Error conectando con Alfred");
    }
    setOptimizing(false);
  };

  const cheapest = comparisons.length > 0
    ? comparisons.reduce((min, c) => c.price < min.price && c.available ? c : min, comparisons[0])
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Compras Inteligentes</h1>
        <p className="mt-1 text-sm text-slate-400">Compara precios y arma tu carro optimo</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Search + Compare */}
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Search className="h-4 w-4 text-blue-600" />
              Buscar producto
            </h2>
            <div className="flex gap-2">
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && searchProduct()}
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                placeholder="Ej: aceite de oliva, leche, detergente..."
              />
              <button
                onClick={searchProduct}
                disabled={comparing}
                className="flex items-center gap-1 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {comparing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowDownUp className="h-4 w-4" />}
                Comparar
              </button>
            </div>
          </div>

          {/* Comparison results */}
          {comparisons.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900">
                  Resultados para &ldquo;{searchQuery}&rdquo;
                </h2>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                  cacheSource === "cache" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                }`}>
                  {cacheSource === "cache" ? "Cache (instantaneo)" : cacheSource === "agent" ? "Busqueda en vivo" : "Actualizado"}
                </span>
              </div>
              <div className="space-y-2">
                {comparisons.sort((a, b) => a.price - b.price).map((c, i) => {
                  const isCheapest = cheapest && c.store === cheapest.store && c.price === cheapest.price;
                  return (
                    <div
                      key={i}
                      className={`flex items-center gap-3 rounded-lg border p-3 ${
                        isCheapest ? "border-green-300 bg-green-50" : "border-slate-200"
                      }`}
                    >
                      {c.image_url && (
                        <img src={c.image_url} alt={c.name} className="h-14 w-14 rounded-md object-contain bg-white" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{c.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {c.brand && <span className="text-[10px] text-slate-500">{c.brand}</span>}
                          <span className="text-[10px] text-slate-400 uppercase font-semibold">{c.store}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-sm font-bold ${isCheapest ? "text-green-600" : "text-slate-900"}`}>
                          ${c.price.toLocaleString("es-CL")}
                        </p>
                        {c.original_price && c.original_price > c.price && (
                          <p className="text-[10px] text-slate-400 line-through">${c.original_price.toLocaleString("es-CL")}</p>
                        )}
                        {c.discount_pct && c.discount_pct > 0 && (
                          <span className="text-[10px] text-red-600 font-bold">-{c.discount_pct}%</span>
                        )}
                        {isCheapest && <span className="block text-[10px] text-green-600 font-medium">MAS BARATO</span>}
                        {!c.available && <span className="block text-[10px] text-red-500">Agotado</span>}
                      </div>
                      <button
                        onClick={() => setShoppingList(prev => [...prev, `${c.name} (${c.store})`])}
                        className="shrink-0 rounded-md bg-blue-600 px-2 py-1 text-[10px] text-white hover:bg-blue-700"
                      >
                        Agregar
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right: Shopping List */}
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-blue-600" />
              Lista de compras ({shoppingList.length} items)
            </h2>

            <div className="flex gap-2">
              <input
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addItem()}
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                placeholder="Agregar item..."
              />
              <button onClick={addItem} className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
                +
              </button>
            </div>

            <div className="space-y-1 max-h-60 overflow-y-auto">
              {shoppingList.map((item, i) => (
                <div key={i} className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-1.5">
                  <span className="text-sm text-slate-700">{item}</span>
                  <button onClick={() => removeItem(i)} className="text-xs text-red-400 hover:text-red-600">x</button>
                </div>
              ))}
              {shoppingList.length === 0 && (
                <p className="py-4 text-center text-xs text-slate-400">Agrega items a tu lista</p>
              )}
            </div>
          </div>

          {/* Strategy selector */}
          {shoppingList.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
              <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <Zap className="h-4 w-4 text-yellow-500" />
                Optimizar carro
              </h2>

              <div className="space-y-2">
                <label className="flex items-center gap-2 rounded-lg border border-slate-200 p-3 cursor-pointer hover:bg-slate-50">
                  <input
                    type="radio"
                    name="strategy"
                    checked={strategy === "cheapest_total"}
                    onChange={() => setStrategy("cheapest_total")}
                    className="h-3.5 w-3.5 text-blue-600"
                  />
                  <div>
                    <p className="text-sm font-medium text-slate-900">Lo mas barato (multi-super)</p>
                    <p className="text-[10px] text-slate-400">Cada producto en el super donde sea mas barato</p>
                  </div>
                </label>
                <label className="flex items-center gap-2 rounded-lg border border-slate-200 p-3 cursor-pointer hover:bg-slate-50">
                  <input
                    type="radio"
                    name="strategy"
                    checked={strategy === "single_store_cheapest"}
                    onChange={() => setStrategy("single_store_cheapest")}
                    className="h-3.5 w-3.5 text-blue-600"
                  />
                  <div>
                    <p className="text-sm font-medium text-slate-900">Un solo super (el mas barato)</p>
                    <p className="text-[10px] text-slate-400">Todo en un lugar, el que tenga menor total</p>
                  </div>
                </label>
              </div>

              <button
                onClick={generateOptimalCart}
                disabled={optimizing}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {optimizing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Store className="h-4 w-4" />}
                {optimizing ? "Buscando precios..." : "Generar carro optimo"}
              </button>
            </div>
          )}

          {/* Optimal result */}
          {optimalResult && (
            <div className="rounded-xl border border-green-200 bg-green-50 p-4">
              <h3 className="text-sm font-semibold text-green-900 mb-2">Resultado</h3>
              <div className="text-xs text-green-800 whitespace-pre-wrap">{optimalResult}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
