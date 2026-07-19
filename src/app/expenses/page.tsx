"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Receipt, Download, Loader2, Mail, Globe, Key, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { ROUTER_URL } from "@/lib/alfred/client";

interface ExpenseService {
  name: string;
  type: "api" | "web" | "correo";
  url?: string;
  search?: string;
  token_key?: string;
}

const typeIcons = { api: Key, web: Globe, correo: Mail };
const typeLabels = { api: "API/Token", web: "Portal Web", correo: "Busca en correo" };

export default function ExpensesPage() {
  const { user } = useAuth();
  const [services, setServices] = useState<ExpenseService[]>([]);
  const [connectorId, setConnectorId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newService, setNewService] = useState<ExpenseService>({ name: "", type: "api", url: "" });
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [period, setPeriod] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    supabase
      .from("connectors")
      .select("*")
      .eq("user_id", user.id)
      .eq("agent_id", "agent-gastos")
      .single()
      .then(({ data }) => {
        if (data) {
          setConnectorId(data.id);
          setServices((data.config as any)?.servicios || []);
        }
      });
  }, [user]);

  const saveServices = async (updated: ExpenseService[]) => {
    setServices(updated);
    if (!connectorId) return;
    const supabase = createClient();
    await supabase.from("connectors").update({ config: { servicios: updated } }).eq("id", connectorId);
  };

  const addService = () => {
    if (!newService.name) return;
    saveServices([...services, newService]);
    setNewService({ name: "", type: "api", url: "" });
    setShowAdd(false);
  };

  const removeService = (idx: number) => {
    saveServices(services.filter((_, i) => i !== idx));
  };

  const generateReport = async () => {
    setGenerating(true);
    setResult(null);
    try {
      // Create session and ask the agent
      const sessionResp = await fetch(`${ROUTER_URL}/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Web expense", user_id: user?.id }),
      });
      const session = await sessionResp.json();

      const serviceNames = services.map(s => s.name).join(", ");
      await fetch(`${ROUTER_URL}/session/${session.id}/prompt_async`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          directory: "/home/agent/sandbox",
          parts: [{ type: "text", text: `Genera la rendicion de gastos del periodo ${period}. Servicios a revisar: ${serviceNames}. Busca facturas en APIs, correo Outlook y portales web. Al final genera un resumen con totales por tarjeta y por servicio.` }],
        }),
      });

      // Poll for response
      for (let i = 0; i < 120; i++) {
        await new Promise(r => setTimeout(r, 5000));
        const msgResp = await fetch(`${ROUTER_URL}/session/${session.id}/message?directory=/home/agent/sandbox`);
        const msgs = await msgResp.json();
        if (!Array.isArray(msgs)) continue;

        const assistantMsgs = msgs.filter((m: any) => (m.role || m.info?.role) === "assistant");
        for (const msg of assistantMsgs) {
          for (const p of (msg.parts || [])) {
            if (p.type === "text" && p.text && p.text.length > 50 && !p.text.endsWith("...")) {
              setResult(p.text);
              setGenerating(false);
              return;
            }
          }
        }
      }
      setResult("Timeout — el agente no pudo completar la rendicion. Intenta de nuevo.");
    } catch (e) {
      setResult("Error generando el reporte.");
    }
    setGenerating(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Rendicion de Gastos</h1>
          <p className="mt-1 text-sm text-slate-400">Extrae facturas de tus servicios y genera Excel</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            onClick={generateReport}
            disabled={generating || services.length === 0}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Receipt className="h-4 w-4" />}
            {generating ? "Generando..." : "Generar rendicion"}
          </button>
        </div>
      </div>

      {/* Services list */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Servicios a rendir ({services.length})</h2>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700"
          >
            <Plus className="h-3 w-3" />
            Agregar servicio
          </button>
        </div>

        {showAdd && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Nombre</label>
                <input
                  value={newService.name}
                  onChange={(e) => setNewService({ ...newService, name: e.target.value })}
                  className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs"
                  placeholder="ej: Google Cloud"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Tipo</label>
                <select
                  value={newService.type}
                  onChange={(e) => setNewService({ ...newService, type: e.target.value as any })}
                  className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs"
                >
                  <option value="api">API/Token</option>
                  <option value="web">Portal Web</option>
                  <option value="correo">Buscar en correo</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  {newService.type === "correo" ? "Buscar por" : "URL"}
                </label>
                <input
                  value={newService.type === "correo" ? (newService.search || "") : (newService.url || "")}
                  onChange={(e) => {
                    if (newService.type === "correo") setNewService({ ...newService, search: e.target.value });
                    else setNewService({ ...newService, url: e.target.value });
                  }}
                  className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs"
                  placeholder={newService.type === "correo" ? "recibo google cloud" : "https://..."}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={addService} className="rounded-md bg-blue-600 px-3 py-1 text-xs text-white">Agregar</button>
              <button onClick={() => setShowAdd(false)} className="rounded-md border border-slate-300 px-3 py-1 text-xs text-slate-600">Cancelar</button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {services.map((s, i) => {
            const Icon = typeIcons[s.type];
            return (
              <div key={i} className="flex items-center justify-between rounded-lg border border-slate-200 p-3 hover:bg-slate-50">
                <div className="flex items-center gap-3">
                  <Icon className="h-4 w-4 text-slate-400" />
                  <div>
                    <p className="text-sm font-medium text-slate-900">{s.name}</p>
                    <p className="text-[10px] text-slate-400">
                      {typeLabels[s.type]}
                      {s.url && <> &middot; <span className="font-mono">{s.url.substring(0, 40)}</span></>}
                      {s.search && <> &middot; Busca: &ldquo;{s.search}&rdquo;</>}
                    </p>
                  </div>
                </div>
                <button onClick={() => removeService(i)} className="text-slate-300 hover:text-red-500">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}
          {services.length === 0 && (
            <p className="py-4 text-center text-xs text-slate-400">Agrega servicios para empezar a rendir gastos</p>
          )}
        </div>
      </div>

      {/* Result */}
      {result && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-green-900">Resultado — {period}</h2>
            <button className="flex items-center gap-1 rounded-md bg-green-600 px-3 py-1.5 text-xs text-white hover:bg-green-700">
              <Download className="h-3 w-3" /> Descargar Excel
            </button>
          </div>
          <pre className="text-xs text-green-800 whitespace-pre-wrap font-mono bg-green-100 rounded-lg p-4 max-h-96 overflow-y-auto">
            {result}
          </pre>
        </div>
      )}
    </div>
  );
}
