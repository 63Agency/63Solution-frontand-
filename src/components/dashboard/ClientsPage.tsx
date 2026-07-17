"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  deleteClient,
  fetchClientsListDetailed,
  isDerivedSyntheticClientId,
  updateClient,
  type BackendClientRecord,
  type BackendClientUpdatePayload,
} from "../../../lib/devis/backend-devis";
import { cn } from "@/src/lib/utils";

type ClientSource = "api" | "unavailable";

const CLIENTS_PER_PAGE = 15;

const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

function canManageClient(row: BackendClientRecord): boolean {
  return !isDerivedSyntheticClientId(row.id);
}

function buildPageItems(currentPage: number, totalPages: number): (number | "...")[] {
  if (totalPages <= 3) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const items: (number | "...")[] = [1];
  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);
  if (start > 2) items.push("...");
  for (let page = start; page <= end; page += 1) items.push(page);
  if (end < totalPages - 1) items.push("...");
  items.push(totalPages);
  return items;
}

export function ClientsPage() {
  const [rows, setRows] = useState<BackendClientRecord[]>([]);
  const [source, setSource] = useState<ClientSource>("unavailable");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [editing, setEditing] = useState<BackendClientRecord | null>(null);
  const [editNom, setEditNom] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editTel, setEditTel] = useState("");
  const [editIce, setEditIce] = useState("");
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<BackendClientRecord | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(rows.length / CLIENTS_PER_PAGE));

  const pageRows = useMemo(() => {
    const start = (currentPage - 1) * CLIENTS_PER_PAGE;
    return rows.slice(start, start + CLIENTS_PER_PAGE);
  }, [rows, currentPage]);

  const pageItems = useMemo(
    () => buildPageItems(currentPage, totalPages),
    [currentPage, totalPages],
  );

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const loadClients = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { clients: apiClients, authoritativeFromApi } = await fetchClientsListDetailed();

      if (authoritativeFromApi) {
        setRows(apiClients);
        setSource("api");
      } else {
        setRows([]);
        setSource("unavailable");
        setError(
          "GET /clients indisponible. Le carnet clients est indépendant des devis, factures et propositions.",
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible de charger les clients.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadClients();
  }, [loadClients]);

  const openEdit = (row: BackendClientRecord) => {
    if (!canManageClient(row)) {
      toast.error(
        "Ce client n’a pas d’identifiant serveur. Crée-le ou modifie-le via GET/PATCH /clients.",
      );
      return;
    }
    setEditing(row);
    setEditNom(row.clientNom ?? "");
    setEditEmail(row.clientEmail ?? "");
    setEditTel(row.clientTelephone ?? "");
    setEditIce(row.clientIce ?? "");
  };

  const handleSaveClient = async () => {
    if (!editing) return;
    const nom = editNom.trim();
    const mail = editEmail.trim();
    const tel = editTel.trim().replace(/\D/g, "");
    const ice = editIce.trim();

    if (!nom) {
      toast.error("Le nom du client est obligatoire.");
      return;
    }
    if (mail && !emailOk(mail)) {
      toast.error("Format email invalide.");
      return;
    }

    const payload: BackendClientUpdatePayload = {
      clientNom: nom,
      clientEmail: mail,
      clientTelephone: tel,
      clientIce: ice,
    };

    setSaving(true);
    try {
      const updated = await updateClient(editing.id, payload);
      setRows((prev) => prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)));
      setEditing(null);
      toast.success("Client mis à jour.");
      await loadClients();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Mise à jour impossible.");
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    if (!canManageClient(pendingDelete)) {
      toast.error("Suppression impossible : id client non serveur.");
      setPendingDelete(null);
      return;
    }
    setDeletingId(pendingDelete.id);
    try {
      await deleteClient(pendingDelete.id);
      setRows((prev) => prev.filter((r) => r.id !== pendingDelete.id));
      setPendingDelete(null);
      if (editing?.id === pendingDelete.id) setEditing(null);
      toast.success(
        "Client supprimé du carnet (les devis, factures et propositions existants ne sont pas supprimés).",
      );
      await loadClients();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Suppression impossible.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <header className="flex shrink-0 flex-col gap-2 border-b border-zinc-800 px-6 py-5 md:px-8 md:py-6">
        <p className="font-mono text-xs uppercase tracking-widest text-zinc-500">Carnet</p>
        <h1 className="text-3xl font-semibold leading-tight text-white">Clients</h1>
        <p className="max-w-xl text-sm text-zinc-400">
          Carnet clients (GET /clients). Créer ou enregistrer une proposition, un devis ou une
          facture avec un nom client appelle POST /clients. Supprimer un document ne supprime pas un
          client ici.
        </p>
      </header>

      <div className="px-6 py-6 md:px-8 md:py-8">
        <section>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-base font-medium text-white">Répertoire</h2>
              <p className="font-mono text-[11px] uppercase tracking-widest text-zinc-500">
                {loading ? "Chargement…" : `${rows.length} client(s)`}
                {source === "api" ? " — API" : ""}
              </p>
            </div>
          </div>

          {error ? (
            <p className="py-8 text-center text-sm text-red-400">{error}</p>
          ) : loading ? (
            <p className="py-8 text-center text-sm text-zinc-500">Chargement des clients…</p>
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-500">
              Aucun client dans le carnet. Ajoute des clients via l’API (POST /clients).
            </p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse font-mono text-sm text-zinc-300">
                  <thead>
                    <tr className="border-b border-zinc-700 text-left text-[10px] uppercase tracking-widest text-zinc-500">
                      <th className="pb-3 pr-4 font-normal">Nom</th>
                      <th className="pb-3 pr-4 font-normal">Email</th>
                      <th className="pb-3 pr-4 font-normal">Téléphone</th>
                      <th className="pb-3 pr-4 font-normal">ICE</th>
                      <th className="pb-3 pl-2 text-right font-normal">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((row) => {
                      const canEdit = canManageClient(row);
                      return (
                        <tr
                          key={row.id}
                          className="border-b border-zinc-800 transition hover:bg-zinc-800/40"
                        >
                          <td className="py-3 pr-4 text-white">{row.clientNom || "—"}</td>
                          <td className="py-3 pr-4">{row.clientEmail || "—"}</td>
                          <td className="py-3 pr-4">{row.clientTelephone || "—"}</td>
                          <td className="py-3 pr-4">{row.clientIce || "—"}</td>
                          <td className="py-3 pl-2 text-right">
                            <div className="inline-flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => openEdit(row)}
                                disabled={!canEdit || deletingId === row.id}
                                title={canEdit ? "Modifier le client" : "Id client non serveur"}
                                className="inline-flex items-center justify-center rounded border border-zinc-700 p-1.5 text-zinc-300 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
                                aria-label="Modifier le client"
                              >
                                <Pencil className="size-3.5" aria-hidden />
                              </button>
                              <button
                                type="button"
                                onClick={() => setPendingDelete(row)}
                                disabled={!canEdit || deletingId === row.id}
                                title={
                                  canEdit
                                    ? "Supprimer le client du carnet"
                                    : "Id client non serveur"
                                }
                                className="inline-flex items-center justify-center rounded border border-red-700/60 p-1.5 text-red-300 hover:bg-red-900/30 disabled:cursor-not-allowed disabled:opacity-40"
                                aria-label="Supprimer le client"
                              >
                                <Trash2 className="size-3.5" aria-hidden />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 ? (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800 pt-3 font-mono text-[11px] uppercase tracking-widest text-zinc-400">
                  <p>
                    Page {currentPage} / {totalPages} — {rows.length} client
                    {rows.length !== 1 ? "s" : ""}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                      disabled={currentPage === 1}
                      className="rounded border border-zinc-700 px-2.5 py-1.5 text-zinc-300 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Précédent
                    </button>
                    {pageItems.map((item, idx) =>
                      item === "..." ? (
                        <span key={`dots-${idx}`} className="px-1 text-zinc-500">
                          …
                        </span>
                      ) : (
                        <button
                          key={item}
                          type="button"
                          onClick={() => setCurrentPage(item)}
                          className={cn(
                            "rounded border px-2.5 py-1.5",
                            item === currentPage
                              ? "border-zinc-500 bg-zinc-800 text-white"
                              : "border-zinc-700 text-zinc-300 hover:bg-zinc-800",
                          )}
                        >
                          {item}
                        </button>
                      ),
                    )}
                    <button
                      type="button"
                      onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                      disabled={currentPage === totalPages}
                      className="rounded border border-zinc-700 px-2.5 py-1.5 text-zinc-300 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Suivant
                    </button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </section>
      </div>

      {pendingDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl">
            <h3 className="text-lg font-semibold text-white">Supprimer le client</h3>
            <p className="mt-2 text-sm text-zinc-300">
              Confirmer la suppression de{" "}
              <span className="font-semibold text-white">
                {pendingDelete.clientNom || pendingDelete.clientEmail || pendingDelete.id}
              </span>{" "}
              du carnet clients ?
              <span className="mt-2 block text-zinc-400">
                Les devis, factures et propositions déjà créés ne sont pas supprimés ; seules leurs
                coordonnées client sur le document restent inchangées.
              </span>
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                disabled={deletingId === pendingDelete.id}
                className="border border-zinc-700 px-4 py-2 font-mono text-[11px] uppercase tracking-widest text-zinc-200 transition hover:bg-zinc-800 disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmDelete()}
                disabled={deletingId === pendingDelete.id}
                className="border border-red-700 bg-red-700/80 px-4 py-2 font-mono text-[11px] uppercase tracking-widest text-white transition hover:bg-red-600 disabled:opacity-50"
              >
                {deletingId === pendingDelete.id ? "Suppression…" : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editing ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl">
            <h3 className="text-lg font-semibold text-white">Modifier le client</h3>
            <p className="mt-1 font-mono text-xs text-zinc-500">Id : {editing.id}</p>
            <div className="mt-4 space-y-3">
              <label className="block text-sm text-zinc-200">
                Nom
                <input
                  type="text"
                  value={editNom}
                  onChange={(e) => setEditNom(e.target.value)}
                  className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
                  autoComplete="organization"
                />
              </label>
              <label className="block text-sm text-zinc-200">
                Email
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
                  autoComplete="email"
                />
              </label>
              <label className="block text-sm text-zinc-200">
                Téléphone (chiffres uniquement à l’enregistrement)
                <input
                  type="text"
                  inputMode="numeric"
                  value={editTel}
                  onChange={(e) => setEditTel(e.target.value.replace(/\D/g, ""))}
                  className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
                  autoComplete="tel"
                />
              </label>
              <label className="block text-sm text-zinc-200">
                ICE
                <input
                  type="text"
                  value={editIce}
                  onChange={(e) => setEditIce(e.target.value)}
                  className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
                />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                disabled={saving}
                className="border border-zinc-700 px-4 py-2 font-mono text-[11px] uppercase tracking-widest text-zinc-200 transition hover:bg-zinc-800 disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => void handleSaveClient()}
                disabled={saving}
                className="border border-indigo-700 bg-indigo-700/80 px-4 py-2 font-mono text-[11px] uppercase tracking-widest text-white transition hover:bg-indigo-600 disabled:opacity-50"
              >
                {saving ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
