"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Download, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  deletePropositionAndLocal,
  downloadPropositionPdf,
  loadPropositionLocal,
  registerPropositionClientInDirectory,
  savePropositionLocal,
  syncPropositionToServer,
} from "@/lib/proposition/backend-proposition";
import { PropositionTemplateField } from "./PropositionTemplateField";
import { StringListEditor } from "./StringListEditor";
import {
  applyPropositionPreparer,
  defaultPropositionForm,
  isVideoContentTarifService,
  newPropositionId,
  PROPOSITION_PREPARERS,
  resolvePropositionPreparerId,
  resolveTarifLineDetail,
  syncVideoTarifDetailInLignes,
  type PropositionFormState,
  type PropositionPreparerId,
  type PropositionTarifLigne,
} from "./proposition-types";

const fieldClass =
  "mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100 outline-none focus:border-indigo-500";

const labelClass = "block text-[11px] font-semibold uppercase tracking-wide text-zinc-400";

function formatNumeroDisplay(value: string): string {
  return value.replace(/^PROP-/i, "PR-");
}

export function NouvellePropositionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState<PropositionFormState>(defaultPropositionForm);
  const [propositionId, setPropositionId] = useState<string | null>(null);
  const [editingEmitter, setEditingEmitter] = useState(false);
  const [busy, setBusy] = useState<"idle" | "saving" | "downloading">("idle");

  useEffect(() => {
    const ref = searchParams.get("ref");
    if (!ref) return;
    const loaded = loadPropositionLocal(ref);
    if (loaded) {
      const personId = resolvePropositionPreparerId(loaded);
      const merged =
        loaded.prepareParPersonId === personId
          ? loaded
          : applyPropositionPreparer(loaded, personId);
      const clientLabel = merged.clientNom.trim() || merged.preparePour.trim();
      setData(
        clientLabel
          ? { ...merged, clientNom: clientLabel, preparePour: clientLabel }
          : merged,
      );
      setPropositionId(ref);
    }
  }, [searchParams]);

  const update = <K extends keyof PropositionFormState>(
    key: K,
    value: PropositionFormState[K],
  ) => {
    setData((d) => ({ ...d, [key]: value }));
  };

  const updateVideoCounts = (patch: { videosMin?: number; videosMax?: number }) => {
    setData((d) => {
      const videosMin = patch.videosMin ?? d.videosMin;
      const videosMax = patch.videosMax ?? d.videosMax;
      return {
        ...d,
        videosMin,
        videosMax,
        tarifsLignes: syncVideoTarifDetailInLignes(
          d.tarifsLignes,
          videosMin,
          videosMax,
        ),
      };
    });
  };

  const updateTarif = (id: string, patch: Partial<PropositionTarifLigne>) => {
    setData((d) => ({
      ...d,
      tarifsLignes: d.tarifsLignes.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    }));
  };

  const addTarif = () => {
    setData((d) => ({
      ...d,
      tarifsLignes: [
        ...d.tarifsLignes,
        { id: newPropositionId(), service: "", detail: "", prixInitial: "", prixOffert: "" },
      ],
    }));
  };

  const removeTarif = (id: string) => {
    setData((d) => {
      if (d.tarifsLignes.length <= 1) return d;
      return { ...d, tarifsLignes: d.tarifsLignes.filter((l) => l.id !== id) };
    });
  };

  const validateBeforeSubmit = (): string | null => {
    if (!data.clientNom.trim()) return "Le nom client est obligatoire.";
    if (!data.nomEtablissement.trim()) return "Le nom de l'établissement est obligatoire.";
    if (!data.dateEmission) return "La date d'émission est obligatoire.";
    if (!data.titreProposition.trim()) return "Le titre de la proposition est obligatoire.";
    if (!Number.isFinite(data.objectifProspects) || data.objectifProspects < 1) {
      return "L'objectif prospects doit être au moins 1.";
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
    const emptyTarif = data.tarifsLignes.findIndex((l) => !l.service.trim());
    if (emptyTarif !== -1) return `Tarif ligne ${emptyTarif + 1} : le service est obligatoire.`;
    return null;
  };

  const handleSaveDraft = async () => {
    const err = validateBeforeSubmit();
    if (err) {
      toast.error(err);
      return;
    }
    setBusy("saving");
    try {
      const saved = savePropositionLocal(data, propositionId ?? undefined);
      let serverId = saved.id;
      const withNumero = saved.numero
        ? { ...data, propositionNumero: saved.numero }
        : data;

      let clientInDirectory = false;
      try {
        const registered = await registerPropositionClientInDirectory(withNumero);
        clientInDirectory = registered !== null;
      } catch (clientErr) {
        toast.warning(
          clientErr instanceof Error
            ? `Carnet clients : ${clientErr.message}`
            : "Ajout au carnet clients impossible (vérifie POST /clients).",
        );
      }

      try {
        serverId = await syncPropositionToServer(withNumero, saved.id);
        setPropositionId(serverId);
        const synced = loadPropositionLocal(serverId);
        if (synced?.propositionNumero) {
          setData((d) => ({ ...d, propositionNumero: synced.propositionNumero }));
        } else if (saved.numero) {
          setData((d) => ({ ...d, propositionNumero: saved.numero! }));
        }
        toast.success(
          clientInDirectory
            ? "Proposition enregistrée. Client ajouté au carnet."
            : "Proposition enregistrée sur le serveur.",
        );
      } catch (syncErr) {
        setPropositionId(saved.id);
        toast.warning(
          syncErr instanceof Error
            ? `Enregistrée localement. Serveur : ${syncErr.message}`
            : "Enregistrée localement. Synchronisation serveur impossible.",
        );
      }
      router.push("/dashboard/factures?tab=propositions");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Enregistrement impossible.");
    } finally {
      setBusy("idle");
    }
  };

  const handleDownloadPdf = async () => {
    const err = validateBeforeSubmit();
    if (err) {
      toast.error(err);
      return;
    }
    setBusy("downloading");
    try {
      const saved = savePropositionLocal(data, propositionId ?? undefined);
      const withNumero = saved.numero
        ? { ...data, propositionNumero: saved.numero }
        : data;
      const serverId = await syncPropositionToServer(withNumero, saved.id);
      setPropositionId(serverId);
      const fileName =
        saved.numero?.trim() ||
        data.propositionNumero.trim() ||
        `proposition-${serverId}`;
      await downloadPropositionPdf(serverId, fileName);
      toast.success("Proposition PDF téléchargée.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Téléchargement impossible.");
    } finally {
      setBusy("idle");
    }
  };

  return (
    <>
      <header className="flex shrink-0 flex-col gap-4 border-b border-zinc-800 px-6 py-5 md:flex-row md:items-center md:justify-between md:px-8">
        <div className="flex flex-col gap-3">
          <Link
            href="/dashboard/factures?tab=propositions"
            className="inline-flex w-max items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-zinc-500 hover:text-zinc-200"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Retour propositions
          </Link>
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-zinc-500">Nouveau</p>
            <h1 className="text-3xl font-semibold text-white md:text-4xl">
              Créer une proposition
            </h1>
          </div>
        </div>
      </header>

      <div className="overflow-x-hidden px-6 py-6 md:px-8 md:py-8">
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
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
                Client &amp; proposition
              </h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Nom client</label>
                  <input
                    className={fieldClass}
                    value={data.clientNom}
                    onChange={(e) => {
                      const v = e.target.value;
                      setData((d) => ({ ...d, clientNom: v, preparePour: v }));
                    }}
                    placeholder="Mr Amine Barnia ou Institution Jabri"
                  />
                  <p className="mt-1 text-[11px] text-zinc-500">
                    Page Clients et ligne « Préparée pour » sur le document.
                  </p>
                </div>
                <div>
                  <label className={labelClass}>Nom de l&apos;établissement</label>
                  <input
                    className={fieldClass}
                    value={data.nomEtablissement}
                    onChange={(e) => update("nomEtablissement", e.target.value)}
                    placeholder="Institution Jabri"
                  />
                  <p className="mt-1 text-[11px] text-zinc-500">
                    Variable {"{{etablissement}}"} dans les paragraphes.
                  </p>
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
                  <label className={labelClass}>Numéro de proposition</label>
                  <div className="mt-1 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-medium text-zinc-200">
                    {data.propositionNumero
                      ? formatNumeroDisplay(data.propositionNumero)
                      : "—"}
                  </div>
                  <p className="mt-1 text-[11px] text-zinc-500">
                    Généré automatiquement à l&apos;enregistrement (ex. PROP-2026-001).
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
              </div>
            </section>
          </div>

          <section className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-4">
            <h2 className="border-b border-zinc-700 pb-2 font-mono text-xs uppercase tracking-widest text-zinc-300">
              En-tête du document
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={labelClass}>Titre de la proposition</label>
                <input
                  className={fieldClass}
                  value={data.titreProposition}
                  onChange={(e) => update("titreProposition", e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>Préparée par (63 Agency)</label>
                <select
                  className={fieldClass}
                  value={resolvePropositionPreparerId(data)}
                  onChange={(e) => {
                    const personId = e.target.value as PropositionPreparerId;
                    setData((d) => applyPropositionPreparer(d, personId));
                  }}
                >
                  {PROPOSITION_PREPARERS.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.preparePar}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-zinc-500">
                  Les coordonnées en bas de page (contact) se mettent à jour
                  automatiquement.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-4">
            <h2 className="border-b border-zinc-700 pb-2 font-mono text-xs uppercase tracking-widest text-zinc-300">
              Introduction
            </h2>
            <p className="mt-3 rounded-md border border-indigo-900/40 bg-indigo-950/20 px-3 py-2 font-mono text-[10px] leading-relaxed text-indigo-200/90">
              Variables :{" "}
              <span className="text-zinc-300">
                {"{{etablissement}}"} →{" "}
                {data.nomEtablissement.trim() || "— (nom établissement)"}
              </span>
              {" · "}
              <span className="text-zinc-300">
                {"{{objectif}}"} → {data.objectifProspects} (ex. « plus de 150 prospects
                qualifiés »)
              </span>
              {" · "}
              <span className="text-zinc-400">**texte** = gras dans le PDF</span>
            </p>
            <div className="mt-4 space-y-4">
              <div>
                <label className={labelClass}>Objectif — nombre de prospects</label>
                <input
                  type="number"
                  min={1}
                  className={fieldClass}
                  value={data.objectifProspects}
                  onChange={(e) =>
                    update(
                      "objectifProspects",
                      Math.max(1, Number.parseInt(e.target.value, 10) || 1),
                    )
                  }
                />
              </div>
              <PropositionTemplateField
                label="Paragraphe 1"
                value={data.introParagraphe1}
                onChange={(v) => update("introParagraphe1", v)}
                etablissement={data.nomEtablissement}
                objectif={data.objectifProspects}
                variables={["etablissement"]}
                rows={4}
              />
              <PropositionTemplateField
                label="Paragraphe 2"
                value={data.introParagraphe2}
                onChange={(v) => update("introParagraphe2", v)}
                etablissement={data.nomEtablissement}
                objectif={data.objectifProspects}
                variables={["objectif"]}
                rows={5}
              />
            </div>
          </section>

          <section className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-4">
            <h2 className="border-b border-zinc-700 pb-2 font-mono text-xs uppercase tracking-widest text-zinc-300">
              Stratégie — page 1 &amp; 2
            </h2>
            <div className="mt-4 space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-white">1. Création de contenu</h3>
                <div className="mt-3 space-y-3">
                  <div>
                    <label className={labelClass}>
                      Description (2 paragraphes — ligne vide entre les deux)
                    </label>
                    <textarea
                      className={`${fieldClass} min-h-[96px]`}
                      value={data.section1Description}
                      onChange={(e) => update("section1Description", e.target.value)}
                      rows={5}
                    />
                    <p className="mt-1 text-[10px] text-zinc-500">
                      La phrase « {data.videosMin} à {data.videosMax} vidéos… » est ajoutée
                      automatiquement dans le PDF après la description.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>Vidéos min</label>
                      <input
                        type="number"
                        min={1}
                        className={fieldClass}
                        value={data.videosMin}
                        onChange={(e) =>
                          updateVideoCounts({
                            videosMin: Math.max(1, Number.parseInt(e.target.value, 10) || 1),
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Vidéos max</label>
                      <input
                        type="number"
                        min={1}
                        className={fieldClass}
                        value={data.videosMax}
                        onChange={(e) =>
                          updateVideoCounts({
                            videosMax: Math.max(
                              data.videosMin,
                              Number.parseInt(e.target.value, 10) || 1,
                            ),
                          })
                        }
                      />
                    </div>
                  </div>
                  <StringListEditor
                    label="Thèmes des vidéos"
                    items={data.section1Topics}
                    onChange={(items) => update("section1Topics", items)}
                  />
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-white">
                  2. Campagnes publicitaires — Facebook &amp; Instagram
                </h3>
                <div className="mt-3 space-y-3">
                  <div>
                    <label className={labelClass}>Introduction</label>
                    <textarea
                      className={`${fieldClass} min-h-[72px]`}
                      value={data.section2Intro}
                      onChange={(e) => update("section2Intro", e.target.value)}
                      rows={3}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>
                      Transition (utilisez **texte** pour le gras)
                    </label>
                    <textarea
                      className={`${fieldClass} min-h-[56px]`}
                      value={data.section2Approche}
                      onChange={(e) => update("section2Approche", e.target.value)}
                      rows={2}
                    />
                  </div>
                  <div className="rounded border border-zinc-700/80 p-3">
                    <label className={labelClass}>Titre volet 1</label>
                    <input
                      className={fieldClass}
                      value={data.section2Bloc1Titre}
                      onChange={(e) => update("section2Bloc1Titre", e.target.value)}
                    />
                    <label className={`${labelClass} mt-2`}>Texte volet 1</label>
                    <textarea
                      className={`${fieldClass} min-h-[56px]`}
                      value={data.section2Bloc1Intro}
                      onChange={(e) => update("section2Bloc1Intro", e.target.value)}
                      rows={2}
                    />
                    <StringListEditor
                      label="Points volet 1"
                      items={data.section2Bloc1Points}
                      onChange={(items) => update("section2Bloc1Points", items)}
                    />
                  </div>
                  <div className="rounded border border-zinc-700/80 p-3">
                    <label className={labelClass}>Titre volet 2</label>
                    <input
                      className={fieldClass}
                      value={data.section2Bloc2Titre}
                      onChange={(e) => update("section2Bloc2Titre", e.target.value)}
                    />
                    <label className={`${labelClass} mt-2`}>Texte volet 2</label>
                    <textarea
                      className={`${fieldClass} min-h-[56px]`}
                      value={data.section2Bloc2Intro}
                      onChange={(e) => update("section2Bloc2Intro", e.target.value)}
                      rows={2}
                    />
                    <StringListEditor
                      label="Points volet 2"
                      items={data.section2Bloc2Points}
                      onChange={(items) => update("section2Bloc2Points", items)}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>
                      Conclusion (utilisez **texte** pour le gras)
                    </label>
                    <textarea
                      className={`${fieldClass} min-h-[56px]`}
                      value={data.section2Conclusion}
                      onChange={(e) => update("section2Conclusion", e.target.value)}
                      rows={2}
                    />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-white">3. Funnel marketing</h3>
                <div className="mt-3 space-y-3">
                  <div>
                    <label className={labelClass}>Introduction</label>
                    <textarea
                      className={`${fieldClass} min-h-[60px]`}
                      value={data.section3Intro}
                      onChange={(e) => update("section3Intro", e.target.value)}
                      rows={2}
                    />
                  </div>
                  <StringListEditor
                    label="Critères de qualification"
                    items={data.funnelCriteres}
                    onChange={(items) => update("funnelCriteres", items)}
                  />
                  <div>
                    <label className={labelClass}>Conclusion</label>
                    <textarea
                      className={fieldClass}
                      value={data.section3Conclusion}
                      onChange={(e) => update("section3Conclusion", e.target.value)}
                      rows={2}
                    />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-white">4. Automatisation &amp; suivi</h3>
                <div className="mt-3 space-y-3">
                  <StringListEditor
                    label="Points"
                    items={data.section4Points}
                    onChange={(items) => update("section4Points", items)}
                  />
                  <div>
                    <label className={labelClass}>Objectif</label>
                    <input
                      className={fieldClass}
                      value={data.section4Objectif}
                      onChange={(e) => update("section4Objectif", e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-700 pb-2">
              <h2 className="font-mono text-xs uppercase tracking-widest text-zinc-300">
                Tarifs proposés
              </h2>
              <button
                type="button"
                onClick={addTarif}
                className="inline-flex items-center gap-1 rounded-md border border-indigo-600 bg-indigo-600/90 px-3 py-1.5 font-mono text-[10px] uppercase text-white hover:bg-indigo-500"
              >
                <Plus className="size-3.5" aria-hidden />
                Ligne tarif
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {data.tarifsLignes.map((ligne, index) => (
                <div key={ligne.id} className="rounded border border-zinc-700 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-mono text-[10px] uppercase text-zinc-500">
                      Ligne {index + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeTarif(ligne.id)}
                      disabled={data.tarifsLignes.length <= 1}
                      className="rounded border border-red-700/50 p-1 text-red-300 disabled:opacity-30"
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                    </button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className={labelClass}>Service</label>
                      <input
                        className={fieldClass}
                        value={ligne.service}
                        onChange={(e) => updateTarif(ligne.id, { service: e.target.value })}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className={labelClass}>Détail</label>
                      {isVideoContentTarifService(ligne.service) ? (
                        <>
                          <input
                            className={`${fieldClass} bg-zinc-800/80`}
                            value={resolveTarifLineDetail(
                              ligne,
                              data.videosMin,
                              data.videosMax,
                            )}
                            readOnly
                          />
                          <p className="mt-1 text-[10px] text-zinc-500">
                            Synchronisé avec « Vidéos min / max » (section Création de contenu).
                          </p>
                        </>
                      ) : (
                        <input
                          className={fieldClass}
                          value={ligne.detail}
                          onChange={(e) => updateTarif(ligne.id, { detail: e.target.value })}
                          placeholder="Ex. Gestion et optimisation des campagnes — **gras** avec **texte**"
                        />
                      )}
                    </div>
                    <div>
                      <label className={labelClass}>Prix initial (MAD)</label>
                      <input
                        className={fieldClass}
                        value={ligne.prixInitial}
                        onChange={(e) => updateTarif(ligne.id, { prixInitial: e.target.value })}
                        placeholder="5 550 / mois"
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Prix offert (MAD)</label>
                      <input
                        className={fieldClass}
                        value={ligne.prixOffert}
                        onChange={(e) => updateTarif(ligne.id, { prixOffert: e.target.value })}
                        placeholder="4 000 / mois ou Offert"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <label className={labelClass}>Note budget Meta Ads</label>
              <textarea
                className={`${fieldClass} min-h-[60px]`}
                value={data.tarifsNoteMeta}
                onChange={(e) => update("tarifsNoteMeta", e.target.value)}
                rows={2}
              />
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-4">
              <h2 className="border-b border-zinc-700 pb-2 font-mono text-xs uppercase tracking-widest text-zinc-300">
                Pourquoi choisir 63 AGENCY
              </h2>
              <div className="mt-4">
                <StringListEditor
                  label="Arguments"
                  items={data.pourquoiChoisir}
                  onChange={(items) => update("pourquoiChoisir", items)}
                />
              </div>
            </section>

            <section className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-4">
              <h2 className="border-b border-zinc-700 pb-2 font-mono text-xs uppercase tracking-widest text-zinc-300">
                Prochaines étapes &amp; contact
              </h2>
              <div className="mt-4 space-y-3">
                <PropositionTemplateField
                  label="Prochaines étapes"
                  value={data.prochainesEtapes}
                  onChange={(v) => update("prochainesEtapes", v)}
                  etablissement={data.nomEtablissement}
                  objectif={data.objectifProspects}
                  variables={["etablissement"]}
                  rows={3}
                />
                <div>
                  <label className={labelClass}>Nom contact</label>
                  <input
                    className={fieldClass}
                    value={data.contactNom}
                    onChange={(e) => update("contactNom", e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelClass}>Téléphone</label>
                  <input
                    className={fieldClass}
                    value={data.contactTelephone}
                    onChange={(e) => update("contactTelephone", e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelClass}>E-mail</label>
                  <input
                    className={fieldClass}
                    value={data.contactEmail}
                    onChange={(e) => update("contactEmail", e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelClass}>Signature / tagline</label>
                  <input
                    className={fieldClass}
                    value={data.contactTagline}
                    onChange={(e) => update("contactTagline", e.target.value)}
                  />
                </div>
              </div>
            </section>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={busy !== "idle"}
              className="inline-flex items-center gap-2 rounded-md border border-indigo-500 bg-indigo-600 px-4 py-2 font-mono text-[11px] uppercase tracking-widest text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {busy === "saving"
                ? "Création..."
                : propositionId
                  ? "Enregistrer les modifications"
                  : "Créer la proposition"}
            </button>
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={busy !== "idle"}
              className="inline-flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-900 px-4 py-2 font-mono text-[11px] uppercase tracking-widest text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
            >
              <Download className="size-4" aria-hidden />
              {busy === "downloading" ? "Téléchargement..." : "Télécharger PDF"}
            </button>
            {propositionId ? (
              <button
                type="button"
                onClick={async () => {
                  try {
                    await deletePropositionAndLocal(propositionId, {
                      numero: data.propositionNumero,
                    });
                    toast.success("Proposition supprimée.");
                    router.push("/dashboard/factures?tab=propositions");
                  } catch (e) {
                    toast.error(
                      e instanceof Error ? e.message : "Suppression impossible.",
                    );
                  }
                }}
                className="inline-flex items-center gap-2 rounded-md border border-red-700/60 px-4 py-2 font-mono text-[11px] uppercase text-red-300 hover:bg-red-900/30"
              >
                Supprimer
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}

