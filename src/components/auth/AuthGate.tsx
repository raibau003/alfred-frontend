"use client";

import { useAuth } from "./AuthProvider";
import { LoginForm } from "./LoginForm";
import { AppShell } from "@/components/layout/AppShell";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-2 text-slate-400">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#0a1628]/50" />
          </span>
          Cargando...
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginForm />;
  }

  return <AppShell>{children}</AppShell>;
}
