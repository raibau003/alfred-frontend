"use client";
import useSWR from "swr";
import { rolesApi } from "@/lib/api/roles";
import { Role } from "@/lib/types";

export function useRoles() {
  const { data, error, mutate, isLoading } = useSWR<Role[]>(
    "/roles",
    rolesApi.list
  );

  return { roles: data ?? [], error, mutate, isLoading };
}
