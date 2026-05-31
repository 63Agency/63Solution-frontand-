"use client";

import { Bell, ChevronDown, Loader2 } from "lucide-react";
import type { AdminProfile } from "@/lib/settings/settings-types";
import { fullName, profileInitials } from "./settings-profile-utils";

type SettingsPageHeaderProps = {
  profile: AdminProfile | null;
  loading: boolean;
};

export function SettingsPageHeader({ profile, loading }: SettingsPageHeaderProps) {
  const displayName = profile
    ? fullName(profile.prenom, profile.nom) || profile.email
    : "—";

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-800 bg-zinc-950/95 px-6 py-4 backdrop-blur-sm md:px-8">
      <h1 className="text-lg font-semibold text-zinc-200">Profil</h1>

      <div className="flex items-center gap-4 md:gap-5">
        <button
          type="button"
          className="relative rounded-md p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
          aria-label="Notifications"
        >
          <Bell className="size-5" aria-hidden />
          <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-semibold text-white">
            2
          </span>
        </button>

        <button
          type="button"
          className="flex items-center gap-2.5 rounded-lg py-1 pl-1 pr-2 transition-colors hover:bg-zinc-800/60 md:gap-3 md:pr-3"
          aria-label="Menu compte"
        >
          <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-linear-to-br from-indigo-600 to-violet-700 text-sm font-semibold text-white">
            {loading ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : profile ? (
              profileInitials(profile.prenom, profile.nom, profile.email)
            ) : (
              "?"
            )}
          </div>
          <span className="hidden max-w-[140px] truncate text-sm font-medium text-zinc-300 sm:inline md:max-w-[180px]">
            {loading ? "…" : displayName}
          </span>
          <ChevronDown className="size-4 shrink-0 text-zinc-500" aria-hidden />
        </button>
      </div>
    </header>
  );
}
