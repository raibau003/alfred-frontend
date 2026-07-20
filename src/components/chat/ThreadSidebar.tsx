"use client";

import { useEffect, useState } from "react";
import { Plus, MessageSquare, Globe, MessageCircle, FileText, ChevronDown, ChevronRight, Download } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import type { ConversationThread } from "@/lib/supabase/types";

interface Artifact {
  id: string;
  name: string;
  type: string;
  content: string | null;
  created_at: string;
}

interface Props {
  activeThreadId: string | null;
  onSelectThread: (id: string) => void;
  onNewThread: () => void;
}

const channelIcons: Record<string, typeof Globe> = {
  web: Globe,
  whatsapp: MessageCircle,
  telegram: MessageSquare,
};

function groupByDate(threads: ConversationThread[]) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);

  const groups: { label: string; threads: ConversationThread[] }[] = [
    { label: "Hoy", threads: [] },
    { label: "Ayer", threads: [] },
    { label: "Esta semana", threads: [] },
    { label: "Anteriores", threads: [] },
  ];

  for (const t of threads) {
    const d = new Date(t.created_at);
    if (d >= today) groups[0].threads.push(t);
    else if (d >= yesterday) groups[1].threads.push(t);
    else if (d >= weekAgo) groups[2].threads.push(t);
    else groups[3].threads.push(t);
  }

  return groups.filter((g) => g.threads.length > 0);
}

export function ThreadSidebar({ activeThreadId, onSelectThread, onNewThread }: Props) {
  const { user } = useAuth();
  const [threads, setThreads] = useState<ConversationThread[]>([]);
  const [expandedThread, setExpandedThread] = useState<string | null>(null);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    supabase
      .from("conversation_threads")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (data) setThreads(data);
      });
  }, [user, activeThreadId]); // reload when thread changes

  // Load artifacts when thread is expanded
  useEffect(() => {
    if (!expandedThread) { setArtifacts([]); return; }
    const supabase = createClient();
    supabase
      .from("artifacts")
      .select("*")
      .eq("thread_id", expandedThread)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setArtifacts(data as Artifact[]);
      });
  }, [expandedThread]);

  const groups = groupByDate(threads);

  return (
    <div className="flex w-64 flex-col border-r border-slate-200 bg-slate-50">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Conversaciones</h3>
        <button
          onClick={onNewThread}
          className="flex h-6 w-6 items-center justify-center rounded-md hover:bg-slate-200 text-slate-500 transition-colors"
          title="Nueva conversacion"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-4">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.threads.map((t) => {
                const Icon = channelIcons[t.channel] ?? MessageSquare;
                const active = t.id === activeThreadId;
                const expanded = expandedThread === t.id;
                const threadArtifacts = expanded ? artifacts : [];
                return (
                  <div key={t.id}>
                    <div className="flex items-center">
                      <button
                        onClick={() => setExpandedThread(expanded ? null : t.id)}
                        className="p-0.5 text-slate-300 hover:text-slate-500"
                      >
                        {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                      </button>
                      <button
                        onClick={() => onSelectThread(t.id)}
                        className={`flex flex-1 items-center gap-2 rounded-md px-1.5 py-1.5 text-left text-sm transition-colors ${
                          active
                            ? "bg-[#0a1628]/5 text-[#0a1628]"
                            : "text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        <span className="truncate">{t.title || "Sin titulo"}</span>
                      </button>
                    </div>
                    {expanded && (
                      <div className="ml-5 mt-0.5 space-y-0.5">
                        {threadArtifacts.length > 0 ? (
                          threadArtifacts.map((a) => (
                            <div key={a.id} className="flex items-center gap-1.5 rounded px-2 py-1 text-[10px] text-slate-500 hover:bg-slate-100 cursor-pointer group">
                              <FileText className="h-3 w-3 text-slate-400" />
                              <span className="truncate flex-1">{a.name}</span>
                              <Download className="h-3 w-3 text-slate-300 opacity-0 group-hover:opacity-100" />
                            </div>
                          ))
                        ) : (
                          <p className="px-2 py-1 text-[10px] text-slate-300">Sin artefactos</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {threads.length === 0 && (
          <p className="px-2 py-4 text-xs text-slate-400 text-center">
            No hay conversaciones aun. Empieza a chatear con Alfred!
          </p>
        )}
      </div>
    </div>
  );
}
