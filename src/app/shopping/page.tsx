"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAlfred } from "@/hooks/useAlfred";
import { useAuth } from "@/components/auth/AuthProvider";
import { ChatView } from "@/components/chat/ChatView";
import { createClient } from "@/lib/supabase/client";
import { Puzzle, Download, Loader2, CheckCircle2, X, ShoppingBag, MessageSquare, Settings } from "lucide-react";
import { ConfiguracionCompras } from "@/components/shopping/ConfiguracionCompras";

type StoreProgress = Record<string, { name?: string; done: number; total: number; status: string; added?: number; failed?: number }>;

export default function ShoppingPage() {
  const { user } = useAuth();
  const alfred = useAlfred();
  const [extPresent, setExtPresent] = useState(false);
  const [progress, setProgress] = useState<StoreProgress>({});
  const [building, setBuilding] = useState(false);
  const [showInstall, setShowInstall] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  // Pestaña activa. La configuración (comuna, programas de socio, costos de despacho) era
  // lo único que solo se podía tocar por WhatsApp o con un curl.
  const [tab, setTab] = useState<"chat" | "config">("chat");

  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearWatchdog = () => { if (watchdogRef.current) { clearTimeout(watchdogRef.current); watchdogRef.current = null; } };
  const armWatchdog = useCallback((ms: number) => {
    clearWatchdog();
    watchdogRef.current = setTimeout(() => {
      setBuilding(false);
      setNote("La extensión no respondió. ¿Está instalada y activa? Descargala e instalala desde el botón «Extensión».");
    }, ms);
  }, []);

  // Escucha a la extensión (presencia + progreso) vía window.postMessage
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const d = e.data;
      if (!d || typeof d !== "object") return;
      if (d.__alfred === "present") setExtPresent(true);
      if (d.__alfred === "progress") {
        setProgress(d.progress || {});
        setBuilding(!!d.running);
        // Mientras siga armando, re-armamos el watchdog; al terminar, lo apagamos.
        if (d.running) armWatchdog(25000); else clearWatchdog();
      }
    };
    window.addEventListener("message", onMsg);
    // Ping activo: si la extensión ya anunció presencia antes de montar el listener, que responda.
    window.postMessage({ __alfred: "ping" }, "*");
    return () => { window.removeEventListener("message", onMsg); clearWatchdog(); };
  }, [armWatchdog]);

  const armarCarritos = useCallback(async () => {
    if (!user) return;
    if (!extPresent) { setShowInstall(true); return; }
    const supabase = createClient();
    const { data } = await supabase
      .from("shopping_list")
      .select("product_name,price,store,quantity")
      .eq("user_id", user.id)
      .eq("status", "pending");
    const rows = data || [];
    if (rows.length === 0) { setNote("Tu carro está vacío. Agregá productos desde el chat primero."); return; }
    // Normaliza el store a la clave canónica que espera la extensión (sin acentos/underscore).
    const normStore = (raw: string) => {
      const s = (raw || "super").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/_/g, " ").trim();
      if (s.includes("santa") && s.includes("isabel")) return "santa isabel";
      for (const k of ["jumbo", "lider", "unimarc", "tottus"]) if (s.includes(k)) return k;
      return s;
    };
    // Agrupar por tienda → spec para la extensión
    const byStore: Record<string, { name: string; qty: number }[]> = {};
    for (const r of rows) {
      const s = normStore(r.store);
      (byStore[s] = byStore[s] || []).push({ name: r.product_name, qty: r.quantity || 1 });
    }
    const spec = { carts: Object.entries(byStore).map(([store, items]) => ({ store, items })) };
    setBuilding(true);
    setNote(null);
    window.postMessage({ __alfred: "build_carts", spec }, "*");
    armWatchdog(15000); // si no llega progreso en 15s, desbloqueamos el botón
  }, [user, extPresent, armWatchdog]);

  const stores = Object.entries(progress);

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col">
      {/* Barra de extensión / armar carritos */}
      <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-2">
        <ShoppingBag className="h-4 w-4 text-[#0a1628]" />
        <span className="text-sm font-semibold text-slate-800">Compras</span>
        {extPresent && (
          <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
            <CheckCircle2 className="h-3 w-3" /> Extensión conectada
          </span>
        )}
        {/* Pestañas: el chat sigue primero; la configuración deja de estar escondida. */}
        <div className="ml-3 flex items-center gap-1">
          {([["chat", "Chat", MessageSquare], ["config", "Configuración", Settings]] as const).map(([k, label, Icon]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                tab === k ? "bg-[#0a1628] text-white" : "text-slate-500 hover:bg-slate-100"
              }`}
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setShowInstall(true)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            <Puzzle className="h-3.5 w-3.5" /> Extensión
          </button>
          <button
            onClick={armarCarritos}
            disabled={building}
            className="flex items-center gap-1.5 rounded-lg bg-[#0a1628] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#1e3a5f] disabled:opacity-50"
          >
            {building ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShoppingBag className="h-3.5 w-3.5" />}
            Armar carritos
          </button>
        </div>
      </div>

      {/* Progreso por tienda */}
      {stores.length > 0 && (
        <div className="flex flex-wrap gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2">
          {stores.map(([store, p]) => {
            const pct = p.total ? Math.round((p.done / p.total) * 100) : 0;
            const done = p.status === "done";
            const partial = p.status === "done_partial";
            return (
              <div key={store} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5">
                <span className="text-xs font-medium text-slate-700 capitalize">{p.name || store}</span>
                <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
                  <div className={`h-full rounded-full ${done ? "bg-emerald-500" : partial ? "bg-amber-500" : "bg-[#0a1628]"}`} style={{ width: `${pct}%` }} />
                </div>
                <span className={`text-[10px] ${done ? "text-emerald-600 font-semibold" : partial ? "text-amber-600 font-semibold" : "text-slate-400"}`}>
                  {done ? "¡Listo!" : partial ? `${p.added ?? 0}/${p.total} agregados` : p.status === "opening" ? "Conectando…" : `${p.done}/${p.total}`}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {note && (
        <div className="flex items-center gap-2 border-b border-amber-100 bg-amber-50 px-4 py-2 text-xs text-amber-700">
          {note}
          <button onClick={() => setNote(null)} className="ml-auto text-amber-400 hover:text-amber-600"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}

      {/* Chat de compras */}
      <div className={`min-h-0 flex-1 ${tab === "chat" ? "" : "hidden"}`}>
        <ChatView
          messages={alfred.messages}
          busy={alfred.busy}
          connected={alfred.connected}
          onSend={alfred.send}
          userName={user?.email?.split("@")[0] ?? "Usuario"}
          shoppingMode
          onNewThread={() => alfred.newThread()}
        />
      </div>

      {/* Configuración de compras: comuna, programas de socio, retiro, tiendas a evitar y
          los costos de despacho — el dato que el optimizador no puede adivinar y que hasta
          ahora solo se podía cargar por WhatsApp o con un curl. */}
      {tab === "config" && (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <ConfiguracionCompras />
        </div>
      )}

      {/* Modal instalar extensión */}
      {showInstall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setShowInstall(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0a1628]/10 text-[#0a1628]"><Puzzle className="h-5 w-5" /></span>
              <h2 className="text-base font-semibold text-slate-900">Extensión Alfred Carritos</h2>
            </div>
            <p className="text-sm text-slate-500">
              Alfred arma tus carritos <b>en tu propia sesión</b> del supermercado (donde ya estás logueado).
              Nunca paga ni ve tus claves — solo agrega productos al carro; vos revisás y pagás.
            </p>
            <ol className="mt-3 space-y-1.5 text-xs text-slate-600">
              <li><b>1.</b> Descargá y descomprimí el .zip.</li>
              <li><b>2.</b> Abrí <code className="rounded bg-slate-100 px-1">chrome://extensions</code> y activá <b>Modo desarrollador</b> (arriba a la derecha).</li>
              <li><b>3.</b> Tocá <b>&quot;Cargar descomprimida&quot;</b> y elegí la carpeta.</li>
              <li><b>4.</b> Volvé acá y tocá <b>&quot;Armar carritos&quot;</b>.</li>
            </ol>
            <a
              href="/alfred-carritos-extension.zip"
              download
              className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-[#0a1628] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1e3a5f]"
            >
              <Download className="h-4 w-4" /> Descargar extensión (.zip)
            </a>
            <button onClick={() => setShowInstall(false)} className="mt-2 w-full text-center text-xs text-slate-400 hover:text-slate-600">Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}
