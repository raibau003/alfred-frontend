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
import { DeleteRoleDialog } from "./DeleteRoleDialog";
import { Role } from "@/lib/types";

interface Props {
  roles: Role[];
  isLoading: boolean;
}

export function RoleTable({ roles, isLoading }: Props) {
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

  if (roles.length === 0) {
    return (
      <div className="rounded-lg border border-surface-4 bg-surface-2 py-16 text-center">
        <p className="text-sm text-slate-400">No roles uploaded</p>
        <p className="mt-1 text-xs text-slate-400">
          Upload an AGENTS.md role file to get started
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
            {roles.map((role) => (
              <TableRow key={role.id} className="border-surface-4 hover:bg-surface-3 transition-colors">
                <TableCell className="font-mono text-sm text-slate-600">{role.name}</TableCell>
                <TableCell className="max-w-sm text-sm text-slate-400">
                  <span className="line-clamp-1">{role.description}</span>
                </TableCell>
                <TableCell>
                  <Tooltip>
                    <TooltipTrigger className="block max-w-[180px] truncate font-mono text-xs text-slate-400 cursor-default text-left">
                      {role.gcs_path}
                    </TooltipTrigger>
                    <TooltipContent className="border-surface-4 bg-surface-2 font-mono text-xs text-slate-600">
                      {role.gcs_path}
                    </TooltipContent>
                  </Tooltip>
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteName(role.name)}
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
        <DeleteRoleDialog
          name={deleteName}
          open={true}
          onOpenChange={(v) => { if (!v) setDeleteName(null); }}
        />
      )}
    </>
  );
}
