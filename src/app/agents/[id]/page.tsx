"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Bot, Plug, Package, Plus, Trash2, Search, Sparkles, Download, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import type { Agent, Connector } from "@/lib/supabase/types";

interface MarketplaceSkill {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  tags: string[];
  compatible_agents: string[];
  install_count: number;
  skill_content: string;
  created_at?: string;
}

interface AgentMcp {
  id: string;
  agent_id: string;
  mcp_name: string;
  mcp_package: string;
  description: string | null;
  enabled: boolean;
}

export default function AgentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [mcps, setMcps] = useState<AgentMcp[]>([]);
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [showAddMcp, setShowAddMcp] = useState(false);
  const [newMcp, setNewMcp] = useState({ name: "", package_name: "", description: "" });
  const [marketplaceSkills, setMarketplaceSkills] = useState<MarketplaceSkill[]>([]);
  const [showMarketplace, setShowMarketplace] = useState(false);
  const [installedSlugs, setInstalledSlugs] = useState<Set<string>>(new Set());

  useEffect(() => {
    const supabase = createClient();
    supabase.from("agents").select("*").eq("id", id).single().then(({ data }) => {
      if (data) setAgent(data);
    });
    supabase.from("agent_mcps").select("*").eq("agent_id", id).then(({ data }) => {
      if (data) setMcps(data as AgentMcp[]);
    });
    if (user) {
      supabase.from("connectors").select("*").eq("agent_id", id).eq("user_id", user.id).then(({ data }) => {
        if (data) setConnectors(data as Connector[]);
      });
    }
  }, [id, user]);

  // Load marketplace skills compatible with this agent
  const loadMarketplace = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("skills_marketplace")
      .select("*")
      .contains("compatible_agents", [id])
      .order("install_count", { ascending: false });
    if (data) setMarketplaceSkills(data as MarketplaceSkill[]);
    setShowMarketplace(true);
  };

  const installSkill = async (skill: MarketplaceSkill) => {
    // Add as MCP to this agent
    const supabase = createClient();
    await supabase.from("agent_mcps").insert({
      agent_id: id,
      mcp_name: skill.name,
      mcp_package: `skill:${skill.slug}`,
      description: skill.description,
      enabled: true,
      installed_by: user?.id,
    });
    // Increment install count
    await supabase.from("skills_marketplace").update({ install_count: skill.install_count + 1 }).eq("id", skill.id);
    setInstalledSlugs(prev => new Set([...prev, skill.slug]));
    // Refresh MCPs
    const { data } = await supabase.from("agent_mcps").select("*").eq("agent_id", id);
    if (data) setMcps(data as AgentMcp[]);
  };

  const toggleMcp = async (mcpId: string, enabled: boolean) => {
    const supabase = createClient();
    await supabase.from("agent_mcps").update({ enabled }).eq("id", mcpId);
    setMcps(prev => prev.map(m => m.id === mcpId ? { ...m, enabled } : m));
  };

  const addMcp = async () => {
    if (!newMcp.name || !newMcp.package_name) return;
    const supabase = createClient();
    const { data } = await supabase.from("agent_mcps").insert({
      agent_id: id,
      mcp_name: newMcp.name,
      mcp_package: newMcp.package_name,
      description: newMcp.description || null,
      enabled: true,
      installed_by: user?.id,
    }).select().single();
    if (data) {
      setMcps(prev => [...prev, data as AgentMcp]);
      setNewMcp({ name: "", package_name: "", description: "" });
      setShowAddMcp(false);
    }
  };

  const removeMcp = async (mcpId: string) => {
    const supabase = createClient();
    await supabase.from("agent_mcps").delete().eq("id", mcpId);
    setMcps(prev => prev.filter(m => m.id !== mcpId));
  };

  if (!agent) return <div className="p-8 text-slate-400">Cargando...</div>;

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-blue-50">
          <Bot className="h-7 w-7 text-blue-600" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{agent.name}</h1>
          <p className="text-sm text-slate-400">{agent.description}</p>
          <div className="mt-1 flex items-center gap-2">
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">{agent.id}</span>
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-600">{agent.category}</span>
            {agent.is_custom && <span className="rounded-full bg-yellow-50 px-2 py-0.5 text-[10px] font-medium text-yellow-600">Custom</span>}
          </div>
        </div>
      </div>

      {/* MCPs */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <Package className="h-4 w-4 text-purple-600" />
            MCPs ({mcps.length})
          </h2>
          <button
            onClick={() => setShowAddMcp(true)}
            className="flex items-center gap-1 rounded-md bg-purple-600 px-3 py-1.5 text-xs text-white hover:bg-purple-700"
          >
            <Plus className="h-3 w-3" />
            Agregar MCP
          </button>
        </div>

        {showAddMcp && (
          <div className="rounded-lg border border-purple-200 bg-purple-50 p-4 space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <Search className="h-4 w-4 text-purple-500" />
              <span className="text-xs font-medium text-purple-900">Agregar MCP al agente</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                value={newMcp.name}
                onChange={(e) => setNewMcp({ ...newMcp, name: e.target.value })}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-xs"
                placeholder="Nombre (ej: Google Flights)"
              />
              <input
                value={newMcp.package_name}
                onChange={(e) => setNewMcp({ ...newMcp, package_name: e.target.value })}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-xs"
                placeholder="Paquete (ej: fli, @playwright/mcp)"
              />
            </div>
            <input
              value={newMcp.description}
              onChange={(e) => setNewMcp({ ...newMcp, description: e.target.value })}
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs"
              placeholder="Descripcion..."
            />
            <div className="flex gap-2">
              <button onClick={addMcp} className="rounded-md bg-purple-600 px-3 py-1 text-xs text-white hover:bg-purple-700">Agregar</button>
              <button onClick={() => setShowAddMcp(false)} className="rounded-md border border-slate-300 px-3 py-1 text-xs text-slate-600">Cancelar</button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {mcps.map((mcp) => (
            <div key={mcp.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => toggleMcp(mcp.id, !mcp.enabled)}
                  className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors ${mcp.enabled ? "bg-purple-600" : "bg-slate-300"}`}
                >
                  <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${mcp.enabled ? "translate-x-4" : "translate-x-0.5"}`} />
                </button>
                <div>
                  <p className="text-sm font-medium text-slate-900">{mcp.mcp_name}</p>
                  <p className="text-[10px] text-slate-400 font-mono">{mcp.mcp_package}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {mcp.description && <p className="text-[10px] text-slate-400 max-w-xs truncate">{mcp.description}</p>}
                <button onClick={() => removeMcp(mcp.id)} className="text-slate-300 hover:text-red-500">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
          {mcps.length === 0 && <p className="py-3 text-center text-xs text-slate-400">Sin MCPs configurados</p>}
        </div>
      </div>

      {/* Skills Marketplace */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-yellow-500" />
            Skills Marketplace
          </h2>
          <button
            onClick={loadMarketplace}
            className="flex items-center gap-1 rounded-md bg-yellow-500 px-3 py-1.5 text-xs text-white hover:bg-yellow-600"
          >
            <Search className="h-3 w-3" />
            {showMarketplace ? "Actualizar" : "Buscar skills"}
          </button>
        </div>

        {showMarketplace && (
          <div className="space-y-2">
            {marketplaceSkills.length > 0 ? (
              marketplaceSkills.map((skill) => {
                const installed = installedSlugs.has(skill.slug) || mcps.some(m => m.mcp_package === `skill:${skill.slug}`);
                const isNew = new Date(skill.created_at || "").getTime() > Date.now() - 7 * 86400000;
                return (
                  <div key={skill.id} className="flex items-start justify-between rounded-lg border border-slate-200 p-3 hover:bg-slate-50">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-slate-900">{skill.name}</p>
                        {isNew && <span className="rounded bg-yellow-100 px-1.5 py-0.5 text-[9px] font-bold text-yellow-700">NEW</span>}
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] text-slate-500">{skill.category}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{skill.description}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {(skill.tags || []).slice(0, 3).map(tag => (
                          <span key={tag} className="text-[9px] text-slate-400">#{tag}</span>
                        ))}
                        <span className="text-[9px] text-slate-300">{skill.install_count} installs</span>
                      </div>
                    </div>
                    <button
                      onClick={() => !installed && installSkill(skill)}
                      disabled={installed}
                      className={`shrink-0 ml-3 flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                        installed
                          ? "bg-green-100 text-green-700 cursor-default"
                          : "bg-blue-600 text-white hover:bg-blue-700"
                      }`}
                    >
                      {installed ? <><Check className="h-3 w-3" /> Instalado</> : <><Download className="h-3 w-3" /> Instalar</>}
                    </button>
                  </div>
                );
              })
            ) : (
              <p className="py-4 text-center text-xs text-slate-400">No hay skills disponibles para este agente</p>
            )}
          </div>
        )}

        {!showMarketplace && (
          <p className="text-xs text-slate-400 text-center py-2">
            Busca skills para darle mas capacidades a este agente
          </p>
        )}
      </div>

      {/* Connectors */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
          <Plug className="h-4 w-4 text-green-600" />
          Conectores ({connectors.length})
        </h2>
        <div className="space-y-2">
          {connectors.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
              <div>
                <p className="text-sm font-medium text-slate-900">{c.name}</p>
                <p className="text-[10px] text-slate-400">{c.type} &middot; {c.status}</p>
              </div>
              <span className={`inline-block h-2 w-2 rounded-full ${c.status === "connected" ? "bg-green-500" : "bg-slate-300"}`} />
            </div>
          ))}
          {connectors.length === 0 && (
            <p className="py-3 text-center text-xs text-slate-400">
              Sin conectores. <a href="/connectors" className="text-blue-600 hover:underline">Configurar</a>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
