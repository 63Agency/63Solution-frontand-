"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Loader2, LogOut, Settings, User } from "lucide-react";
import { clearAuthSession } from "@/lib/auth/backend-login";
import { fetchAdminProfile } from "@/lib/settings/backend-settings";
import type { AdminProfile } from "@/lib/settings/settings-types";
import { cn } from "@/src/lib/utils";
import { DashboardNotificationsBell } from "./notifications/DashboardNotificationsBell";
import { fullName, profileInitials } from "./settings/settings-profile-utils";

function getPageTitle(pathname: string): string {
  if (pathname.startsWith("/dashboard/parametres")) return "Profil";
  if (pathname.startsWith("/dashboard/conversations/envoi-multiple/import-leads")) {
    return "Importer des Leads";
  }
  if (pathname.startsWith("/dashboard/conversations/envoi-multiple")) {
    return "Envoi multiple";
  }
  if (pathname.startsWith("/dashboard/conversations")) return "Conversations";
  if (pathname.startsWith("/dashboard/factures")) return "Devis, factures & propositions";
  if (pathname.startsWith("/dashboard/clients")) return "Clients";
  if (pathname.startsWith("/dashboard/leads")) return "Leads";
  if (pathname === "/dashboard") return "Vue d'ensemble";
  return "63 Agency";
}

export function DashboardTopBar() {
  const pathname = usePathname();
  const menuRef = useRef<HTMLDivElement>(null);
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void fetchAdminProfile()
      .then((data) => {
        if (!cancelled) setProfile(data);
      })
      .catch(() => {
        if (!cancelled) setProfile(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const displayName = profile
    ? fullName(profile.prenom, profile.nom) || profile.email
    : "—";

  const itemClass =
    "flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-zinc-300 transition hover:bg-zinc-800 hover:text-white";

  return (
    <>
      <header className="relative z-30 flex shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-950/95 px-6 py-4 backdrop-blur-sm md:px-8">
        <h1 className="truncate text-lg font-semibold text-zinc-200">
          {getPageTitle(pathname ?? "/dashboard")}
        </h1>

        <div className="flex items-center gap-4 md:gap-5">
          <DashboardNotificationsBell />

          <div ref={menuRef} className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              className="flex items-center gap-2.5 py-1 md:gap-3"
              aria-label="Menu compte"
              aria-expanded={menuOpen}
              aria-haspopup="menu"
            >
              <span className="hidden max-w-[140px] truncate text-sm font-medium text-zinc-300 sm:inline md:max-w-[180px]">
                {loading ? "…" : displayName}
              </span>
              <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-linear-to-br from-indigo-600 to-violet-700 text-sm font-semibold text-white">
                {loading ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : profile?.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.avatarUrl} alt="" className="size-full object-cover" />
                ) : profile ? (
                  profileInitials(profile.prenom, profile.nom, profile.email)
                ) : (
                  "?"
                )}
              </div>
              <ChevronDown
                className={cn(
                  "size-4 shrink-0 text-zinc-500 transition-transform",
                  menuOpen && "rotate-180",
                )}
                aria-hidden
              />
            </button>

            {menuOpen ? (
              <div
                role="menu"
                aria-label="Menu compte"
                className="absolute right-0 z-40 mt-2 w-52 border border-zinc-700 bg-zinc-950 py-1 shadow-xl shadow-black/40"
              >
                <Link
                  href="/dashboard/parametres?tab=profil"
                  role="menuitem"
                  className={itemClass}
                  onClick={() => setMenuOpen(false)}
                >
                  <User className="size-4 shrink-0 text-zinc-500" aria-hidden />
                  Profil
                </Link>
                <Link
                  href="/dashboard/parametres?tab=profil"
                  role="menuitem"
                  className={itemClass}
                  onClick={() => setMenuOpen(false)}
                >
                  <Settings className="size-4 shrink-0 text-zinc-500" aria-hidden />
                  Paramètres
                </Link>
                <div className="my-1 h-px bg-zinc-800" />
                <button
                  type="button"
                  role="menuitem"
                  className={cn(itemClass, "text-red-300 hover:bg-red-950/40 hover:text-red-200")}
                  onClick={() => {
                    setMenuOpen(false);
                    setShowLogoutConfirm(true);
                  }}
                >
                  <LogOut className="size-4 shrink-0" aria-hidden />
                  Déconnexion
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {showLogoutConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md border border-zinc-700 bg-zinc-900 p-5 shadow-2xl">
            <h3 className="text-lg font-semibold text-white">Confirmer la déconnexion</h3>
            <p className="mt-2 text-sm text-zinc-300">
              Voulez-vous vraiment vous déconnecter maintenant ?
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="border border-zinc-700 px-4 py-2 font-mono text-[11px] uppercase tracking-widest text-zinc-200 transition hover:bg-zinc-800"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  clearAuthSession();
                  window.location.href = "/login";
                }}
                className="border border-red-700 bg-red-700/80 px-4 py-2 font-mono text-[11px] uppercase tracking-widest text-white transition hover:bg-red-600"
              >
                Se déconnecter
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
