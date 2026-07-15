import { LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  label: string;
  value: number | undefined;
  icon: LucideIcon;
  color: string;
  isLoading?: boolean;
}

export function StatCard({ label, value, icon: Icon, color, isLoading }: Props) {
  return (
    <div className="rounded-lg border border-surface-4 bg-surface-2 p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
          {label}
        </p>
        <div
          className="flex h-8 w-8 items-center justify-center rounded-md"
          style={{ backgroundColor: `${color}18` }}
        >
          <Icon className="h-4 w-4" style={{ color }} />
        </div>
      </div>
      {isLoading ? (
        <Skeleton className="mt-3 h-8 w-16 bg-surface-3" />
      ) : (
        <p className="mt-3 text-3xl font-semibold text-slate-900">{value ?? 0}</p>
      )}
    </div>
  );
}
