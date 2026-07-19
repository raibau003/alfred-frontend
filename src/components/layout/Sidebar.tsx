"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import {
  LayoutDashboard,
  Bot,
  MessageSquare,
  Plug,
  Settings,
  LogOut,
  ShoppingCart,
  Receipt,
  RefreshCw,
  Wifi,
  WifiOff,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth/AuthProvider";
import { ROUTER_URL } from "@/lib/alfred/client";

const navItems = [
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/shopping", label: "Compras", icon: ShoppingCart },
  { href: "/expenses", label: "Gastos", icon: Receipt },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/agents", label: "Agentes", icon: Bot },
  { href: "/connectors", label: "Conectores", icon: Plug },
  { href: "/settings", label: "Configuracion", icon: Settings },
];

type ServiceStatus = "connected" | "disconnected" | "checking" | "retrying";

export function Sidebar() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const [status, setStatus] = useState<ServiceStatus>("checking");
  const [retryIn, setRetryIn] = useState(0);
  const [showStatus, setShowStatus] = useState(false);

  const checkHealth = useCallback(async () => {
    setStatus("checking");
    try {
      const resp = await fetch(`${ROUTER_URL}/health`, { signal: AbortSignal.timeout(5000) });
      const data = await resp.json();
      setStatus(data?.ok ? "connected" : "disconnected");
      setRetryIn(0);
    } catch {
      setStatus("disconnected");
    }
  }, []);

  // Check on mount + every 30s
  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, [checkHealth]);

  // Auto-retry countdown when disconnected
  useEffect(() => {
    if (status !== "disconnected") return;
    setRetryIn(15);
    const countdown = setInterval(() => {
      setRetryIn(prev => {
        if (prev <= 1) {
          clearInterval(countdown);
          checkHealth();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(countdown);
  }, [status, checkHealth]);

  const handleRebuild = async () => {
    setStatus("retrying");
    // Hit the health endpoint a few times with delay
    for (let i = 0; i < 3; i++) {
      await new Promise(r => setTimeout(r, 5000));
      try {
        const resp = await fetch(`${ROUTER_URL}/health`, { signal: AbortSignal.timeout(5000) });
        const data = await resp.json();
        if (data?.ok) { setStatus("connected"); return; }
      } catch {}
    }
    setStatus("disconnected");
  };

  const statusConfig = {
    connected: { icon: Wifi, color: "text-green-500", bg: "bg-green-500", label: "Conectado" },
    disconnected: { icon: WifiOff, color: "text-red-500", bg: "bg-red-500", label: "Desconectado" },
    checking: { icon: Loader2, color: "text-yellow-500", bg: "bg-yellow-500", label: "Verificando..." },
    retrying: { icon: RefreshCw, color: "text-yellow-500", bg: "bg-yellow-500", label: "Reconectando..." },
  };

  const sc = statusConfig[status];
  const StatusIcon = sc.icon;

  return (
    <aside className="fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r border-surface-4 bg-surface-1">
      {/* Logo */}
      <div className="flex h-14 items-center justify-center border-b border-surface-4 px-5">
        <img src="/alfred-logo.png" alt="Alfred" className="h-8" />
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 p-3">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150",
                active
                  ? "bg-blue-50 text-brand-600"
                  : "text-slate-500 hover:bg-surface-3 hover:text-slate-900"
              )}
            >
              <Icon className={cn("h-4 w-4 shrink-0", active ? "text-brand-600" : "text-slate-400")} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Status indicator */}
      <div className="border-t border-surface-4">
        <button
          onClick={() => setShowStatus(!showStatus)}
          className="flex w-full items-center gap-2 px-4 py-2.5 text-xs hover:bg-surface-3 transition-colors"
        >
          <span className={`inline-block h-2 w-2 rounded-full ${sc.bg} ${status === "checking" || status === "retrying" ? "animate-pulse" : ""}`} />
          <span className={cn("font-medium", sc.color)}>{sc.label}</span>
          {status === "disconnected" && retryIn > 0 && (
            <span className="text-slate-400 ml-auto">retry en {retryIn}s</span>
          )}
        </button>

        {/* Expanded status panel */}
        {showStatus && (
          <div className="px-4 pb-3 space-y-2">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-slate-500">Alfred Router</span>
                <span className={sc.color}>{sc.label}</span>
              </div>
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-slate-500">URL</span>
                <span className="text-slate-400 font-mono truncate ml-2">{ROUTER_URL.replace("https://", "").substring(0, 25)}</span>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={checkHealth}
                  disabled={status === "checking"}
                  className="flex-1 flex items-center justify-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[10px] text-slate-600 hover:bg-white disabled:opacity-50"
                >
                  <RefreshCw className={cn("h-3 w-3", status === "checking" && "animate-spin")} />
                  Verificar
                </button>
                {status === "disconnected" && (
                  <button
                    onClick={handleRebuild}
                    className="flex-1 flex items-center justify-center gap-1 rounded-md bg-blue-600 px-2 py-1 text-[10px] text-white hover:bg-blue-700"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Rebuild
                  </button>
                )}
              </div>
            </div>
            <Link
              href="/settings"
              className="block text-center text-[10px] text-blue-600 hover:underline"
              onClick={() => setShowStatus(false)}
            >
              Ver configuracion completa
            </Link>
          </div>
        )}
      </div>

      {/* User */}
      <div className="border-t border-surface-4 p-3 space-y-1.5">
        <div className="flex items-center gap-2 text-xs text-slate-500 px-1">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-600 text-[10px] font-bold shrink-0">
            {user?.email?.[0]?.toUpperCase() ?? "U"}
          </div>
          <span className="truncate">{user?.email ?? "Usuario"}</span>
        </div>
        <button
          onClick={() => signOut()}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-slate-400 hover:bg-surface-3 hover:text-red-500 transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" />
          Cerrar sesion
        </button>
      </div>
    </aside>
  );
}
