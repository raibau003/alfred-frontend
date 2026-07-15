import { AgentStatus } from "@/lib/types";
import { STATUS_CONFIG } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface Props {
  status: AgentStatus;
  size?: "sm" | "lg";
}

export function AgentStatusBadge({ status, size = "sm" }: Props) {
  const cfg = STATUS_CONFIG[status];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm"
      )}
      style={{ backgroundColor: cfg.bg, color: cfg.color }}
    >
      <span
        className={cn(
          "rounded-full",
          size === "sm" ? "h-1.5 w-1.5" : "h-2 w-2",
          cfg.pulse && "status-pulse"
        )}
        style={{ backgroundColor: cfg.color }}
      />
      {cfg.label}
    </span>
  );
}
