"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AgentTable } from "@/components/agents/AgentTable";
import { CreateAgentDialog } from "@/components/agents/CreateAgentDialog";
import { useAgents } from "@/hooks/useAgents";
import { usePlaybooks } from "@/hooks/usePlaybooks";
import { useRoles } from "@/hooks/useRoles";

export default function AgentsPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const { agents, isLoading } = useAgents();
  const { playbooks } = usePlaybooks();
  const { roles } = useRoles();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Agents</h1>
          <p className="mt-1 text-sm text-slate-400">
            {agents.length} agent{agents.length !== 1 ? "s" : ""} total
          </p>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          className="gap-2 bg-brand-600 text-white hover:bg-brand-500"
        >
          <Plus className="h-4 w-4" />
          New Agent
        </Button>
      </div>

      <AgentTable agents={agents} playbooks={playbooks} roles={roles} isLoading={isLoading} />

      <CreateAgentDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        roles={roles}
        playbooks={playbooks}
      />
    </div>
  );
}
