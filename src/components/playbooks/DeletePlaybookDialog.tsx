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
import { playbooksApi } from "@/lib/api/playbooks";
import { Playbook } from "@/lib/types";

interface Props {
  name: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function DeletePlaybookDialog({ name, open, onOpenChange }: Props) {
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (confirm !== name) return;
    setLoading(true);

    // Optimistically remove from cache immediately — close dialog right away
    mutate(
      "/playbooks",
      (current: Playbook[] | undefined) =>
        current?.filter((p) => p.name !== name),
      false
    );
    onOpenChange(false);
    setConfirm("");
    setLoading(false);

    // API call fires in the background
    toast.promise(playbooksApi.delete(name), {
      loading: `Deleting "${name}"…`,
      success: `Playbook "${name}" deleted`,
      error: (err) => {
        // Revert on failure
        mutate("/playbooks");
        return err?.message ?? "Failed to delete";
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!loading) { onOpenChange(v); if (!v) setConfirm(""); } }}>
      <DialogContent className="max-w-sm border-surface-4 bg-surface-2 text-slate-700">
        <DialogHeader>
          <DialogTitle className="text-slate-900">Delete Playbook</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-slate-500">
            This will remove{" "}
            <span className="font-mono text-slate-900">{name}</span> from GCS and
            Firestore.
          </p>
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-400">
              Type <span className="font-mono text-slate-600">{name}</span> to confirm
            </Label>
            <Input
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder={name}
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
            disabled={confirm !== name || loading}
            className="bg-red-50 text-red-600 border border-red-200 hover:bg-red-100"
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
