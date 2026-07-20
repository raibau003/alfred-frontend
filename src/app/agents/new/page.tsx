"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, Loader2, Check, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";

interface AgentProposal {
  name: string;
  description: string;
  category: string;
  connectors: string[];
  schedule?: string;
}

export default function NewAgentPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [prompt, setPrompt] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [proposal, setProposal] = useState<AgentProposal | null>(null);
  const [creating, setCreating] = useState(false);

  const analyzePrompt = async () => {
    if (!prompt.trim()) return;
    setAnalyzing(true);

    try {
      // Use Groq to analyze the user's request and propose agent config
      const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_GROQ_API_KEY || ""}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [
            {
              role: "system",
              content: `Eres un asistente que analiza peticiones de usuarios para crear agentes de IA.
Dado lo que el usuario quiere, genera un JSON con:
- name: nombre corto del agente (2-3 palabras)
- description: descripcion de lo que hace (1 oracion)
- category: una de: finanzas, correo, hogar, compras, bienestar, trabajo, educacion
- connectors: array de conectores que necesita (ej: ["API REST", "Web Scraping"])
- schedule: si necesita ejecutarse periodicamente, con que frecuencia (ej: "cada hora", "diario", null)

Responde SOLO el JSON, nada mas.`,
            },
            { role: "user", content: prompt },
          ],
          max_tokens: 300,
          temperature: 0,
        }),
      });

      const data = await resp.json();
      const text = data.choices?.[0]?.message?.content?.trim() || "";
      const parsed = JSON.parse(text);
      setProposal(parsed);
      setStep(2);
    } catch {
      // Fallback proposal
      setProposal({
        name: "Agente Custom",
        description: prompt.substring(0, 100),
        category: "trabajo",
        connectors: ["API REST"],
      });
      setStep(2);
    }

    setAnalyzing(false);
  };

  const createAgent = async () => {
    if (!user || !proposal) return;
    setCreating(true);

    const supabase = createClient();
    const agentId = `agent-custom-${Date.now().toString(36)}`;

    await supabase.from("agents").insert({
      id: agentId,
      name: proposal.name,
      description: proposal.description,
      category: proposal.category,
      enabled: true,
      is_custom: true,
      created_by: user.id,
      config: { prompt, connectors: proposal.connectors, schedule: proposal.schedule },
    });

    setStep(3);
    setCreating(false);

    // Redirect to agents page after 2s
    setTimeout(() => router.push("/agents"), 2000);
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Crear nuevo agente</h1>
        <p className="mt-1 text-sm text-slate-400">Describe lo que quieres y Alfred lo crea</p>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                s < step ? "bg-green-500 text-white" : s === step ? "bg-[#0a1628] text-white" : "bg-slate-200 text-slate-400"
              }`}
            >
              {s < step ? <Check className="h-3.5 w-3.5" /> : s}
            </div>
            {s < 3 && <div className={`h-0.5 w-8 ${s < step ? "bg-green-500" : "bg-slate-200"}`} />}
          </div>
        ))}
        <span className="ml-2 text-xs text-slate-400">
          {step === 1 ? "Describe" : step === 2 ? "Revisa" : "Creado!"}
        </span>
      </div>

      {/* Step 1: Describe */}
      {step === 1 && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <div className="flex items-center gap-3">
            <Bot className="h-8 w-8 text-[#0a1628]" />
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Que quieres que haga?</h2>
              <p className="text-xs text-slate-400">Describe en lenguaje natural</p>
            </div>
          </div>

          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm focus:border-[#0a1628] focus:outline-none focus:ring-1 focus:ring-[#0a1628]"
            rows={4}
            placeholder='Ej: "Quiero un agente que monitoree el precio de Bitcoin y me avise si baja de 50,000 USD"'
          />

          <div className="flex flex-wrap gap-2">
            {[
              "Monitorear precios de acciones",
              "Revisar ofertas de vuelos a Cancun",
              "Buscar arriendos en Las Condes",
              "Seguir noticias de tecnologia",
            ].map((ex) => (
              <button
                key={ex}
                onClick={() => setPrompt(ex)}
                className="rounded-full border border-slate-200 px-3 py-1 text-[10px] text-slate-500 hover:bg-slate-50"
              >
                {ex}
              </button>
            ))}
          </div>

          <button
            onClick={analyzePrompt}
            disabled={!prompt.trim() || analyzing}
            className="flex items-center gap-2 rounded-lg bg-[#0a1628] px-4 py-2 text-sm font-medium text-white hover:bg-[#1e3a5f] disabled:opacity-50"
          >
            {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            {analyzing ? "Analizando..." : "Siguiente"}
          </button>
        </div>
      )}

      {/* Step 2: Review proposal */}
      {step === 2 && proposal && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900">Propuesta de Alfred</h2>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Nombre</label>
              <input
                value={proposal.name}
                onChange={(e) => setProposal({ ...proposal, name: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Descripcion</label>
              <input
                value={proposal.description}
                onChange={(e) => setProposal({ ...proposal, description: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Categoria</label>
              <select
                value={proposal.category}
                onChange={(e) => setProposal({ ...proposal, category: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                {["finanzas", "correo", "hogar", "compras", "bienestar", "trabajo", "educacion"].map((c) => (
                  <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Conectores necesarios</label>
              <div className="flex flex-wrap gap-1">
                {proposal.connectors.map((c, i) => (
                  <span key={i} className="rounded-full bg-[#0a1628]/5 px-2 py-0.5 text-xs text-[#0a1628] border border-[#0a1628]/20">
                    {c}
                  </span>
                ))}
              </div>
            </div>
            {proposal.schedule && (
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Frecuencia</label>
                <span className="text-sm text-slate-700">{proposal.schedule}</span>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={createAgent}
              disabled={creating}
              className="flex items-center gap-2 rounded-lg bg-[#0a1628] px-4 py-2 text-sm font-medium text-white hover:bg-[#1e3a5f] disabled:opacity-50"
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {creating ? "Creando..." : "Crear agente"}
            </button>
            <button
              onClick={() => setStep(1)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              Volver
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Created */}
      {step === 3 && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center space-y-3">
          <div className="flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500">
              <Check className="h-6 w-6 text-white" />
            </div>
          </div>
          <h2 className="text-sm font-semibold text-green-900">Agente creado!</h2>
          <p className="text-xs text-green-700">
            {proposal?.name} esta listo. Redirigiendo a la lista de agentes...
          </p>
        </div>
      )}
    </div>
  );
}
