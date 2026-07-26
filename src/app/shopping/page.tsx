"use client";

import { useState } from "react";
import { useAlfred } from "@/hooks/useAlfred";
import { useAuth } from "@/components/auth/AuthProvider";
import { ChatView } from "@/components/chat/ChatView";
import { ConfiguracionCompras } from "@/components/shopping/ConfiguracionCompras";
import { MessageSquare, Settings } from "lucide-react";

const TABS = ["Chat", "Configuración"] as const;
type Tab = typeof TABS[number];

export default function ShoppingPage() {
  const { user } = useAuth();
  const alfred = useAlfred();
  const [tab, setTab] = useState<Tab>("Chat");

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* Pestañas: el chat sigue siendo lo primero, pero la configuración deja de ser algo
          que solo se puede tocar por WhatsApp o con un curl. */}
      <div className="flex border-b border-slate-200 px-4 shrink-0">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? "border-[#0a1628] text-[#0a1628]"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t === "Chat" ? <MessageSquare className="h-4 w-4" /> : <Settings className="h-4 w-4" />}
            {t}
          </button>
        ))}
      </div>

      {tab === "Chat" ? (
        <div className="flex flex-1 min-h-0">
          <ChatView
            messages={alfred.messages}
            busy={alfred.busy}
            connected={alfred.connected}
            onSend={alfred.send}
            userName={user?.email?.split("@")[0] ?? "Usuario"}
            shoppingMode
          />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <ConfiguracionCompras />
        </div>
      )}
    </div>
  );
}
