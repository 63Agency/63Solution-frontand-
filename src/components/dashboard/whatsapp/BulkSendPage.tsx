"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Loader2,
  MessageSquare,
  Send,
  Smartphone,
  Users,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  BULK_SEND_IMPORT_PATH,
  consumeBulkSendImport,
  loadBulkSendDraft,
  saveBulkSendDraft,
  type BulkSendSendMode,
} from "@/lib/whatsapp/bulk-send-storage";
import { sendBulkWhatsAppMessages } from "@/lib/whatsapp/backend-whatsapp";
import type { BulkWhatsAppSendPayload, BulkWhatsAppSendResultItem } from "@/lib/whatsapp/types";
import { formatTemplatePreview } from "@/lib/whatsapp/whatsapp-templates";
import { getStoredAccessToken } from "@/lib/auth/backend-login";
import { cn } from "@/src/lib/utils";
import {
  formatWhatsAppPhone,
  parsePhoneNumbersInput,
} from "./whatsapp-utils";

const FALLBACK_TEMPLATE_NAME = "Client";

function SendResultBadge({ success }: { success: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset",
        success
          ? "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30"
          : "bg-red-500/10 text-red-300 ring-red-500/30",
      )}
    >
      {success ? (
        <CheckCircle2 className="size-3.5 shrink-0" aria-hidden />
      ) : (
        <XCircle className="size-3.5 shrink-0" aria-hidden />
      )}
      {success ? "Envoyé" : "Échec"}
    </span>
  );
}

