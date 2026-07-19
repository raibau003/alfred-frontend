"use client";

import { useAlfred } from "@/hooks/useAlfred";
import { useAuth } from "@/components/auth/AuthProvider";
import { ChatView } from "@/components/chat/ChatView";
import { ThreadSidebar } from "@/components/chat/ThreadSidebar";
import { useState } from "react";

export default function ChatPage() {
  const { user } = useAuth();
  const [activeThreadId, setActiveThreadId] = useState<string | undefined>();
  const alfred = useAlfred(activeThreadId);

  return (
    <div className="flex h-[calc(100vh-64px)]">
      <ThreadSidebar
        activeThreadId={alfred.currentThreadId}
        onSelectThread={(id) => setActiveThreadId(id)}
        onNewThread={() => {
          setActiveThreadId(undefined);
          alfred.newThread();
        }}
      />
      <ChatView
        messages={alfred.messages}
        busy={alfred.busy}
        connected={alfred.connected}
        onSend={alfred.send}
        userName={user?.email?.split("@")[0] ?? "Usuario"}
      />
    </div>
  );
}
