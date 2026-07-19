"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bot, Zap, Mail, ShoppingCart, Heart, Briefcase, Home, GraduationCap, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Agent } from "@/lib/supabase/types";

const categoryConfig: Record<string, { label: string; color: string; icon: typeof Bot }> = {
  finanzas: { label: "Finanzas", color: "bg-green-50 text-green-700 border-green-200", icon: Zap },
  correo: { label: "Correo", color: "bg-blue-50 text-blue-700 border-blue-200", icon: Mail },
  hogar: { label: "Hogar", color: "bg-orange-50 text-orange-700 border-orange-200", icon: Home },
  compras: { label: "Compras", color: "bg-purple-50 text-purple-700 border-purple-200", icon: ShoppingCart },
  bienestar: { label: "Bienestar", color: "bg-pink-50 text-pink-700 border-pink-200", icon: Heart },
  trabajo: { label: "Trabajo", color: "bg-slate-50 text-slate-700 border-slate-200", icon: Briefcase },
  educacion: { label: "Educacion", color: "bg-yellow-50 text-yellow-700 border-yellow-200", icon: GraduationCap },
};

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [filter, setFilter] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("agents")
      .select("*")
      .order("category")
      .then(({ data }) => {
        if (data) setAgents(data);
      });
  }, []);

  const toggleAgent = async (id: string, enabled: boolean) => {
    const supabase = createClient();
    await supabase.from("agents").update({ enabled }).eq("id", id);
    setAgents((prev) => prev.map((a) => (a.id === id ? { ...a, enabled } : a)));
  };

  const categories = [...new Set(agents.map((a) => a.category).filter(Boolean))];
  const filtered = filter ? agents.filter((a) => a.category === filter) : agents;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Agentes</h1>
          <p className="mt-1 text-sm text-slate-400">
            {agents.filter((a) => a.enabled).length} activos de {agents.length} agentes
          </p>
        </div>
        <Link
          href="/agents/new"
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Crear agente
        </Link>
      </div>

      {/* Category filters */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setFilter(null)}
          className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
            !filter ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
          }`}
        >
          Todos
        </button>
        {categories.map((cat) => {
          const cfg = categoryConfig[cat!] ?? { label: cat, color: "bg-slate-50 text-slate-600 border-slate-200" };
          return (
            <button
              key={cat}
              onClick={() => setFilter(cat === filter ? null : cat!)}
              className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                filter === cat ? "bg-blue-600 text-white border-blue-600" : cfg.color
              }`}
            >
              {cfg.label}
            </button>
          );
        })}
      </div>

      {/* Agent grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((agent) => {
          const cfg = categoryConfig[agent.category ?? ""] ?? { label: "", color: "", icon: Bot };
          return (
            <div
              key={agent.id}
              className={`rounded-xl border p-4 transition-all ${
                agent.enabled
                  ? "border-slate-200 bg-white hover:shadow-md"
                  : "border-slate-100 bg-slate-50 opacity-60"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${agent.enabled ? "bg-blue-50" : "bg-slate-100"}`}>
                    <Bot className={`h-5 w-5 ${agent.enabled ? "text-blue-600" : "text-slate-400"}`} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">{agent.name}</h3>
                    {agent.category && (
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium border ${cfg.color}`}>
                        {cfg.label}
                      </span>
                    )}
                  </div>
                </div>

                {/* Toggle */}
                <button
                  onClick={() => toggleAgent(agent.id, !agent.enabled)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    agent.enabled ? "bg-blue-600" : "bg-slate-300"
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                      agent.enabled ? "translate-x-4" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>

              <p className="mt-2 text-xs text-slate-500 line-clamp-2">{agent.description}</p>

              <div className="mt-3 flex items-center gap-3 text-[10px] text-slate-400">
                <span className="font-mono">{agent.id}</span>
                {agent.is_custom && <span className="rounded bg-yellow-50 px-1.5 py-0.5 text-yellow-600 border border-yellow-200">Custom</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
