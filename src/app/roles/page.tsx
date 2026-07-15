"use client";
import { useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RoleTable } from "@/components/roles/RoleTable";
import { UploadRoleDialog } from "@/components/roles/UploadRoleDialog";
import { useRoles } from "@/hooks/useRoles";

export default function RolesPage() {
  const [uploadOpen, setUploadOpen] = useState(false);
  const { roles, isLoading } = useRoles();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Roles</h1>
          <p className="mt-1 text-sm text-slate-400">
            {roles.length} role{roles.length !== 1 ? "s" : ""} in registry
          </p>
        </div>
        <Button
          onClick={() => setUploadOpen(true)}
          className="gap-2 bg-brand-600 text-white hover:bg-brand-500"
        >
          <Upload className="h-4 w-4" />
          Upload Role
        </Button>
      </div>

      <RoleTable roles={roles} isLoading={isLoading} />

      <UploadRoleDialog open={uploadOpen} onOpenChange={setUploadOpen} />
    </div>
  );
}