export function BulkSendPage() {
  const [phonesRaw, setPhonesRaw] = useState("");
  const [message, setMessage] = useState("");
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [sendMode, setSendMode] = useState<BulkSendSendMode>("text");
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendProgress, setSendProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState<BulkWhatsAppSendResultItem[] | null>(null);
  const [leadsImportCount, setLeadsImportCount] = useState(0);
  const [contactNamesByPhone, setContactNamesByPhone] = useState<Record<string, string>>({});
  const [draftReady, setDraftReady] = useState(false);
  const [pendingTemplateId, setPendingTemplateId] = useState<string | undefined>();

  useEffect(() => {
    // Les numéros sont déjà fusionnés dans le brouillon par stashBulkSendImport
    // (avant la navigation). On consomme le pending pour le vider, puis on hydrate
    // depuis le brouillon — fiable même si React Strict Mode relance cet effect.
    consumeBulkSendImport();
    const draft = loadBulkSendDraft();

    const phones = draft?.phonesRaw ?? "";
    const messageText = draft?.message ?? "";
    const importCount = draft?.leadsImportCount ?? 0;
    const names = { ...(draft?.contactNamesByPhone ?? {}) };
    const draftSendMode = draft?.sendMode ?? "text";
    const draftTemplateId = draft?.selectedTemplateId;

    saveBulkSendDraft({
      phonesRaw: phones,
      message: messageText,
      leadsImportCount: importCount,
      sendMode: draftSendMode,
      selectedTemplateId: draftTemplateId,
      contactNamesByPhone: names,
    });

    setPhonesRaw(phones);
    setMessage(messageText);
    setLeadsImportCount(importCount);
    setContactNamesByPhone(names);
    setSendMode(draftSendMode);
    setPendingTemplateId(draftTemplateId);
    setDraftReady(true);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadTemplates() {
      setTemplatesLoading(true);
      try {
        const token = getStoredAccessToken();
        const res = await fetch("/api/whatsapp/templates", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = (await res.json().catch(() => null)) as {
          templates?: any[];
          error?: string;
        };
        if (!res.ok) {
          console.error("[BulkSendPage] templates error", res.status, data);
          throw new Error(data?.error ?? `Erreur ${res.status}`);
        }
        const list = Array.isArray(data.templates) ? data.templates : [];
        console.log(`[BulkSendPage] templates loaded count=${list.length}`, list);
        if (!cancelled) {
          setTemplates(list);
        }
      } catch (e) {
        if (!cancelled) {
          console.error("[BulkSendPage] templates fetch failed", e);
          toast.error(
            e instanceof Error ? e.message : "Impossible de charger les templates.",
          );
        }
      } finally {
        if (!cancelled) setTemplatesLoading(false);
      }
    }

    void loadTemplates();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!pendingTemplateId || templates.length === 0) return;
    const match = templates.find((t) => t.id === pendingTemplateId);
    if (match) {
      setSelectedTemplate(match);
      setMessage(typeof match.body === "string" ? match.body : "");
    }
    setPendingTemplateId(undefined);
  }, [pendingTemplateId, templates]);

  useEffect(() => {
    if (!draftReady) return;
    const activePhones = new Set(parsePhoneNumbersInput(phonesRaw));
    const prunedNames = Object.fromEntries(
      Object.entries(contactNamesByPhone).filter(([phone]) => activePhones.has(phone)),
    );
    saveBulkSendDraft({
      phonesRaw,
      message,
      leadsImportCount,
      sendMode,
      selectedTemplateId: selectedTemplate?.id,
      contactNamesByPhone: prunedNames,
    });
  }, [
    draftReady,
    phonesRaw,
    message,
    leadsImportCount,
    sendMode,
    selectedTemplate,
    contactNamesByPhone,
  ]);

  const parsedPhones = useMemo(() => parsePhoneNumbersInput(phonesRaw), [phonesRaw]);
  const progressPercent =
    sendProgress.total > 0
      ? Math.min(100, Math.round((sendProgress.current / sendProgress.total) * 100))
      : 0;

  const resultSummary = useMemo(() => {
    if (!results) return null;
    const sent = results.filter((r) => r.success).length;
    const failed = results.length - sent;
    return { sent, failed, total: results.length };
  }, [results]);

  const handleImportFromLeads = () => {
    saveBulkSendDraft({
      phonesRaw,
      message,
      leadsImportCount,
      sendMode,
      selectedTemplateId: selectedTemplate?.id,
      contactNamesByPhone,
    });
  };

  const handleSendModeChange = (mode: BulkSendSendMode) => {
    setSendMode(mode);
    if (mode === "text") {
      setSelectedTemplate(null);
    }
  };

  const handleTemplateSelect = (templateId: string) => {
    if (!templateId) {
      setSelectedTemplate(null);
      setMessage("");
      return;
    }
    const template = templates.find((t) => t.id === templateId);
    if (!template) return;
    setSelectedTemplate(template);
    setMessage(typeof template.body === "string" ? template.body : "");
  };

  const canSend =
    parsedPhones.length > 0 &&
    (sendMode === "template" ? Boolean(selectedTemplate) : Boolean(message.trim()));

  const templatePreview = useMemo(() => {
    if (sendMode !== "template" || !message.trim()) return "";
    return formatTemplatePreview(message);
  }, [sendMode, message]);

  const handleSend = async () => {
    if (parsedPhones.length === 0) {
      toast.error("Ajoutez au moins un numéro valide (un par ligne).");
      return;
    }
    if (sendMode === "template") {
      if (!selectedTemplate) {
        toast.error("Sélectionnez un template WhatsApp.");
        return;
      }
    } else if (!message.trim()) {
      toast.error("Écrivez le message à envoyer.");
      return;
    }

    setSending(true);
    setResults(null);
    setSendProgress({ current: 0, total: parsedPhones.length });

    let payload: BulkWhatsAppSendPayload;
    if (sendMode === "template" && selectedTemplate) {
      payload = {
        phoneNumbers: parsedPhones,
        templateName: selectedTemplate.name,
        templateLanguage: "fr",
        recipients: parsedPhones.map((phone) => ({
          phoneNumber: phone,
          variable1: contactNamesByPhone[phone]?.trim() || FALLBACK_TEMPLATE_NAME,
        })),
      };
    } else {
      payload = { phoneNumbers: parsedPhones, text: message.trim() };
    }

    try {
      const res = await sendBulkWhatsAppMessages(payload, {
          onProgress: (completed, total) => {
            setSendProgress({ current: completed, total });
          },
        },
      );
      setResults(res.results);
      setSendProgress({ current: res.results.length, total: parsedPhones.length });

      if (res.sent > 0) {
        toast.success(`${res.sent} message${res.sent > 1 ? "s" : ""} envoyé${res.sent > 1 ? "s" : ""}.`);
      }
      if (res.failed > 0) {
        toast.error(`${res.failed} échec${res.failed > 1 ? "s" : ""}.`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Envoi impossible.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      {!draftReady ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="size-8 animate-spin text-emerald-500" aria-hidden />
        </div>
      ) : (
        <div className="mx-auto max-w-5xl space-y-6 px-6 py-8 md:px-8">
          <div className="rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-900/90 to-zinc-950 p-6 shadow-xl shadow-black/20">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-600/15 ring-1 ring-emerald-500/25">
                  <Users className="size-6 text-emerald-400" aria-hidden />
                </div>
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-widest text-zinc-500">
                    WhatsApp
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold text-white">Envoi multiple</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
                    Envoyez un même message à plusieurs contacts. Saisissez les numéros manuellement
                    ou importez-les depuis vos Leads ClickUp.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <div className="rounded-xl border border-zinc-700/80 bg-zinc-950/60 px-4 py-3 text-center">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
                    Destinataires
                  </p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums text-white">
                    {parsedPhones.length}
                  </p>
                </div>
                {leadsImportCount > 0 ? (
                  <div className="rounded-xl border border-sky-500/25 bg-sky-950/20 px-4 py-3 text-center">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-sky-400/80">
                      Depuis Leads
                    </p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums text-sky-200">
                      {leadsImportCount}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 shadow-lg shadow-black/10">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Smartphone className="size-4 text-emerald-400" aria-hidden />
                  <h3 className="text-sm font-semibold text-zinc-100">Destinataires</h3>
                </div>
                <Link
                  href={BULK_SEND_IMPORT_PATH}
                  onClick={handleImportFromLeads}
                  className="inline-flex items-center gap-2 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs font-medium text-sky-200 transition hover:bg-sky-500/20"
                >
                  <Download className="size-3.5" aria-hidden />
                  Importer depuis les Leads
                </Link>
              </div>

              <label htmlFor="bulk-phones" className="sr-only">
                Numéros de téléphone
              </label>
              <textarea
                id="bulk-phones"
                value={phonesRaw}
                onChange={(e) => setPhonesRaw(e.target.value)}
                rows={10}
                placeholder={"212612345678\n0612345678\n+212 6 12 34 56 78"}
                className="w-full rounded-xl border border-zinc-700/80 bg-zinc-950/90 px-4 py-3 font-mono text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-600/80 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
              />
              <p className="mt-2 text-xs text-zinc-500">
                Un numéro par ligne. Formats acceptés :{" "}
                <span className="font-mono text-zinc-400">212612345678</span>,{" "}
                <span className="font-mono text-zinc-400">0612345678</span>,{" "}
                <span className="font-mono text-zinc-400">+212 6 12 34 56 78</span>
              </p>
            </section>

            <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 shadow-lg shadow-black/10">
              <div className="mb-4 flex items-center gap-2">
                <MessageSquare className="size-4 text-emerald-400" aria-hidden />
                <h3 className="text-sm font-semibold text-zinc-100">Message</h3>
              </div>

              <div className="mb-4 flex rounded-xl border border-zinc-800 bg-zinc-950/60 p-1">
                <button
                  type="button"
                  onClick={() => handleSendModeChange("text")}
                  className={cn(
                    "flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition",
                    sendMode === "text"
                      ? "bg-emerald-600/20 text-emerald-300 ring-1 ring-emerald-500/30"
                      : "text-zinc-400 hover:text-zinc-200",
                  )}
                >
                  Texte libre
                </button>
                <button
                  type="button"
                  onClick={() => handleSendModeChange("template")}
                  className={cn(
                    "flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition",
                    sendMode === "template"
                      ? "bg-emerald-600/20 text-emerald-300 ring-1 ring-emerald-500/30"
                      : "text-zinc-400 hover:text-zinc-200",
                  )}
                >
                  Template WhatsApp
                </button>
              </div>

              {sendMode === "template" ? (
                <div className="mb-4 space-y-3">
                  <label htmlFor="bulk-template" className="block text-xs font-medium text-zinc-400">
                    Template approuvé
                  </label>
                  <div className="relative">
                    <select
                      id="bulk-template"
                      value={selectedTemplate?.id ?? ""}
                      onChange={(e) => handleTemplateSelect(e.target.value)}
                      disabled={templatesLoading}
                      className="w-full appearance-none rounded-xl border border-zinc-700/80 bg-zinc-950/90 px-4 py-3 pr-10 text-sm text-zinc-100 focus:border-emerald-600/80 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 disabled:opacity-50"
                    >
                      <option value="">
                        {templatesLoading
                          ? "Chargement des templates…"
                          : "Choisir un template"}
                      </option>
                      {templates.map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.name}
                        </option>
                      ))}
                    </select>
                    {templatesLoading ? (
                      <Loader2
                        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-emerald-400"
                        aria-hidden
                      />
                    ) : null}
                  </div>
                  {!templatesLoading && templates.length === 0 ? (
                    <p className="text-xs text-amber-400/90">
                      Aucun template personnalisé trouvé. Vérifiez WHATCHIMP_API_KEY côté serveur.
                    </p>
                  ) : null}
                </div>
              ) : null}

              {sendMode === "text" ? (
                <>
                  <label htmlFor="bulk-message" className="sr-only">
                    Message WhatsApp
                  </label>
                  <textarea
                    id="bulk-message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={10}
                    placeholder="Bonjour, nous vous contactons au sujet de…"
                    className="w-full rounded-xl border border-zinc-700/80 bg-zinc-950/90 px-4 py-3 text-sm leading-relaxed text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-600/80 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                  />
                  <p className="mt-2 text-xs text-zinc-500">
                    {message.trim().length} caractère{message.trim().length !== 1 ? "s" : ""}
                  </p>
                </>
              ) : (
                <>
                  <label htmlFor="bulk-template-body" className="sr-only">
                    Corps du template
                  </label>
                  <textarea
                    id="bulk-template-body"
                    value={message}
                    readOnly
                    rows={6}
                    placeholder="Sélectionnez un template pour voir son contenu…"
                    className="w-full rounded-xl border border-zinc-700/80 bg-zinc-950/90 px-4 py-3 text-sm leading-relaxed text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
                  />

                  {selectedTemplate && templatePreview ? (
                    <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-4">
                      <p className="font-mono text-[10px] uppercase tracking-widest text-emerald-400/80">
                        Aperçu
                      </p>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-200">
                        {templatePreview}
                      </p>
                      <p className="mt-3 text-xs text-zinc-500">
                        <span className="font-mono text-emerald-400/90">{"{{1}}"}</span> sera remplacé
                        par le nom du contact à l&apos;envoi.
                      </p>
                    </div>
                  ) : null}
                </>
              )}
            </section>
          </div>

          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 shadow-lg shadow-black/10">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-zinc-100">Lancer l&apos;envoi</h3>
                <p className="mt-1 text-xs text-zinc-500">
                  {parsedPhones.length > 0
                    ? sendMode === "template"
                      ? selectedTemplate
                        ? `Prêt à envoyer le template « ${selectedTemplate.name} » à ${parsedPhones.length} numéro${parsedPhones.length !== 1 ? "s" : ""}.`
                        : "Sélectionnez un template WhatsApp."
                      : `Prêt à envoyer à ${parsedPhones.length} numéro${parsedPhones.length !== 1 ? "s" : ""}.`
                    : sendMode === "template"
                      ? "Ajoutez des destinataires et sélectionnez un template."
                      : "Ajoutez au moins un destinataire et un message."}
                </p>
              </div>

              <button
                type="button"
                disabled={sending || !canSend}
                onClick={() => void handleSend()}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-900/30 transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {sending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Send className="size-4" aria-hidden />
                )}
                {sending
                  ? `Envoi ${sendProgress.current}/${sendProgress.total}…`
                  : `Envoyer à ${parsedPhones.length || "…"} numéro${parsedPhones.length !== 1 ? "s" : ""}`}
              </button>
            </div>

            {sending ? (
              <div className="mt-5 space-y-2">
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span className="font-medium text-zinc-300">Envoi en cours…</span>
                  <span className="font-mono tabular-nums">
                    {sendProgress.current} / {sendProgress.total} ({progressPercent}%)
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-300 ease-out"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            ) : null}
          </section>

          {results && results.length > 0 ? (
            <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/50 shadow-lg shadow-black/10">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 px-5 py-4">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-100">Résultats de l&apos;envoi</h3>
                  {resultSummary ? (
                    <p className="mt-1 text-xs text-zinc-500">
                      <span className="text-emerald-400">{resultSummary.sent} envoyé{resultSummary.sent !== 1 ? "s" : ""}</span>
                      {resultSummary.failed > 0 ? (
                        <>
                          {" · "}
                          <span className="text-red-400">
                            {resultSummary.failed} échec{resultSummary.failed !== 1 ? "s" : ""}
                          </span>
                        </>
                      ) : null}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800 bg-zinc-950/40 text-left text-[10px] uppercase tracking-widest text-zinc-500">
                      <th className="px-5 py-3 font-medium">Numéro</th>
                      <th className="px-5 py-3 font-medium">Statut</th>
                      <th className="px-5 py-3 font-medium">Détail</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/80">
                    {results.map((result) => (
                      <tr key={result.phoneNumber} className="transition hover:bg-zinc-800/30">
                        <td className="px-5 py-3 font-mono text-zinc-200">
                          {formatWhatsAppPhone(result.phoneNumber)}
                        </td>
                        <td className="px-5 py-3">
                          <SendResultBadge success={result.success} />
                        </td>
                        <td className="px-5 py-3 text-zinc-400">
                          {result.success ? (
                            <span className="text-xs text-zinc-500">Message transmis</span>
                          ) : (
                            <span className="text-xs text-red-300/90">{result.error ?? "Échec"}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-400" aria-hidden />
            <p className="text-xs leading-relaxed text-zinc-500">
              Sans endpoint <span className="font-mono text-zinc-400">POST /whatsapp/broadcast</span>,
              l&apos;envoi utilise les conversations déjà connues (contact ayant déjà écrit). Demandez
              au backend un envoi proactif si vous devez contacter de nouveaux numéros.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
