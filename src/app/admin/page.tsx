"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Users, MessageSquare, Bot, Activity, Clock, AlertTriangle, RefreshCw,
  Zap, Shield, TrendingUp, Database, Eye, Power, Search, ChevronDown,
  CheckCircle, XCircle, Loader2, BarChart3
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ROUTER_URL } from "@/lib/alfred/client";

interface AdminStats {
  totalUsers: number;
  activeToday: number;
  totalConversations: number;
  todayConversations: number;
  avgResponseTime: number;
  errorRate: number;
  totalAgents: number;
  onlineAgents: number;
}

interface UserRow {
  id: string;
  name: string | null;
  phone: string | null;
  created_at: string;
  conversations: number;
  lastActive: string | null;
}

interface ConversationRow {
  id: number;
  channel: string;
  agent: string;
  prompt: string;
  response: string;
  duration_ms: number;
  error: string | null;
  created_at: string;
  user_id: string | null;
}

interface AgentHealth {
  agent: string;
  status: string;
  latency: number;
}

export default function AdminPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [tab, setTab] = useState<"overview" | "users" | "conversations" | "agents" | "system" | "learning" | "logs">("overview");
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [agentHealth, setAgentHealth] = useState<AgentHealth[]>([]);
  const [systemStats, setSystemStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<any[]>([]);
  const [graduatedFixes, setGraduatedFixes] = useState<any[]>([]);
  const [agentLogs, setAgentLogs] = useState<Record<string, any[]>>({});

  const login = () => {
    if (password === "admin") { setAuthed(true); loadAll(); }
  };

  const loadAll = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const today = new Date().toISOString().split("T")[0];

    // Users
    const { data: profiles } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });

    // Conversations
    const { data: convs } = await supabase.from("conversations").select("*").order("created_at", { ascending: false }).limit(200);

    // Agent health from Router
    const healthResp = await fetch(`${ROUTER_URL}/monitor/agents`).then(r => r.json()).catch(() => ({ agents: [] }));
    const sysResp = await fetch(`${ROUTER_URL}/monitor/stats`).then(r => r.json()).catch(() => null);

    // Test results (learning)
    const { data: tests } = await supabase.from("agent_tests").select("*").order("created_at", { ascending: false }).limit(100);
    setTestResults(tests || []);

    // Graduated fixes
    const { data: fixes } = await supabase.from("agent_graduated_fixes").select("*").eq("graduated", true).order("created_at", { ascending: false }).limit(50);
    setGraduatedFixes(fixes || []);

    // Recent conversations as logs grouped by agent
    const logsByAgent: Record<string, any[]> = {};
    for (const c of (convs || [])) {
      const agent = c.agent || "chat-ai";
      if (!logsByAgent[agent]) logsByAgent[agent] = [];
      if (logsByAgent[agent].length < 10) logsByAgent[agent].push(c);
    }
    setAgentLogs(logsByAgent);

    const allConvs = convs || [];
    const todayConvs = allConvs.filter(c => c.created_at?.startsWith(today));
    const durations = allConvs.filter(c => c.duration_ms > 0).map(c => c.duration_ms);
    const errors = allConvs.filter(c => c.error);

    // Build user rows with activity
    const userRows: UserRow[] = (profiles || []).map(p => {
      const userConvs = allConvs.filter(c => c.user_id === p.id);
      const lastConv = userConvs[0];
      return {
        id: p.id,
        name: p.name,
        phone: p.phone,
        created_at: p.created_at,
        conversations: userConvs.length,
        lastActive: lastConv?.created_at || null,
      };
    });

    setUsers(userRows);
    setConversations(allConvs as ConversationRow[]);
    setAgentHealth(healthResp.agents || []);
    setSystemStats(sysResp);
    setStats({
      totalUsers: userRows.length,
      activeToday: new Set(todayConvs.map(c => c.user_id).filter(Boolean)).size,
      totalConversations: allConvs.length,
      todayConversations: todayConvs.length,
      avgResponseTime: durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length / 1000) : 0,
      errorRate: allConvs.length > 0 ? Math.round(errors.length / allConvs.length * 100) : 0,
      totalAgents: (healthResp.agents || []).length,
      onlineAgents: (healthResp.agents || []).filter((a: any) => a.status === "online").length,
    });
    setLoading(false);
  }, []);

  useEffect(() => { if (authed) { const i = setInterval(loadAll, 30000); return () => clearInterval(i); } }, [authed, loadAll]);

  // Login screen
  if (!authed) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center">
        <div className="w-72 space-y-4 rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex items-center gap-2 justify-center">
            <Shield className="h-5 w-5 text-red-600" />
            <h2 className="text-sm font-bold text-slate-900">Admin Access</h2>
          </div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && login()}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Password"
            autoFocus
          />
          <button onClick={login} className="w-full rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700">
            Entrar
          </button>
        </div>
      </div>
    );
  }

  const StatCard = ({ label, value, sub, icon: Icon, color = "text-white" }: any) => (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
        <Icon className={`h-4 w-4 ${color}`} />
      </div>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
      {sub && <p className="text-[10px] text-slate-400">{sub}</p>}
    </div>
  );

  const tabs = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "users", label: "Usuarios", icon: Users },
    { id: "conversations", label: "Conversaciones", icon: MessageSquare },
    { id: "agents", label: "Agentes", icon: Bot },
    { id: "learning", label: "Aprendizaje", icon: TrendingUp },
    { id: "logs", label: "Logs", icon: Activity },
    { id: "system", label: "Sistema", icon: Database },
  ];

  const filteredConvs = selectedUser ? conversations.filter(c => c.user_id === selectedUser) : conversations;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-red-600" />
          <h1 className="text-xl font-bold text-slate-900">Admin Dashboard</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadAll} disabled={loading} className="flex items-center gap-1 rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50">
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
          <span className="text-[10px] text-slate-400">Auto-refresh 30s</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as any)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm border-b-2 transition-colors ${tab === t.id ? "border-red-600 text-red-700 font-medium" : "border-transparent text-slate-500 hover:text-slate-700"}`}
          >
            <t.icon className="h-3.5 w-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === "overview" && stats && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Usuarios" value={stats.totalUsers} sub={`${stats.activeToday} activos hoy`} icon={Users} color="text-blue-500" />
            <StatCard label="Conversaciones" value={stats.totalConversations} sub={`${stats.todayConversations} hoy`} icon={MessageSquare} color="text-green-500" />
            <StatCard label="Tiempo promedio" value={`${stats.avgResponseTime}s`} icon={Clock} color="text-yellow-500" />
            <StatCard label="Error rate" value={`${stats.errorRate}%`} sub={`${stats.onlineAgents}/${stats.totalAgents} agentes online`} icon={AlertTriangle} color="text-red-500" />
          </div>

          {/* Embedded test dashboard iframe */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-4 py-2 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Test Cluster Dashboard</h3>
              <a href="https://alfred-test-dashboard.vercel.app" target="_blank" className="text-[10px] text-blue-600 hover:underline">Abrir completo</a>
            </div>
            <iframe src="https://alfred-test-dashboard.vercel.app" className="w-full h-[600px] border-0" />
          </div>
        </div>
      )}

      {/* Users */}
      {tab === "users" && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-slate-50">
              <tr className="text-slate-500 border-b border-slate-200">
                <th className="text-left py-2 px-3">Usuario</th>
                <th className="text-left px-2">Telefono</th>
                <th className="text-right px-2">Chats</th>
                <th className="text-left px-2">Ultimo activo</th>
                <th className="text-left px-2">Registro</th>
                <th className="text-center px-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-2 px-3 font-medium text-slate-900">{u.name || u.id.substring(0, 8)}</td>
                  <td className="px-2 text-slate-500">{u.phone || "-"}</td>
                  <td className="px-2 text-right text-slate-700">{u.conversations}</td>
                  <td className="px-2 text-slate-500">{u.lastActive ? new Date(u.lastActive).toLocaleDateString("es-CL") : "Nunca"}</td>
                  <td className="px-2 text-slate-400">{new Date(u.created_at).toLocaleDateString("es-CL")}</td>
                  <td className="px-2 text-center">
                    <button
                      onClick={() => { setSelectedUser(u.id); setTab("conversations"); }}
                      className="rounded border border-slate-200 px-2 py-0.5 text-[10px] text-slate-600 hover:bg-slate-100"
                    >
                      <Eye className="h-3 w-3 inline" /> Ver chats
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Conversations */}
      {tab === "conversations" && (
        <div className="space-y-3">
          {selectedUser && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Filtrando por usuario: {users.find(u => u.id === selectedUser)?.name || selectedUser.substring(0, 8)}</span>
              <button onClick={() => setSelectedUser(null)} className="text-xs text-red-600 hover:underline">Quitar filtro</button>
            </div>
          )}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden max-h-[600px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 sticky top-0">
                <tr className="text-slate-500 border-b border-slate-200">
                  <th className="text-left py-2 px-3">Hora</th>
                  <th className="text-left px-2">Canal</th>
                  <th className="text-left px-2">Agente</th>
                  <th className="text-left px-2">Prompt</th>
                  <th className="text-right px-2">Tiempo</th>
                  <th className="text-center px-2">Status</th>
                  <th className="text-left px-2">Respuesta</th>
                </tr>
              </thead>
              <tbody>
                {filteredConvs.slice(0, 100).map(c => {
                  const time = new Date(c.created_at).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
                  const hasResp = c.response && c.response.length > 10;
                  return (
                    <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-1.5 px-3 text-slate-400 whitespace-nowrap">{time}</td>
                      <td className="px-2"><span className={`text-[10px] px-1.5 py-0.5 rounded ${c.channel === "whatsapp" ? "bg-green-50 text-green-700" : c.channel === "web" ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-600"}`}>{c.channel}</span></td>
                      <td className="px-2 font-medium text-slate-700">{(c.agent || "chat").replace("agent-", "")}</td>
                      <td className="px-2 text-slate-600 max-w-xs truncate">{c.prompt?.substring(0, 50)}</td>
                      <td className="px-2 text-right text-slate-400">{c.duration_ms > 0 ? `${Math.round(c.duration_ms / 1000)}s` : "-"}</td>
                      <td className="px-2 text-center">{c.error ? <XCircle className="h-3 w-3 text-red-500 inline" /> : hasResp ? <CheckCircle className="h-3 w-3 text-green-500 inline" /> : <Clock className="h-3 w-3 text-yellow-500 inline" />}</td>
                      <td className="px-2 text-slate-500 max-w-sm truncate">{c.response?.substring(0, 80) || "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Agents */}
      {tab === "agents" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {agentHealth.map(a => (
              <div key={a.agent} className={`rounded-lg border p-3 ${a.status === "online" ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${a.status === "online" ? "bg-green-500" : "bg-red-500"}`} />
                  <span className="text-xs font-medium text-slate-900 truncate">{a.agent.replace("agent-", "")}</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500">
                  <span>{a.status}</span>
                  {a.latency >= 0 && <span>{a.latency}ms</span>}
                </div>
              </div>
            ))}
          </div>

          {/* Agent usage stats */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Uso por agente</h3>
            <div className="space-y-2">
              {(() => {
                const agentCounts: Record<string, number> = {};
                conversations.forEach(c => { if (c.agent) agentCounts[c.agent] = (agentCounts[c.agent] || 0) + 1; });
                const sorted = Object.entries(agentCounts).sort((a, b) => b[1] - a[1]);
                const max = sorted[0]?.[1] || 1;
                return sorted.map(([agent, count]) => (
                  <div key={agent} className="flex items-center gap-3">
                    <span className="w-28 text-xs text-slate-700 truncate">{agent.replace("agent-", "")}</span>
                    <div className="flex-1 bg-slate-100 rounded-full h-4 overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(count / max) * 100}%` }} />
                    </div>
                    <span className="text-xs text-slate-500 w-12 text-right">{count}</span>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      )}

      {/* System */}
      {/* Learning / Test Results */}
      {tab === "learning" && (
        <div className="space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <StatCard label="Total Tests" value={testResults.length} icon={BarChart3} color="text-blue-500" />
            <StatCard label="Pass Rate" value={`${testResults.length > 0 ? Math.round(testResults.filter(t => t.pass).length / testResults.length * 100) : 0}%`} icon={CheckCircle} color="text-green-500" />
            <StatCard label="Passed" value={testResults.filter(t => t.pass).length} icon={CheckCircle} color="text-green-500" />
            <StatCard label="Failed" value={testResults.filter(t => !t.pass).length} icon={XCircle} color="text-red-500" />
            <StatCard label="Fixes Graduados" value={graduatedFixes.length} sub="Aprendizajes permanentes" icon={TrendingUp} color="text-purple-500" />
          </div>

          {/* Graduated Fixes */}
          {graduatedFixes.length > 0 && (
            <div className="rounded-xl border border-purple-200 bg-purple-50 p-4 space-y-2">
              <h3 className="text-sm font-semibold text-purple-900">Aprendizajes Graduados (permanentes)</h3>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {graduatedFixes.map((f, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-md bg-white/60 px-3 py-2">
                    <CheckCircle className="h-3.5 w-3.5 text-purple-500 mt-0.5 shrink-0" />
                    <div>
                      <span className="text-xs font-medium text-purple-900">{f.agent}</span>
                      <p className="text-[10px] text-purple-700">{f.fix}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pass rate by agent */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Pass Rate por Agente</h3>
            <div className="space-y-2">
              {(() => {
                const agentStats: Record<string, { pass: number; fail: number; avg: number }> = {};
                testResults.forEach(t => {
                  if (!agentStats[t.agent]) agentStats[t.agent] = { pass: 0, fail: 0, avg: 0 };
                  if (t.pass) agentStats[t.agent].pass++;
                  else agentStats[t.agent].fail++;
                  if (t.duration_ms > 0) agentStats[t.agent].avg = (agentStats[t.agent].avg + t.duration_ms / 1000) / 2;
                });
                return Object.entries(agentStats).sort((a, b) => {
                  const rateA = a[1].pass / (a[1].pass + a[1].fail);
                  const rateB = b[1].pass / (b[1].pass + b[1].fail);
                  return rateA - rateB;
                }).map(([agent, s]) => {
                  const total = s.pass + s.fail;
                  const rate = Math.round(s.pass / total * 100);
                  return (
                    <div key={agent} className="flex items-center gap-3">
                      <span className="w-32 text-xs text-slate-700 truncate">{agent.replace("agent-", "")}</span>
                      <div className="flex-1 bg-slate-100 rounded-full h-4 overflow-hidden">
                        <div className={`h-full rounded-full ${rate >= 90 ? "bg-green-500" : rate >= 70 ? "bg-yellow-500" : "bg-red-500"}`} style={{ width: `${rate}%` }} />
                      </div>
                      <span className="text-xs text-slate-500 w-16 text-right">{rate}% ({total})</span>
                      <span className="text-[10px] text-slate-400 w-12 text-right">{Math.round(s.avg)}s</span>
                    </div>
                  );
                });
              })()}
            </div>
          </div>

          {/* Recent test results */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden max-h-[400px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 sticky top-0">
                <tr className="text-slate-500 border-b border-slate-200">
                  <th className="text-left py-2 px-3">Hora</th>
                  <th className="text-left px-2">Agente</th>
                  <th className="text-left px-2">Prompt</th>
                  <th className="text-center px-2">Result</th>
                  <th className="text-right px-2">Tiempo</th>
                  <th className="text-left px-2">Razon</th>
                </tr>
              </thead>
              <tbody>
                {testResults.slice(0, 50).map(t => (
                  <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-1.5 px-3 text-slate-400 whitespace-nowrap">{new Date(t.created_at).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}</td>
                    <td className="px-2 font-medium text-slate-700">{t.agent?.replace("agent-", "")}</td>
                    <td className="px-2 text-slate-600 max-w-xs truncate">{t.prompt?.substring(0, 40)}</td>
                    <td className="px-2 text-center">{t.pass ? <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700">PASS</span> : <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700">FAIL</span>}</td>
                    <td className="px-2 text-right text-slate-400">{Math.round((t.duration_ms || 0) / 1000)}s</td>
                    <td className="px-2 text-slate-500 max-w-sm truncate">{t.reason?.substring(0, 60)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Embedded test dashboard */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-4 py-2 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Test Cluster — Vista Completa</h3>
              <a href="https://alfred-test-dashboard.vercel.app" target="_blank" className="text-[10px] text-blue-600 hover:underline">Abrir en nueva ventana</a>
            </div>
            <iframe src="https://alfred-test-dashboard.vercel.app" className="w-full h-[700px] border-0" />
          </div>
        </div>
      )}

      {/* Logs — one box per agent */}
      {tab === "logs" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Logs por Agente (ultimas 10 interacciones cada uno)</h2>
            <button onClick={loadAll} className="flex items-center gap-1 rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50">
              <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Refresh
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {Object.entries(agentLogs).sort((a, b) => a[0].localeCompare(b[0])).map(([agent, logs]) => {
              const isOnline = agentHealth.find(a => a.agent === agent)?.status === "online";
              return (
                <div key={agent} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                  {/* Agent header */}
                  <div className={`px-3 py-2 border-b flex items-center justify-between ${isOnline ? "bg-green-50 border-green-200" : "bg-slate-50 border-slate-200"}`}>
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${isOnline ? "bg-green-500" : "bg-slate-300"}`} />
                      <span className="text-xs font-bold text-slate-900">{agent.replace("agent-", "").replace("chat-ai", "Alfred Chat")}</span>
                    </div>
                    <span className="text-[10px] text-slate-400">{logs.length} logs</span>
                  </div>

                  {/* Log entries */}
                  <div className="max-h-48 overflow-y-auto">
                    {logs.map((log, i) => {
                      const time = new Date(log.created_at).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
                      const dur = Math.round((log.duration_ms || 0) / 1000);
                      const hasError = !!log.error;
                      const hasResp = log.response && log.response.length > 10;
                      return (
                        <div key={i} className={`px-3 py-1.5 border-b border-slate-50 text-[10px] ${hasError ? "bg-red-50" : ""}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-slate-400 font-mono">{time}</span>
                              <span className={`px-1 rounded ${log.channel === "whatsapp" ? "bg-green-100 text-green-700" : log.channel === "web" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}>{log.channel}</span>
                              {dur > 0 && <span className="text-slate-400">{dur}s</span>}
                              {hasError && <span className="text-red-500 font-bold">ERROR</span>}
                            </div>
                            {hasResp ? <CheckCircle className="h-3 w-3 text-green-500" /> : <XCircle className="h-3 w-3 text-red-400" />}
                          </div>
                          <p className="text-slate-600 truncate mt-0.5">Q: {log.prompt?.substring(0, 60)}</p>
                          {hasResp && <p className="text-slate-400 truncate">A: {log.response?.substring(0, 60)}</p>}
                        </div>
                      );
                    })}
                    {logs.length === 0 && (
                      <p className="px-3 py-4 text-[10px] text-slate-400 text-center">Sin actividad</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {Object.keys(agentLogs).length === 0 && (
            <p className="text-center py-8 text-sm text-slate-400">No hay logs disponibles. Los agentes aun no han procesado solicitudes.</p>
          )}
        </div>
      )}

      {tab === "system" && systemStats && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Router Uptime" value={`${Math.round(systemStats.router?.uptime / 60)}m`} icon={Activity} color="text-green-500" />
            <StatCard label="Memory" value={`${systemStats.router?.memory_mb}MB`} icon={Database} color="text-blue-500" />
            <StatCard label="Sessions" value={`${systemStats.router?.sessions?.active}/${systemStats.router?.sessions?.total}`} sub="activas/total" icon={Zap} color="text-purple-500" />
            <StatCard label="PC Bridges" value={systemStats.bridges?.connected || 0} icon={Power} color="text-cyan-500" />
          </div>

          {/* Controls */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">Controles</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <button
                onClick={() => fetch(`${ROUTER_URL}/health`).then(() => loadAll())}
                className="flex items-center justify-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
              >
                <RefreshCw className="h-3 w-3" /> Verificar Router
              </button>
              <button
                onClick={() => { fetch(`${ROUTER_URL}/monitor/agents`); loadAll(); }}
                className="flex items-center justify-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
              >
                <Bot className="h-3 w-3" /> Check Agentes
              </button>
              <button
                onClick={() => { /* trigger product refresh */ }}
                className="flex items-center justify-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
              >
                <Search className="h-3 w-3" /> Refresh Productos
              </button>
              <button
                onClick={() => { /* trigger skill discovery */ }}
                className="flex items-center justify-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
              >
                <TrendingUp className="h-3 w-3" /> Buscar Skills
              </button>
            </div>
          </div>

          {/* Supabase tables info */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Base de Datos</h3>
            <div className="grid grid-cols-3 gap-2 text-xs">
              {["profiles", "conversation_threads", "conversation_messages", "conversations", "agents", "agent_mcps", "connectors", "shopping_carts", "checkouts", "product_cache", "product_search_log", "artifacts", "skills_marketplace", "agent_tests"].map(table => (
                <div key={table} className="flex items-center gap-2 rounded border border-slate-100 px-2 py-1.5">
                  <Database className="h-3 w-3 text-slate-400" />
                  <span className="text-slate-600 font-mono truncate">{table}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
