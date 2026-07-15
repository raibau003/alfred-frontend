"use client";
import useSWR from "swr";
import { playbooksApi } from "@/lib/api/playbooks";
import { Playbook } from "@/lib/types";

export function usePlaybooks() {
  const { data, error, mutate, isLoading } = useSWR<Playbook[]>(
    "/playbooks",
    playbooksApi.list
  );

  return { playbooks: data ?? [], error, mutate, isLoading };
}
