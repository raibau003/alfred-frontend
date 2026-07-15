"use client";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ExternalLink,
  Trash2,
  Package,
  CheckCircle2,
  XCircle,
  UserCog,
  LayoutPanelLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AgentStatusBadge } from "@/components/agents/AgentStatusBadge";
import { DeleteAgentDialog } from "@/components/agents/DeleteAgentDialog";
import { InstallPlaybooksDialog } from "@/components/agents/InstallPlaybooksDialog";
import { ChangeRoleDialog } from "@/components/agents/ChangeRoleDialog";
import { useAgent } from "@/hooks/useAgent";
import { useAgentHealth } from "@/hooks/useAgentHealth";
import { usePlaybooks } from "@/hooks/usePlaybooks";
import { useRoles } from "@/hooks/useRoles";
import { agentUrl, formatDate } from "@/lib/utils";

export default function AgentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { agent, isLoading } = useAgent(id);
  const { health } = useAgentHealth(id);
  const { playbooks } = usePlaybooks();
  const { roles } = useRoles();

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [installOpen, setInstallOpen] = useState(false);
  const [changeRoleOpen, setChangeRoleOpen] = useState(false);

  const roleName = agent?.role_id
    ? roles.find((r) => r.id === agent.role_id)?.name ?? agent.role_id
    : null;
  const playbookName = agent?.playbook_id
    ? playbooks.find((p) => p.id === agent.playbook_id)?.name ?? agent.playbook_id
    : null;
  const podUrl = agent?.url || agentUrl(id);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48 bg-surface-3" />
        <Skeleton className="h-32 w-full bg-surface-3" />
        <Skeleton className="h-48 w-full bg-surface-3" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="rounded-lg border border-surface-4 bg-surface-2 py-20 text-center">
        <p className="text-slate-400">Agent not found</p>
        <Link href="/agents" className="mt-4 inline-block text-sm text-brand-600 hover:underline">
          ← Back to agents
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/agents"
            className="mb-3 flex items-center gap-1 text-xs text-slate-400 hover:text-slate-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Agents
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-xl font-semibold text-slate-900">{agent.name}</h1>
            <AgentStatusBadge status={agent.status} size="lg" />
          </div>
          <p className="mt-1 font-mono text-xs text-slate-400">{id}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/workspace/${id}`}
            className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
          >
            <LayoutPanelLeft className="h-4 w-4" />
            Open Workspace
          </Link>
          <a
            href={podUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-slate-500 hover:text-slate-900 hover:bg-surface-3 transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
            UI nativa
          </a>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setInstallOpen(true)}
            className="gap-2 text-slate-500 hover:text-slate-900"
          >
            <Package className="h-4 w-4" />
            Playbooks
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setChangeRoleOpen(true)}
            disabled={agent.status === "restarting"}
            className="gap-2 text-slate-500 hover:text-slate-900"
          >
            <UserCog className="h-4 w-4" />
            Change Role
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDeleteOpen(true)}
            className="gap-2 text-red-600 hover:text-red-600"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      {/* Health */}
      {health && (
        <div className="rounded-lg border border-surface-4 bg-surface-2 p-5">
          <h2 className="mb-4 text-sm font-medium text-slate-500 uppercase tracking-wider">Health</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <HealthIndicator
              label="Overall"
              ok={health.ready}
              value={health.ready ? "Healthy" : "Unhealthy"}
            />
            <HealthIndicator
              label="Ready Replicas"
              ok={health.ready_replicas > 0}
              value={`${health.ready_replicas} replica${health.ready_replicas !== 1 ? "s" : ""}`}
            />
            <div className="rounded-md border border-surface-4 bg-surface-3 p-3">
              <p className="text-xs text-slate-400">Status</p>
              <AgentStatusBadge status={health.status} />
            </div>
          </div>
        </div>
      )}

      {/* Details */}
      <div className="rounded-lg border border-surface-4 bg-surface-2 p-5">
        <h2 className="mb-4 text-sm font-medium text-slate-500 uppercase tracking-wider">Details</h2>
        <dl className="grid gap-4 sm:grid-cols-2">
          <DetailRow label="Role" value={roleName ?? "—"} />
          <DetailRow label="Ready Replicas" value={String(agent.ready_replicas ?? "—")} />
          <DetailRow
            label="URL"
            value={
              <a
                href={podUrl}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-brand-600 hover:underline"
              >
                {podUrl}
              </a>
            }
          />
          <DetailRow
            label="Playbook"
            value={playbookName ?? "None"}
          />
        </dl>
      </div>

      <DeleteAgentDialog
        agentId={id}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onDeleted={() => router.push("/agents")}
      />
      <InstallPlaybooksDialog
        agentId={id}
        currentPlaybookId={agent.playbook_id}
        availablePlaybooks={playbooks}
        open={installOpen}
        onOpenChange={setInstallOpen}
      />
      <ChangeRoleDialog
        agentId={id}
        currentRoleId={agent.role_id}
        availableRoles={roles}
        open={changeRoleOpen}
        onOpenChange={setChangeRoleOpen}
      />
    </div>
  );
}

function HealthIndicator({
  label,
  ok,
  value,
}: {
  label: string;
  ok: boolean;
  value: string;
}) {
  return (
    <div className="rounded-md border border-surface-4 bg-surface-3 p-3">
      <p className="text-xs text-slate-400">{label}</p>
      <div className="mt-1 flex items-center gap-1.5">
        {ok ? (
          <CheckCircle2 className="h-4 w-4 text-green-500" />
        ) : (
          <XCircle className="h-4 w-4 text-red-600" />
        )}
        <span className="text-sm font-medium text-slate-600">{value}</span>
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs text-slate-400 uppercase tracking-wider">{label}</dt>
      <dd className="mt-1 text-sm text-slate-600">{value}</dd>
    </div>
  );
}
