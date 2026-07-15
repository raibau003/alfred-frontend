"use client";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Agent } from "@/lib/types";
import { STATUS_CONFIG } from "@/lib/constants";
import { AgentStatus } from "@/lib/types";

interface Props {
  agents: Agent[];
}

export function StatusChart({ agents }: Props) {
  const counts = Object.entries(STATUS_CONFIG)
    .map(([status, cfg]) => ({
      status: cfg.label,
      count: agents.filter((a) => a.status === status).length,
      color: cfg.color,
    }))
    .filter((d) => d.count > 0);

  if (counts.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-400">
        No data
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={counts} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
        <XAxis
          dataKey="status"
          tick={{ fill: "#94a3b8", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: "#94a3b8", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <Tooltip
          cursor={{ fill: "#f1f5f9" }}
          contentStyle={{
            backgroundColor: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: 6,
            color: "#0f172a",
            fontSize: 12,
          }}
          labelStyle={{ color: "#64748b" }}
        />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {counts.map((entry, i) => (
            <Cell key={i} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
