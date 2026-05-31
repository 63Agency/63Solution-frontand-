"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  FileText,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  PanelLeft,
  Settings,
  Users,
} from "lucide-react";
import { cn } from "@/src/lib/utils";
import {
  canAccessDashboardHref,
  canAccessParametres,
  getDefaultDashboardRoute,
} from "@/lib/auth/roles";
import {
  clearAuthSession,
  fetchCurrentUser,
  getStoredUser,
} from "../../../lib/auth/backend-login";

const allNavItems = [
  { href: "/dashboard", label: "Vue d'ensemble", icon: LayoutDashboard },
  {
    href: "/dashboard/factures",
    label: "Devis, factures & propositions",
    icon: FileText,
  },
  { href: "/dashboard/clients", label: "Clients", icon: Users },
  { href: "/dashboard/conversations", label: "WhatsApp", icon: MessageCircle },
] as const;

export function IndustryDashboardShell({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [userRole, setUserRole] = useState<string>(() => getStoredUser()?.role ?? "admin");

  useEffect(() => {
    let cancelled = false;
    void fetchCurrentUser()
      .then(({ user }) => {
        if (!cancelled) setUserRole(user.role);
      })
      .catch(() => {
        const stored = getStoredUser();
        if (!cancelled && stored?.role) setUserRole(stored.role);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!pathname || !userRole) return;
    if (!canAccessDashboardHref(pathname, userRole)) {
      router.replace(getDefaultDashboardRoute(userRole));
    }
  }, [pathname, router, userRole]);

  const navItems = useMemo(
    () => allNavItems.filter((item) => canAccessDashboardHref(item.href, userRole)),
    [userRole],
  );

  const showParametres = canAccessParametres(userRole);

  return (
    <div className="flex h-dvh max-h-dvh overflow-hidden bg-zinc-950 text-zinc-100">
      <aside
        className={cn(
          "flex shrink-0 flex-col border-r border-zinc-800 bg-zinc-950 transition-[width] duration-200",
          collapsed ? "w-[72px]" : "w-64",
        )}
      >
        <div className="flex h-14 items-center border-b border-zinc-800 px-2">
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="rounded-md p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white"
            aria-label={collapsed ? "Agrandir le menu" : "Réduire le menu"}
          >
            <PanelLeft
              className={cn("size-5 transition-transform", collapsed && "rotate-180")}
            />
          </button>
          {!collapsed ? (
            <span className="ml-1 truncate text-sm font-semibold text-white">
              63 Agency
            </span>
          ) : null}
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-zinc-800 text-white"
                    : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200",
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                {!collapsed ? <span>{item.label}</span> : null}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-zinc-800 p-2">
          {showParametres ? (
            <Link
              href="/dashboard/parametres"
              className={cn(
                "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                pathname === "/dashboard/parametres" ||
                  pathname.startsWith("/dashboard/parametres/")
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200",
              )}
            >
              <Settings className="size-4 shrink-0" aria-hidden />
              {!collapsed ? <span>Paramètres</span> : null}
            </Link>
          ) : null}
          <button
            type="button"
            onClick={() => setShowLogoutConfirm(true)}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
          >
            <LogOut className="size-4 shrink-0" aria-hidden />
            {!collapsed ? <span>Déconnexion</span> : null}
          </button>
        </div>
      </aside>
      <main
        className={
          pathname.startsWith("/dashboard/conversations")
            ? "min-h-0 min-w-0 flex-1 overflow-hidden bg-zinc-950"
            : "min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-y-contain bg-zinc-950"
        }
      >
        {children}
      </main>
      {showLogoutConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl">
            <h3 className="text-lg font-semibold text-white">Confirmer la déconnexion</h3>
            <p className="mt-2 text-sm text-zinc-300">
              Voulez-vous vraiment vous déconnecter maintenant ?
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="rounded-md border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  clearAuthSession();
                  window.location.href = "/login";
                }}
                className="rounded-md border border-red-700 bg-red-700/80 px-4 py-2 text-sm font-medium text-white hover:bg-red-600"
              >
                Se déconnecter
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
