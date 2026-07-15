import { ApiError } from "@/lib/types";

// Same host as the SPA + the agent pods (apex serves the UI, /api is routed by
// the Gateway to merlina-backend). Keeping the hostname form — not the bare IP
// — makes the admin API call same-origin and consistent with the pod subdomains
// (NEXT_PUBLIC_AGENT_BASE_DOMAIN), avoiding a third stray origin.
const BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://8-228-225-174.sslip.io/api";

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      if (body?.detail) message = String(body.detail);
    } catch {}
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string>),
  };
  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers });
  return handleResponse<T>(res);
}

export async function apiUpload<T>(
  path: string,
  form: FormData,
  method = "POST"
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, { method, body: form });
  return handleResponse<T>(res);
}
