"use client";

import { useEffect, useState, useCallback } from "react";
import { Music, Loader2, CheckCircle2, ExternalLink, Save } from "lucide-react";
import { ROUTER_URL } from "@/lib/alfred/client";

interface SpotifyStatus { configured: boolean; connected: boolean; status: string; redirect_uri: string; }

export default function IntegracionesPage() {
  const [st, setSt] = useState<SpotifyStatus | null>(null);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${ROUTER_URL}/spotify/status`, { signal: AbortSignal.timeout(8000) });
      setSt(await r.json());
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 4000); return () => clearInterval(t); }, [load]);

  const save = async () => {
    setSaving(true); setMsg(null);
    try {
      const r = await fetch(`${ROUTER_URL}/spotify/config`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: clientId || undefined, client_secret: clientSecret || undefined }),
        signal: AbortSignal.timeout(10000),
      });
      const d = await r.json();
      setMsg(d.ok ? "✅ Credenciales guardadas. Ahora tocá «Conectar con Spotify»." : `⚠️ ${d.error || "error"}`);
      setClientSecret("");
      await load();
    } catch { setMsg("⚠️ No pude contactar el router."); }
    setSaving(false);
  };

  const connect = () => window.open(`${ROUTER_URL}/spotify/connect`, "_blank", "width=520,height=720");

  const connected = st?.connected;
  const configured = st?.configured;

  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
          <Music className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Integraciones</h1>
          <p className="text-sm text-slate-500">Conectá servicios externos a Alfred.</p>
        </div>
      </div>

      {/* Spotify */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1DB954]/10 text-[#1DB954]"><Music className="h-5 w-5" /></span>
            <div>
              <div className="font-medium text-slate-900">Spotify</div>
              <div className="text-xs text-slate-500">Reproducir, buscar, playlists y control de volumen desde Alfred.</div>
            </div>
          </div>
          {connected ? (
            <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" /> Conectado</span>
          ) : (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">{configured ? "Falta conectar" : "Sin configurar"}</span>
          )}
        </div>

        {connected ? (
          <div className="rounded-lg bg-emerald-50 p-4 text-center">
            <CheckCircle2 className="mx-auto mb-1 h-8 w-8 text-emerald-600" />
            <p className="text-sm font-medium text-emerald-800">Spotify conectado 🎵</p>
            <p className="mt-1 text-xs text-emerald-700">Decile a Alfred «pon algo de …», «sube el volumen», «qué estoy escuchando».</p>
            <button onClick={connect} className="mt-3 text-xs text-emerald-700 underline">Volver a conectar</button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">
              1) Creá una app en <a className="text-indigo-600 underline" href="https://developer.spotify.com/dashboard" target="_blank" rel="noreferrer">developer.spotify.com/dashboard</a> con Redirect URI{" "}
              <code className="rounded bg-slate-100 px-1 text-[11px]">{st?.redirect_uri || ".../spotify/callback"}</code> y API = Web API.
              2) Pegá el Client ID y Secret. 3) Conectá.
            </p>
            <div>
              <label className="text-xs text-slate-500">Client ID {configured && <span className="text-emerald-600">(ya guardado — dejalo vacío si no cambia)</span>}</label>
              <input value={clientId} onChange={e => setClientId(e.target.value)} placeholder="48ab9bae…"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400" />
            </div>
            <div>
              <label className="text-xs text-slate-500">Client Secret</label>
              <input value={clientSecret} onChange={e => setClientSecret(e.target.value)} type="password" placeholder="••••••••"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400" />
            </div>
            {msg && <p className="text-xs text-slate-600">{msg}</p>}
            <div className="flex gap-2">
              <button onClick={save} disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar credenciales
              </button>
              <button onClick={connect} disabled={!configured}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#1DB954] px-3 py-2 text-sm font-medium text-white hover:brightness-95 disabled:opacity-40">
                <ExternalLink className="h-4 w-4" /> Conectar con Spotify
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
