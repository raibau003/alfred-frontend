"use client";

import { useState } from "react";
import { useAlfred } from "@/hooks/useAlfred";
import { useAuth } from "@/components/auth/AuthProvider";
import { ChatView } from "@/components/chat/ChatView";
import { HogarPanel } from "@/components/salud/HogarPanel";
import { PlanEntrenamiento } from "@/components/salud/PlanEntrenamiento";
import { Dumbbell, Salad, Users, Table2 } from "lucide-react";

// El orden de las pestañas NO es decorativo: el coach va primero porque define el gasto
// calórico, y el nutricionista lo usa para armar la pauta. Ver el plan en
// PLAN_SALUD_COMPRAS.md — la cadena es coach → plan → pauta → menú → lista de compras.
//
// "La semana" va segunda y no escondida en un modal: es la tabla que se consulta seguido y
// donde se elige qué plan alimenta la nutrición. Una función que vive detrás de un ícono sin
// nombre es una función que nadie encuentra.
const TABS = [
  { k: "deporte", t: "Deporte", icon: Dumbbell, hint: "hablá con el coach" },
  { k: "plan", t: "La semana", icon: Table2, hint: "la tabla del entrenamiento y sus alternativas" },
  { k: "nutricion", t: "Nutrición", icon: Salad, hint: "usa el plan elegido para tu pauta" },
  { k: "hogar", t: "Hogar", icon: Users, hint: "quiénes comen y qué no pueden comer" },
] as const;

type Tab = typeof TABS[number]["k"];

export default function SaludPage() {
  const { user } = useAuth();
  const alfred = useAlfred();
  const [tab, setTab] = useState<Tab>("deporte");

  const esChat = tab === "deporte" || tab === "nutricion";

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col">
      <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-200 bg-white px-4 py-2">
        <span className="mr-3 shrink-0 text-sm font-semibold text-slate-800">Salud</span>
        {TABS.map(({ k, t, icon: Icon, hint }) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            title={hint}
            className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === k ? "bg-[#0a1628] text-white" : "text-slate-500 hover:bg-slate-100"
            }`}
          >
            <Icon className="h-3.5 w-3.5" /> {t}
          </button>
        ))}
      </div>

      {!esChat ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          {tab === "plan" ? <PlanEntrenamiento /> : <HogarPanel />}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          {/* Una línea que explica qué hace cada agente: sin esto, dos chats idénticos
              confunden más que ayudar. */}
          <p className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs text-slate-500">
            {tab === "deporte"
              ? "Hablá con el coach: plan semanal, qué toca hoy, registrar que entrenaste. Lo que entrenás define cuántas calorías necesitás."
              : "Hablá con el nutricionista: usa tu gasto del coach y las restricciones del hogar para armar tu pauta y el menú."}
          </p>
          <div className="min-h-0 flex-1">
            <ChatView
              messages={alfred.messages}
              busy={alfred.busy}
              connected={alfred.connected}
              onSend={(t) =>
                // Se prefija el dominio para que el router elija el agente correcto sin
                // que el usuario tenga que decir "coach" o "nutricionista" cada vez.
                alfred.send(tab === "deporte" ? `[coach] ${t}` : `[nutricion] ${t}`)
              }
              userName={user?.email?.split("@")[0] ?? "Usuario"}
              onNewThread={() => alfred.newThread()}
              showCart={false}
              // La pesa del encabezado abre la tabla acá mismo en vez de mandar a una
              // planilla afuera: el plan de la semana es parte de la app, no un adjunto.
              onTrainings={() => setTab("plan")}
            />
          </div>
        </div>
      )}
    </div>
  );
}
