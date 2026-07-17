"use client";

import { useMemo, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { changeAdminPassword } from "@/lib/settings/backend-settings";
import { cn } from "@/src/lib/utils";

const fieldClass =
  "mt-1.5 w-full rounded-lg border border-zinc-700 bg-transparent px-3.5 py-2.5 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-zinc-500";

const labelClass = "block text-sm font-medium text-zinc-400";

const PASSWORD_RULES = [
  {
    id: "length",
    label: "Entre 8 et 16 caractères",
    test: (value: string) => value.length >= 8 && value.length <= 16,
  },
  {
    id: "upper",
    label: "Au moins une lettre majuscule (A-Z)",
    test: (value: string) => /[A-Z]/.test(value),
  },
  {
    id: "lower",
    label: "Au moins une lettre minuscule (a-z)",
    test: (value: string) => /[a-z]/.test(value),
  },
  {
    id: "number",
    label: "Au moins un chiffre (0-9)",
    test: (value: string) => /[0-9]/.test(value),
  },
  {
    id: "special",
    label: "Au moins un caractère spécial (!@#$%…)",
    test: (value: string) => /[^A-Za-z0-9]/.test(value),
  },
] as const;

function PasswordInput({
  id,
  label,
  value,
  onChange,
  autoComplete,
  placeholder,
  onFocus,
  onBlur,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  placeholder: string;
  onFocus?: () => void;
  onBlur?: () => void;
}) {
  return (
    <div className="min-w-0">
      <label className={labelClass} htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        type="password"
        className={fieldClass}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        autoComplete={autoComplete}
        placeholder={placeholder}
        maxLength={id === "pwd-new" || id === "pwd-confirm" ? 16 : undefined}
      />
    </div>
  );
}

export function SettingsPasswordSection() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [showRules, setShowRules] = useState(false);

  const ruleResults = useMemo(
    () =>
      PASSWORD_RULES.map((rule) => ({
        ...rule,
        ok: rule.test(newPassword),
      })),
    [newPassword],
  );

  const allRulesOk = ruleResults.every((rule) => rule.ok);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword.trim()) {
      toast.error("Indique ton mot de passe actuel.");
      return;
    }
    if (!allRulesOk) {
      setShowRules(true);
      toast.error("Le nouveau mot de passe ne respecte pas toutes les conditions.");
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
      setShowRules(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Changement impossible.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="mx-auto max-w-5xl">
      <div className="grid gap-5 md:grid-cols-3">
        <PasswordInput
          id="pwd-current"
          label="Mot de passe actuel"
          value={currentPassword}
          onChange={setCurrentPassword}
          autoComplete="current-password"
          placeholder="Entrez votre mot de passe actuel"
        />
        <div className="relative min-w-0">
          <PasswordInput
            id="pwd-new"
            label="Nouveau mot de passe"
            value={newPassword}
            onChange={(value) => {
              setNewPassword(value);
              setShowRules(true);
            }}
            onFocus={() => setShowRules(true)}
            autoComplete="new-password"
            placeholder="Nouveau mot de passe"
          />

          {showRules ? (
            <ul className="mt-2 space-y-1.5">
              {ruleResults.map((rule) => (
                <li
                  key={rule.id}
                  className={cn(
                    "flex items-start gap-2 text-xs",
                    rule.ok ? "text-emerald-400" : "text-zinc-500",
                  )}
                >
                  {rule.ok ? (
                    <Check className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  ) : (
                    <X className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  )}
                  <span>{rule.label}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <PasswordInput
          id="pwd-confirm"
          label="Confirmer le mot de passe"
          value={confirmPassword}
          onChange={setConfirmPassword}
          autoComplete="new-password"
          placeholder="Confirmer le nouveau mot de passe"
        />
      </div>

      <div className="mt-8 flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 border border-indigo-500 bg-indigo-600 px-4 py-2 font-mono text-[11px] uppercase tracking-widest text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          Modifier le mot de passe
        </button>
      </div>
    </form>
  );
}
