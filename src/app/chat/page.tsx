"use client";

import { useAlfred } from "@/hooks/useAlfred";
import { useAuth } from "@/components/auth/AuthProvider";
import { ChatView } from "@/components/chat/ChatView";
import { ThreadSidebar } from "@/components/chat/ThreadSidebar";
import { useState } from "react";
import { X } from "lucide-react";

export default function ChatPage() {
  const { user } = useAuth();
  const [activeThreadId, setActiveThreadId] = useState<string | undefined>();
  const [showThreads, setShowThreads] = useState(false);
  const alfred = useAlfred(activeThreadId);

  return (
    <div className="relative flex h-[calc(100vh-64px)]">
      {/* Thread sidebar — overlay */}
      {showThreads && (
        <>
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/20 z-40" onClick={() => setShowThreads(false)} />
          {/* Sidebar */}
          <div className="absolute left-0 top-0 bottom-0 z-50 w-72 shadow-xl">
            <ThreadSidebar
              activeThreadId={alfred.currentThreadId}
              onSelectThread={(id) => {
                setActiveThreadId(id);
                setShowThreads(false);
              }}
              onNewThread={() => {
                setActiveThreadId(undefined);
                alfred.newThread();
                setShowThreads(false);
              }}
            />
            <button
              onClick={() => setShowThreads(false)}
              className="absolute top-3 right-3 flex h-6 w-6 items-center justify-center rounded-md bg-white shadow hover:bg-slate-100 text-slate-500 z-50"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </>
      )}

      {/* Chat — always full width */}
      <ChatView
        messages={alfred.messages}
        busy={alfred.busy}
        connected={alfred.connected}
        onSend={alfred.send}
        onStop={alfred.stop}
        userName={user?.email?.split("@")[0] ?? "Usuario"}
        onToggleThreads={() => setShowThreads(!showThreads)}
        showThreadsButton={!showThreads}
      />
    </div>
  );
}
