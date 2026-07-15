"use client";
import { Bot, Package, ScrollText, Activity } from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";
import { RecentAgentsTable } from "@/components/dashboard/RecentAgentsTable";
import { StatusChart } from "@/components/dashboard/StatusChart";
import { useAgents } from "@/hooks/useAgents";
import { usePlaybooks } from "@/hooks/usePlaybooks";
import { useRoles } from "@/hooks/useRoles";

export default function DashboardPage() {
  const { agents, isLoading: agentsLoading } = useAgents();
  const { playbooks, isLoading: playbooksLoading } = usePlaybooks();
  const { roles, isLoading: rolesLoading } = useRoles();

  const runningCount = agents.filter((a) => a.status === "running").length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-400">
          Overview of your AI agent infrastructure
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          label="Total Agents"
          value={agents.length}
          icon={Bot}
          color="#3b82f6"
          isLoading={agentsLoading}
        />
        <StatCard
          label="Running"
          value={runningCount}
          icon={Activity}
          color="#22c55e"
          isLoading={agentsLoading}
        />
        <StatCard
          label="Playbooks"
          value={playbooks.length}
          icon={Package}
          color="#8b5cf6"
          isLoading={playbooksLoading}
        />
        <StatCard
          label="Roles"
          value={roles.length}
          icon={ScrollText}
          color="#f59e0b"
          isLoading={rolesLoading}
        />
      </div>

      {/* Charts + Recent */}
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="rounded-lg border border-surface-4 bg-surface-2 p-5 xl:col-span-1">
          <h3 className="mb-4 text-sm font-medium text-slate-900">Agent Status Distribution</h3>
          <div className="h-48">
            <StatusChart agents={agents} />
          </div>
        </div>
        <div className="xl:col-span-2">
          <RecentAgentsTable agents={agents} isLoading={agentsLoading} />
        </div>
      </div>
    </div>
  );
}
