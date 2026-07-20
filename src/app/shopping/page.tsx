"use client";

import { useAlfred } from "@/hooks/useAlfred";
import { useAuth } from "@/components/auth/AuthProvider";
import { ChatView } from "@/components/chat/ChatView";
import { ShoppingCart } from "lucide-react";

export default function ShoppingPage() {
  const { user } = useAuth();
  const alfred = useAlfred();

  return (
    <div className="flex h-[calc(100vh-64px)]">
      <ChatView
        messages={alfred.messages}
        busy={alfred.busy}
        connected={alfred.connected}
        onSend={alfred.send}
        userName={user?.email?.split("@")[0] ?? "Usuario"}
        shoppingMode
      />
    </div>
  );
}
