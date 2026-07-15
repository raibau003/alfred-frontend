import { apiFetch, apiUpload } from "./client";
import { Playbook } from "@/lib/types";

export const playbooksApi = {
  list: () => apiFetch<Playbook[]>("/playbooks"),

  get: (name: string) => apiFetch<Playbook>(`/playbooks/${name}`),

  upload: (form: FormData) => apiUpload<Playbook>("/playbooks", form),

  delete: (name: string) =>
    apiFetch<void>(`/playbooks/${name}`, { method: "DELETE" }),
};
