"use client";
import useSWR from "swr";
import { agentsApi } from "@/lib/api/agents";
import { AgentDetail } from "@/lib/types";
import { POLL_INTERVAL_MS } from "@/lib/constants";

export function useAgent(id: string) {
  const { data, error, mutate, isLoading } = useSWR<AgentDetail>(
    id ? `/agents/${id}` : null,
    () => agentsApi.get(id),
    {
      refreshInterval: (data) => (data?.status === "running" ? 0 : POLL_INTERVAL_MS),
    }
  );

  // The API returns 200 { status: "not_found" } when the agent doesn't exist in Firestore.
  // Treat that the same as no data so callers see agent === undefined.
  const agent = (data?.status as string) === "not_found" ? undefined : data;

  return { agent, error, mutate, isLoading };
}
