"use client";
import { useState } from "react";
import { toast } from "sonner";
import { mutate } from "swr";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { agentsApi } from "@/lib/api/agents";
import { Agent, Role } from "@/lib/types";

interface Props {
  agentId: string;
  currentRoleId: string | null;
  availableRoles: Role[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function ChangeRoleDialog({
  agentId,
  currentRoleId,
  availableRoles,
  open,
  onOpenChange,
}: Props) {
  const [selected, setSelected] = useState<string>(currentRoleId ?? "");
  const [loading, setLoading] = useState(false);

  const unchanged = selected === (currentRoleId ?? "");

  function handleClose(v: boolean) {
    if (!loading) {
      onOpenChange(v);
      if (!v) setSelected(currentRoleId ?? "");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || unchanged) return;
    setLoading(true);
    try {
      await toast.promise(agentsApi.setRole(agentId, selected), {
        loading: `Changing role…`,
        success: `Role changed — agent "${agentId}" is restarting`,
        error: (err) => err?.message ?? "Failed to change role",
      });
      mutate(
        "/agents",
        (current: Agent[] | undefined) =>
          current?.map((a) =>
            a.id === agentId
              ? { ...a, role_id: selected, status: "restarting" as const }
              : a
          ),
        false
      );
      mutate(`/agents/${agentId}`);
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm border-surface-4 bg-surface-2 text-slate-700">
        <DialogHeader>
          <DialogTitle className="text-slate-900">Change Role</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-slate-500">
            Agent{" "}
            <span className="font-mono text-slate-900">{agentId}</span> will
            restart with the new role. Existing playbook is preserved.
          </p>
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-500">Role</Label>
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              disabled={loading}
              className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600 disabled:opacity-50"
            >
              <option value="">None</option>
              {availableRoles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleClose(false)}
              disabled={loading}
              className="text-slate-500"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={unchanged || loading}
              className="bg-brand-600 text-white hover:bg-brand-500"
            >
              Change Role
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
