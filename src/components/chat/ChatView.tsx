"use client";

import { useRef, useEffect, useState } from "react";
import { Send, PanelLeftOpen, Plus, Square, Copy, Check, Share2, ThumbsUp, ThumbsDown, Mic, Paperclip, Search } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatMessage } from "@/hooks/useAlfred";
import { ProductCards } from "./rich/ProductCards";
import { ProductCarousel } from "./rich/ProductCarousel";
import { ActionButtons } from "./rich/ActionButtons";
import { ComparisonTable } from "./rich/ComparisonTable";
import { CartView } from "./rich/CartView";
import { ShoppingCart } from "./rich/ShoppingCart";
import { ShoppingCart as ShoppingCartIcon, X as XIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { StoreComparison } from "./rich/StoreComparison";
import { BridgePrompt } from "./rich/BridgePrompt";

interface Props {
  messages: ChatMessage[];
  busy: boolean;
  connected: boolean;
  onSend: (text: string) => void;
  onStop?: () => void;
  userName: string;
  onToggleThreads?: () => void;
  showThreadsButton?: boolean;
  shoppingMode?: boolean;
}

// Extracts search terms from user message (split by commas, "y", newlines)
function extractSearchTerms(text: string): string[] {
  const cleaned = text
    .replace(/^(busca|buscar|necesito|quiero|comprar|compra|precio|precios|comparar|compara|cotizar|cotiza|dame|encuentra|busqueda de|todo esto|esto)\s*/gi, "")
    .replace(/\s+(en los supers|en supermercados|en el super|en el lider|en jumbo|en unimarc|en tottus|en santa isabel)\s*/gi, "")
    .replace(/\s*(arma|deja|dejalo|listo|computador|carro|carrito|lista).*$/gi, "")
    .trim();
  const terms = cleaned
    .split(/\s+y\s+|,\s*|\s*\+\s*|\n+/i)
    .map((t) => t.trim())
    .filter((t) => t.length > 2);
  return terms;
}

// Groups products by which search term they best match
function groupProductsBySearchTerm(
  products: any[],
  searchTerms: string[]
): { term: string; products: any[] }[] {
  if (searchTerms.length <= 1) return [{ term: "", products }];

  const groups: Record<string, any[]> = {};
  const unmatched: any[] = [];

  for (const term of searchTerms) {
    groups[term] = [];
  }

  for (const product of products) {
    const pName = (product.name || "").toLowerCase();
    let bestTerm = "";
    let bestScore = 0;
    for (const term of searchTerms) {
      const tLower = term.toLowerCase();
      // Check if any word in the search term appears in the product name
      const words = tLower.split(/\s+/);
      let score = 0;
      for (const w of words) {
        if (w.length > 2 && pName.includes(w)) score += w.length;
      }
      if (score > bestScore) {
        bestScore = score;
        bestTerm = term;
      }
    }
    if (bestTerm && bestScore > 0) {
      groups[bestTerm].push(product);
    } else {
      unmatched.push(product);
    }
  }

  const result = searchTerms
    .filter((t) => groups[t].length > 0)
    .map((t) => ({ term: t, products: groups[t] }));

  if (unmatched.length > 0) {
    result.push({ term: "Otros", products: unmatched });
  }
  return result;
}

export function ChatView({ messages, busy, connected, onSend, onStop, userName, onToggleThreads, showThreadsButton, shoppingMode }: Props) {
  const [input, setInput] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [reactions, setReactions] = useState<Record<string, "up" | "down">>({});
  const [cartOpen, setCartOpen] = useState(false);
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [cartLoading, setCartLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { user } = useAuth();

  // Show a temporary toast notification
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  // Load cart from Supabase
  const loadCart = async () => {
    if (!user?.id) return;
    setCartLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("shopping_list")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    setCartItems(data || []);
    setCartLoading(false);
  };

  // Add product to cart directly via Supabase (no round-trip through Router)
  const addToCartDirect = async (product: { name: string; price: number; store: string }, quantity: number) => {
    if (!user?.id) return;
    const supabase = createClient();
    await supabase.from("shopping_list").insert({
      user_id: user.id,
      channel: "web",
      product_name: product.name,
      price: product.price,
      store: product.store,
      quantity,
      status: "pending",
    });
    showToast(`${quantity}x ${product.name} agregado al carro`);
    // Refresh cart count in header
    loadCart();
  };

  // Reload cart when messages change (might have added items)
  useEffect(() => {
    if (cartOpen) loadCart();
  }, [messages.length, cartOpen]);

  // Always load cart count on mount to show badge
  useEffect(() => {
    loadCart();
  }, [user?.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleReaction = (id: string, type: "up" | "down") => {
    setReactions(prev => prev[id] === type ? { ...prev, [id]: undefined as any } : { ...prev, [id]: type });
  };

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
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
            onClick={() => { setCartOpen(!cartOpen); if (!cartOpen) loadCart(); }}
            className={`relative flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] transition-colors ${cartOpen ? "border-[#e8864a] bg-[#e8864a]/10 text-[#e8864a]" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}
            title="Carro de compras"
          >
            <ShoppingCartIcon className="h-3.5 w-3.5" />
            {cartItems.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#e8864a] text-[8px] font-bold text-white">{cartItems.length}</span>
            )}
          </button>
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

      {/* Cart panel */}
      {cartOpen && (
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 max-h-[40vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <ShoppingCartIcon className="h-4 w-4 text-[#e8864a]" />
              Carro de Compras ({cartItems.length})
            </h3>
            <button onClick={() => setCartOpen(false)} className="text-slate-400 hover:text-slate-600">
              <XIcon className="h-4 w-4" />
            </button>
          </div>
          {cartLoading ? (
            <p className="text-xs text-slate-400">Cargando...</p>
          ) : cartItems.length === 0 ? (
            <p className="text-xs text-slate-400">Tu carro esta vacio. Busca productos y haz click en "Agregar".</p>
          ) : (
            <>
              <ShoppingCart
                items={cartItems.map(i => ({ name: i.product_name, price: i.price, store: i.store, quantity: i.quantity || 1 }))}
                onAction={onSend}
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={async () => {
                    const supabase = createClient();
                    await supabase.from("shopping_list").delete().eq("user_id", user?.id).eq("status", "pending");
                    setCartItems([]);
                  }}
                  className="px-3 py-1 text-[10px] text-red-500 border border-red-200 rounded-lg hover:bg-red-50"
                >
                  Vaciar carro
                </button>
              </div>
            </>
          )}
        </div>
      )}

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
                      <span className="text-[8px] font-bold text-[#0a1628]">
                        {msg.agent.replace("agent-", "").charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <span className="text-[10px] font-medium text-[#0a1628]">
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
                    <div>
                      {/* Progress bar if message has percentage */}
                      {(() => {
                        const pctMatch = msg.content.match(/(\d+)%/);
                        const timeMatch = msg.content.match(/~(\d+)s/);
                        if (pctMatch) {
                          const pct = parseInt(pctMatch[1]);
                          const timeLeft = timeMatch ? parseInt(timeMatch[1]) : null;
                          const label = msg.content.split("—")[0].trim();
                          return (
                            <div className="space-y-1.5">
                              <p className="text-xs text-slate-600">{label}</p>
                              <div className="flex items-center gap-2">
                                <div className="flex-1 bg-slate-200 rounded-full h-2 overflow-hidden">
                                  <div className="h-full bg-[#e8864a] rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                                </div>
                                <span className="text-[10px] text-slate-500 whitespace-nowrap">{pct}%</span>
                              </div>
                              {timeLeft && <p className="text-[9px] text-slate-400">~{timeLeft}s restantes</p>}
                            </div>
                          );
                        }
                        return null;
                      })()}
                      {/* Regular markdown content (if no progress bar) */}
                      {!msg.content.match(/\d+%.*restantes/) && (() => {
                        // Clean JSON blocks from display text
                        const cleanContent = msg.content.replace(/```json[\s\S]*?```/g, "").trim();

                        return (
                          <div className="prose prose-sm prose-slate max-w-none [&_table]:text-xs [&_th]:px-2 [&_td]:px-2 [&_h2]:text-sm [&_h3]:text-sm [&_p]:my-1">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{cleanContent}</ReactMarkdown>
                          </div>
                        );
                      })()}
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  )}
                </div>

                {/* Rich content */}
                {msg.rich && msg.role === "assistant" && (
                  <>
                    {msg.rich.type === "product_list" && msg.rich.products && (() => {
                      // Find the user message that triggered this response
                      const msgIdx = messages.indexOf(msg);
                      const prevUserMsg = messages.slice(0, msgIdx).reverse().find(m => m.role === "user");
                      const userText = prevUserMsg?.content || "";
                      const searchTerms = extractSearchTerms(userText);
                      const isMultiProduct = searchTerms.length > 1 && msg.rich.products.length > 3;

                      if (isMultiProduct) {
                        const groups = groupProductsBySearchTerm(msg.rich.products, searchTerms);
                        return (
                          <div className="mt-3 space-y-4">
                            <div className="flex items-center gap-2 px-1">
                              <span className="text-xs font-bold text-[#0a1628]">
                                {msg.rich.products.length} productos en {groups.length} categorias
                              </span>
                            </div>
                            {groups.map((group, gi) => (
                              <div key={gi} className="border border-slate-200 rounded-xl p-3 bg-white">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-sm">🔍</span>
                                  <span className="text-xs font-bold text-slate-800 uppercase">{group.term}</span>
                                  <span className="text-[10px] text-slate-400">({group.products.length} opciones)</span>
                                </div>
                                <ProductCarousel
                                  products={group.products}
                                  onAction={onSend}
                                  compact
                                  onAddToCart={(p, qty) => addToCartDirect(p, qty)}
                                />
                              </div>
                            ))}
                            {/* Global actions */}
                            <div className="flex flex-wrap gap-2 pt-1">
                              <button onClick={() => onSend("arma el carro mas barato con todos los productos")} className="flex items-center gap-1 rounded-lg border border-[#0a1628]/20 bg-[#0a1628]/5 px-3 py-1.5 text-xs text-[#0a1628] hover:bg-slate-100">
                                Lo mas barato
                              </button>
                              <button onClick={() => onSend("cual supermercado tiene todo mas barato en total")} className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50">
                                Todo en 1 super
                              </button>
                              <button onClick={() => onSend("compara los precios de cada producto en todos los supermercados")} className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50">
                                Comparar precios
                              </button>
                            </div>
                          </div>
                        );
                      }

                      // Single product or few results — standard carousel
                      return (
                        <ProductCarousel
                          products={msg.rich.products}
                          onAction={onSend}
                          onAddToCart={(p, qty) => addToCartDirect(p, qty)}
                        />
                      );
                    })()}
                    {msg.rich.type === "comparison" && msg.rich.comparisons && (
                      <ComparisonTable product={msg.rich.product || ""} comparisons={msg.rich.comparisons} onAction={onSend} />
                    )}
                    {msg.rich.type === "cart" && msg.rich.items && (
                      <CartView items={msg.rich.items} onAction={onSend} />
                    )}
                    {msg.rich.type === "shopping_cart" && msg.rich.items && (
                      <ShoppingCart items={msg.rich.items} onAction={onSend} />
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

                {/* Actions row — copy, reactions, share */}
                {msg.role === "assistant" && msg.content.length > 30 && !msg.content.includes("% (~") && (
                  <div className="flex items-center gap-1 mt-1 px-1">
                    <button onClick={() => copyToClipboard(msg.content, msg.id)} className="p-1 rounded hover:bg-slate-100 text-slate-300 hover:text-slate-500" title="Copiar">
                      {copiedId === msg.id ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                    </button>
                    <button onClick={() => toggleReaction(msg.id, "up")} className={`p-1 rounded hover:bg-slate-100 ${reactions[msg.id] === "up" ? "text-green-500" : "text-slate-300 hover:text-slate-500"}`} title="Util">
                      <ThumbsUp className="h-3 w-3" />
                    </button>
                    <button onClick={() => toggleReaction(msg.id, "down")} className={`p-1 rounded hover:bg-slate-100 ${reactions[msg.id] === "down" ? "text-red-500" : "text-slate-300 hover:text-slate-500"}`} title="No util">
                      <ThumbsDown className="h-3 w-3" />
                    </button>
                    <span className="text-[9px] text-slate-300 ml-1">
                      {msg.timestamp.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                )}
                {msg.role === "user" && (
                  <span className="text-[9px] text-slate-300 mt-0.5 block px-1">
                    {msg.timestamp.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
              </div>
            </div>
          ))}

          {busy && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-slate-100 px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-[#e8864a] animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="h-2 w-2 rounded-full bg-[#e8864a] animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="h-2 w-2 rounded-full bg-[#e8864a] animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                  <span className="text-[10px] text-slate-400">Alfred esta trabajando...</span>
                  {onStop && (
                    <button onClick={onStop} className="flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] text-red-600 hover:bg-red-100">
                      <Square className="h-2.5 w-2.5 fill-red-600" /> Detener
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Follow-up suggestions after last response */}
          {!busy && messages.length > 0 && messages[messages.length - 1]?.role === "assistant" && !messages[messages.length - 1]?.content.includes("% (~") && messages[messages.length - 1]?.content.length > 50 && (
            <div className="flex flex-wrap gap-1.5 mt-2 px-1">
              {["Dame mas detalles", "Que mas puedes hacer con esto?", "Busca alternativas"].map(q => (
                <button key={q} onClick={() => onSend(q)} className="rounded-full border border-slate-200 px-3 py-1 text-[10px] text-slate-500 hover:bg-slate-50 hover:border-slate-300 transition-colors">
                  {q}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-slate-200 p-3 shrink-0">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-end gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-2 focus-within:border-[#0a1628] focus-within:ring-1 focus-within:ring-[#0a1628] shadow-sm">
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
            <div className="flex items-center gap-1 shrink-0">
              <button className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors" title="Adjuntar archivo">
                <Paperclip className="h-4 w-4" />
              </button>
              <button className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:text-[#e8864a] hover:bg-orange-50 transition-colors" title="Mensaje de voz">
                <Mic className="h-4 w-4" />
              </button>
              <button
                onClick={handleSend}
                disabled={!input.trim() || !connected}
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#0a1628] text-white hover:bg-[#1e3a5f] disabled:opacity-30 transition-colors"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between mt-1.5 px-1">
            <p className="text-[9px] text-slate-300">Alfred puede cometer errores. Verifica la informacion importante.</p>
            <div className="flex items-center gap-2 text-[9px] text-slate-300">
              <span>⌘K buscar</span>
              <span>⌘N nuevo</span>
            </div>
          </div>
        </div>
      </div>

      {/* Toast notification */}
      {toast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-2 rounded-xl bg-[#0a1628] px-4 py-2.5 text-sm text-white shadow-lg">
            <span className="text-green-400">&#10003;</span>
            <span>{toast}</span>
          </div>
        </div>
      )}
    </div>
  );
}
