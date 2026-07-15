"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
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
import { Role, Playbook } from "@/lib/types";
import { AGENT_ID_REGEX } from "@/lib/constants";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  roles: Role[];
  playbooks: Playbook[];
}

interface EnvEntry {
  key: string;
  value: string;
}

export function CreateAgentDialog({ open, onOpenChange, roles, playbooks }: Props) {
  const [name, setName] = useState("");
  const [roleId, setRoleId] = useState<string>("");
  const [playbookId, setPlaybookId] = useState<string>("");
  const [envEntries, setEnvEntries] = useState<EnvEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const idError =
    name.length > 0 && !AGENT_ID_REGEX.test(name)
      ? "Must be lowercase alphanumeric/hyphens, start and end with alphanumeric"
      : null;

  function addEnvRow() {
    setEnvEntries((prev) => [...prev, { key: "", value: "" }]);
  }

  function removeEnvRow(i: number) {
    setEnvEntries((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateEnvRow(i: number, field: "key" | "value", val: string) {
    setEnvEntries((prev) =>
      prev.map((e, idx) => (idx === i ? { ...e, [field]: val } : e))
    );
  }

  function reset() {
    setName("");
    setRoleId("");
    setPlaybookId("");
    setEnvEntries([]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || idError) return;

    const env: Record<string, string> = {};
    for (const { key, value } of envEntries) {
      if (key.trim()) env[key.trim()] = value;
    }

    setLoading(true);
    // POST /agents returns an empty body; the generated UUID `id` only shows up
    // on a subsequent GET /agents, so we revalidate the list instead of
    // optimistically inserting an agent we don't have the id for yet.
    const createPromise = agentsApi.create({
      name,
      role_id: roleId || null,
      playbook_id: playbookId || null,
      env: Object.keys(env).length ? env : null,
    });
    toast.promise(createPromise, {
      loading: `Creating agent "${name}"…`,
      success: `Agent "${name}" created`,
      error: (err) => err?.message ?? "Failed to create agent",
    });
    try {
      await createPromise;
      reset();
      onOpenChange(false);
      // Revalidate now and again after the backend has settled the new doc.
      mutate("/agents");
      setTimeout(() => mutate("/agents"), 2000);
    } catch {
      // toast already showed the error
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!loading) { onOpenChange(v); if (!v) reset(); } }}>
      <DialogContent className="max-w-lg border-surface-4 bg-surface-2 text-slate-700">
        <DialogHeader>
          <DialogTitle className="text-slate-900">Create Agent</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Agent name */}
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-500">Agent Name *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value.toLowerCase())}
              placeholder="my-agent"
              className="border-surface-4 bg-surface-3 text-slate-900 placeholder:text-slate-500 font-mono"
              disabled={loading}
            />
            {idError && <p className="text-xs text-red-600">{idError}</p>}
          </div>

          {/* Role */}
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-500">Role</Label>
            <select
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
              disabled={loading}
              className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600 disabled:opacity-50"
            >
              <option value="">None</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          {/* Playbook */}
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-500">Playbook</Label>
            <select
              value={playbookId}
              onChange={(e) => setPlaybookId(e.target.value)}
              disabled={loading}
              className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600 disabled:opacity-50"
            >
              <option value="">None</option>
              {playbooks.map((pb) => (
                <option key={pb.id} value={pb.id}>
                  {pb.name}
                </option>
              ))}
            </select>
          </div>

          {/* Environment variables */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-slate-500">Environment Variables</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={addEnvRow}
                disabled={loading}
                className="h-6 gap-1 px-2 text-xs text-slate-400 hover:text-slate-900"
              >
                <Plus className="h-3 w-3" />
                Add
              </Button>
            </div>
            {envEntries.length > 0 && (
              <div className="space-y-1.5">
                {envEntries.map((entry, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      value={entry.key}
                      onChange={(e) => updateEnvRow(i, "key", e.target.value)}
                      placeholder="KEY"
                      className="border-surface-4 bg-surface-3 font-mono text-xs text-slate-900 placeholder:text-slate-500"
                      disabled={loading}
                    />
                    <Input
                      value={entry.value}
                      onChange={(e) => updateEnvRow(i, "value", e.target.value)}
                      placeholder="value"
                      className="border-surface-4 bg-surface-3 font-mono text-xs text-slate-900 placeholder:text-slate-500"
                      disabled={loading}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeEnvRow(i)}
                      disabled={loading}
                      className="h-9 w-9 shrink-0 text-slate-400 hover:text-red-600"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => { reset(); onOpenChange(false); }}
              disabled={loading}
              className="text-slate-500"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!name || !!idError || loading}
              className="bg-brand-600 text-white hover:bg-brand-500"
            >
              Create Agent
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
