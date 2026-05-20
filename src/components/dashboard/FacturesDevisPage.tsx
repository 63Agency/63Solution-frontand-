"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRightLeft,
  Download,
  Eye,
  FilePlus2,
  FileStack,
  FileText,
  Send,
  Plus,
  Trash2,
} from "lucide-react";
import { PropositionsSection } from "./proposition/PropositionsSection";
import { toast } from "sonner";
import {
  deleteFacture,
  deleteDevis,
  downloadFacturePdf,
  downloadDevisPdf,
  fetchDevisById,
  fetchDevisList,
  fetchFacturesList,
  sendDevisEmail,
  sendFactureEmail,
  transferDevisToFacture,
  type BackendDevisListItem,
  type TransferDevisToFactureLigne,
} from "../../../lib/devis/backend-devis";

type Tab = "devis" | "factures" | "propositions";

const NOUVEAU_DEVIS_HREF = "/dashboard/factures/devis/nouveau";
const NOUVELLE_FACTURE_HREF = "/dashboard/factures/facture/nouveau";
const NOUVELLE_PROPOSITION_HREF = "/dashboard/factures/proposition/nouveau";
const DEVIS_PER_PAGE = 10;
type PendingDelete = {
  row: BackendDevisListItem;
  kind: "devis" | "facture";
};
type PendingSend = {
  row: BackendDevisListItem;
  kind: "devis" | "facture";
};

