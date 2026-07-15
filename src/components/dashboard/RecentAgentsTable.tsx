"use client";
import Link from "next/link";
import { Agent } from "@/lib/types";
import { AgentStatusBadge } from "@/components/agents/AgentStatusBadge";
import { formatRelative } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  agents: Agent[];
  isLoading: boolean;
}

export function RecentAgentsTable({ agents, isLoading }: Props) {
  const recent = [...agents]
    .sort((a, b) => {
      const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
      return tb - ta;
    })
    .slice(0, 8);

  return (
    <div className="rounded-lg border border-surface-4 bg-surface-2">
      <div className="border-b border-surface-4 px-5 py-3">
        <h3 className="text-sm font-medium text-slate-900">Recent Agents</h3>
      </div>
      {isLoading ? (
        <div className="space-y-2 p-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-10 w-full bg-surface-3" />
          ))}
        </div>
      ) : recent.length === 0 ? (
        <div className="py-10 text-center text-sm text-slate-400">
          No agents yet
        </div>
      ) : (
        <div>
          {recent.map((agent) => (
            <div
              key={agent.id}
              className="flex items-center gap-4 border-b border-surface-4 px-5 py-2.5 last:border-0 hover:bg-surface-3 transition-colors"
            >
              <Link
                href={`/agents/${agent.id}`}
                className="flex-1 font-mono text-sm text-brand-600 hover:text-brand-700"
              >
                {agent.name}
              </Link>
              <AgentStatusBadge status={agent.status} />
              <span className="w-20 text-right text-xs text-slate-400">
                {formatRelative(agent.created_at)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
