"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronDown, Loader2 } from "lucide-react";
import { DashboardNotificationsBell } from "./notifications/DashboardNotificationsBell";
import { fetchAdminProfile } from "@/lib/settings/backend-settings";
import type { AdminProfile } from "@/lib/settings/settings-types";
import { fullName, profileInitials } from "./settings/settings-profile-utils";

function getPageTitle(pathname: string): string {
  if (pathname.startsWith("/dashboard/parametres")) return "Profil";
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
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [loading, setLoading] = useState(true);

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

  const displayName = profile
    ? fullName(profile.prenom, profile.nom) || profile.email
    : "—";

  return (
    <header className="relative z-30 flex shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-950/95 px-6 py-4 backdrop-blur-sm md:px-8">
      <h1 className="truncate text-lg font-semibold text-zinc-200">
        {getPageTitle(pathname ?? "/dashboard")}
      </h1>

      <div className="flex items-center gap-4 md:gap-5">
        <DashboardNotificationsBell />

        <button
          type="button"
          className="flex items-center gap-2.5 py-1 md:gap-3"
          aria-label="Menu compte"
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
          <ChevronDown className="size-4 shrink-0 text-zinc-500" aria-hidden />
        </button>
      </div>
    </header>
  );
}
