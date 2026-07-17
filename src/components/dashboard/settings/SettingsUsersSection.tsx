"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Trash2, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { canManageTeamUsers, shouldShowTeamUserInList } from "@/lib/auth/roles";
import {
  createTeamUser,
  deleteTeamUser,
  fetchTeamUsers,
} from "@/lib/settings/backend-settings";
import type { AssignableTeamUserRole, TeamUser } from "@/lib/settings/settings-types";
import { fetchCurrentUser } from "@/lib/auth/backend-login";
import { btnPrimary, fieldClass, labelClass } from "./settings-ui";
import { cn } from "@/src/lib/utils";

const emptyForm = {
  prenom: "",
  nom: "",
  email: "",
  telephone: "",
  ville: "",
  password: "",
  role: "admin_whatsapp" as AssignableTeamUserRole,
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function roleBadge(role: TeamUser["role"]) {
  if (role === "admin") return { label: "Administrateur", className: "text-indigo-300" };
  return { label: "Admin WhatsApp", className: "text-emerald-300" };
}

export function SettingsUsersSection() {
  const [canManage, setCanManage] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const me = await fetchCurrentUser();
      setCanManage(canManageTeamUsers(me.user.role));
      setCurrentUserId(me.user.id);
      const list = await fetchTeamUsers();
      const visible = list.filter((u) => shouldShowTeamUserInList(u, me.user.id));
      setUsers(visible);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Impossible de charger les comptes.");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.prenom.trim() || !form.nom.trim()) {
      toast.error("Prénom et nom obligatoires.");
      return;
    }
    setCreating(true);
    try {
      const created = await createTeamUser(form);
      setUsers((prev) => {
        if (currentUserId && !shouldShowTeamUserInList(created, currentUserId)) {
          return prev;
        }
        return [created, ...prev];
      });
      setForm(emptyForm);
      setShowForm(false);
      toast.success(`Compte ${created.email} créé.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Création impossible.");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (user: TeamUser) => {
    if (!window.confirm(`Supprimer le compte ${user.email} ?`)) return;
    setDeletingId(user.id);
    try {
      await deleteTeamUser(user.id);
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      toast.success("Compte supprimé.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Suppression impossible.");
    } finally {
      setDeletingId(null);
    }
  };

  if (!canManage && !loading) {
    return (
      <p className="py-8 text-sm text-zinc-400">
        Seuls les administrateurs peuvent gérer les comptes de l&apos;équipe.
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-zinc-400">
          Comptes avec accès au dashboard 63 Agency.
        </p>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className={btnPrimary}
        >
          {showForm ? (
            <X className="size-4" aria-hidden />
          ) : (
            <UserPlus className="size-4" aria-hidden />
          )}
          {showForm ? "Fermer" : "Ajouter un membre"}
        </button>
      </div>

      {showForm ? (
        <form
          onSubmit={(e) => void handleCreate(e)}
          className="mb-8 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 md:p-6"
        >
          <h3 className="text-sm font-semibold text-white">Nouveau membre</h3>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="user-prenom">
                Prénom
              </label>
              <input
                id="user-prenom"
                className={fieldClass}
                value={form.prenom}
                onChange={(e) => setForm((f) => ({ ...f, prenom: e.target.value }))}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="user-nom">
                Nom
              </label>
              <input
                id="user-nom"
                className={fieldClass}
                value={form.nom}
                onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="user-telephone">
                Numéro de téléphone
              </label>
              <input
                id="user-telephone"
                type="tel"
                className={fieldClass}
                value={form.telephone}
                onChange={(e) => setForm((f) => ({ ...f, telephone: e.target.value }))}
                autoComplete="tel"
                placeholder="+212 6 12 34 56 78"
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="user-ville">
                Ville
              </label>
              <input
                id="user-ville"
                className={fieldClass}
                value={form.ville}
                onChange={(e) => setForm((f) => ({ ...f, ville: e.target.value }))}
                autoComplete="address-level2"
                placeholder="Rabat"
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass} htmlFor="user-email">
                E-mail
              </label>
              <input
                id="user-email"
                type="email"
                className={fieldClass}
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                autoComplete="off"
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="user-password">
                Mot de passe temporaire
              </label>
              <input
                id="user-password"
                type="password"
                className={fieldClass}
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="user-role">
                Rôle
              </label>
              <select
                id="user-role"
                className={fieldClass}
                value={form.role}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    role: e.target.value as AssignableTeamUserRole,
                  }))
                }
              >
                <option value="admin_whatsapp">Admin WhatsApp</option>
                <option value="admin">Administrateur</option>
              </select>
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setForm(emptyForm);
              }}
              className="border border-zinc-700 px-4 py-2 font-mono text-[11px] uppercase tracking-widest text-zinc-300 transition hover:bg-zinc-800"
            >
              Annuler
            </button>
            <button type="submit" disabled={creating} className={btnPrimary}>
              {creating ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <UserPlus className="size-4" aria-hidden />
              )}
              Créer le compte
            </button>
          </div>
        </form>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 py-12 text-sm text-zinc-500">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Chargement des comptes…
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/60 text-left text-xs text-zinc-500">
                <th className="px-4 py-3 font-medium">Nom</th>
                <th className="px-4 py-3 font-medium">E-mail</th>
                <th className="px-4 py-3 font-medium">Téléphone</th>
                <th className="px-4 py-3 font-medium">Ville</th>
                <th className="px-4 py-3 font-medium">Rôle</th>
                <th className="px-4 py-3 font-medium">Créé le</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/80">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-zinc-500">
                    Aucun compte équipe. Cliquez sur « Ajouter un membre ».
                  </td>
                </tr>
              ) : (
                users.map((user) => {
                  const badge = roleBadge(user.role);
                  return (
                    <tr key={user.id} className="text-zinc-300 transition hover:bg-zinc-900/40">
                      <td className="px-4 py-3.5 font-medium text-white">
                        {[user.prenom, user.nom].filter(Boolean).join(" ") || "—"}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs">{user.email}</td>
                      <td className="px-4 py-3.5 text-zinc-400">
                        {user.telephone || "—"}
                      </td>
                      <td className="px-4 py-3.5 text-zinc-400">{user.ville || "—"}</td>
                      <td className="px-4 py-3.5">
                        <span className={cn("text-sm font-medium", badge.className)}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-zinc-500">
                        {formatDate(user.createdAt)}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => void handleDelete(user)}
                          disabled={deletingId === user.id}
                          className="inline-flex items-center gap-1.5 border border-red-700/60 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-widest text-red-300 transition hover:bg-red-900/30 disabled:opacity-50"
                        >
                          {deletingId === user.id ? (
                            <Loader2 className="size-3.5 animate-spin" aria-hidden />
                          ) : (
                            <Trash2 className="size-3.5" aria-hidden />
                          )}
                          Supprimer
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
