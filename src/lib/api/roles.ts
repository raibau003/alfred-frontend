import { apiFetch, apiUpload } from "./client";
import { Role } from "@/lib/types";

export const rolesApi = {
  list: () => apiFetch<Role[]>("/roles"),

  get: (name: string) => apiFetch<Role>(`/roles/${name}`),

  upload: (form: FormData) => apiUpload<Role>("/roles", form),

  delete: (name: string) =>
    apiFetch<void>(`/roles/${name}`, { method: "DELETE" }),
};
