"use client";
import { useState, useRef } from "react";
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
import { rolesApi } from "@/lib/api/roles";
import { Role } from "@/lib/types";
import { Upload } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function UploadRoleDialog({ open, onOpenChange }: Props) {
  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const nameError =
    name.length > 0 && !/^[a-z0-9-]+$/.test(name)
      ? "Lowercase alphanumeric and hyphens only"
      : null;

  function reset() {
    setName(""); setDisplayName(""); setDescription(""); setFile(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || nameError || !displayName || !description || !file) return;
    const form = new FormData();
    form.append("name", name);
    form.append("display_name", displayName);
    form.append("description", description);
    form.append("file", file);

    setLoading(true);
    const uploadPromise = rolesApi.upload(form);
    toast.promise(uploadPromise, {
      loading: `Uploading role "${name}"…`,
      success: `Role "${name}" uploaded`,
      error: (err) => err?.message ?? "Upload failed",
    });
    try {
      const created = await uploadPromise;
      mutate(
        "/roles",
        (current: Role[] | undefined) => [...(current ?? []), created],
        false
      );
      reset();
      onOpenChange(false);
      setTimeout(() => mutate("/roles"), 2000);
    } catch {
      // toast already showed the error
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!loading) { onOpenChange(v); if (!v) reset(); } }}>
      <DialogContent className="max-w-md border-surface-4 bg-surface-2 text-slate-700">
        <DialogHeader>
          <DialogTitle className="text-slate-900">Upload Role</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-500">Name *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value.toLowerCase())}
              placeholder="data-analyst"
              className="border-surface-4 bg-surface-3 font-mono text-slate-900 placeholder:text-slate-500"
              disabled={loading}
            />
            {nameError && <p className="text-xs text-red-600">{nameError}</p>}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-500">Display Name *</Label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Data Analyst"
              className="border-surface-4 bg-surface-3 text-slate-900 placeholder:text-slate-500"
              disabled={loading}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-500">Description *</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Analyzes data and generates reports"
              className="border-surface-4 bg-surface-3 text-slate-900 placeholder:text-slate-500"
              disabled={loading}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-500">AGENTS.md File *</Label>
            <label className="flex cursor-pointer items-center gap-3 rounded-md border border-dashed border-surface-4 bg-surface-3 px-4 py-3 hover:border-brand-600 transition-colors">
              <Upload className="h-4 w-4 text-slate-400" />
              <span className="text-sm text-slate-500">
                {file ? file.name : "Choose AGENTS.md file"}
              </span>
              <input
                ref={fileRef}
                type="file"
                accept=".md,text/markdown"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                disabled={loading}
              />
            </label>
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
              disabled={!name || !!nameError || !displayName || !description || !file || loading}
              className="bg-brand-600 text-white hover:bg-brand-500"
            >
              Upload
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
