"use client";
import useSWR from "swr";
import { agentsApi } from "@/lib/api/agents";
import { AgentHealth } from "@/lib/types";

export function useAgentHealth(id: string) {
  const { data, error, mutate, isLoading } = useSWR<AgentHealth>(
    id ? `/agents/${id}/health` : null,
    () => agentsApi.health(id),
    { revalidateOnFocus: false }
  );

  return { health: data, error, mutate, isLoading };
}
