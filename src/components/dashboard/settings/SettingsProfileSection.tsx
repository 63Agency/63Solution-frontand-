"use client";

import { useEffect, useState } from "react";
import { Calendar, ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { updateAdminProfile } from "@/lib/settings/backend-settings";
import type { AdminProfile } from "@/lib/settings/settings-types";
import { ProfileAvatarEditor } from "./ProfileAvatarEditor";
import { fullName, roleLabel } from "./settings-profile-utils";
import { btnPrimary } from "./settings-ui";
import { cn } from "@/src/lib/utils";

type SettingsProfileSectionProps = {
  profile: AdminProfile | null;
  loading: boolean;
  error: string | null;
  onProfileUpdated: (profile: AdminProfile) => void;
};

const TITRE_OPTIONS = ["M.", "Mme", "Mlle"] as const;

const TIMEZONE_OPTIONS = [
  "+01:00 Western European Time - Casablanca, Rabat, Fes, Tangier",
  "+00:00 Greenwich Mean Time - London, Lisbon",
  "+01:00 Central European Time - Paris, Berlin, Madrid",
  "+02:00 Eastern European Time - Athens, Cairo",
] as const;

const PAYS_OPTIONS = [
  "Morocco",
  "France",
  "Belgium",
  "Switzerland",
  "Canada",
  "United States",
  "Spain",
  "Algeria",
  "Tunisia",
] as const;

const fieldClass =
  "mt-1.5 w-full rounded-lg border border-zinc-700 bg-transparent px-3.5 py-2.5 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-zinc-500";

const labelClass = "block text-sm font-medium text-zinc-300";

const cardClass = "rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 md:p-8";

function SelectField({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
}) {
  return (
    <div>
      <label className={labelClass} htmlFor={id}>
        {label}
      </label>
      <div className="relative mt-1.5">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            fieldClass,
            "mt-0 appearance-none pr-10",
          )}
        >
          {options.map((opt) => (
            <option key={opt} value={opt} className="bg-zinc-900 text-zinc-100">
              {opt}
            </option>
          ))}
          {!options.includes(value as (typeof options)[number]) && value ? (
            <option value={value} className="bg-zinc-900 text-zinc-100">
              {value}
            </option>
          ) : null}
        </select>
        <ChevronDown
          className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-zinc-500"
          aria-hidden
        />
      </div>
    </div>
  );
}

export function SettingsProfileSection({
  profile,
  loading,
  error,
  onProfileUpdated,
}: SettingsProfileSectionProps) {
  const [titre, setTitre] = useState<string>("M.");
  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [dateNaissance, setDateNaissance] = useState("");
  const [fuseauHoraire, setFuseauHoraire] = useState<string>(TIMEZONE_OPTIONS[0]);
  const [adresse, setAdresse] = useState("");
  const [ville, setVille] = useState("");
  const [codePostal, setCodePostal] = useState("");
  const [pays, setPays] = useState<string>("Morocco");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [avatarSaving, setAvatarSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setTitre(profile.titre || "M.");
      setPrenom(profile.prenom);
      setNom(profile.nom);
      setDateNaissance(profile.dateNaissance);
      setFuseauHoraire(profile.fuseauHoraire || TIMEZONE_OPTIONS[0]);
      setAdresse(profile.adresse);
      setVille(profile.ville);
      setCodePostal(profile.codePostal);
      setPays(profile.pays || "Morocco");
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
        telephone: profile.telephone,
        ville,
        avatarUrl: url,
        titre,
        dateNaissance,
        fuseauHoraire,
        adresse,
        codePostal,
        pays,
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
    if (!profile) return;
    setSaving(true);
    try {
      const updated = await updateAdminProfile({
        prenom,
        nom,
        telephone: profile.telephone,
        ville,
        avatarUrl,
        titre,
        dateNaissance,
        fuseauHoraire,
        adresse,
        codePostal,
        pays,
      });
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
    titre !== profile.titre ||
    prenom.trim() !== profile.prenom ||
    nom.trim() !== profile.nom ||
    dateNaissance.trim() !== profile.dateNaissance ||
    fuseauHoraire !== profile.fuseauHoraire ||
    adresse.trim() !== profile.adresse ||
    ville.trim() !== profile.ville ||
    codePostal.trim() !== profile.codePostal ||
    pays !== profile.pays ||
    avatarUrl.trim() !== profile.avatarUrl;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <section className={cardClass}>
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-white">Informations personnelles</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Mettez à jour vos données personnelles et vos coordonnées.
          </p>
        </div>

        <div className="mb-8 flex flex-col gap-4 border-b border-zinc-800 pb-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="truncate text-xl font-semibold text-white">
              {fullName(prenom, nom)}
            </p>
            <p className="mt-1 truncate text-sm text-zinc-400">{profile.email}</p>
            <p className="mt-1 text-sm text-zinc-500">{roleLabel(profile.role)}</p>
          </div>
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
          <SelectField
            id="profile-titre"
            label="Titre"
            value={titre}
            onChange={setTitre}
            options={TITRE_OPTIONS}
          />

          <div>
            <label className={labelClass} htmlFor="profile-role">
              Rôle
            </label>
            <input
              id="profile-role"
              className={cn(
                fieldClass,
                "cursor-not-allowed bg-zinc-900/80 text-zinc-500",
              )}
              value={roleLabel(profile.role)}
              readOnly
            />
          </div>

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
              Nom de famille
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
            <label className={labelClass} htmlFor="profile-naissance">
              Date de naissance
            </label>
            <div className="relative mt-1.5">
              <input
                id="profile-naissance"
                type="date"
                className={cn(fieldClass, "mt-0 pr-10 scheme-dark")}
                value={dateNaissance}
                onChange={(e) => setDateNaissance(e.target.value)}
              />
              <Calendar
                className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-zinc-500"
                aria-hidden
              />
            </div>
          </div>

          <div>
            <label className={labelClass} htmlFor="profile-email">
              Adresse email
            </label>
            <input
              id="profile-email"
              className={cn(
                fieldClass,
                "cursor-not-allowed bg-zinc-900/80 text-zinc-500",
              )}
              value={profile.email}
              readOnly
            />
          </div>

          <div className="sm:col-span-2">
            <SelectField
              id="profile-fuseau"
              label="Fuseau horaire préféré"
              value={fuseauHoraire}
              onChange={setFuseauHoraire}
              options={TIMEZONE_OPTIONS}
            />
          </div>
        </div>
      </section>

      <section className={cardClass}>
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-white">Informations sur l&apos;adresse</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Votre adresse résidentielle à des fins de vérification et de facturation.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="profile-adresse">
              Adresse de la rue
            </label>
            <input
              id="profile-adresse"
              className={fieldClass}
              value={adresse}
              onChange={(e) => setAdresse(e.target.value)}
              autoComplete="street-address"
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
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="profile-postal">
              Code Postal
            </label>
            <input
              id="profile-postal"
              className={fieldClass}
              value={codePostal}
              onChange={(e) => setCodePostal(e.target.value)}
              autoComplete="postal-code"
            />
          </div>

          <div>
            <SelectField
              id="profile-pays"
              label="Pays"
              value={pays}
              onChange={setPays}
              options={PAYS_OPTIONS}
            />
          </div>
        </div>
      </section>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving || !dirty || avatarSaving}
          className={btnPrimary}
        >
          {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          Mettre à jour
        </button>
      </div>
    </div>
  );
}
