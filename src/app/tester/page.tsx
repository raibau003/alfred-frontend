"use client";

import { useEffect, useState, useCallback } from "react";
import {
  RefreshCw, CheckCircle, XCircle, Clock, AlertTriangle,
  BarChart3, Bot, ShoppingCart, Loader2, Play, Square
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ROUTER_URL } from "@/lib/alfred/client";

interface TestRun {
  id: number;
  test_type: string;
  agent_name: string;
  prompt: string;
  actual_response: string | null;
  response_time_ms: number;
  status: string;
  error_detail: string | null;
  has_carousel: boolean;
  product_count: number;
  session_id: string | null;
  created_at: string;
}

interface TestSummary {
  agent_name: string;
  test_type: string;
  total_runs: number;
  passed: number;
  failed: number;
  timeouts: number;
  avg_response_ms: number;
  pass_rate: number;
  last_run_at: string;
}

type TabType = "agent" | "frontend";

export default function TesterDashboard() {
  const [tab, setTab] = useState<TabType>("agent");
  const [runs, setRuns] = useState<TestRun[]>([]);
  const [summaries, setSummaries] = useState<TestSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState("compras");
  const [running, setRunning] = useState(false);

  const supabase = createClient();

  const loadData = useCallback(async () => {
    setLoading(true);
    const [runsRes, summaryRes] = await Promise.all([
      supabase
        .from("test_runs")
        .select("*")
        .eq("test_type", tab)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("test_summary")
        .select("*")
        .eq("test_type", tab)
        .order("pass_rate", { ascending: true }),
    ]);
    if (runsRes.data) setRuns(runsRes.data);
    if (summaryRes.data) setSummaries(summaryRes.data);
    setLoading(false);
  }, [tab]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Run a single test from the dashboard
  const runSingleTest = async (prompt: string) => {
    setRunning(true);
    try {
      // Create session
      const sessionResp = await fetch(`${ROUTER_URL}/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ directory: "/home/agent/sandbox", title: `dashboard-test-${Date.now()}` }),
      });
      const sessionData = await sessionResp.json();
      const sid = sessionData?.id;
      if (!sid) { setRunning(false); return; }

      const startTime = Date.now();

      // Send prompt
      await fetch(`${ROUTER_URL}/session/${sid}/prompt_async`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ directory: "/home/agent/sandbox", parts: [{ type: "text", text: prompt }] }),
      });

      // Poll for response
      let response = "";
      let status = "unknown";
      for (let i = 0; i < 36; i++) {
        await new Promise(r => setTimeout(r, 5000));
        const msgResp = await fetch(`${ROUTER_URL}/session/${sid}/message`);
        const data = await msgResp.json();
        status = typeof data === "object" && !Array.isArray(data) ? data.status : "old";

        if (status === "done") {
          const msgs = data.messages || [];
          for (let j = msgs.length - 1; j >= 0; j--) {
            const m = msgs[j];
            if (m?.info?.role === "assistant") {
              for (const p of m.parts || []) {
                if (p.type === "text" && p.text.length > 20 && !p.text.endsWith("...") && !p.text.includes("% (~")) {
                  response = p.text;
                  break;
                }
              }
              if (response) break;
            }
          }
          break;
        }
      }

      const durationMs = Date.now() - startTime;
      const testStatus = status === "done" && response.length > 50 ? "pass" : status === "done" ? "fail" : "timeout";

      // Save to Supabase
      await supabase.from("test_runs").insert({
        test_type: "frontend",
        agent_name: selectedAgent,
        prompt,
        actual_response: response.substring(0, 2000),
        response_time_ms: durationMs,
        status: testStatus,
        session_id: sid,
        has_carousel: response.toLowerCase().includes("producto"),
        product_count: parseInt((response.match(/(\d+) productos/)?.[1]) || "0"),
      });

      loadData();
    } catch (err) {
      console.error(err);
    }
    setRunning(false);
  };

  const statusIcon = (s: string) => {
    switch (s) {
      case "pass": return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "fail": return <XCircle className="h-4 w-4 text-red-500" />;
      case "timeout": return <Clock className="h-4 w-4 text-yellow-500" />;
      default: return <AlertTriangle className="h-4 w-4 text-slate-400" />;
    }
  };

  const passRateColor = (rate: number) => {
    if (rate >= 98) return "text-green-600 bg-green-50";
    if (rate >= 80) return "text-yellow-600 bg-yellow-50";
    return "text-red-600 bg-red-50";
  };

  const quickTests: Record<string, string[]> = {
    compras: ["busca leche en los supers", "busca pan de molde", "busca aceite de oliva", "busca arroz", "busca cafe"],
    outlook: ["que reuniones tengo manana", "lee mis ultimos correos", "tengo correos sin leer"],
    chat: ["hola como estas", "que puedes hacer", "gracias"],
    nutricion: ["dame un plan de alimentacion para hoy", "cuantas calorias tiene un huevo"],
    servipag: ["cuanto debo de luz", "revisa mis cuentas de servicios"],
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Alfred Tester Dashboard</h1>
          <p className="text-sm text-slate-500">Monitoreo de pruebas E2E — agentes y frontend</p>
        </div>
        <button onClick={loadData} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-slate-50">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Actualizar
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b pb-2">
        <button
          onClick={() => setTab("agent")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg ${tab === "agent" ? "bg-[#0a1628] text-white" : "text-slate-500 hover:bg-slate-100"}`}
        >
          <Bot className="h-4 w-4" /> Tester Agent
        </button>
        <button
          onClick={() => setTab("frontend")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg ${tab === "frontend" ? "bg-[#0a1628] text-white" : "text-slate-500 hover:bg-slate-100"}`}
        >
          <ShoppingCart className="h-4 w-4" /> Tester Front
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {summaries.map((s) => (
          <div key={s.agent_name} className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500 uppercase">{s.agent_name}</span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${passRateColor(s.pass_rate)}`}>
                {s.pass_rate}%
              </span>
            </div>
            <div className="text-2xl font-bold text-slate-900">{s.passed}/{s.total_runs}</div>
            <div className="flex gap-3 mt-1 text-[10px] text-slate-400">
              <span>Avg: {Math.round(s.avg_response_ms / 1000)}s</span>
              <span>Fail: {s.failed}</span>
              <span>Timeout: {s.timeouts}</span>
            </div>
            <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-green-500 rounded-full" style={{ width: `${s.pass_rate}%` }} />
            </div>
          </div>
        ))}
        {summaries.length === 0 && !loading && (
          <div className="col-span-4 text-center text-slate-400 py-8">No hay datos de pruebas todavia</div>
        )}
      </div>

      {/* Quick Test Runner */}
      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Ejecutar Prueba Rapida</h3>
        <div className="flex gap-2 mb-3 flex-wrap">
          {Object.keys(quickTests).map((agent) => (
            <button
              key={agent}
              onClick={() => setSelectedAgent(agent)}
              className={`px-3 py-1 text-xs rounded-full ${selectedAgent === agent ? "bg-[#0a1628] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
            >
              {agent}
            </button>
          ))}
        </div>
        <div className="flex gap-2 flex-wrap">
          {(quickTests[selectedAgent] || []).map((prompt) => (
            <button
              key={prompt}
              onClick={() => !running && runSingleTest(prompt)}
              disabled={running}
              className="flex items-center gap-1 px-3 py-1.5 text-xs border rounded-lg hover:bg-slate-50 disabled:opacity-50"
            >
              {running ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
              {prompt.substring(0, 30)}
            </button>
          ))}
        </div>
      </div>

      {/* Recent Test Runs */}
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">Ultimas Pruebas ({runs.length})</h3>
          <BarChart3 className="h-4 w-4 text-slate-400" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left text-slate-500">Status</th>
                <th className="px-3 py-2 text-left text-slate-500">Agente</th>
                <th className="px-3 py-2 text-left text-slate-500">Prompt</th>
                <th className="px-3 py-2 text-left text-slate-500">Respuesta</th>
                <th className="px-3 py-2 text-left text-slate-500">Tiempo</th>
                <th className="px-3 py-2 text-left text-slate-500">Productos</th>
                <th className="px-3 py-2 text-left text-slate-500">Hora</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {runs.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2">{statusIcon(r.status)}</td>
                  <td className="px-3 py-2 font-medium text-slate-700">{r.agent_name}</td>
                  <td className="px-3 py-2 text-slate-600 max-w-[200px] truncate">{r.prompt}</td>
                  <td className="px-3 py-2 text-slate-500 max-w-[300px] truncate">
                    {r.status === "pass" ? (r.actual_response || "").substring(0, 80) : r.error_detail || r.status}
                  </td>
                  <td className="px-3 py-2 text-slate-500">{Math.round(r.response_time_ms / 1000)}s</td>
                  <td className="px-3 py-2 text-slate-500">{r.product_count > 0 ? r.product_count : "-"}</td>
                  <td className="px-3 py-2 text-slate-400">{new Date(r.created_at).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
