"use client";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DeletePlaybookDialog } from "./DeletePlaybookDialog";
import { Playbook } from "@/lib/types";

interface Props {
  playbooks: Playbook[];
  isLoading: boolean;
}

export function PlaybookTable({ playbooks, isLoading }: Props) {
  const [deleteName, setDeleteName] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full bg-surface-3" />
        ))}
      </div>
    );
  }

  if (playbooks.length === 0) {
    return (
      <div className="rounded-lg border border-surface-4 bg-surface-2 py-16 text-center">
        <p className="text-sm text-slate-400">No playbooks uploaded</p>
        <p className="mt-1 text-xs text-slate-400">
          Upload a .tar.gz playbook to get started
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
              <TableHead className="text-xs uppercase tracking-wider text-slate-400">Name</TableHead>
              <TableHead className="text-xs uppercase tracking-wider text-slate-400">Description</TableHead>
              <TableHead className="text-xs uppercase tracking-wider text-slate-400">GCS Path</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {playbooks.map((pb) => (
              <TableRow key={pb.id} className="border-surface-4 hover:bg-surface-3 transition-colors">
                <TableCell className="font-mono text-sm text-slate-600">{pb.name}</TableCell>
                <TableCell className="max-w-xs text-sm text-slate-400">
                  <span className="line-clamp-1">{pb.description}</span>
                </TableCell>
                <TableCell>
                  <Tooltip>
                    <TooltipTrigger className="block max-w-[180px] truncate font-mono text-xs text-slate-400 cursor-default text-left">
                      {pb.gcs_path}
                    </TooltipTrigger>
                    <TooltipContent className="border-surface-4 bg-surface-2 font-mono text-xs text-slate-600">
                      {pb.gcs_path}
                    </TooltipContent>
                  </Tooltip>
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteName(pb.name)}
                    className="h-7 w-7 text-slate-400 hover:text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {deleteName && (
        <DeletePlaybookDialog
          name={deleteName}
          open={true}
          onOpenChange={(v) => { if (!v) setDeleteName(null); }}
        />
      )}
    </>
  );
}
