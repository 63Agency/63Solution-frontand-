"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { fetchAdminProfile } from "@/lib/settings/backend-settings";
import type { AdminProfile } from "@/lib/settings/settings-types";
import { fetchCurrentUser } from "@/lib/auth/backend-login";
import { canViewTeamUsersSection } from "@/lib/auth/roles";
import { SettingsPasswordSection } from "./settings/SettingsPasswordSection";
import { SettingsProfileSection } from "./settings/SettingsProfileSection";
import { SettingsUsersSection } from "./settings/SettingsUsersSection";

type SettingsTab = "profil" | "password" | "users";

const TAB_TITLES: Record<SettingsTab, string> = {
  profil: "Détails du profil",
  password: "Sécurité",
  users: "Gestion acc équipe",
};

function parseTab(value: string | null): SettingsTab {
  if (value === "password" || value === "users" || value === "profil") return value;
  return "profil";
}

export function ParametresPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = parseTab(searchParams.get("tab"));

  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [showUsersTab, setShowUsersTab] = useState(false);

  const loadProfile = useCallback(async () => {
    setProfileLoading(true);
    setProfileError(null);
    try {
      const me = await fetchCurrentUser();
      const canViewUsers = canViewTeamUsersSection(me.user.role);
      setShowUsersTab(canViewUsers);
      setProfile(await fetchAdminProfile());
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
    if (tab === "users" && !showUsersTab && !profileLoading) {
      router.replace("/dashboard/parametres?tab=profil");
    }
  }, [tab, showUsersTab, profileLoading, router]);

  const title = useMemo(() => TAB_TITLES[tab], [tab]);

  return (
    <div className="min-h-full pb-10">
      <div className="px-6 pt-6 md:px-8 md:pt-8">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight text-white md:mb-8">
          {title}
        </h1>

        {tab === "profil" ? (
          <SettingsProfileSection
            profile={profile}
            loading={profileLoading}
            error={profileError}
            onProfileUpdated={(p) => setProfile(p)}
          />
        ) : null}

        {tab === "password" ? <SettingsPasswordSection /> : null}

        {tab === "users" && showUsersTab ? <SettingsUsersSection /> : null}
      </div>
    </div>
  );
}
