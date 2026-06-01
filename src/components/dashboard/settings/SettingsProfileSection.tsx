"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { updateAdminProfile } from "@/lib/settings/backend-settings";
import type { AdminProfile } from "@/lib/settings/settings-types";
import { ProfileAvatarEditor } from "./ProfileAvatarEditor";
import { btnPrimary, fieldClass, labelClass } from "./settings-ui";

type SettingsProfileSectionProps = {
  profile: AdminProfile | null;
  loading: boolean;
  error: string | null;
  onProfileUpdated: (profile: AdminProfile) => void;
};

export function SettingsProfileSection({
  profile,
  loading,
  error,
  onProfileUpdated,
}: SettingsProfileSectionProps) {
  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [ville, setVille] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [avatarSaving, setAvatarSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setPrenom(profile.prenom);
      setNom(profile.nom);
      setTelephone(profile.telephone);
      setVille(profile.ville);
      setAvatarUrl(profile.avatarUrl);
    }
  }, [profile]);

  const persistAvatar = async (url: string) => {
    if (!profile) return;
    setAvatarSaving(true);
    try {
      const updated = await updateAdminProfile({
        prenom,
        nom,
        telephone,
        ville,
        avatarUrl: url,
      });
      setAvatarUrl(updated.avatarUrl);
      onProfileUpdated(updated);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Enregistrement de la photo impossible.");
      setAvatarUrl(profile.avatarUrl);
    } finally {
      setAvatarSaving(false);
    }
  };

  const handleSave = async () => {
    if (!prenom.trim() || !nom.trim()) {
      toast.error("Prénom et nom sont obligatoires.");
      return;
    }
    setSaving(true);
    try {
      const updated = await updateAdminProfile({ prenom, nom, telephone, ville, avatarUrl });
      onProfileUpdated(updated);
      toast.success("Profil enregistré.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-3 py-12 text-zinc-500">
        <Loader2 className="size-5 animate-spin" aria-hidden />
        Chargement du profil…
      </div>
    );
  }

  if (error || !profile) {
    return <p className="py-8 text-sm text-red-400">{error ?? "Profil introuvable."}</p>;
  }

  const dirty =
    prenom.trim() !== profile.prenom ||
    nom.trim() !== profile.nom ||
    telephone.trim() !== profile.telephone ||
    ville.trim() !== profile.ville ||
    avatarUrl.trim() !== profile.avatarUrl;

  return (
    <div>
      <div className="mb-8 border-b border-zinc-800 pb-8">
        <ProfileAvatarEditor
          prenom={prenom}
          nom={nom}
          email={profile.email}
          avatarUrl={avatarUrl}
          disabled={saving || avatarSaving}
          onAvatarChange={(url) => {
            setAvatarUrl(url);
            void persistAvatar(url);
          }}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="profile-prenom">
            Prénom
          </label>
          <input
            id="profile-prenom"
            className={fieldClass}
            value={prenom}
            onChange={(e) => setPrenom(e.target.value)}
            autoComplete="given-name"
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="profile-nom">
            Nom
          </label>
          <input
            id="profile-nom"
            className={fieldClass}
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            autoComplete="family-name"
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="profile-telephone">
            Numéro de téléphone
          </label>
          <input
            id="profile-telephone"
            type="tel"
            className={fieldClass}
            value={telephone}
            onChange={(e) => setTelephone(e.target.value)}
            autoComplete="tel"
            placeholder="+212 6 12 34 56 78"
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="profile-ville">
            Ville
          </label>
          <input
            id="profile-ville"
            className={fieldClass}
            value={ville}
            onChange={(e) => setVille(e.target.value)}
            autoComplete="address-level2"
            placeholder="Casablanca"
          />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="profile-email">
            Adresse e-mail
          </label>
          <input
            id="profile-email"
            className={`${fieldClass} cursor-not-allowed opacity-70`}
            value={profile.email}
            readOnly
          />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass}>Mot de passe</label>
          <div className="mt-1.5 rounded-lg border border-zinc-700 px-3 py-2.5">
            <span className="font-mono text-sm tracking-widest text-zinc-500">••••••••••••</span>
          </div>
          <p className="mt-1.5 text-xs text-zinc-500">
            Modifier via l&apos;onglet « Mot de passe ».
          </p>
        </div>
      </div>

      <div className="mt-8 border-t border-zinc-800 pt-6">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving || !dirty}
          className={btnPrimary}
        >
          {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          Mettre à jour
        </button>
      </div>
    </div>
  );
}
