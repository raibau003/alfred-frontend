"use client";

import { useAlfred } from "@/hooks/useAlfred";
import { useAuth } from "@/components/auth/AuthProvider";
import { ChatView } from "@/components/chat/ChatView";
import { ThreadSidebar } from "@/components/chat/ThreadSidebar";
import { useState } from "react";
import { PanelLeftOpen, PanelLeftClose } from "lucide-react";

export default function ChatPage() {
  const { user } = useAuth();
  const [activeThreadId, setActiveThreadId] = useState<string | undefined>();
  const [showThreads, setShowThreads] = useState(false);
  const alfred = useAlfred(activeThreadId);

  return (
    <div className="flex h-[calc(100vh-64px)]">
      {/* Thread sidebar — collapsable */}
      {showThreads && (
        <div className="relative">
          <ThreadSidebar
            activeThreadId={alfred.currentThreadId}
            onSelectThread={(id) => {
              setActiveThreadId(id);
              setShowThreads(false); // close after selecting
            }}
            onNewThread={() => {
              setActiveThreadId(undefined);
              alfred.newThread();
              setShowThreads(false);
            }}
          />
          <button
            onClick={() => setShowThreads(false)}
            className="absolute top-3 right-2 flex h-6 w-6 items-center justify-center rounded-md hover:bg-slate-200 text-slate-400"
            title="Cerrar conversaciones"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Chat area — full width when sidebar is hidden */}
      <div className="flex-1 flex flex-col">
        <ChatView
          messages={alfred.messages}
          busy={alfred.busy}
          connected={alfred.connected}
          onSend={alfred.send}
          userName={user?.email?.split("@")[0] ?? "Usuario"}
          onToggleThreads={() => setShowThreads(!showThreads)}
          showThreadsButton={!showThreads}
        />
      </div>
    </div>
  );
}
