"use client";
import { useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlaybookTable } from "@/components/playbooks/PlaybookTable";
import { UploadPlaybookDialog } from "@/components/playbooks/UploadPlaybookDialog";
import { usePlaybooks } from "@/hooks/usePlaybooks";

export default function PlaybooksPage() {
  const [uploadOpen, setUploadOpen] = useState(false);
  const { playbooks, isLoading } = usePlaybooks();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Playbooks</h1>
          <p className="mt-1 text-sm text-slate-400">
            {playbooks.length} playbook{playbooks.length !== 1 ? "s" : ""} in registry
          </p>
        </div>
        <Button
          onClick={() => setUploadOpen(true)}
          className="gap-2 bg-brand-600 text-white hover:bg-brand-500"
        >
          <Upload className="h-4 w-4" />
          Upload Playbook
        </Button>
      </div>

      <PlaybookTable playbooks={playbooks} isLoading={isLoading} />

      <UploadPlaybookDialog open={uploadOpen} onOpenChange={setUploadOpen} />
    </div>
  );
}
