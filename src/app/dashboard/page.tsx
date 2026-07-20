"use client";

import { useEffect, useState } from "react";
import { Bot, Activity, MessageSquare, Clock, CheckCircle, XCircle, Loader2, Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";

interface AgentStat {
  id: string;
  name: string;
  enabled: boolean;
  lastUsed: string | null;
  totalChats: number;
  avgTime: number;
}

interface RecentTask {
  id: number;
  agent: string;
  prompt: string;
  response: string;
  duration_ms: number;
  created_at: string;
  channel: string;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [agents, setAgents] = useState<AgentStat[]>([]);
  const [recentTasks, setRecentTasks] = useState<RecentTask[]>([]);
  const [stats, setStats] = useState({ totalChats: 0, todayChats: 0, avgTime: 0, activeAgents: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, [user]);

  async function loadDashboard() {
    const supabase = createClient();

    // Get agents
    const { data: agentsData } = await supabase
      .from("agents")
      .select("*")
      .neq("internal", true)
      .order("name");

    // Get recent conversations (last 50)
    const { data: convData } = await supabase
      .from("conversations")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    const conversations = convData || [];
    const today = new Date().toISOString().split("T")[0];

    // Calculate stats
    const todayConvs = conversations.filter(c => c.created_at?.startsWith(today));
    const durations = conversations.filter(c => c.duration_ms > 0).map(c => c.duration_ms);
    const avgDuration = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length / 1000) : 0;

    // Agent stats
    const agentStats: AgentStat[] = (agentsData || []).map(a => {
      const agentConvs = conversations.filter(c => c.agent === a.id);
      const agentDurations = agentConvs.filter(c => c.duration_ms > 0).map(c => c.duration_ms);
      return {
        id: a.id,
        name: a.name,
        enabled: a.enabled,
        lastUsed: agentConvs[0]?.created_at || null,
        totalChats: agentConvs.length,
        avgTime: agentDurations.length > 0 ? Math.round(agentDurations.reduce((a, b) => a + b, 0) / agentDurations.length / 1000) : 0,
      };
    });

    setAgents(agentStats.sort((a, b) => b.totalChats - a.totalChats));
    setRecentTasks(conversations.slice(0, 15) as RecentTask[]);
    setStats({
      totalChats: conversations.length,
      todayChats: todayConvs.length,
      avgTime: avgDuration,
      activeAgents: agentStats.filter(a => a.enabled).length,
    });
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-400">Monitoreo de agentes y actividad</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Agentes activos</p>
            <Bot className="h-4 w-4 text-green-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">{stats.activeAgents}</p>
          <p className="text-[10px] text-slate-400">{agents.length} total</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Chats hoy</p>
            <MessageSquare className="h-4 w-4 text-blue-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">{stats.todayChats}</p>
          <p className="text-[10px] text-slate-400">{stats.totalChats} total</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Tiempo promedio</p>
            <Clock className="h-4 w-4 text-yellow-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">{stats.avgTime}s</p>
          <p className="text-[10px] text-slate-400">por respuesta</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Canales</p>
            <Zap className="h-4 w-4 text-purple-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">3</p>
          <p className="text-[10px] text-slate-400">Web, WhatsApp, API</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Agent monitor */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <Activity className="h-4 w-4 text-[#0a1628]" />
            Agentes — Actividad
          </h2>
          <div className="space-y-1.5 max-h-80 overflow-y-auto">
            {agents.map(a => (
              <div key={a.id} className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-slate-50">
                <div className="flex items-center gap-2">
                  <span className={`inline-block h-2 w-2 rounded-full ${a.enabled ? "bg-green-500" : "bg-slate-300"}`} />
                  <span className="text-sm text-slate-700">{a.name}</span>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-slate-400">
                  {a.totalChats > 0 && (
                    <>
                      <span>{a.totalChats} chats</span>
                      <span>{a.avgTime}s avg</span>
                    </>
                  )}
                  {a.lastUsed && (
                    <span>{new Date(a.lastUsed).toLocaleDateString("es-CL", { day: "2-digit", month: "short" })}</span>
                  )}
                  {!a.lastUsed && <span className="text-slate-300">Sin uso</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent tasks / logs */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-green-600" />
            Actividad reciente
          </h2>
          <div className="space-y-1.5 max-h-80 overflow-y-auto">
            {recentTasks.map(t => {
              const dur = Math.round((t.duration_ms || 0) / 1000);
              const time = new Date(t.created_at).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
              const hasResponse = t.response && t.response.length > 10;
              return (
                <div key={t.id} className="rounded-lg border border-slate-100 px-3 py-2 space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {hasResponse ? (
                        <CheckCircle className="h-3 w-3 text-green-500" />
                      ) : (
                        <XCircle className="h-3 w-3 text-red-400" />
                      )}
                      <span className="text-xs font-medium text-slate-700">
                        {(t.agent || "chat-ai").replace("agent-", "")}
                      </span>
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] text-slate-400">{t.channel}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400">
                      {dur > 0 && <span>{dur}s</span>}
                      <span>{time}</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 truncate">{t.prompt}</p>
                </div>
              );
            })}
            {recentTasks.length === 0 && (
              <p className="py-8 text-center text-xs text-slate-400">Sin actividad reciente</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
