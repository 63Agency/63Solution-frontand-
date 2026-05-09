"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Download } from "lucide-react";
import { toast } from "sonner";
import {
  defaultDevisForm,
  ligneTotalHt,
  type DevisFormState,
  type DevisLigne,
} from "./devis-types";
import {
  createFacture,
  createDevis,
  downloadFacturePdf,
  fetchDevisById,
  fetchFactureById,
  downloadDevisPdf,
  toBackendDevisPayload,
  updateFacture,
  updateDevis,
} from "../../../../lib/devis/backend-devis";

type NouveauDevisPageProps = {
  mode?: "devis" | "facture";
};

export function NouveauDevisPage({ mode = "devis" }: NouveauDevisPageProps) {
  const isFacture = mode === "facture";
  const docLabel = isFacture ? "Facture" : "Devis";
  const docLabelLower = isFacture ? "facture" : "devis";
  const formatNumeroDisplay = (value: string): string =>
    value.replace(/^FAC-/i, "FC-").replace(/^DEV-/i, "DV-");

  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState<DevisFormState>(defaultDevisForm);
  const [devisId, setDevisId] = useState<string | null>(null);
  const [busy, setBusy] = useState<"idle" | "saving" | "downloading">("idle");
  const [editingEmitter, setEditingEmitter] = useState(false);

  useEffect(() => {
    const ref = searchParams.get("ref");
    if (!ref) return;
    let cancelled = false;

    const load = async () => {
      try {
        const devis = isFacture ? await fetchFactureById(ref) : await fetchDevisById(ref);
        if (cancelled) return;
        setDevisId(devis.id);
        setData((prev) => ({
          ...prev,
          societeNom: devis.societeNom ?? prev.societeNom,
          societeRc: devis.societeRc ?? prev.societeRc,
          societeCnie: devis.societeCnie ?? prev.societeCnie,
          societeIce: devis.societeIce ?? prev.societeIce,
          societeTp: devis.societeTp ?? prev.societeTp,
          societeAdresse: devis.societeAdresse ?? prev.societeAdresse,
          societeTelephone: devis.societeTelephone ?? prev.societeTelephone,
          societeEmail: devis.societeEmail ?? prev.societeEmail,
          clientNom: devis.clientNom ?? prev.clientNom,
          clientIce: devis.clientIce ?? prev.clientIce,
          clientEmail: devis.clientEmail ?? prev.clientEmail,
          clientTelephone: devis.clientTelephone ?? prev.clientTelephone,
          devisNumero: devis.numero ?? prev.devisNumero,
          dateEmission: devis.dateEmission ?? prev.dateEmission,
          mentionTva: devis.mentionTva ?? prev.mentionTva,
          paiementMode: devis.paiementMode ?? prev.paiementMode,
          paiementBanque: devis.paiementBanque ?? prev.paiementBanque,
          paiementTitulaire: devis.paiementTitulaire ?? prev.paiementTitulaire,
          paiementRib: devis.paiementRib ?? prev.paiementRib,
          lignes:
            devis.lignes && devis.lignes.length > 0
              ? prev.lignes.map((line, idx) => ({
                  ...line,
                  id: devis.lignes?.[idx]?.id ?? line.id,
                  titre: devis.lignes?.[idx]?.titre ?? line.titre,
                  description: devis.lignes?.[idx]?.description ?? line.description,
                  quantite:
                    typeof devis.lignes?.[idx]?.quantite === "number"
                      ? (devis.lignes[idx].quantite as number)
                      : line.quantite,
                  prixUnitaireHt:
                    typeof devis.lignes?.[idx]?.prixUnitaireHt === "number"
                      ? (devis.lignes[idx].prixUnitaireHt as number)
                      : line.prixUnitaireHt,
                }))
              : prev.lignes,
        }));
      } catch (e) {
        if (!cancelled) {
          toast.error(
            e instanceof Error
              ? `Chargement ${docLabelLower} impossible: ${e.message}`
              : `Chargement ${docLabelLower} impossible.`,
          );
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  const { totalHt, montantTva, totalTtc } = useMemo(() => {
    const ht = data.lignes.reduce((s, l) => s + ligneTotalHt(l), 0);
    const rounded = Math.round(ht * 100) / 100;
    const taux = Number.isFinite(data.tvaTaux) ? data.tvaTaux / 100 : 0;
    const tva = Math.round(rounded * taux * 100) / 100;
    const ttc = Math.round((rounded + tva) * 100) / 100;
    return { totalHt: rounded, montantTva: tva, totalTtc: ttc };
  }, [data.lignes, data.tvaTaux]);

  const update = <K extends keyof DevisFormState>(key: K, value: DevisFormState[K]) => {
    setData((d) => ({ ...d, [key]: value }));
  };

  const updateLigne = (id: string, patch: Partial<DevisLigne>) => {
    setData((d) => ({
      ...d,
      lignes: d.lignes.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    }));
  };

  const syncNumeroFromServer = async (id: string) => {
    const full = isFacture ? await fetchFactureById(id) : await fetchDevisById(id);
    if (full.numero) {
      setData((prev) => ({ ...prev, devisNumero: full.numero! }));
    }
  };

  const validateBeforeSubmit = (): string | null => {
    if (!data.societeNom.trim()) return "Le nom de la société est obligatoire.";
    if (!data.clientNom.trim()) return "Le nom du client est obligatoire.";
    if (!data.dateEmission) return "La date d'émission est obligatoire.";
    if (!Number.isFinite(data.tvaTaux) || data.tvaTaux < 0 || data.tvaTaux > 100) {
      return "Le taux de TVA doit être compris entre 0 et 100.";
    }
    if (data.clientIce.trim() && !/^[0-9A-Za-z\s-]+$/.test(data.clientIce.trim())) {
      return "ICE client invalide (lettres/chiffres/espaces/tiret).";
    }
    if (
      data.clientEmail.trim() &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.clientEmail.trim())
    ) {
      return "Email client invalide.";
    }
    const invalidLineIndex = data.lignes.findIndex(
      (ligne) => !Number.isFinite(ligne.quantite) || ligne.quantite < 1,
    );
    if (invalidLineIndex !== -1) {
      return `La quantité de la ligne ${invalidLineIndex + 1} doit être au minimum 1.`;
    }
    return null;
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSaveDraft = async () => {
    const validationError = validateBeforeSubmit();
    if (validationError) {
      toast.error(validationError);
      return;
    }
    setBusy("saving");
    try {
      const payload = toBackendDevisPayload(data, { includeNumero: !isFacture });
      if (devisId) {
        const updated = isFacture
          ? await updateFacture(devisId, payload)
          : await updateDevis(devisId, payload);
        if (updated.numero) {
          setData((prev) => ({ ...prev, devisNumero: updated.numero! }));
        } else {
          await syncNumeroFromServer(devisId);
        }
        toast.success(`${docLabel} mis à jour (brouillon).`);
      } else {
        const created = isFacture ? await createFacture(payload) : await createDevis(payload);
        setDevisId(created.id);
        if (created.numero) {
          setData((prev) => ({ ...prev, devisNumero: created.numero! }));
        } else {
          await syncNumeroFromServer(created.id);
        }
        toast.success(`${docLabel} créé sur le serveur.`);
        router.push(isFacture ? "/dashboard/factures?tab=factures" : "/dashboard/factures?tab=devis");
        router.refresh();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur serveur.");
    } finally {
      setBusy("idle");
    }
  };

  const handleDownloadPdf = async () => {
    const validationError = validateBeforeSubmit();
    if (validationError) {
      toast.error(validationError);
      return;
    }
    setBusy("downloading");
    try {
      const payload = toBackendDevisPayload(data, { includeNumero: !isFacture });
      let activeId = devisId;

      if (activeId) {
        const updated = isFacture
          ? await updateFacture(activeId, payload)
          : await updateDevis(activeId, payload);
        if (updated.numero) {
          setData((prev) => ({ ...prev, devisNumero: updated.numero! }));
        } else {
          await syncNumeroFromServer(activeId);
        }
      } else {
        const created = isFacture ? await createFacture(payload) : await createDevis(payload);
        activeId = created.id;
        setDevisId(activeId);
        if (created.numero) {
          setData((prev) => ({ ...prev, devisNumero: created.numero! }));
        } else {
          await syncNumeroFromServer(activeId);
        }
        toast.success(`${docLabel} créé sur le serveur.`);
        router.push(isFacture ? "/dashboard/factures?tab=factures" : "/dashboard/factures?tab=devis");
        router.refresh();
        return;
      }

      if (isFacture) {
        await downloadFacturePdf(activeId, `${docLabelLower}-${data.devisNumero || "draft"}`);
      } else {
        await downloadDevisPdf(activeId, `${docLabelLower}-${data.devisNumero || "draft"}`);
      }
      toast.success("PDF officiel téléchargé.");
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : "Impossible de télécharger le PDF serveur.",
      );
    } finally {
      setBusy("idle");
    }
  };

  const fieldClass =
    "mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100 outline-none focus:border-indigo-500";

  const labelClass =
    "block text-[11px] font-semibold uppercase tracking-wide text-zinc-400";
  const money = (value: number) =>
    `${new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)} MAD`;

  return (
    <>
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #devis-pdf-preview,
          #devis-pdf-preview * {
            visibility: visible;
          }
          #devis-pdf-preview {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 12mm;
            border: none !important;
            box-shadow: none !important;
          }
        }
      `}</style>

      <header className="flex shrink-0 flex-col gap-4 border-b border-zinc-800 px-6 py-5 print:hidden md:flex-row md:items-center md:justify-between md:px-8">
        <div className="flex flex-col gap-3">
          <Link
            href="/dashboard/factures"
            className="inline-flex w-max items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-zinc-500 hover:text-zinc-200"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Retour devis &amp; factures
          </Link>
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-zinc-500">
              Nouveau
            </p>
            <h1 className="text-3xl font-semibold text-white md:text-4xl">
              {isFacture ? "Créer une facture" : "Créer un devis"}
            </h1>
          </div>
        </div>
      </header>

      <div className="px-6 py-6 md:px-8 md:py-8">
        <div className="space-y-6 print:hidden">
          <div className="grid gap-6 xl:grid-cols-2">
            <section className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-4">
            <div className="flex items-center justify-between border-b border-zinc-700 pb-2">
              <h2 className="font-mono text-xs uppercase tracking-widest text-zinc-300">
                Émetteur
              </h2>
              <button
                type="button"
                onClick={() => setEditingEmitter((v) => !v)}
                className="rounded border border-zinc-700 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-zinc-300 hover:bg-zinc-800"
              >
                {editingEmitter ? "Fermer" : "Modifier"}
              </button>
            </div>

            {!editingEmitter ? (
              <p className="mt-3 text-sm leading-relaxed text-zinc-200">
                <strong>{data.societeNom}</strong>
                <br />
                RC : {data.societeRc} — CNIE : {data.societeCnie} — ICE : {data.societeIce} —
                TP : {data.societeTp}
                <br />
                Adresse : {data.societeAdresse}
                <br />
                Téléphone : {data.societeTelephone}
                <br />
                E-mail : {data.societeEmail}
              </p>
            ) : (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className={labelClass}>Raison sociale</label>
                  <input
                    className={fieldClass}
                    value={data.societeNom}
                    onChange={(e) => update("societeNom", e.target.value)}
                    maxLength={150}
                  />
                </div>
                <div>
                  <label className={labelClass}>RC</label>
                  <input
                    className={fieldClass}
                    value={data.societeRc}
                    onChange={(e) => update("societeRc", e.target.value)}
                    maxLength={60}
                  />
                </div>
                <div>
                  <label className={labelClass}>CNIE</label>
                  <input
                    className={fieldClass}
                    value={data.societeCnie}
                    onChange={(e) => update("societeCnie", e.target.value)}
                    maxLength={60}
                  />
                </div>
                <div>
                  <label className={labelClass}>ICE</label>
                  <input
                    className={fieldClass}
                    value={data.societeIce}
                    onChange={(e) => update("societeIce", e.target.value)}
                    maxLength={60}
                  />
                </div>
                <div>
                  <label className={labelClass}>TP</label>
                  <input
                    className={fieldClass}
                    value={data.societeTp}
                    onChange={(e) => update("societeTp", e.target.value)}
                    maxLength={60}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClass}>Adresse</label>
                  <input
                    className={fieldClass}
                    value={data.societeAdresse}
                    onChange={(e) => update("societeAdresse", e.target.value)}
                    maxLength={255}
                  />
                </div>
                <div>
                  <label className={labelClass}>Téléphone</label>
                  <input
                    className={fieldClass}
                    value={data.societeTelephone}
                    onChange={(e) => update("societeTelephone", e.target.value)}
                    maxLength={60}
                  />
                </div>
                <div>
                  <label className={labelClass}>E-mail</label>
                  <input
                    className={fieldClass}
                    value={data.societeEmail}
                    onChange={(e) => update("societeEmail", e.target.value)}
                    maxLength={120}
                  />
                </div>
              </div>
            )}
            </section>

            <section className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-4">
            <h2 className="border-b border-zinc-700 pb-2 font-mono text-xs uppercase tracking-widest text-zinc-300">
              Client &amp; {docLabelLower}
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Nom client</label>
                <input
                  className={fieldClass}
                  value={data.clientNom}
                  onChange={(e) => update("clientNom", e.target.value)}
                  placeholder="Mme Bouchra"
                />
              </div>
              <div>
                <label className={labelClass}>ICE client</label>
                <input
                  className={fieldClass}
                  value={data.clientIce}
                  onChange={(e) => update("clientIce", e.target.value)}
                  maxLength={60}
                />
              </div>
              <div>
                <label className={labelClass}>E-mail client</label>
                <input
                  type="email"
                  className={fieldClass}
                  value={data.clientEmail}
                  onChange={(e) => update("clientEmail", e.target.value)}
                  maxLength={120}
                  placeholder="client@example.com"
                />
              </div>
              <div>
                <label className={labelClass}>Téléphone client</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className={fieldClass}
                  value={data.clientTelephone}
                  onChange={(e) =>
                    update("clientTelephone", e.target.value.replace(/\D+/g, ""))
                  }
                  maxLength={60}
                  placeholder="0612345678"
                />
              </div>
              <div>
                <label className={labelClass}>Numéro de {docLabelLower}</label>
                <div className="mt-1 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-medium text-zinc-200">
                  {data.devisNumero ? formatNumeroDisplay(data.devisNumero) : "—"}
                </div>
                <p className="mt-1 text-[11px] text-zinc-500">
                  Numéro unique généré par le serveur, jamais répété.
                </p>
              </div>
              <div>
                <label className={labelClass}>Date d&apos;émission</label>
                <input
                  type="date"
                  className={fieldClass}
                  value={data.dateEmission}
                  onChange={(e) => update("dateEmission", e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>TVA %</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  className={fieldClass}
                  value={data.tvaTaux}
                  onChange={(e) =>
                    update("tvaTaux", Number.parseFloat(e.target.value) || 0)
                  }
                />
              </div>
            </div>
            </section>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <section className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-4 xl:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-700 pb-2">
              <h2 className="font-mono text-xs uppercase tracking-widest text-zinc-300">
                Lignes
              </h2>
              <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
                Désignation et prix unitaires fixes
              </span>
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {data.lignes.map((ligne, index) => (
                <div
                  key={ligne.id}
                  className="rounded border border-zinc-700 p-3"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-mono text-[10px] uppercase text-zinc-500">
                      Ligne {index + 1}
                    </span>
                  </div>
                  <div className="grid gap-2">
                    <div>
                      <label className={labelClass}>Titre (désignation)</label>
                      <div className="mt-1 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-semibold text-zinc-200">
                        {ligne.titre}
                      </div>
                    </div>
                    <div>
                      <label className={labelClass}>Description</label>
                      <div className="mt-1 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-300">
                        {ligne.description}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className={labelClass}>Quantité</label>
                        <input
                          type="number"
                          min={1}
                          step={1}
                          className={fieldClass}
                          value={ligne.quantite}
                          onChange={(e) =>
                            updateLigne(ligne.id, {
                              quantite: Math.max(
                                1,
                                Number.parseInt(e.target.value || "1", 10) || 1,
                              ),
                            })
                          }
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Prix unitaire HT (MAD)</label>
                        <div className="mt-1 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-medium text-zinc-200">
                          {money(ligne.prixUnitaireHt)}
                        </div>
                      </div>
                    </div>
                    <p className="text-right text-xs text-zinc-400">
                      Total ligne HT :{" "}
                      <strong>{ligneTotalHt(ligne).toFixed(2)} MAD</strong>
                    </p>
                  </div>
                </div>
              ))}
            </div>
            </section>

            <section className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-4">
            <h2 className="border-b border-zinc-700 pb-2 font-mono text-xs uppercase tracking-widest text-zinc-300">
              Mention TVA &amp; paiement
            </h2>
            <div className="mt-4 space-y-3">
              <div>
                <label className={labelClass}>Mention (sous le tableau)</label>
                <textarea
                  className={`${fieldClass} min-h-[60px]`}
                  value={data.mentionTva}
                  onChange={(e) => update("mentionTva", e.target.value)}
                  rows={2}
                />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Mode de paiement</label>
                  <input
                    className={fieldClass}
                    value={data.paiementMode}
                    onChange={(e) => update("paiementMode", e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelClass}>Banque</label>
                  <input
                    className={fieldClass}
                    value={data.paiementBanque}
                    onChange={(e) => update("paiementBanque", e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelClass}>Titulaire</label>
                  <input
                    className={fieldClass}
                    value={data.paiementTitulaire}
                    onChange={(e) => update("paiementTitulaire", e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelClass}>RIB</label>
                  <input
                    className={fieldClass}
                    value={data.paiementRib}
                    onChange={(e) => update("paiementRib", e.target.value)}
                  />
                </div>
              </div>
            </div>
            </section>
          </div>

          <p className="font-mono text-[10px] uppercase leading-relaxed text-zinc-500">
            Totaux calculés côté front pour l&apos;aperçu. Le backend devra
            recalculer et verrouiller les montants à l&apos;enregistrement /
            génération PDF.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={busy !== "idle"}
              className="inline-flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-900 px-4 py-2 font-mono text-[11px] uppercase tracking-widest text-zinc-200 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy === "saving" ? "Sauvegarde..." : `Sauvegarder ${docLabelLower}`}
            </button>
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={busy !== "idle"}
              className="inline-flex items-center gap-2 rounded-md border border-indigo-500 bg-indigo-600 px-4 py-2 font-mono text-[11px] uppercase tracking-widest text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download className="size-4" aria-hidden />
              {busy === "downloading"
                ? "Téléchargement..."
                : "Télécharger et sauvegarder"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
