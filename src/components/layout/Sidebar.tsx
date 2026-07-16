"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Bot,
  Package,
  ScrollText,
  Server,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/playbooks", label: "Playbooks", icon: Package },
  { href: "/roles", label: "Roles", icon: ScrollText },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r border-surface-4 bg-surface-1">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2.5 border-b border-surface-4 px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600">
          <Zap className="h-4 w-4 text-white" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900">Alfred</p>
          <p className="text-[10px] text-slate-400 uppercase tracking-wider">Agent</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 p-3">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150",
                active
                  ? "bg-blue-50 text-brand-600"
                  : "text-slate-500 hover:bg-surface-3 hover:text-slate-900"
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0",
                  active ? "text-brand-600" : "text-slate-400"
                )}
              />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-surface-4 p-4">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Server className="h-3.5 w-3.5" />
          <span className="font-mono">GKE Autopilot</span>
        </div>
        <p className="mt-1 font-mono text-[10px] text-slate-400">
          us-central1
        </p>
      </div>
    </aside>
  );
}
