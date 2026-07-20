"use client";

import { useState, useEffect } from "react";
import { X, MessageSquare, Bot, Settings, Zap, ShoppingCart } from "lucide-react";

const steps = [
  { icon: MessageSquare, title: "Chatea con Alfred", desc: "Preguntale lo que necesites — desde reuniones hasta compras del super." },
  { icon: Bot, title: "Agentes especializados", desc: "Cada agente es experto en un area: correo, finanzas, nutricion, compras..." },
  { icon: ShoppingCart, title: "Compras inteligentes", desc: "Busca productos, compara precios y arma tu carro en los supermercados." },
  { icon: Settings, title: "Conecta tus canales", desc: "WhatsApp, Telegram y PC Bridge — habla con Alfred desde cualquier lugar." },
  { icon: Zap, title: "Alfred aprende", desc: "Mientras mas lo usas, mejor te conoce. Recuerda tus preferencias y datos." },
];

export function Onboarding() {
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const seen = localStorage.getItem("alfred_onboarding_done");
    if (!seen) setShow(true);
  }, []);

  const finish = () => {
    localStorage.setItem("alfred_onboarding_done", "1");
    setShow(false);
  };

  if (!show) return null;

  const StepIcon = steps[step].icon;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-slate-400">Paso {step + 1} de {steps.length}</span>
          <button onClick={finish} className="text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex flex-col items-center text-center space-y-3 py-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#0a1628]">
            <StepIcon className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">{steps[step].title}</h2>
          <p className="text-sm text-slate-500 max-w-xs">{steps[step].desc}</p>
        </div>

        {/* Progress dots */}
        <div className="flex justify-center gap-1.5">
          {steps.map((_, i) => (
            <div key={i} className={`h-1.5 rounded-full transition-all ${i === step ? "w-6 bg-[#e8864a]" : "w-1.5 bg-slate-200"}`} />
          ))}
        </div>

        <div className="flex gap-2">
          {step > 0 && (
            <button onClick={() => setStep(s => s - 1)} className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm text-slate-600 hover:bg-slate-50">
              Atras
            </button>
          )}
          <button
            onClick={() => step < steps.length - 1 ? setStep(s => s + 1) : finish()}
            className="flex-1 rounded-lg bg-[#0a1628] py-2.5 text-sm font-medium text-white hover:bg-[#1e3a5f]"
          >
            {step < steps.length - 1 ? "Siguiente" : "Empezar!"}
          </button>
        </div>
      </div>
    </div>
  );
}
