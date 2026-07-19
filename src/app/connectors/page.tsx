"use client";

import { useEffect, useState } from "react";
import { Plus, Plug, Check, X, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import type { Connector, Agent } from "@/lib/supabase/types";

export default function ConnectorsPage() {
  const { user } = useAuth();
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [newForm, setNewForm] = useState({ agent_id: "", name: "", type: "rest_api", url: "", api_key: "" });

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    supabase.from("connectors").select("*").eq("user_id", user.id).then(({ data }) => {
      if (data) setConnectors(data as Connector[]);
    });
    supabase.from("agents").select("*").eq("enabled", true).order("name").then(({ data }) => {
      if (data) setAgents(data);
    });
  }, [user]);

  const addConnector = async () => {
    if (!user || !newForm.agent_id || !newForm.name) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("connectors")
      .insert({
        user_id: user.id,
        agent_id: newForm.agent_id,
        name: newForm.name,
        type: newForm.type,
        config: { url: newForm.url },
        credentials: { api_key: newForm.api_key },
        status: "disconnected",
      })
      .select()
      .single();
    if (data) {
      setConnectors((prev) => [...prev, data as Connector]);
      setShowNew(false);
      setNewForm({ agent_id: "", name: "", type: "rest_api", url: "", api_key: "" });
    }
  };

  const testConnector = async (id: string) => {
    const supabase = createClient();
    // For now, just mark as connected (real test would hit the Router)
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
    connected: "Conectado",
    disconnected: "Desconectado",
    error: "Error",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Conectores</h1>
          <p className="mt-1 text-sm text-slate-400">
            Gestiona las credenciales y APIs de tus agentes
          </p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nuevo conector
        </button>
      </div>

      {/* New connector form */}
      {showNew && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">Nuevo conector</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Agente</label>
              <select
                value={newForm.agent_id}
                onChange={(e) => setNewForm({ ...newForm, agent_id: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Seleccionar...</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Nombre</label>
              <input
                value={newForm.name}
                onChange={(e) => setNewForm({ ...newForm, name: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="ej: Microsoft Graph API"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Tipo</label>
              <select
                value={newForm.type}
                onChange={(e) => setNewForm({ ...newForm, type: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="rest_api">API REST</option>
                <option value="oauth">OAuth</option>
                <option value="web_scraping">Web Scraping</option>
                <option value="database">Base de Datos</option>
                <option value="pc_bridge">PC Bridge</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">URL</label>
              <input
                value={newForm.url}
                onChange={(e) => setNewForm({ ...newForm, url: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="https://api.ejemplo.com"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">API Key / Token</label>
              <input
                type="password"
                value={newForm.api_key}
                onChange={(e) => setNewForm({ ...newForm, api_key: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="sk-..."
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={addConnector} className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-blue-700">
              Guardar
            </button>
            <button onClick={() => setShowNew(false)} className="rounded-lg border border-slate-300 px-4 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Connector list */}
      <div className="space-y-3">
        {connectors.length === 0 && !showNew && (
          <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center">
            <Plug className="mx-auto h-8 w-8 text-slate-300 mb-2" />
            <p className="text-sm text-slate-500">No tienes conectores configurados</p>
            <p className="text-xs text-slate-400 mt-1">Agrega uno para que Alfred pueda acceder a tus servicios</p>
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
                <button
                  onClick={() => testConnector(c.id)}
                  className="rounded-md border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50"
                >
                  Test
                </button>
                <button
                  onClick={() => deleteConnector(c.id)}
                  className="rounded-md border border-red-200 px-3 py-1 text-xs text-red-600 hover:bg-red-50"
                >
                  Eliminar
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
