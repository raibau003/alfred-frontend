"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";

const FULLSCREEN_PREFIXES = ["/workspace"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isFullscreen = FULLSCREEN_PREFIXES.some((p) =>
    pathname?.startsWith(p)
  );

  if (isFullscreen) {
    return <div className="min-h-screen bg-surface-0">{children}</div>;
  }

  return (
    <div className="flex min-h-screen bg-surface-0">
      <Sidebar />
      <main className="ml-60 flex-1 overflow-auto">
        <div className="min-h-screen p-8">{children}</div>
      </main>
    </div>
  );
}
