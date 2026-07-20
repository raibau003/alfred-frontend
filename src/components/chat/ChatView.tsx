"use client";

import { useRef, useEffect, useState } from "react";
import { Send, PanelLeftOpen, Plus } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatMessage } from "@/hooks/useAlfred";
import { ProductCards } from "./rich/ProductCards";
import { ActionButtons } from "./rich/ActionButtons";
import { ComparisonTable } from "./rich/ComparisonTable";
import { CartView } from "./rich/CartView";
import { StoreComparison } from "./rich/StoreComparison";
import { BridgePrompt } from "./rich/BridgePrompt";

interface Props {
  messages: ChatMessage[];
  busy: boolean;
  connected: boolean;
  onSend: (text: string) => void;
  userName: string;
  onToggleThreads?: () => void;
  showThreadsButton?: boolean;
  shoppingMode?: boolean;
}

export function ChatView({ messages, busy, connected, onSend, userName, onToggleThreads, showThreadsButton, shoppingMode }: Props) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = () => {
    const text = input.trim();
    if (!text || busy) return;
    onSend(text);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
  };

  return (
    <div className="flex flex-1 flex-col bg-white h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5 shrink-0">
        <div className="flex items-center gap-2">
          {showThreadsButton && (
            <button
              onClick={onToggleThreads}
              className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-slate-100 text-slate-400 transition-colors"
              title="Ver conversaciones"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>
          )}
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#0a1628]">
              <span className="text-[10px] font-bold text-white">A</span>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Alfred</h2>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => onSend("")}
            className="flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[10px] text-slate-500 hover:bg-slate-50"
            title="Nueva conversacion"
          >
            <Plus className="h-3 w-3" />
            Nuevo chat
          </button>
          <div className="flex items-center gap-1.5 text-xs">
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${connected ? "bg-green-500" : "bg-slate-300"}`} />
            <span className="text-slate-400">{connected ? "Online" : "Offline"}</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {messages.length === 0 && !busy && (
          <div className="flex flex-col items-center justify-center h-full text-center px-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#0a1628] mb-4">
              <span className="text-2xl text-white font-bold">A</span>
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-1">Hola {userName}!</h3>
            <p className="text-sm text-slate-500 max-w-md mb-6">
              Soy Alfred, tu asistente personal. Preguntame lo que necesites.
            </p>
            <div className="grid grid-cols-2 gap-2 max-w-lg w-full">
              {(shoppingMode ? [
                { q: "Busca leche en los supermercados", icon: "🥛" },
                { q: "Arma lista para un asado de 8 personas", icon: "🥩" },
                { q: "Busca aceite de oliva y compara precios", icon: "🫒" },
                { q: "Que necesito comprar para la semana?", icon: "📋" },
                { q: "Busca detergente y papel higienico", icon: "🧹" },
                { q: "Donde esta mas barato el cafe?", icon: "☕" },
              ] : [
                { q: "Que reuniones tengo manana?", icon: "📅" },
                { q: "Cuanto debo de luz?", icon: "💡" },
                { q: "Busca leche en los supers", icon: "🛒" },
                { q: "Que ejercicio hago hoy?", icon: "💪" },
                { q: "Busca vuelos a Buenos Aires", icon: "✈️" },
                { q: "Rinde mis gastos de julio", icon: "🧾" },
              ]).map(({ q, icon }) => (
                <button
                  key={q}
                  onClick={() => onSend(q)}
                  className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-left text-sm text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors"
                >
                  <span>{icon}</span>
                  <span>{q}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="max-w-3xl mx-auto px-4 py-4 space-y-4">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] ${msg.role === "user" ? "" : ""}`}>
                {/* Agent badge */}
                {msg.agent && msg.role === "assistant" && (
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className="h-4 w-4 rounded bg-blue-100 flex items-center justify-center">
                      <span className="text-[8px] font-bold text-blue-600">
                        {msg.agent.replace("agent-", "").charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <span className="text-[10px] font-medium text-blue-600">
                      {msg.agent.replace("agent-", "").replace("chat-ai", "Alfred")}
                    </span>
                  </div>
                )}

                <div
                  className={`rounded-2xl px-4 py-2.5 text-sm ${
                    msg.role === "user"
                      ? "bg-[#0a1628] text-white"
                      : "bg-slate-100 text-slate-900"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm prose-slate max-w-none [&_table]:text-xs [&_th]:px-2 [&_td]:px-2 [&_h2]:text-sm [&_h3]:text-sm [&_p]:my-1">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  )}
                </div>

                {/* Rich content */}
                {msg.rich && msg.role === "assistant" && (
                  <>
                    {msg.rich.type === "product_list" && msg.rich.products && (
                      <ProductCards products={msg.rich.products} onAction={onSend} />
                    )}
                    {msg.rich.type === "comparison" && msg.rich.comparisons && (
                      <ComparisonTable product={msg.rich.product || ""} comparisons={msg.rich.comparisons} onAction={onSend} />
                    )}
                    {msg.rich.type === "cart" && msg.rich.items && (
                      <CartView items={msg.rich.items} onAction={onSend} />
                    )}
                    {msg.rich.type === "store_comparison" && msg.rich.stores && (
                      <StoreComparison stores={msg.rich.stores} onAction={onSend} />
                    )}
                    {msg.rich.type === "bridge_prompt" && (
                      <BridgePrompt store={msg.rich.store || ""} checkoutUrl={msg.rich.checkout_url} onAction={onSend} />
                    )}
                    {msg.rich.type === "action_buttons" && msg.rich.actions && (
                      <ActionButtons actions={msg.rich.actions} onAction={onSend} />
                    )}
                  </>
                )}

                <span className="text-[9px] text-slate-300 mt-0.5 block px-1">
                  {msg.timestamp.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            </div>
          ))}

          {busy && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-slate-100 px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="h-2 w-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="h-2 w-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-slate-200 p-3 shrink-0">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-end gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-2 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 shadow-sm">
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Escribe tu mensaje..."
              rows={1}
              className="flex-1 resize-none bg-transparent text-sm text-slate-900 placeholder-slate-400 focus:outline-none"
              style={{ maxHeight: "120px" }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || busy || !connected}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#0a1628] text-white hover:bg-slate-800 disabled:opacity-30 transition-colors"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          <p className="text-center text-[9px] text-slate-300 mt-1.5">Alfred puede cometer errores. Verifica la informacion importante.</p>
        </div>
      </div>
    </div>
  );
}
