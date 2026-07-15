"use client";

import { useParams, useSearchParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { DualPaneLayout } from "@/components/workspace/DualPaneLayout";
import { ChatPanel } from "@/components/workspace/ChatPanel";
import { CanvasPanel } from "@/components/workspace/CanvasPanel";
import { useWorkspace } from "@/hooks/useWorkspace";

export default function WorkspacePage() {
  const params = useParams();
  const search = useSearchParams();
  const router = useRouter();
  const agentId = params.agentId as string;
  const sessionId = search.get("session") ?? undefined;

  const { send, cancel, replyPermission, bootstrapping } = useWorkspace({
    agentId,
    sessionId,
  });

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-surface-4 bg-surface-1 px-4 py-2">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(`/agents/${agentId}`)}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900"
            aria-label="Back to agent"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Agente</span>
          </button>
          <span className="text-slate-300">/</span>
          <h1 className="font-mono text-sm font-semibold text-slate-900">{agentId}</h1>
        </div>
      </header>

      <main className="flex-1 min-h-0">
        <DualPaneLayout
          left={
            <ChatPanel
              onSend={send}
              onCancel={cancel}
              onReplyPermission={replyPermission}
              bootstrapping={bootstrapping}
            />
          }
          right={<CanvasPanel />}
        />
      </main>
    </div>
  );
}
