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
import { Playbook } from "@/lib/types";

interface Props {
  agentId: string;
  currentPlaybookId: string | null;
  availablePlaybooks: Playbook[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function InstallPlaybooksDialog({
  agentId,
  currentPlaybookId,
  availablePlaybooks,
  open,
  onOpenChange,
}: Props) {
  const [selected, setSelected] = useState<string>(currentPlaybookId ?? "");
  const [loading, setLoading] = useState(false);

  function handleOpen(v: boolean) {
    if (!loading) {
      if (v) setSelected(currentPlaybookId ?? "");
      onOpenChange(v);
    }
  }

  async function handleSet() {
    if (!selected) return;
    setLoading(true);
    try {
      await toast.promise(agentsApi.setPlaybook(agentId, selected), {
        loading: `Setting playbook…`,
        success: "Playbook set, agent is restarting",
        error: (err) => err?.message ?? "Failed to set playbook",
      });
      await mutate("/agents");
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-md border-surface-4 bg-surface-2 text-slate-700">
        <DialogHeader>
          <DialogTitle className="text-slate-900">Set Playbook</DialogTitle>
        </DialogHeader>
        {availablePlaybooks.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-400">
            No playbooks available in the registry.
          </p>
        ) : (
          <div className="space-y-2">
            <Label className="text-xs text-slate-500">Select playbook</Label>
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              disabled={loading}
              className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600 disabled:opacity-50"
            >
              <option value="">None</option>
              {availablePlaybooks.map((pb) => (
                <option key={pb.id} value={pb.id}>
                  {pb.name}
                  {pb.id === currentPlaybookId ? " (current)" : ""}
                </option>
              ))}
            </select>
          </div>
        )}
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="text-slate-500"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSet}
            disabled={!selected || selected === currentPlaybookId || loading}
            className="bg-brand-600 text-white hover:bg-brand-500"
          >
            Set Playbook
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
