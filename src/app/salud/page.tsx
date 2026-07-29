"use client";

import { useState } from "react";
import { useAlfred } from "@/hooks/useAlfred";
import { useAuth } from "@/components/auth/AuthProvider";
import { ChatView } from "@/components/chat/ChatView";
import { HogarPanel } from "@/components/salud/HogarPanel";
import { PlanEntrenamiento } from "@/components/salud/PlanEntrenamiento";
import { PlanAlimentacion } from "@/components/salud/PlanAlimentacion";
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

// Dentro de "La semana" conviven las dos mitades del plan. Pedido de Javier: "que lo que
// hace la nutricionista quede también en la semana, con una pestaña de deporte y otra de
// alimentación, así puedo ver qué tengo que comer".
//
// Van como sub-pestañas y no como dos pestañas más arriba porque son la MISMA pregunta
// —qué me toca esta semana— vista de dos lados. Arriba, "Deporte" y "Nutrición" son los
// dos chats; acá abajo, las dos tablas.
const VISTAS = [
  { k: "entrenamiento", t: "Deporte", icon: Dumbbell },
  { k: "alimentacion", t: "Alimentación", icon: Salad },
] as const;

type Vista = typeof VISTAS[number]["k"];

export default function SaludPage() {
  const { user } = useAuth();
  // DOS conversaciones separadas, una por asesor. Compartían una sola: al abrir Nutrición
  // aparecía todo lo hablado con el coach —planes de entrenamiento incluidos— y el
  // nutricionista parecía estar contestando cosas de deporte. Son dos asesores distintos y
  // cada uno tiene que tener su propio hilo.
  // La clave separa las conversaciones EN EL ROUTER, no solo en pantalla: el historial se
  // hereda por chat, así que con la misma clave el nutricionista recibía lo del coach.
  const coach = useAlfred(undefined, "salud-coach");
  const nutricionista = useAlfred(undefined, "salud-nutricion");
  const [tab, setTab] = useState<Tab>("deporte");
  const [vista, setVista] = useState<Vista>("entrenamiento");
  const alfred = tab === "nutricion" ? nutricionista : coach;

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
          {tab === "plan" ? (
            <>
              <div className="flex items-center gap-1 border-b border-slate-100 bg-slate-50 px-4 py-2">
                {VISTAS.map(({ k, t, icon: Icon }) => (
                  <button
                    key={k}
                    onClick={() => setVista(k)}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
                      vista === k ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:bg-white/60"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" /> {t}
                  </button>
                ))}
              </div>
              {vista === "entrenamiento"
                ? <PlanEntrenamiento />
                : <PlanAlimentacion onHablar={() => setTab("nutricion")} chat={nutricionista} />}
            </>
          ) : (
            <HogarPanel />
          )}
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
              sugerencias={tab === "deporte"
                ? ["¿Qué toca hoy?", "Ya entrené", "Ajustá el plan"]
                : ["Armá mi pauta", "¿Qué como hoy?", "Cambiá una comida"]}
            />
          </div>
        </div>
      )}
    </div>
  );
}
