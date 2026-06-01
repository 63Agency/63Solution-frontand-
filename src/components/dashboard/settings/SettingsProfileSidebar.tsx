"use client";

import { Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { AdminProfile } from "@/lib/settings/settings-types";
import { fullName, profileInitials, roleLabel } from "./settings-profile-utils";

type SettingsProfileSidebarProps = {
  profile: AdminProfile | null;
  loading: boolean;
  teamCount: number;
  showTeamCount?: boolean;
};

export function SettingsProfileSidebar({
  profile,
  loading,
  teamCount,
  showTeamCount = true,
}: SettingsProfileSidebarProps) {
  const copyEmail = async () => {
    if (!profile?.email) return;
    try {
      await navigator.clipboard.writeText(profile.email);
      toast.success("E-mail copié.");
    } catch {
      toast.error("Copie impossible.");
    }
  };

  return (
    <aside>
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-6 shadow-lg shadow-black/20 backdrop-blur-sm">
        <div className="flex flex-col items-center text-center">
          <div className="flex size-24 items-center justify-center overflow-hidden rounded-full border-4 border-zinc-900 bg-linear-to-br from-indigo-600 to-violet-700 text-2xl font-bold text-white shadow-lg ring-2 ring-indigo-500/30">
            {loading ? (
              <Loader2 className="size-8 animate-spin text-indigo-200" aria-hidden />
            ) : profile?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatarUrl}
                alt=""
                className="size-full object-cover"
              />
            ) : profile ? (
              profileInitials(profile.prenom, profile.nom, profile.email)
            ) : (
              "?"
            )}
          </div>
          <h2 className="mt-4 text-lg font-semibold text-white">
            {loading ? "…" : profile ? fullName(profile.prenom, profile.nom) : "—"}
          </h2>
          <p className="mt-0.5 text-sm text-zinc-400">63 AGENCY</p>
          {profile ? (
            <span className="mt-3 rounded-full border border-indigo-500/40 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-indigo-300">
              {roleLabel(profile.role)}
            </span>
          ) : null}
        </div>

        <dl className="mt-8 space-y-4 border-t border-zinc-800 pt-6">
          {showTeamCount ? (
            <div className="flex items-center justify-between gap-2 text-sm">
              <dt className="text-zinc-500">Membres équipe</dt>
              <dd className="font-semibold tabular-nums text-amber-400/90">{teamCount}</dd>
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-2 text-sm">
            <dt className="text-zinc-500">Rôle</dt>
            <dd className="font-medium text-emerald-400/90">
              {profile ? roleLabel(profile.role) : "—"}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-2 text-sm">
            <dt className="text-zinc-500">Compte</dt>
            <dd className="font-medium text-zinc-300">Actif</dd>
          </div>
        </dl>

        {profile?.email ? (
          <div className="mt-6">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
              E-mail
            </p>
            <div className="flex overflow-hidden rounded-lg border border-zinc-700">
              <span className="min-w-0 flex-1 truncate bg-zinc-950/50 px-3 py-2 text-xs text-zinc-300">
                {profile.email}
              </span>
              <button
                type="button"
                onClick={() => void copyEmail()}
                className="shrink-0 border-l border-zinc-700 px-3 py-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
                title="Copier l'e-mail"
              >
                <Copy className="size-4" aria-hidden />
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
