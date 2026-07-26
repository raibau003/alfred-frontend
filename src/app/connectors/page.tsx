"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Plus, Plug, Check, X, Loader2, Music, Save, ExternalLink,
  CheckCircle2, Calendar, ArrowLeft, KeyRound,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { ROUTER_URL } from "@/lib/alfred/client";
import type { Connector, Agent } from "@/lib/supabase/types";

// Cada integración declara SU forma de conectar (los parámetros que pide son distintos)
type Kind = "spotify" | "oauth_creds" | "generic";
interface CatalogItem {
  id: string;
  name: string;
  kind: Kind;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  tint: string; // clases tailwind para el badge
}

const CATALOG: CatalogItem[] = [
  {
    id: "spotify",
    name: "Spotify",
    kind: "spotify",
    desc: "Reproducir, buscar, playlists y volumen desde Alfred.",
    icon: Music,
    tint: "bg-[#1DB954]/10 text-[#1DB954]",
  },
  {
    id: "google",
    name: "Google (Calendar + Gmail)",
    kind: "oauth_creds",
    desc: "Calendario y correo vía OAuth 2.0.",
    icon: Calendar,
    tint: "bg-blue-100 text-blue-600",
  },
  {
    id: "custom",
    name: "API personalizada",
    kind: "generic",
    desc: "Cualquier API REST, base de datos o bridge propio.",
    icon: Plug,
    tint: "bg-slate-100 text-slate-500",
  },
];

