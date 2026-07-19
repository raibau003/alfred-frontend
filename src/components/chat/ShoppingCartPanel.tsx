"use client";

import { useEffect, useState } from "react";
import { ShoppingCart, X, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import type { ShoppingCart as CartType } from "@/lib/supabase/types";

export function ShoppingCartPanel() {
  const { user } = useAuth();
  const [carts, setCarts] = useState<CartType[]>([]);
  const [activeStore, setActiveStore] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    supabase
      .from("shopping_carts")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "active")
      .then(({ data }) => {
        if (data) setCarts(data as CartType[]);
      });
  }, [user]);

  if (carts.length === 0) return null;

  const active = activeStore ? carts.find((c) => c.store === activeStore) : carts[0];

  return (
    <div className="border-t border-slate-200 bg-slate-50">
      {/* Store tabs */}
      <div className="flex border-b border-slate-200">
        {carts.map((cart) => (
          <button
            key={cart.store}
            onClick={() => setActiveStore(cart.store)}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
              (activeStore ?? carts[0]?.store) === cart.store
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <ShoppingCart className="h-3 w-3" />
            {cart.store} ({cart.items.length})
          </button>
        ))}
      </div>

      {/* Cart items */}
      {active && (
        <div className="p-3 space-y-2 max-h-48 overflow-y-auto">
          {active.items.map((item, i) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <span className="text-slate-700 truncate flex-1">{item.name}</span>
              <span className="text-slate-500 mx-2">x{item.qty}</span>
              <span className="font-medium text-slate-900">${(item.price * item.qty).toLocaleString("es-CL")}</span>
            </div>
          ))}
          <div className="flex items-center justify-between border-t border-slate-200 pt-2">
            <span className="text-xs font-semibold text-slate-900">Total</span>
            <span className="text-sm font-bold text-blue-600">${active.total.toLocaleString("es-CL")}</span>
          </div>
          <button className="w-full flex items-center justify-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700">
            <ExternalLink className="h-3 w-3" />
            Ir a pagar en {active.store}
          </button>
        </div>
      )}
    </div>
  );
}