export function FacturesDevisPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>("devis");
  const [devisRows, setDevisRows] = useState<BackendDevisListItem[]>([]);
  const [factureRows, setFactureRows] = useState<BackendDevisListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [transferringId, setTransferringId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [pendingTransfer, setPendingTransfer] = useState<BackendDevisListItem | null>(null);
  const [transferPriceValidated, setTransferPriceValidated] = useState(false);
  const [transferEditTtc, setTransferEditTtc] = useState("");
  const [transferDetailLoading, setTransferDetailLoading] = useState(false);
  const [transferDetailError, setTransferDetailError] = useState<string | null>(null);
  const [transferLignes, setTransferLignes] = useState<TransferDevisToFactureLigne[]>([]);
  const [transferTvaRate, setTransferTvaRate] = useState(20);
  const transferFetchSeq = useRef(0);
  const [pendingSend, setPendingSend] = useState<PendingSend | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sendEmailTo, setSendEmailTo] = useState("");
  const [sendMessage, setSendMessage] = useState("");
  const [hiddenConvertedDevisIds, setHiddenConvertedDevisIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [currentFacturePage, setCurrentFacturePage] = useState(1);
  const formatNumeroDisplay = (value?: string) =>
    value ? value.replace(/^FAC-/i, "FC-").replace(/^DEV-/i, "DV-") : "—";

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("hiddenConvertedDevisIds");
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        setHiddenConvertedDevisIds(parsed.filter((v): v is string => typeof v === "string"));
      }
    } catch {
      // Ignore localStorage parse issues
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const [devis, factures] = await Promise.all([fetchDevisList(), fetchFacturesList()]);
        if (!cancelled) {
          setDevisRows(devis);
          setFactureRows(factures);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Impossible de charger les devis.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const raw = searchParams.get("tab");
    if (raw === "devis" || raw === "factures" || raw === "propositions") {
      setTab(raw);
    }
  }, [searchParams]);

  const selectTab = (next: Tab) => {
    setTab(next);
    router.replace(`/dashboard/factures?tab=${next}`, { scroll: false });
  };

  const formatMad = (value: number | undefined) =>
    value == null
      ? "—"
      : `${new Intl.NumberFormat("fr-FR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(value)} MAD`;

  const transferLineTotals = useMemo(() => {
    const round2 = (x: number) => Math.round(x * 100) / 100;
    const totalHt = round2(
      transferLignes.reduce((s, l) => s + l.quantite * l.prixUnitaireHt, 0),
    );
    const montantTva = round2(totalHt * (transferTvaRate / 100));
    const totalTtc = round2(totalHt + montantTva);
    return { totalHt, montantTva, totalTtc };
  }, [transferLignes, transferTvaRate]);

  const isEmailValid = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const handleDownloadDevis = async (row: BackendDevisListItem) => {
    setError(null);
    setDownloadingId(row.id);
    try {
      await downloadDevisPdf(row.id, row.numero || `devis-${row.id}`);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Téléchargement du devis impossible.",
      );
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDownloadFacture = async (row: BackendDevisListItem) => {
    setError(null);
    setDownloadingId(row.id);
    try {
      await downloadFacturePdf(row.id, row.numero || `facture-${row.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Téléchargement de la facture impossible.");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDeleteDevis = async (row: BackendDevisListItem) => {
    setError(null);
    setDeletingId(row.id);
    try {
      await deleteDevis(row.id);
      setDevisRows((prev) => prev.filter((d) => d.id !== row.id));
      toast.success("Devis supprimé avec succès.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Suppression du devis impossible.");
      toast.error(e instanceof Error ? e.message : "Suppression du devis impossible.");
    } finally {
      setDeletingId(null);
      setPendingDelete(null);
    }
  };

  const handleDeleteFacture = async (row: BackendDevisListItem) => {
    setError(null);
    setDeletingId(row.id);
    try {
      await deleteFacture(row.id);
      setFactureRows((prev) => prev.filter((f) => f.id !== row.id));
      toast.success("Facture supprimée avec succès.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Suppression de la facture impossible.");
      toast.error(e instanceof Error ? e.message : "Suppression de la facture impossible.");
    } finally {
      setDeletingId(null);
      setPendingDelete(null);
    }
  };

  const numberToTransferInput = (value: number | undefined) =>
    value != null && Number.isFinite(value) ? String(value) : "";

  const parseTransferTtcInput = (): number | null => {
    const t = transferEditTtc.trim().replace(",", ".");
    if (t === "") {
      toast.error("Renseigne le total TTC (nombre ≥ 0).");
      return null;
    }
    const n = Number.parseFloat(t);
    if (!Number.isFinite(n) || n < 0) {
      toast.error("Total TTC invalide (nombre ≥ 0, virgule ou point acceptés).");
      return null;
    }
    return n;
  };

  /** Dérive HT / TVA pour l’API à partir du seul TTC saisi (répartition proportionnelle au devis). */
  const buildTransferTotalsFromTtc = (
    row: BackendDevisListItem,
    newTtc: number,
  ): { totalHt: number; montantTva: number; totalTtc: number } => {
    const round2 = (x: number) => Math.round(x * 100) / 100;
    const oHt = row.totals?.totalHt;
    const oTva = row.totals?.montantTva;
    const oTtc = row.totals?.totalTtc;

    const htOk = typeof oHt === "number" && Number.isFinite(oHt) && oHt >= 0;
    const tvaOk = typeof oTva === "number" && Number.isFinite(oTva) && oTva >= 0;
    const ttcOk = typeof oTtc === "number" && Number.isFinite(oTtc) && oTtc > 0;

    if (htOk && tvaOk && ttcOk) {
      const f = newTtc / oTtc;
      return {
        totalHt: round2(oHt * f),
        montantTva: round2(oTva * f),
        totalTtc: round2(newTtc),
      };
    }

    const sumParts = (htOk ? oHt! : 0) + (tvaOk ? oTva! : 0);
    if (htOk && tvaOk && sumParts > 0) {
      const f = newTtc / sumParts;
      return {
        totalHt: round2(oHt * f),
        montantTva: round2(oTva * f),
        totalTtc: round2(newTtc),
      };
    }

    return {
      totalHt: round2(newTtc),
      montantTva: 0,
      totalTtc: round2(newTtc),
    };
  };

  const closeTransferModal = () => {
    transferFetchSeq.current += 1;
    setPendingTransfer(null);
    setTransferPriceValidated(false);
    setTransferEditTtc("");
    setTransferLignes([]);
    setTransferDetailError(null);
    setTransferDetailLoading(false);
    setTransferTvaRate(20);
  };

  const patchTransferLigneAt = (
    index: number,
    patch: Partial<TransferDevisToFactureLigne>,
  ) => {
    setTransferPriceValidated(false);
    setTransferLignes((prev) => {
      const next = [...prev];
      const cur = next[index];
      if (!cur) return prev;
      next[index] = { ...cur, ...patch };
      return next;
    });
  };

  const openTransferModal = (row: BackendDevisListItem) => {
    const seq = ++transferFetchSeq.current;
    setTransferPriceValidated(false);
    setTransferEditTtc(numberToTransferInput(row.totals?.totalTtc));
    setPendingTransfer(row);
    setTransferDetailError(null);
    setTransferLignes([]);
    setTransferDetailLoading(true);

    void (async () => {
      try {
        const full = await fetchDevisById(row.id);
        if (transferFetchSeq.current !== seq) return;

        let tva = 20;
        if (typeof full.tvaTaux === "number" && Number.isFinite(full.tvaTaux) && full.tvaTaux >= 0) {
          tva = full.tvaTaux;
        } else {
          const th = full.totals?.totalHt ?? row.totals?.totalHt;
          const mtv = full.totals?.montantTva ?? row.totals?.montantTva;
          if (typeof th === "number" && th > 0 && typeof mtv === "number" && mtv >= 0) {
            tva = (mtv / th) * 100;
          }
        }
        setTransferTvaRate(Math.round(tva * 100) / 100);

        const list = full.lignes ?? [];
        const mapped: TransferDevisToFactureLigne[] = list.map((l, i) => ({
          id: typeof l.id === "string" && l.id.length > 0 ? l.id : `line-${i}`,
          titre: (String(l.titre ?? `Ligne ${i + 1}`).trim() || `Ligne ${i + 1}`),
          description: typeof l.description === "string" ? l.description : "",
          quantite:
            typeof l.quantite === "number" && Number.isFinite(l.quantite)
              ? Math.max(1, Math.floor(l.quantite))
              : 1,
          prixUnitaireHt:
            typeof l.prixUnitaireHt === "number" &&
            Number.isFinite(l.prixUnitaireHt) &&
            l.prixUnitaireHt >= 0
              ? l.prixUnitaireHt
              : 0,
        }));
        setTransferLignes(mapped);
      } catch (e) {
        if (transferFetchSeq.current !== seq) return;
        setTransferDetailError(
          e instanceof Error ? e.message : "Impossible de charger le détail du devis.",
        );
        setTransferLignes([]);
      } finally {
        if (transferFetchSeq.current === seq) setTransferDetailLoading(false);
      }
    })();
  };

  const handleTransferToFacture = async (
    row: BackendDevisListItem,
    totals: { totalHt: number; montantTva: number; totalTtc: number },
    options?: { lignes?: TransferDevisToFactureLigne[]; tvaTaux?: number },
  ) => {
    setError(null);
    setTransferringId(row.id);
    try {
      const facture = await transferDevisToFacture(row.id, {
        totals,
        ...(options?.lignes && options.lignes.length > 0
          ? { lignes: options.lignes, tvaTaux: options.tvaTaux }
          : {}),
      });
      const factures = await fetchFacturesList();
      // Hide the converted devis immediately from the devis table.
      setDevisRows((prev) => prev.filter((d) => d.id !== row.id));
      setHiddenConvertedDevisIds((prev) => {
        if (prev.includes(row.id)) return prev;
        const next = [...prev, row.id];
        window.localStorage.setItem("hiddenConvertedDevisIds", JSON.stringify(next));
        return next;
      });
      setFactureRows(factures);
      setTab("factures");
      closeTransferModal();
      toast.success(
        `Devis transféré en facture${facture.numero ? ` (${formatNumeroDisplay(facture.numero)})` : ""}.`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Transfert devis -> facture impossible.";
      setError(msg);
      toast.error(msg);
    } finally {
      setTransferringId(null);
    }
  };

  const openSendModal = (row: BackendDevisListItem, kind: "devis" | "facture") => {
    const numero = formatNumeroDisplay(row.numero);
    setPendingSend({ row, kind });
    setSendEmailTo((row.clientEmail || "").trim());
    setSendMessage(
      kind === "devis"
        ? `Bonjour,\n\nVeuillez trouver ci-joint le devis ${numero} au format PDF.\n\nCordialement.`
        : `Bonjour,\n\nVeuillez trouver ci-joint la facture ${numero} au format PDF.\n\nCordialement.`,
    );
  };

  const handleSendDocumentEmail = async () => {
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

    setError(null);
    setSendingId(pendingSend.row.id);
    try {
      const subject = `${
        pendingSend.kind === "devis" ? "Devis" : "Facture"
      } ${formatNumeroDisplay(pendingSend.row.numero)}`;
      if (pendingSend.kind === "devis") {
        await sendDevisEmail(pendingSend.row.id, { to, subject, message });
      } else {
        await sendFactureEmail(pendingSend.row.id, { to, subject, message });
      }
      toast.success(
        `${pendingSend.kind === "devis" ? "Devis" : "Facture"} envoyé(e) par email avec succès.`,
      );
      setPendingSend(null);
      setSendEmailTo("");
      setSendMessage("");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Envoi email impossible.";
      setError(msg);
      toast.error(msg);
    } finally {
      setSendingId(null);
    }
  };

  const sortedDevis = useMemo(
    () =>
      [...devisRows]
        .filter((row) => !hiddenConvertedDevisIds.includes(row.id))
        .sort((a, b) => {
          const da = new Date(a.createdAt || a.dateEmission || 0).getTime();
          const db = new Date(b.createdAt || b.dateEmission || 0).getTime();
          return db - da;
        }),
    [devisRows, hiddenConvertedDevisIds],
  );
  const sortedFactures = useMemo(
    () =>
      [...factureRows].sort((a, b) => {
        const da = new Date(a.createdAt || a.dateEmission || 0).getTime();
        const db = new Date(b.createdAt || b.dateEmission || 0).getTime();
        return db - da;
      }),
    [factureRows],
  );

  const totalPages = Math.max(1, Math.ceil(sortedDevis.length / DEVIS_PER_PAGE));

  const paginatedDevis = useMemo(() => {
    const start = (currentPage - 1) * DEVIS_PER_PAGE;
    return sortedDevis.slice(start, start + DEVIS_PER_PAGE);
  }, [sortedDevis, currentPage]);
  const totalFacturePages = Math.max(1, Math.ceil(sortedFactures.length / DEVIS_PER_PAGE));
  const paginatedFactures = useMemo(() => {
    const start = (currentFacturePage - 1) * DEVIS_PER_PAGE;
    return sortedFactures.slice(start, start + DEVIS_PER_PAGE);
  }, [sortedFactures, currentFacturePage]);

  const pageItems = useMemo<(number | "...")[]>(() => {
    if (totalPages <= 3) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const items: (number | "...")[] = [];
    items.push(1);

    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);

    if (start > 2) {
      items.push("...");
    }

    for (let page = start; page <= end; page += 1) {
      items.push(page);
    }

    if (end < totalPages - 1) {
      items.push("...");
    }

    items.push(totalPages);
    return items;
  }, [currentPage, totalPages]);
  const facturePageItems = useMemo<(number | "...")[]>(() => {
    if (totalFacturePages <= 3) {
      return Array.from({ length: totalFacturePages }, (_, i) => i + 1);
    }

    const items: (number | "...")[] = [];
    items.push(1);

    const start = Math.max(2, currentFacturePage - 1);
    const end = Math.min(totalFacturePages - 1, currentFacturePage + 1);

    if (start > 2) {
      items.push("...");
    }

    for (let page = start; page <= end; page += 1) {
      items.push(page);
    }

    if (end < totalFacturePages - 1) {
      items.push("...");
    }

    items.push(totalFacturePages);
    return items;
  }, [currentFacturePage, totalFacturePages]);

  useEffect(() => {
    setCurrentPage(1);
    setCurrentFacturePage(1);
  }, [tab]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);
  useEffect(() => {
    if (currentFacturePage > totalFacturePages) {
      setCurrentFacturePage(totalFacturePages);
    }
  }, [currentFacturePage, totalFacturePages]);

  return (
    <>
      <header className="flex shrink-0 flex-col gap-4 border-b border-zinc-800 px-6 py-5 md:flex-row md:items-end md:justify-between md:px-8 md:py-6">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-zinc-500">
            Facturation
          </p>
          <h1 className="text-4xl font-semibold leading-tight text-white">
            Devis, factures & propositions
          </h1>
        </div>
        <p className="max-w-md font-mono text-xs uppercase tracking-wider text-zinc-500">
          Devis, factures et propositions commerciales — chaque type avec son propre modèle.
        </p>
      </header>

      <div className="flex flex-col gap-6 px-6 py-6 md:px-8 md:py-8">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-4 font-mono text-[11px] uppercase tracking-widest">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => selectTab("devis")}
              className={`border px-4 py-2 transition ${
                tab === "devis"
                  ? "border-zinc-700 bg-zinc-800 text-white"
                  : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <FilePlus2 className="size-4" aria-hidden />
                Devis
              </span>
            </button>
            <button
              type="button"
              onClick={() => selectTab("factures")}
              className={`border px-4 py-2 transition ${
                tab === "factures"
                  ? "border-zinc-700 bg-zinc-800 text-white"
                  : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <FileText className="size-4" aria-hidden />
                Factures
              </span>
            </button>
            <button
              type="button"
              onClick={() => selectTab("propositions")}
              className={`border px-4 py-2 transition ${
                tab === "propositions"
                  ? "border-zinc-700 bg-zinc-800 text-white"
                  : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <FileStack className="size-4" aria-hidden />
                Propositions
              </span>
            </button>
          </div>
          <Link
            href={
              tab === "devis"
                ? NOUVEAU_DEVIS_HREF
                : tab === "factures"
                  ? NOUVELLE_FACTURE_HREF
                  : NOUVELLE_PROPOSITION_HREF
            }
            className="inline-flex items-center justify-center gap-2 rounded-md border border-indigo-500 bg-indigo-600 px-4 py-2 font-mono text-[11px] uppercase tracking-widest text-white transition hover:bg-indigo-500"
          >
            <Plus className="size-4" aria-hidden />
            {tab === "devis"
              ? "Nouveau devis"
              : tab === "factures"
                ? "Nouvelle facture"
                : "Nouvelle proposition"}
          </Link>
        </div>

        {tab === "devis" ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <section className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-5 lg:col-span-12 min-h-[200px]">
              <div className="mb-4">
                <h3 className="text-base font-medium text-white">Devis récents</h3>
                <p className="text-xs uppercase tracking-widest text-zinc-500">
                  Aperçu
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] border-collapse font-mono text-sm text-zinc-300">
                  <thead>
                    <tr className="border-b border-zinc-700 text-left text-[10px] uppercase tracking-widest text-zinc-500">
                      <th className="pb-2 pr-4 font-normal">Numéro</th>
                      <th className="pb-2 pr-4 font-normal">Client</th>
                      <th className="pb-2 pr-4 font-normal">Montant TTC</th>
                      <th className="pb-2 pr-4 font-normal">Statut</th>
                      <th className="pb-2 font-normal">Date</th>
                      <th className="pb-2 pl-4 text-right font-normal">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-zinc-500">
                          Chargement des devis...
                        </td>
                      </tr>
                    ) : error ? (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-red-400">
                          {error}
                        </td>
                      </tr>
                    ) : sortedDevis.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-zinc-500">
                          Aucun devis enregistré pour le moment.
                        </td>
                      </tr>
                    ) : (
                      paginatedDevis.map((row) => (
                        <tr
                          key={row.id}
                          className="border-b border-zinc-800 transition hover:bg-zinc-800/50"
                        >
                          <td className="py-3 pr-4">{formatNumeroDisplay(row.numero)}</td>
                          <td className="py-3 pr-4">{row.clientNom || "—"}</td>
                          <td className="py-3 pr-4">{formatMad(row.totals?.totalTtc)}</td>
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
                                    `${NOUVEAU_DEVIS_HREF}?ref=${encodeURIComponent(row.id)}`,
                                  )
                                }
                                className="inline-flex items-center justify-center rounded border border-zinc-700 p-1.5 text-zinc-300 hover:bg-zinc-800"
                                title="Voir détail devis"
                                aria-label="Voir détail devis"
                              >
                                <Eye className="size-3.5" aria-hidden />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDownloadDevis(row)}
                                disabled={downloadingId === row.id || deletingId === row.id}
                                className="inline-flex items-center justify-center rounded border border-zinc-700 p-1.5 text-zinc-300 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                                title="Télécharger devis PDF"
                                aria-label="Télécharger devis PDF"
                              >
                                <Download className="size-3.5" aria-hidden />
                              </button>
                              <button
                                type="button"
                                onClick={() => openSendModal(row, "devis")}
                                disabled={
                                  deletingId === row.id ||
                                  downloadingId === row.id ||
                                  transferringId === row.id ||
                                  sendingId === row.id
                                }
                                className="inline-flex items-center justify-center rounded border border-emerald-700/60 p-1.5 text-emerald-300 hover:bg-emerald-900/30 disabled:cursor-not-allowed disabled:opacity-60"
                                title="Envoyer devis par email"
                                aria-label="Envoyer devis par email"
                              >
                                <Send className="size-3.5" aria-hidden />
                              </button>
                              <button
                                type="button"
                                onClick={() => setPendingDelete({ row, kind: "devis" })}
                                disabled={
                                  deletingId === row.id ||
                                  downloadingId === row.id ||
                                  transferringId === row.id
                                }
                                className="inline-flex items-center justify-center rounded border border-red-700/60 p-1.5 text-red-300 hover:bg-red-900/30 disabled:cursor-not-allowed disabled:opacity-60"
                                title="Supprimer devis"
                                aria-label="Supprimer devis"
                              >
                                <Trash2 className="size-3.5" aria-hidden />
                              </button>
                              <button
                                type="button"
                                onClick={() => openTransferModal(row)}
                                disabled={
                                  deletingId === row.id ||
                                  downloadingId === row.id ||
                                  transferringId === row.id
                                }
                                className="inline-flex items-center justify-center rounded border border-indigo-700/60 p-1.5 text-indigo-300 hover:bg-indigo-900/30 disabled:cursor-not-allowed disabled:opacity-60"
                                title="Transférer en facture"
                                aria-label="Transférer en facture"
                              >
                                <ArrowRightLeft className="size-3.5" aria-hidden />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {!loading && !error && sortedDevis.length > 0 ? (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800 pt-3 font-mono text-[11px] uppercase tracking-widest text-zinc-400">
                  <p>
                    Page {currentPage} / {totalPages} - {sortedDevis.length} devis
                  </p>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="rounded border border-zinc-700 px-2.5 py-1.5 text-zinc-300 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Precedent
                    </button>
                    {pageItems.map((item, idx) =>
                      item === "..." ? (
                        <span key={`dots-${idx}`} className="px-1 text-zinc-500">
                          ...
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
            </section>
          </div>
        ) : tab === "factures" ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <section className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-5 lg:col-span-12 min-h-[200px]">
              <div className="mb-4">
                <h3 className="text-base font-medium text-white">Factures récentes</h3>
                <p className="text-xs uppercase tracking-widest text-zinc-500">
                  Aperçu
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] border-collapse font-mono text-sm text-zinc-300">
                  <thead>
                    <tr className="border-b border-zinc-700 text-left text-[10px] uppercase tracking-widest text-zinc-500">
                      <th className="pb-2 pr-4 font-normal">Numéro</th>
                      <th className="pb-2 pr-4 font-normal">Client</th>
                      <th className="pb-2 pr-4 font-normal">Montant TTC</th>
                      <th className="pb-2 pr-4 font-normal">Statut</th>
                      <th className="pb-2 font-normal">Date</th>
                      <th className="pb-2 pl-4 text-right font-normal">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-zinc-500">
                          Chargement des factures...
                        </td>
                      </tr>
                    ) : error ? (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-red-400">
                          {error}
                        </td>
                      </tr>
                    ) : sortedFactures.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-zinc-500">
                          Aucune facture réelle disponible pour le moment.
                        </td>
                      </tr>
                    ) : (
                      paginatedFactures.map((row) => (
                        <tr
                          key={row.id}
                          className="border-b border-zinc-800 transition hover:bg-zinc-800/50"
                        >
                          <td className="py-3 pr-4">{formatNumeroDisplay(row.numero)}</td>
                          <td className="py-3 pr-4">{row.clientNom || "—"}</td>
                          <td className="py-3 pr-4">{formatMad(row.totals?.totalTtc)}</td>
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
                                    `${NOUVELLE_FACTURE_HREF}?ref=${encodeURIComponent(row.id)}`,
                                  )
                                }
                                className="inline-flex items-center justify-center rounded border border-zinc-700 p-1.5 text-zinc-300 hover:bg-zinc-800"
                                title="Voir détail facture"
                                aria-label="Voir détail facture"
                              >
                                <Eye className="size-3.5" aria-hidden />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDownloadFacture(row)}
                                disabled={downloadingId === row.id || deletingId === row.id}
                                className="inline-flex items-center justify-center rounded border border-zinc-700 p-1.5 text-zinc-300 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                                title="Télécharger facture PDF"
                                aria-label="Télécharger facture PDF"
                              >
                                <Download className="size-3.5" aria-hidden />
                              </button>
                              <button
                                type="button"
                                onClick={() => openSendModal(row, "facture")}
                                disabled={
                                  deletingId === row.id ||
                                  downloadingId === row.id ||
                                  sendingId === row.id
                                }
                                className="inline-flex items-center justify-center rounded border border-emerald-700/60 p-1.5 text-emerald-300 hover:bg-emerald-900/30 disabled:cursor-not-allowed disabled:opacity-60"
                                title="Envoyer facture par email"
                                aria-label="Envoyer facture par email"
                              >
                                <Send className="size-3.5" aria-hidden />
                              </button>
                              <button
                                type="button"
                                onClick={() => setPendingDelete({ row, kind: "facture" })}
                                disabled={deletingId === row.id || downloadingId === row.id}
                                className="inline-flex items-center justify-center rounded border border-red-700/60 p-1.5 text-red-300 hover:bg-red-900/30 disabled:cursor-not-allowed disabled:opacity-60"
                                title="Supprimer facture"
                                aria-label="Supprimer facture"
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
              {!loading && !error && sortedFactures.length > 0 ? (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800 pt-3 font-mono text-[11px] uppercase tracking-widest text-zinc-400">
                  <p>
                    Page {currentFacturePage} / {totalFacturePages} - {sortedFactures.length} factures
                  </p>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setCurrentFacturePage((p) => Math.max(1, p - 1))}
                      disabled={currentFacturePage === 1}
                      className="rounded border border-zinc-700 px-2.5 py-1.5 text-zinc-300 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Precedent
                    </button>
                    {facturePageItems.map((item, idx) =>
                      item === "..." ? (
                        <span key={`facture-dots-${idx}`} className="px-1 text-zinc-500">
                          ...
                        </span>
                      ) : (
                        <button
                          key={item}
                          type="button"
                          onClick={() => setCurrentFacturePage(item)}
                          className={`rounded border px-2.5 py-1.5 ${
                            item === currentFacturePage
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
                      onClick={() =>
                        setCurrentFacturePage((p) => Math.min(totalFacturePages, p + 1))
                      }
                      disabled={currentFacturePage === totalFacturePages}
                      className="rounded border border-zinc-700 px-2.5 py-1.5 text-zinc-300 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Suivant
                    </button>
                  </div>
                </div>
              ) : null}
            </section>
          </div>
        ) : (
          <PropositionsSection />
        )}
      </div>

      {pendingDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl">
            <h3 className="text-lg font-semibold text-white">Confirmer la suppression</h3>
            <p className="mt-2 text-sm text-zinc-300">
              Voulez-vous vraiment supprimer {pendingDelete.kind === "facture" ? "la facture" : "le devis"}{" "}
              <span className="font-semibold text-white">
                {pendingDelete.row.numero
                  ? formatNumeroDisplay(pendingDelete.row.numero)
                  : pendingDelete.row.id}
              </span>{" "}
              ? Cette action est irréversible.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                disabled={deletingId === pendingDelete.row.id}
                className="rounded-md border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() =>
                  pendingDelete.kind === "facture"
                    ? handleDeleteFacture(pendingDelete.row)
                    : handleDeleteDevis(pendingDelete.row)
                }
                disabled={deletingId === pendingDelete.row.id}
                className="rounded-md border border-red-700 bg-red-700/80 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deletingId === pendingDelete.row.id ? "Suppression..." : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pendingTransfer ? (
        <div className="fixed inset-0 z-50 overflow-y-auto overscroll-y-contain bg-black/60">
          <div className="mx-auto flex min-h-dvh w-full max-w-[calc(100vw-0.5rem)] flex-col items-stretch justify-center px-3 py-6 pb-[max(1.5rem,calc(env(safe-area-inset-bottom)+1rem))] pt-[max(0.75rem,env(safe-area-inset-top))] sm:max-w-none sm:px-4 sm:py-8">
            <div
              className={`mx-auto flex min-h-0 w-full flex-col overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl ${
                transferLignes.length > 0 || transferDetailLoading
                  ? "h-[calc(100dvh-1.75rem-env(safe-area-inset-top,0)-env(safe-area-inset-bottom,0))] max-h-[calc(100dvh-1.75rem-env(safe-area-inset-top,0)-env(safe-area-inset-bottom,0))] max-w-4xl"
                  : "max-h-[min(calc(100dvh-2rem),28rem)] max-w-md overflow-y-auto"
              }`}
            >
            <div className="shrink-0 border-b border-zinc-800 px-5 py-4 sm:px-6 sm:py-5">
              <h3 className="text-lg font-semibold text-white">Transférer en facture</h3>
              <p className="mt-2 text-pretty text-sm leading-relaxed text-zinc-300">
                Devis{" "}
                <span className="font-semibold text-white">
                  {pendingTransfer.numero
                    ? formatNumeroDisplay(pendingTransfer.numero)
                    : pendingTransfer.id}
                </span>
                {transferLignes.length > 0
                  ? " : ajuste chaque ligne (quantité, prix unitaire HT) et le taux de TVA si besoin. Les totaux se mettent à jour automatiquement."
                  : " : si le détail ne contient pas de lignes, saisis le total TTC souhaité."}
              </p>

              {transferDetailLoading ? (
                <p className="mt-3 text-sm text-zinc-400">Chargement des lignes du devis…</p>
              ) : null}
              {transferDetailError ? (
                <p className="mt-3 rounded-md border border-amber-800/50 bg-amber-950/25 px-3 py-2 text-sm text-amber-100">
                  {transferDetailError} Tu peux quand même utiliser le total TTC ci-dessous si le
                  devis a des montants connus.
                </p>
              ) : null}
            </div>

            <div
              className={
                transferLignes.length > 0 || transferDetailLoading
                  ? "min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6"
                  : "px-5 py-4 sm:px-6"
              }
            >
            {transferLignes.length > 0 ? (
              <div className="mt-4 space-y-3">
                <div className="-mx-1 overflow-x-auto rounded-lg border border-zinc-700 bg-zinc-950/80 sm:mx-0">
                  <table className="w-full min-w-xl table-fixed text-left text-sm">
                    <colgroup>
                      <col className="w-[46%]" />
                      <col className="w-[12%]" />
                      <col className="w-[22%]" />
                      <col className="w-[20%]" />
                    </colgroup>
                    <thead className="bg-zinc-900 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                      <tr>
                        <th className="px-3 py-2">Désignation</th>
                        <th className="px-2 py-2">Qté</th>
                        <th className="px-2 py-2">PU HT (MAD)</th>
                        <th className="px-3 py-2 text-right">Total HT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transferLignes.map((ligne, idx) => {
                        const ligneHt =
                          Math.round(ligne.quantite * ligne.prixUnitaireHt * 100) / 100;
                        return (
                          <tr key={`transfer-ligne-${idx}`} className="border-t border-zinc-800">
                            <td className="px-3 py-3 align-top text-zinc-200">
                              <div className="wrap-break-word font-medium leading-snug">
                                {ligne.titre}
                              </div>
                              {ligne.description ? (
                                <div className="mt-2 whitespace-pre-wrap wrap-break-word text-xs leading-relaxed text-zinc-500">
                                  {ligne.description}
                                </div>
                              ) : null}
                            </td>
                            <td className="px-2 py-3 align-top">
                              <input
                                type="number"
                                min={1}
                                step={1}
                                value={ligne.quantite}
                                onChange={(e) =>
                                  patchTransferLigneAt(idx, {
                                    quantite: Math.max(
                                      1,
                                      Number.parseInt(e.target.value || "1", 10) || 1,
                                    ),
                                  })
                                }
                                disabled={transferringId === pendingTransfer.id}
                                className="w-full min-w-0 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-zinc-100 outline-none focus:border-zinc-500 disabled:opacity-50"
                              />
                            </td>
                            <td className="px-2 py-3 align-top">
                              <input
                                type="number"
                                min={0}
                                step={0.01}
                                value={
                                  Number.isFinite(ligne.prixUnitaireHt)
                                    ? ligne.prixUnitaireHt
                                    : 0
                                }
                                onChange={(e) => {
                                  const v = Number.parseFloat(e.target.value);
                                  patchTransferLigneAt(idx, {
                                    prixUnitaireHt: Number.isFinite(v) && v >= 0 ? v : 0,
                                  });
                                }}
                                disabled={transferringId === pendingTransfer.id}
                                className="w-full min-w-0 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-zinc-100 outline-none focus:border-zinc-500 disabled:opacity-50"
                              />
                            </td>
                            <td className="px-3 py-3 align-top text-right font-mono text-sm text-zinc-200">
                              {formatMad(ligneHt)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-wrap items-end gap-4">
                  <label className="text-sm text-zinc-200">
                    <span className="block text-xs text-zinc-500">TVA (%)</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.01}
                      value={transferTvaRate}
                      onChange={(e) => {
                        setTransferPriceValidated(false);
                        const v = Number.parseFloat(e.target.value.replace(",", "."));
                        if (Number.isFinite(v) && v >= 0 && v <= 100) {
                          setTransferTvaRate(Math.round(v * 100) / 100);
                        }
                      }}
                      disabled={transferringId === pendingTransfer.id}
                      className="mt-1 w-28 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-zinc-100 outline-none focus:border-zinc-500 disabled:opacity-50"
                    />
                  </label>
                </div>
                <div className="space-y-1 rounded-lg border border-zinc-700 bg-zinc-950/80 p-4 font-mono text-sm text-zinc-200">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Total HT</span>
                    <span>{formatMad(transferLineTotals.totalHt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Montant TVA</span>
                    <span>{formatMad(transferLineTotals.montantTva)}</span>
                  </div>
                  <div className="flex justify-between border-t border-zinc-800 pt-2 font-medium text-white">
                    <span>Total TTC</span>
                    <span>{formatMad(transferLineTotals.totalTtc)}</span>
                  </div>
                </div>
              </div>
            ) : !transferDetailLoading ? (
              <div className="mt-4 space-y-2 rounded-lg border border-zinc-700 bg-zinc-950/80 p-4 font-mono text-sm">
                <p className="text-[10px] uppercase tracking-widest text-zinc-500">
                  Prix (MAD) — saisie manuelle
                </p>
                <label className="block text-zinc-200">
                  <span className="text-xs text-zinc-500">Total TTC</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={transferEditTtc}
                    onChange={(e) => {
                      setTransferEditTtc(e.target.value);
                      setTransferPriceValidated(false);
                    }}
                    disabled={transferringId === pendingTransfer.id}
                    className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500 disabled:opacity-50"
                    placeholder="0"
                    autoComplete="off"
                  />
                </label>
                <p className="text-xs text-zinc-500">
                  Sans lignes sur le devis, le backend reçoit une répartition HT / TVA
                  proportionnelle aux totaux connus du devis pour ce TTC.
                </p>
              </div>
            ) : null}
            </div>

            <div className="shrink-0 border-t border-zinc-800 bg-zinc-900 px-5 py-4 sm:px-6">
              <label className="flex cursor-pointer items-start gap-3 text-pretty text-sm leading-relaxed text-zinc-300">
                <input
                  type="checkbox"
                  checked={transferPriceValidated}
                  onChange={(e) => setTransferPriceValidated(e.target.checked)}
                  disabled={transferringId === pendingTransfer.id}
                  className="mt-0.5 size-4 shrink-0 rounded border-zinc-600 bg-zinc-950 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
                />
                <span>
                  {transferLignes.length > 0
                    ? "Je confirme les lignes, le taux de TVA et les totaux affichés, et j’accepte de créer la facture avec ces montants."
                    : "Je confirme le total TTC saisi et j’accepte de créer la facture avec ce montant."}
                </span>
              </label>
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={closeTransferModal}
                  disabled={transferringId === pendingTransfer.id}
                  className="rounded-md border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!pendingTransfer) return;
                    if (transferLignes.length > 0) {
                      const invalid = transferLignes.some(
                        (l) =>
                          !Number.isFinite(l.quantite) ||
                          l.quantite < 1 ||
                          !Number.isFinite(l.prixUnitaireHt) ||
                          l.prixUnitaireHt < 0,
                      );
                      if (invalid) {
                        toast.error("Vérifie les quantités (≥ 1) et les prix unitaires HT (≥ 0).");
                        return;
                      }
                      if (
                        !Number.isFinite(transferTvaRate) ||
                        transferTvaRate < 0 ||
                        transferTvaRate > 100
                      ) {
                        toast.error("TVA % invalide (entre 0 et 100).");
                        return;
                      }
                      void handleTransferToFacture(pendingTransfer, transferLineTotals, {
                        lignes: transferLignes,
                        tvaTaux: transferTvaRate,
                      });
                      return;
                    }
                    const ttc = parseTransferTtcInput();
                    if (ttc === null) return;
                    const totals = buildTransferTotalsFromTtc(pendingTransfer, ttc);
                    void handleTransferToFacture(pendingTransfer, totals);
                  }}
                  disabled={
                    transferringId === pendingTransfer.id ||
                    !transferPriceValidated ||
                    transferDetailLoading
                  }
                  className="rounded-md border border-indigo-700 bg-indigo-700/80 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {transferringId === pendingTransfer.id
                    ? "Transfert..."
                    : "Transférer en facture"}
                </button>
              </div>
            </div>
            </div>
          </div>
        </div>
      ) : null}

      {pendingSend ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl">
            <h3 className="text-lg font-semibold text-white">
              Envoyer {pendingSend.kind === "devis" ? "le devis" : "la facture"} par email
            </h3>
            <p className="mt-2 text-sm text-zinc-300">
              {pendingSend.kind === "devis" ? "Devis" : "Facture"}{" "}
              <span className="font-semibold text-white">
                {pendingSend.row.numero
                  ? formatNumeroDisplay(pendingSend.row.numero)
                  : pendingSend.row.id}
              </span>{" "}
              sera envoyé en PDF au client.
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
                disabled={sendingId === pendingSend.row.id}
                className="rounded-md border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSendDocumentEmail}
                disabled={sendingId === pendingSend.row.id}
                className="rounded-md border border-emerald-700 bg-emerald-700/80 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {sendingId === pendingSend.row.id ? "Envoi..." : "Envoyer"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