export default function IntegracionesPage() {
  const { user } = useAuth();
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selected, setSelected] = useState<CatalogItem | null>(null);

  const reloadConnectors = useCallback(() => {
    if (!user) return;
    const supabase = createClient();
    supabase.from("connectors").select("*").eq("user_id", user.id).then(({ data }) => {
      if (data) setConnectors(data as Connector[]);
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    reloadConnectors();
    const supabase = createClient();
    supabase.from("agents").select("*").eq("enabled", true).order("name").then(({ data }) => {
      if (data) setAgents(data);
    });
  }, [user, reloadConnectors]);

  const testConnector = async (id: string) => {
    const supabase = createClient();
    await supabase
      .from("connectors")
      .update({ status: "connected", last_test_at: new Date().toISOString(), last_test_result: "OK" })
      .eq("id", id);
    setConnectors((prev) => prev.map((c) => (c.id === id ? { ...c, status: "connected" as const } : c)));
  };

  const deleteConnector = async (id: string) => {
    const supabase = createClient();
    await supabase.from("connectors").delete().eq("id", id);
    setConnectors((prev) => prev.filter((c) => c.id !== id));
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case "connected": return <Check className="h-3.5 w-3.5 text-green-500" />;
      case "error": return <X className="h-3.5 w-3.5 text-red-500" />;
      default: return <Loader2 className="h-3.5 w-3.5 text-slate-400" />;
    }
  };
  const statusLabel: Record<string, string> = {
    connected: "Conectado", disconnected: "Desconectado", error: "Error",
  };

  // ---- vista de un formulario específico ----
  if (selected) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => { setSelected(null); reloadConnectors(); }}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" /> Volver a Integraciones
        </button>
        {selected.kind === "spotify" && <SpotifyForm />}
        {selected.kind === "oauth_creds" && (
          <OAuthCredsForm item={selected} agents={agents} onSaved={() => { setSelected(null); reloadConnectors(); }} />
        )}
        {selected.kind === "generic" && (
          <GenericForm agents={agents} onSaved={() => { setSelected(null); reloadConnectors(); }} />
        )}
      </div>
    );
  }

  // ---- hub ----
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Integraciones</h1>
        <p className="mt-1 text-sm text-slate-400">
          Conectá servicios externos a Alfred. Cada uno se conecta a su manera.
        </p>
      </div>

      {/* Catálogo: cada tarjeta abre su propio formulario */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {CATALOG.map((it) => {
          const Icon = it.icon;
          return (
            <button
              key={it.id}
              onClick={() => setSelected(it)}
              className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left transition-colors hover:border-[#0a1628]/30 hover:bg-slate-50"
            >
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${it.tint}`}>
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-sm font-medium text-slate-900">
                  {it.name}
                </div>
                <p className="mt-0.5 text-xs text-slate-500">{it.desc}</p>
                <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[#0a1628]">
                  <Plus className="h-3 w-3" /> Conectar
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Conexiones existentes */}
      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Conexiones activas</h2>
        <div className="space-y-3">
          {connectors.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center">
              <Plug className="mx-auto h-8 w-8 text-slate-300 mb-2" />
              <p className="text-sm text-slate-500">Todavía no conectaste nada</p>
              <p className="text-xs text-slate-400 mt-1">Elegí una integración arriba para empezar</p>
            </div>
          )}
          {connectors.map((c) => {
            const agent = agents.find((a) => a.id === c.agent_id);
            return (
              <div key={c.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-3">
                  {statusIcon(c.status)}
                  <div>
                    <p className="text-sm font-medium text-slate-900">{c.name}</p>
                    <p className="text-xs text-slate-400">
                      {agent?.name ?? c.agent_id} &middot; {c.type} &middot;{" "}
                      <span className={c.status === "connected" ? "text-green-600" : "text-slate-400"}>
                        {statusLabel[c.status] ?? c.status}
                      </span>
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => testConnector(c.id)} className="rounded-md border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50">Test</button>
                  <button onClick={() => deleteConnector(c.id)} className="rounded-md border border-red-200 px-3 py-1 text-xs text-red-600 hover:bg-red-50">Eliminar</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ============ Spotify (OAuth vía router) ============ */
interface SpotifyStatus { configured: boolean; connected: boolean; status: string; redirect_uri: string; }
function SpotifyForm() {
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
  );
}

/* ============ OAuth por credenciales (Google) — parámetros propios ============ */
function OAuthCredsForm({ item, agents, onSaved }: { item: CatalogItem; agents: Agent[]; onSaved: () => void }) {
  const { user } = useAuth();
  const [f, setF] = useState({
    agent_id: "", client_id: "", client_secret: "",
    redirect_uri: "", scopes: "https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/gmail.modify",
  });
  const [saving, setSaving] = useState(false);
  const Icon = item.icon;

  const save = async () => {
    if (!user || !f.agent_id || !f.client_id) return;
    setSaving(true);
    const supabase = createClient();
    await supabase.from("connectors").insert({
      user_id: user.id,
      agent_id: f.agent_id,
      name: item.name,
      type: "oauth",
      config: { provider: item.id, redirect_uri: f.redirect_uri, scopes: f.scopes },
      credentials: { client_id: f.client_id, client_secret: f.client_secret },
      status: "disconnected",
    });
    setSaving(false);
    onSaved();
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
      <div className="flex items-center gap-2">
        <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${item.tint}`}><Icon className="h-5 w-5" /></span>
        <div>
          <div className="font-medium text-slate-900">{item.name}</div>
          <div className="text-xs text-slate-500">OAuth 2.0 — pegá las credenciales de tu proyecto en Google Cloud.</div>
        </div>
      </div>
      <p className="text-xs text-slate-500">
        Creá un OAuth Client ID en <a className="text-indigo-600 underline" href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer">console.cloud.google.com</a> (tipo «Web»), copiá Client ID/Secret y el Redirect URI autorizado.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs text-slate-500">Agente</label>
          <select value={f.agent_id} onChange={e => setF({ ...f, agent_id: e.target.value })}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="">Seleccionar…</option>
            {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500">Redirect URI</label>
          <input value={f.redirect_uri} onChange={e => setF({ ...f, redirect_uri: e.target.value })}
            placeholder="https://…/oauth/callback"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-xs text-slate-500">Client ID</label>
          <input value={f.client_id} onChange={e => setF({ ...f, client_id: e.target.value })}
            placeholder="…apps.googleusercontent.com"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-xs text-slate-500">Client Secret</label>
          <input type="password" value={f.client_secret} onChange={e => setF({ ...f, client_secret: e.target.value })}
            placeholder="GOCSPX-…"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs text-slate-500">Scopes (separados por espacio)</label>
          <input value={f.scopes} onChange={e => setF({ ...f, scopes: e.target.value })}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono text-[11px]" />
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={save} disabled={saving || !f.agent_id || !f.client_id}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#0a1628] px-4 py-2 text-sm font-medium text-white hover:bg-[#1e3a5f] disabled:opacity-40">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />} Guardar credenciales
        </button>
      </div>
    </div>
  );
}

/* ============ Genérico (API personalizada) ============ */
function GenericForm({ agents, onSaved }: { agents: Agent[]; onSaved: () => void }) {
  const { user } = useAuth();
  const [f, setF] = useState({ agent_id: "", name: "", type: "rest_api", url: "", api_key: "" });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!user || !f.agent_id || !f.name) return;
    setSaving(true);
    const supabase = createClient();
    await supabase.from("connectors").insert({
      user_id: user.id,
      agent_id: f.agent_id,
      name: f.name,
      type: f.type,
      config: { url: f.url },
      credentials: { api_key: f.api_key },
      status: "disconnected",
    });
    setSaving(false);
    onSaved();
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500"><Plug className="h-5 w-5" /></span>
        <div>
          <div className="font-medium text-slate-900">API personalizada</div>
          <div className="text-xs text-slate-500">API REST, base de datos, scraping o bridge propio.</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Agente</label>
          <select value={f.agent_id} onChange={(e) => setF({ ...f, agent_id: e.target.value })}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="">Seleccionar...</option>
            {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Nombre</label>
          <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="ej: Microsoft Graph API" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Tipo</label>
          <select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="rest_api">API REST</option>
            <option value="oauth">OAuth</option>
            <option value="web_scraping">Web Scraping</option>
            <option value="database">Base de Datos</option>
            <option value="pc_bridge">PC Bridge</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">URL</label>
          <input value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="https://api.ejemplo.com" />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-slate-700 mb-1">API Key / Token</label>
          <input type="password" value={f.api_key} onChange={(e) => setF({ ...f, api_key: e.target.value })}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="sk-..." />
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={save} disabled={saving || !f.agent_id || !f.name}
          className="rounded-lg bg-[#0a1628] px-4 py-2 text-sm font-medium text-white hover:bg-[#1e3a5f] disabled:opacity-40">
          Guardar
        </button>
      </div>
    </div>
  );
}
