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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { agentsApi } from "@/lib/api/agents";
import { Agent } from "@/lib/types";

interface Props {
  agentId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDeleted?: () => void;
}

export function DeleteAgentDialog({ agentId, open, onOpenChange, onDeleted }: Props) {
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (confirm !== agentId) return;
    setLoading(true);

    // Optimistically mark the agent as "deleting" so the badge shows immediately
    mutate(
      "/agents",
      (current: Agent[] | undefined) =>
        current?.map((a) =>
          a.id === agentId ? { ...a, status: "deleting" as const } : a
        ),
      false
    );

    try {
      await toast.promise(agentsApi.delete(agentId), {
        loading: `Deleting agent "${agentId}"…`,
        success: `Agent "${agentId}" deleted`,
        error: (err) => err?.message ?? "Failed to delete agent",
      });

      // Close dialog immediately — badge is already showing "Deleting"
      onOpenChange(false);
      onDeleted?.();

      // Refetch after 3 s so the agent visibly lingers with the Deleting badge
      // before disappearing (K8s cleanup takes a moment anyway)
      setTimeout(() => mutate("/agents"), 3000);
    } catch {
      // Revert the optimistic update on failure
      mutate("/agents");
    } finally {
      setLoading(false);
      setConfirm("");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!loading) { onOpenChange(v); if (!v) setConfirm(""); } }}>
      <DialogContent className="max-w-md border-surface-4 bg-surface-2 text-slate-700">
        <DialogHeader>
          <DialogTitle className="text-slate-900">Delete Agent</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            This will permanently delete{" "}
            <span className="font-mono text-slate-900">{agentId}</span> and all its
            resources (Deployment, Service, PVC, ConfigMap).
          </p>
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-400">
              Type <span className="font-mono text-slate-600">{agentId}</span> to confirm
            </Label>
            <Input
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder={agentId}
              className="border-surface-4 bg-surface-3 font-mono text-slate-900 placeholder:text-slate-500"
              disabled={loading}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => { setConfirm(""); onOpenChange(false); }}
            disabled={loading}
            className="text-slate-500"
          >
            Cancel
          </Button>
          <Button
            onClick={handleDelete}
            disabled={confirm !== agentId || loading}
            className="bg-red-50 text-red-600 border border-red-200 hover:bg-red-100"
          >
            Delete Agent
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
