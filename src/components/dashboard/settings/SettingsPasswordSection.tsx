"use client";

import { useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { changeAdminPassword } from "@/lib/settings/backend-settings";
import { btnPrimary, fieldClass, labelClass } from "./settings-ui";

function PasswordInput({
  id,
  label,
  value,
  onChange,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <label className={labelClass} htmlFor={id}>
        {label}
      </label>
      <div className="relative mt-1.5">
        <input
          id={id}
          type={visible ? "text" : "password"}
          className={`${fieldClass} pr-10`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-zinc-500 hover:text-zinc-300"
          aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    </div>
  );
}

export function SettingsPasswordSection() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword.trim()) {
      toast.error("Indique ton mot de passe actuel.");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("Le nouveau mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("La confirmation ne correspond pas au nouveau mot de passe.");
      return;
    }
    if (newPassword === currentPassword) {
      toast.error("Le nouveau mot de passe doit être différent de l'actuel.");
      return;
    }

    setSaving(true);
    try {
      await changeAdminPassword({ currentPassword, newPassword });
      toast.success("Mot de passe mis à jour.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Changement impossible.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={(e) => void handleSubmit(e)}>
      <p className="mb-6 text-sm text-zinc-400">
        Mot de passe fort recommandé — 8 caractères minimum.
      </p>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <PasswordInput
            id="pwd-current"
            label="Mot de passe actuel"
            value={currentPassword}
            onChange={setCurrentPassword}
            autoComplete="current-password"
          />
        </div>
        <div>
          <PasswordInput
            id="pwd-new"
            label="Nouveau mot de passe"
            value={newPassword}
            onChange={setNewPassword}
            autoComplete="new-password"
          />
        </div>
        <div>
          <PasswordInput
            id="pwd-confirm"
            label="Confirmer le mot de passe"
            value={confirmPassword}
            onChange={setConfirmPassword}
            autoComplete="new-password"
          />
        </div>
      </div>

      <ul className="mt-5 flex flex-wrap gap-4 text-xs text-zinc-500">
        <li className={newPassword.length >= 8 ? "text-emerald-400" : ""}>
          • 8 caractères min.
        </li>
        <li
          className={
            newPassword === confirmPassword && confirmPassword.length > 0
              ? "text-emerald-400"
              : ""
          }
        >
          • Confirmation identique
        </li>
      </ul>

      <div className="mt-8 border-t border-zinc-800 pt-6">
        <button type="submit" disabled={saving} className={btnPrimary}>
          {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          Mettre à jour
        </button>
      </div>
    </form>
  );
}
