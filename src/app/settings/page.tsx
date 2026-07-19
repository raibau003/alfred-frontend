"use client";

import { useEffect, useState } from "react";
import { Copy, Check, Download, Wifi, WifiOff } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import { ROUTER_URL } from "@/lib/alfred/client";

export default function SettingsPage() {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [bridgeToken, setBridgeToken] = useState("");
  const [bridgeActive, setBridgeActive] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    supabase.from("profiles").select("*").eq("id", user.id).single().then(({ data }) => {
      if (data) {
        setName(data.name || "");
        setPhone(data.phone || "");
      }
    });
    // Generate deterministic bridge token from user id
    setBridgeToken(`bridge_${user.id.substring(0, 16)}`);
    // Check bridge status
    fetch(`${ROUTER_URL}/bridge/status`).then(r => r.json()).then(data => {
      const active = data.bridges?.some((b: { token: string }) => b.token === `bridge_${user.id.substring(0, 8)}`);
      setBridgeActive(!!active);
    }).catch(() => {});
  }, [user]);

  const saveProfile = async () => {
    if (!user) return;
    const supabase = createClient();
    await supabase.from("profiles").upsert({ id: user.id, name, phone });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const copyToken = () => {
    navigator.clipboard.writeText(bridgeToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Configuracion</h1>
        <p className="mt-1 text-sm text-slate-400">Tu perfil y conexiones</p>
      </div>

      {/* Profile */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Perfil</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Nombre</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Telefono (WhatsApp)</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              placeholder="+56 9 1234 5678"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={saveProfile}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            {saved ? "Guardado!" : "Guardar"}
          </button>
          <span className="text-xs text-slate-400">{user?.email}</span>
        </div>
      </div>

      {/* PC Bridge */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">PC Bridge</h2>
          <div className="flex items-center gap-1.5 text-xs">
            {bridgeActive ? (
              <>
                <Wifi className="h-3.5 w-3.5 text-green-500" />
                <span className="text-green-600">Conectado</span>
              </>
            ) : (
              <>
                <WifiOff className="h-3.5 w-3.5 text-slate-400" />
                <span className="text-slate-400">Desconectado</span>
              </>
            )}
          </div>
        </div>

        <p className="text-xs text-slate-500">
          El PC Bridge permite que Alfred navegue internet usando tu computador.
          Esto es necesario para sitios como Lider, bancos y paginas con Cloudflare.
        </p>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Tu token de bridge</label>
          <div className="flex gap-2">
            <code className="flex-1 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-mono text-slate-600">
              {bridgeToken}
            </code>
            <button
              onClick={copyToken}
              className="flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copiado" : "Copiar"}
            </button>
          </div>
        </div>

        <div className="rounded-lg bg-slate-50 p-4 space-y-2">
          <p className="text-xs font-medium text-slate-700">Como conectar:</p>
          <ol className="text-xs text-slate-500 space-y-1 list-decimal list-inside">
            <li>Descarga el script de bridge</li>
            <li>Abre una terminal</li>
            <li>Ejecuta: <code className="bg-slate-200 px-1 rounded">python3 alfred-bridge.py --token {bridgeToken}</code></li>
            <li>Alfred podra navegar usando tu browser</li>
          </ol>
          <button className="flex items-center gap-1 rounded-md bg-slate-900 px-3 py-1.5 text-xs text-white hover:bg-slate-800 mt-2">
            <Download className="h-3.5 w-3.5" />
            Descargar alfred-bridge.py
          </button>
        </div>
      </div>

      {/* Channels */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Canales conectados</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
              <span className="text-sm text-slate-700">WhatsApp</span>
            </div>
            <span className="text-xs text-slate-400">{phone || "No configurado"}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
              <span className="text-sm text-slate-700">Web</span>
            </div>
            <span className="text-xs text-slate-400">Siempre activo</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-slate-300" />
              <span className="text-sm text-slate-700">Telegram</span>
            </div>
            <span className="text-xs text-slate-400">No configurado</span>
          </div>
        </div>
      </div>
    </div>
  );
}
