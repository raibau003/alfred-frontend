"use client";
import useSWR from "swr";
import { agentsApi } from "@/lib/api/agents";
import { Agent, AgentDetail, AgentStatus } from "@/lib/types";
import { ACTIVE_STATUSES, POLL_INTERVAL_MS, TRANSITION_STATUSES } from "@/lib/constants";

async function fetchAgentsWithTransitions(): Promise<Agent[]> {
  const agents = await agentsApi.list();

  const needsTransition = agents.filter((a) =>
    TRANSITION_STATUSES.includes(a.status as AgentStatus)
  );
  if (needsTransition.length === 0) return agents;

  // Hit individual endpoints to drive backend status transitions (polling-on-read design).
  // created/pending/restarting → running only happens when GET /agents/{id} is called.
  const results = await Promise.allSettled(
    needsTransition.map((a) => agentsApi.get(a.id))
  );

  const updatedMap = new Map<string, AgentDetail>(
    results
      .filter((r): r is PromiseFulfilledResult<AgentDetail> => r.status === "fulfilled")
      .map((r) => [r.value.id, r.value])
  );

  return agents.map((a) =>
    updatedMap.has(a.id)
      ? ({ ...a, ...updatedMap.get(a.id)! } as Agent)
      : a
  );
}

export function useAgents() {
  const { data, error, mutate, isLoading } = useSWR<Agent[]>(
    "/agents",
    fetchAgentsWithTransitions,
    {
      refreshInterval: (data) => {
        const hasActive = data?.some((a) =>
          ACTIVE_STATUSES.includes(a.status as AgentStatus)
        );
        return hasActive ? POLL_INTERVAL_MS : 0;
      },
    }
  );

  return {
    agents: data ?? [],
    error,
    mutate,
    isLoading,
  };
}
