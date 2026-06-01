"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@/src/lib/utils";
import {
  fetchAdminProfile,
  fetchTeamUsers,
} from "@/lib/settings/backend-settings";
import type { AdminProfile } from "@/lib/settings/settings-types";
import { fetchCurrentUser } from "@/lib/auth/backend-login";
import {
  canViewTeamUsersSection,
  shouldShowTeamUserInList,
} from "@/lib/auth/roles";
import { SettingsPasswordSection } from "./settings/SettingsPasswordSection";
import { SettingsProfileSection } from "./settings/SettingsProfileSection";
import { SettingsProfileSidebar } from "./settings/SettingsProfileSidebar";
import { SettingsUsersSection } from "./settings/SettingsUsersSection";

type SettingsTab = "profil" | "password" | "users";

const allTabs: { id: SettingsTab; label: string }[] = [
  { id: "profil", label: "Mon profil" },
  { id: "password", label: "Mot de passe" },
  { id: "users", label: "Utilisateurs" },
];

export function ParametresPage() {
  const [tab, setTab] = useState<SettingsTab>("profil");
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [teamCount, setTeamCount] = useState(0);
  const [showUsersTab, setShowUsersTab] = useState(false);

  const loadProfile = useCallback(async () => {
    setProfileLoading(true);
    setProfileError(null);
    try {
      const me = await fetchCurrentUser();
      const canViewUsers = canViewTeamUsersSection(me.user.role);
      setShowUsersTab(canViewUsers);

      const [data, team] = await Promise.all([
        fetchAdminProfile(),
        canViewUsers ? fetchTeamUsers().catch(() => []) : Promise.resolve([]),
      ]);
      setProfile(data);
      const visibleCount = canViewUsers
        ? team.filter((u) => shouldShowTeamUserInList(u, me.user.id)).length
        : 0;
      setTeamCount(visibleCount);
    } catch (e) {
      setProfileError(e instanceof Error ? e.message : "Impossible de charger le profil.");
      setProfile(null);
      setShowUsersTab(false);
    } finally {
      setProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (tab === "users" && !showUsersTab) {
      setTab("profil");
    }
  }, [tab, showUsersTab]);

  const tabs = useMemo(
    () => (showUsersTab ? allTabs : allTabs.filter((t) => t.id !== "users")),
    [showUsersTab],
  );

  return (
    <div className="min-h-full pb-10">
      <div className="px-6 pt-6 md:px-8 md:pt-8">
        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[minmax(260px,300px)_1fr] lg:gap-8">
          <SettingsProfileSidebar
            profile={profile}
            loading={profileLoading}
            teamCount={teamCount}
            showTeamCount={showUsersTab}
          />

          <div className="min-w-0 rounded-xl border border-zinc-800 bg-zinc-900/50 shadow-lg shadow-black/10">
            <nav
              className="flex gap-0 overflow-x-auto border-b border-zinc-800 px-4 md:px-6"
              aria-label="Sections paramètres"
            >
              {tabs.map(({ id, label }) => {
                const active = tab === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTab(id)}
                    className={cn(
                      "relative shrink-0 px-4 py-4 text-sm font-medium transition-colors md:px-5",
                      active
                        ? "text-white"
                        : "text-zinc-500 hover:text-zinc-300",
                    )}
                  >
                    {label}
                    <span
                      className={cn(
                        "absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-indigo-500 transition-opacity",
                        active ? "opacity-100" : "opacity-0",
                      )}
                      aria-hidden
                    />
                  </button>
                );
              })}
            </nav>

            <div className="p-6 md:p-8">
              {tab === "profil" ? (
                <SettingsProfileSection
                  profile={profile}
                  loading={profileLoading}
                  error={profileError}
                  onProfileUpdated={(p) => setProfile(p)}
                />
              ) : null}
              {tab === "password" ? <SettingsPasswordSection /> : null}
              {tab === "users" && showUsersTab ? (
                <SettingsUsersSection onTeamChange={setTeamCount} />
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
