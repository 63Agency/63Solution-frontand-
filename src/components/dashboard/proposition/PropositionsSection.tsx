"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Eye, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  computePropositionTotalMad,
  formatPropositionTotalMad,
} from "@/src/components/dashboard/proposition/proposition-types";
import {
  deletePropositionAndLocal,
  downloadPropositionPdf,
  generateNextPropositionNumero,
  loadPropositionLocal,
  loadPropositionsForDashboard,
  propositionListSourceLabel,
  savePropositionLocal,
  sendPropositionEmail,
  type BackendPropositionListItem,
  type PropositionFetchSource,
} from "@/lib/proposition/backend-proposition";

export type PropositionListItem = {
  id: string;
  numero?: string;
  nomEtablissement?: string;
  preparePar?: string;
  clientEmail?: string;
  montantTotalLabel: string;
  status?: string;
  dateEmission?: string;
  createdAt?: string;
};

const PROPOSITION_PER_PAGE = 10;
const NOUVELLE_PROPOSITION_HREF = "/dashboard/factures/proposition/nouveau";

function formatNumeroDisplay(value?: string) {
  return value ? value.replace(/^PROP-/i, "PR-") : "—";
}

function mapApiRow(row: BackendPropositionListItem): PropositionListItem {
  let full = loadPropositionLocal(row.id);
  if (full && !full.propositionNumero.trim() && !row.numero) {
    const numero = generateNextPropositionNumero(row.id);
    full = { ...full, propositionNumero: numero };
    savePropositionLocal(full, row.id);
  }
  const numero = full?.propositionNumero?.trim() || row.numero?.trim();
  const nomEtablissement =
    full?.nomEtablissement?.trim() || row.nomEtablissement?.trim() || "";
  const totalMad = full ? computePropositionTotalMad(full) : 0;

  const preparePar = full?.preparePar?.trim() || row.preparePour?.trim() || "";

  return {
    id: row.id,
    numero,
    nomEtablissement: nomEtablissement || undefined,
    preparePar: preparePar || undefined,
    clientEmail: full?.clientEmail?.trim() || undefined,
    montantTotalLabel: formatPropositionTotalMad(totalMad),
    status: row.status,
    dateEmission: row.dateEmission,
    createdAt: row.createdAt,
  };
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

const isEmailValid = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export function PropositionsSection() {
  const router = useRouter();
  const [rows, setRows] = useState<PropositionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pendingDelete, setPendingDelete] = useState<PropositionListItem | null>(null);
  const [pendingSend, setPendingSend] = useState<PropositionListItem | null>(null);
  const [sendEmailTo, setSendEmailTo] = useState("");
  const [sendMessage, setSendMessage] = useState("");
  const [listSource, setListSource] = useState<PropositionFetchSource>("local");

  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      const { items, source } = await loadPropositionsForDashboard();
      setListSource(source);
      setRows(items.map(mapApiRow));
      if (source === "auth") {
        toast.warning("Session expirée ou absente. Reconnecte-toi pour voir les propositions en base.");
      } else if (source === "unreachable") {
        toast.warning("API Nest injoignable sur le port 3002. Vérifie que le serveur Nest tourne.");
      }
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Impossible de charger les propositions.",
      );
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  const sortedRows = useMemo(
    () =>
      [...rows].sort((a, b) => {
        const da = new Date(a.createdAt || a.dateEmission || 0).getTime();
        const db = new Date(b.createdAt || b.dateEmission || 0).getTime();
        return db - da;
      }),
    [rows],
  );

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / PROPOSITION_PER_PAGE));

  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * PROPOSITION_PER_PAGE;
    return sortedRows.slice(start, start + PROPOSITION_PER_PAGE);
  }, [sortedRows, currentPage]);

  const pageItems = useMemo(
    () => buildPageItems(currentPage, totalPages),
    [currentPage, totalPages],
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [rows.length]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    const id = pendingDelete.id;
    setDeletingId(id);
    try {
      await deletePropositionAndLocal(id, { numero: pendingDelete.numero });
      setRows((prev) => prev.filter((r) => r.id !== id));
      setPendingDelete(null);
      toast.success("Proposition supprimée.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Suppression impossible.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleDownload = async (row: PropositionListItem) => {
    setDownloadingId(row.id);
    try {
      await downloadPropositionPdf(
        row.id,
        `proposition-${formatNumeroDisplay(row.numero) !== "—" ? formatNumeroDisplay(row.numero) : row.id}`,
      );
      toast.success("Proposition PDF téléchargée.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Téléchargement impossible.");
    } finally {
      setDownloadingId(null);
    }
  };

  const openSendModal = (row: PropositionListItem) => {
    const numero = formatNumeroDisplay(row.numero);
    setPendingSend(row);
    setSendEmailTo((row.clientEmail || "").trim());
    setSendMessage(
      `Bonjour,\n\nVeuillez trouver ci-joint la proposition ${numero} au format PDF.\n\nCordialement,\n63 Agency`,
    );
  };

  const handleSendEmail = async () => {
    if (!pendingSend) return;
    const to = sendEmailTo.trim();
    const message = sendMessage.trim();

    if (!to) {
      toast.error("Email du client obligatoire.");
      return;
    }
    if (!isEmailValid(to)) {
      toast.error("Format email invalide.");
      return;
    }
    if (!message) {
      toast.error("Message obligatoire.");
      return;
    }

    setSendingId(pendingSend.id);
    try {
      const subject = `Proposition ${formatNumeroDisplay(pendingSend.numero)}`;
      await sendPropositionEmail(pendingSend.id, { to, subject, message });
      toast.success("Proposition envoyée par email.");
      setPendingSend(null);
      setSendEmailTo("");
      setSendMessage("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Envoi email impossible.");
    } finally {
      setSendingId(null);
    }
  };

  const rowBusy = (id: string) =>
    deletingId === id || downloadingId === id || sendingId === id;

  return (
    <>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <section className="min-h-[200px] lg:col-span-12">
          <div className="mb-4">
            <h3 className="text-base font-medium text-white">Propositions récentes</h3>
            <p className="text-xs uppercase tracking-widest text-zinc-500">
              {propositionListSourceLabel(listSource)}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] border-collapse font-mono text-sm text-zinc-300">
              <thead>
                <tr className="border-b border-zinc-700 text-left text-[10px] uppercase tracking-widest text-zinc-500">
                  <th className="pb-2 pr-4 font-normal">Numéro</th>
                  <th className="pb-2 pr-4 font-normal">Établissement</th>
                  <th className="pb-2 pr-4 font-normal">Préparée par</th>
                  <th className="pb-2 pr-4 font-normal">Montant total</th>
                  <th className="pb-2 pr-4 font-normal">Statut</th>
                  <th className="pb-2 font-normal">Date</th>
                  <th className="pb-2 pl-4 text-right font-normal">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-zinc-500">
                      Chargement des propositions…
                    </td>
                  </tr>
                ) : sortedRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-zinc-500">
                      {listSource === "api"
                        ? "Aucune proposition en base. Créez-en une via « Nouvelle proposition »."
                        : "Aucune proposition enregistrée pour le moment."}
                    </td>
                  </tr>
                ) : (
                  paginatedRows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-zinc-800 transition hover:bg-zinc-800/50"
                    >
                      <td className="py-3 pr-4">{formatNumeroDisplay(row.numero)}</td>
                      <td className="py-3 pr-4">{row.nomEtablissement || "—"}</td>
                      <td className="py-3 pr-4 text-zinc-200">{row.preparePar || "—"}</td>
                      <td className="py-3 pr-4 tabular-nums text-zinc-200">
                        {row.montantTotalLabel}
                      </td>
                      <td className="py-3 pr-4">{row.status || "draft"}</td>
                      <td className="py-3">
                        {row.dateEmission
                          ? new Date(row.dateEmission).toLocaleDateString("fr-FR")
                          : "—"}
                      </td>
                      <td className="py-3 pl-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              router.push(
                                `${NOUVELLE_PROPOSITION_HREF}?ref=${encodeURIComponent(row.id)}`,
                              )
                            }
                            disabled={rowBusy(row.id)}
                            className="inline-flex items-center justify-center rounded border border-zinc-700 p-1.5 text-zinc-300 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                            title="Voir / modifier la proposition"
                            aria-label="Voir la proposition"
                          >
                            <Eye className="size-3.5" aria-hidden />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDownload(row)}
                            disabled={rowBusy(row.id)}
                            className="inline-flex items-center justify-center rounded border border-zinc-700 p-1.5 text-zinc-300 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                            title="Télécharger proposition PDF"
                            aria-label="Télécharger proposition PDF"
                          >
                            <Download className="size-3.5" aria-hidden />
                          </button>
                          <button
                            type="button"
                            onClick={() => openSendModal(row)}
                            disabled={rowBusy(row.id)}
                            className="inline-flex items-center justify-center rounded border border-emerald-700/60 p-1.5 text-emerald-300 hover:bg-emerald-900/30 disabled:cursor-not-allowed disabled:opacity-50"
                            title="Envoyer la proposition par email"
                            aria-label="Envoyer la proposition par email"
                          >
                            <Send className="size-3.5" aria-hidden />
                          </button>
                          <button
                            type="button"
                            onClick={() => setPendingDelete(row)}
                            disabled={rowBusy(row.id)}
                            title="Supprimer la proposition"
                            className="inline-flex items-center justify-center rounded border border-red-700/60 p-1.5 text-red-300 hover:bg-red-900/30 disabled:cursor-not-allowed disabled:opacity-50"
                            aria-label="Supprimer la proposition"
                          >
                            <Trash2 className="size-3.5" aria-hidden />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {!loading && sortedRows.length > 0 ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800 pt-3 font-mono text-[11px] uppercase tracking-widest text-zinc-400">
              <p>
                Page {currentPage} / {totalPages} — {sortedRows.length} proposition
                {sortedRows.length > 1 ? "s" : ""}
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
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
                      className={`rounded border px-2.5 py-1.5 ${
                        item === currentPage
                          ? "border-zinc-500 bg-zinc-800 text-white"
                          : "border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                      }`}
                    >
                      {item}
                    </button>
                  ),
                )}
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="rounded border border-zinc-700 px-2.5 py-1.5 text-zinc-300 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Suivant
                </button>
              </div>
            </div>
          ) : null}

          {!loading && sortedRows.length === 0 ? (
            <p className="mt-3 text-center text-xs text-zinc-500">
              Utilise le bouton <strong className="text-zinc-400">Nouvelle proposition</strong> en
              haut à droite pour créer ton premier document.
            </p>
          ) : null}
        </section>
      </div>

      {pendingDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl">
            <h3 className="text-lg font-semibold text-white">Confirmer la suppression</h3>
            <p className="mt-2 text-sm text-zinc-300">
              Voulez-vous vraiment supprimer la proposition{" "}
              <span className="font-semibold text-white">
                {formatNumeroDisplay(pendingDelete.numero)}
              </span>
              {pendingDelete.nomEtablissement ? (
                <>
                  {" "}
                  — <span className="text-zinc-200">{pendingDelete.nomEtablissement}</span>
                </>
              ) : null}
              ? Cette action est irréversible.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                disabled={deletingId === pendingDelete.id}
                className="border border-zinc-700 px-4 py-2 font-mono text-[11px] uppercase tracking-widest text-zinc-200 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmDelete()}
                disabled={deletingId === pendingDelete.id}
                className="border border-red-700 bg-red-700/80 px-4 py-2 font-mono text-[11px] uppercase tracking-widest text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deletingId === pendingDelete.id ? "Suppression..." : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pendingSend ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl">
            <h3 className="text-lg font-semibold text-white">Envoyer la proposition par email</h3>
            <p className="mt-2 text-sm text-zinc-300">
              Proposition{" "}
              <span className="font-semibold text-white">
                {formatNumeroDisplay(pendingSend.numero)}
              </span>{" "}
              — PDF joint côté serveur lorsque l&apos;API est active.
            </p>

            <div className="mt-4 space-y-3">
              <label className="block text-sm text-zinc-200">
                Email destinataire
                <input
                  type="email"
                  value={sendEmailTo}
                  onChange={(e) => setSendEmailTo(e.target.value)}
                  placeholder="client@email.com"
                  className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-zinc-500"
                />
              </label>

              <label className="block text-sm text-zinc-200">
                Message
                <textarea
                  value={sendMessage}
                  onChange={(e) => setSendMessage(e.target.value)}
                  rows={6}
                  className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-zinc-500"
                />
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingSend(null)}
                disabled={sendingId === pendingSend.id}
                className="border border-zinc-700 px-4 py-2 font-mono text-[11px] uppercase tracking-widest text-zinc-200 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => void handleSendEmail()}
                disabled={sendingId === pendingSend.id}
                className="border border-emerald-700 bg-emerald-700/80 px-4 py-2 font-mono text-[11px] uppercase tracking-widest text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {sendingId === pendingSend.id ? "Envoi..." : "Envoyer"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
