"use client";
import { useState } from "react";
import Link from "next/link";
import { ExternalLink, MoreHorizontal, Package, Trash2, UserCog } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { AgentStatusBadge } from "./AgentStatusBadge";
import { DeleteAgentDialog } from "./DeleteAgentDialog";
import { InstallPlaybooksDialog } from "./InstallPlaybooksDialog";
import { ChangeRoleDialog } from "./ChangeRoleDialog";
import { Agent, Playbook, Role } from "@/lib/types";
import { formatRelative, agentUrl } from "@/lib/utils";

interface Props {
  agents: Agent[];
  playbooks: Playbook[];
  roles: Role[];
  isLoading: boolean;
}

export function AgentTable({ agents, playbooks, roles, isLoading }: Props) {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [installId, setInstallId] = useState<string | null>(null);
  const [changeRoleId, setChangeRoleId] = useState<string | null>(null);

  const installAgent = agents.find((a) => a.id === installId);
  const changeRoleAgent = agents.find((a) => a.id === changeRoleId);

  const roleName = (id: string | null) =>
    id ? roles.find((r) => r.id === id)?.name ?? id : null;
  const playbookName = (id: string | null) =>
    id ? playbooks.find((p) => p.id === id)?.name ?? id : null;

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full bg-surface-3" />
        ))}
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="rounded-lg border border-surface-4 bg-surface-2 py-16 text-center">
        <p className="text-sm text-slate-400">No agents found</p>
        <p className="mt-1 text-xs text-slate-400">
          Create your first agent to get started
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-lg border border-surface-4 bg-surface-2 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-surface-4 hover:bg-transparent">
              <TableHead className="text-xs uppercase tracking-wider text-slate-400 w-48">Agent ID</TableHead>
              <TableHead className="text-xs uppercase tracking-wider text-slate-400">Status</TableHead>
              <TableHead className="text-xs uppercase tracking-wider text-slate-400">Role</TableHead>
              <TableHead className="text-xs uppercase tracking-wider text-slate-400">Playbooks</TableHead>
              <TableHead className="text-xs uppercase tracking-wider text-slate-400">Created</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {agents.map((agent) => (
              <TableRow
                key={agent.id}
                className="border-surface-4 hover:bg-surface-3 transition-colors"
              >
                <TableCell>
                  <Link
                    href={`/agents/${agent.id}`}
                    className="font-mono text-sm text-brand-600 hover:text-brand-700 hover:underline"
                  >
                    {agent.name}
                  </Link>
                </TableCell>
                <TableCell>
                  <AgentStatusBadge status={agent.status} />
                </TableCell>
                <TableCell className="text-sm text-slate-500">
                  {roleName(agent.role_id) ?? <span className="text-slate-400">—</span>}
                </TableCell>
                <TableCell className="text-sm text-slate-500">
                  {playbookName(agent.playbook_id) ? (
                    <span className="font-mono text-xs">{playbookName(agent.playbook_id)}</span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </TableCell>
                <TableCell className="text-sm text-slate-400">
                  {formatRelative(agent.created_at)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                  <a
                    href={agent.url || agentUrl(agent.id)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:text-slate-900 hover:bg-surface-3 transition-colors"
                    title="Open agent"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:text-slate-900 hover:bg-surface-3 transition-colors">
                      <MoreHorizontal className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="border-surface-4 bg-surface-2 text-slate-600"
                    >
                      <DropdownMenuItem
                        onClick={() => setInstallId(agent.id)}
                        className="gap-2 cursor-pointer"
                      >
                        <Package className="h-3.5 w-3.5" />
                        Install Playbooks
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setChangeRoleId(agent.id)}
                        disabled={agent.status === "restarting"}
                        className="gap-2 cursor-pointer"
                      >
                        <UserCog className="h-3.5 w-3.5" />
                        Change Role
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-surface-4" />
                      <DropdownMenuItem
                        onClick={() => setDeleteId(agent.id)}
                        className="gap-2 cursor-pointer text-red-600 focus:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {deleteId && (
        <DeleteAgentDialog
          agentId={deleteId}
          open={true}
          onOpenChange={(v) => { if (!v) setDeleteId(null); }}
        />
      )}
      {installId && installAgent && (
        <InstallPlaybooksDialog
          agentId={installId}
          currentPlaybookId={installAgent.playbook_id ?? null}
          availablePlaybooks={playbooks}
          open={true}
          onOpenChange={(v) => { if (!v) setInstallId(null); }}
        />
      )}
      {changeRoleId && changeRoleAgent && (
        <ChangeRoleDialog
          agentId={changeRoleId}
          currentRoleId={changeRoleAgent.role_id}
          availableRoles={roles}
          open={true}
          onOpenChange={(v) => { if (!v) setChangeRoleId(null); }}
        />
      )}
    </>
  );
}
