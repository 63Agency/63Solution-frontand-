"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  MessageSquare,
  Plus,
  RotateCcw,
  Send,
  Trash2,
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
import type {
  BulkWhatsAppSendPayload,
  BulkWhatsAppSendResultItem,
} from "@/lib/whatsapp/types";
import { formatWhatsAppSendError } from "@/lib/whatsapp/whatsapp-send-errors";
import { formatTemplatePreview } from "@/lib/whatsapp/whatsapp-templates";
import { getStoredAccessToken } from "@/lib/auth/backend-login";
import { cn } from "@/src/lib/utils";
import {
  avatarGradientClass,
  formatWhatsAppPhone,
  normalizeWhatsAppPhoneDigits,
  parsePhoneNumbersInput,
} from "./whatsapp-utils";

const FALLBACK_TEMPLATE_NAME = "Client";
const PAGE_SIZE = 15;

const BULK_TABLE_CLASS =
  "w-full min-w-[520px] border-collapse font-mono text-sm text-zinc-300";
const BULK_THEAD_ROW =
  "border-b border-zinc-700 text-left text-[10px] uppercase tracking-widest text-zinc-500";
const BULK_TH = "pb-2 pr-4 font-normal";
const BULK_TH_RIGHT = "pb-2 pl-4 text-right font-normal";
const BULK_TR = "border-b border-zinc-800 transition hover:bg-zinc-800/50";
const BULK_TD = "py-3 pr-4";
const BULK_TD_RIGHT = "py-3 pl-4 text-right";

type WizardStep = 1 | 2 | 3;
type Recipient = { phone: string; name: string };

const STEPS: { id: WizardStep; label: string }[] = [
  { id: 1, label: "Destinataires" },
  { id: 2, label: "Template" },
  { id: 3, label: "Confirmation" },
];

function recipientsFromDraft(
  phonesRaw: string,
  names: Record<string, string>,
): Recipient[] {
  return parsePhoneNumbersInput(phonesRaw).map((phone) => ({
    phone,
    name: names[phone]?.trim() ?? "",
  }));
}

function draftFromRecipients(recipients: Recipient[]) {
  return {
    phonesRaw: recipients.map((r) => r.phone).join("\n"),
    contactNamesByPhone: Object.fromEntries(
      recipients
        .filter((r) => r.name.trim())
        .map((r) => [r.phone, r.name.trim()]),
    ),
  };
}

function personalizeMessage(body: string, name: string): string {
  return body.replace(/\{\{1\}\}/g, name.trim() || FALLBACK_TEMPLATE_NAME);
}

function buildPageItems(page: number, totalPages: number): (number | "...")[] {
  if (totalPages <= 3) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const items: (number | "...")[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(totalPages - 1, page + 1);
  if (start > 2) items.push("...");
  for (let p = start; p <= end; p += 1) items.push(p);
  if (end < totalPages - 1) items.push("...");
  items.push(totalPages);
  return items;
}

function DevisTablePagination({
  page,
  totalPages,
  totalItems,
  itemLabel,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  itemLabel: string;
  onPageChange: (page: number) => void;
}) {
  if (totalItems <= PAGE_SIZE) return null;
  const pageItems = buildPageItems(page, totalPages);

  return (
    <div className="mt-4 flex flex-col gap-3 border-t border-zinc-800 pt-3 font-mono text-[11px] uppercase tracking-widest text-zinc-400 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-center sm:text-left">
        Page {page} / {totalPages} — {totalItems} {itemLabel}
      </p>
      <div className="flex items-center justify-center gap-1.5">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="rounded border border-zinc-700 px-2.5 py-1.5 text-zinc-300 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Précédent
        </button>
        {pageItems.map((item, idx) =>
          item === "..." ? (
            <span
              key={`dots-${idx}`}
              className="hidden px-1 text-zinc-500 sm:inline"
            >
              ...
            </span>
          ) : (
            <button
              key={item}
              type="button"
              onClick={() => onPageChange(item)}
              className={cn(
                "hidden rounded border px-2.5 py-1.5 sm:inline-flex",
                item === page
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
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="rounded border border-zinc-700 px-2.5 py-1.5 text-zinc-300 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Suivant
        </button>
      </div>
    </div>
  );
}

function StepIndicator({
  current,
  maxReached,
  onGoTo,
}: {
  current: WizardStep;
  maxReached: WizardStep;
  onGoTo: (step: WizardStep) => void;
}) {
  const currentLabel = STEPS.find((s) => s.id === current)?.label ?? "";

  return (
    <div className="mb-6 sm:mb-8">
      <p className="mb-3 text-center text-sm font-medium text-zinc-400 sm:hidden">
        Étape {current} — {currentLabel}
      </p>
      <div className="flex items-center justify-center gap-0">
      {STEPS.map((step, idx) => {
        const done = step.id < current;
        const active = step.id === current;
        const reachable = step.id <= maxReached;

        return (
          <div key={step.id} className="flex items-center">
            <button
              type="button"
              disabled={!reachable}
              onClick={() => reachable && onGoTo(step.id)}
              className={cn(
                "flex items-center gap-2.5 rounded-xl px-3 py-2 transition",
                reachable && !active ? "hover:bg-zinc-800/60" : "",
                !reachable && "cursor-default opacity-50",
              )}
            >
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition",
                  done
                    ? "bg-emerald-500 text-white"
                    : active
                      ? "bg-emerald-500/20 text-emerald-400 ring-2 ring-emerald-500/40"
                      : "bg-zinc-800 text-zinc-500",
                )}
              >
                {done ? <Check className="size-4" /> : step.id}
              </span>
              <span
                className={cn(
                  "hidden text-sm font-medium sm:block",
                  active ? "text-white" : "text-zinc-500",
                )}
              >
                {step.label}
              </span>
            </button>
            {idx < STEPS.length - 1 ? (
              <div
                className={cn(
                  "mx-1 h-px w-8 sm:w-16",
                  step.id < current ? "bg-emerald-500/60" : "bg-zinc-800",
                )}
              />
            ) : null}
          </div>
        );
      })}
      </div>
    </div>
  );
}

function RecipientAvatar({ name, phone }: { name: string; phone: string }) {
  const seed = name || phone;
  const initial = (name || phone).charAt(0).toUpperCase() || "?";
  return (
    <span
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-xs font-semibold text-white",
        avatarGradientClass(seed),
      )}
    >
      {initial}
    </span>
  );
}

function RecipientMobileCard({
  index,
  recipient,
  onRemove,
  messagePreview,
}: {
  index: number;
  recipient: Recipient;
  onRemove?: () => void;
  messagePreview?: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <RecipientAvatar name={recipient.name} phone={recipient.phone} />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">
              {recipient.name || "—"}
            </p>
            <p className="truncate font-mono text-xs text-zinc-500">
              {formatWhatsAppPhone(recipient.phone)}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="font-mono text-[10px] text-zinc-600">#{index}</span>
          {onRemove ? (
            <button
              type="button"
              onClick={onRemove}
              className="inline-flex items-center justify-center rounded border border-red-700/60 p-1.5 text-red-300 hover:bg-red-900/30"
              aria-label="Supprimer"
            >
              <Trash2 className="size-3.5" />
            </button>
          ) : null}
        </div>
      </div>
      {messagePreview ? (
        <p className="mt-2 line-clamp-3 border-t border-zinc-800/80 pt-2 text-xs leading-relaxed text-zinc-400">
          {messagePreview}
        </p>
      ) : null}
    </div>
  );
}

function SendResultMobileCard({
  result,
}: {
  result: BulkWhatsAppSendResultItem;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="font-mono text-sm text-zinc-200">
          {formatWhatsAppPhone(result.phoneNumber)}
        </p>
        {result.success ? (
          <span className="shrink-0 text-xs font-medium text-emerald-400">
            Envoyé
          </span>
        ) : (
          <span className="shrink-0 text-xs font-medium text-red-400">
            Échec
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-zinc-500">
        {result.success ? "Message transmis" : result.error ?? "Échec"}
      </p>
    </div>
  );
}

export function BulkSendPage() {
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [maxReachedStep, setMaxReachedStep] = useState<WizardStep>(1);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [message, setMessage] = useState("");
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [sendMode, setSendMode] = useState<BulkSendSendMode>("template");
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendProgress, setSendProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState<BulkWhatsAppSendResultItem[] | null>(
    null,
  );
  const [leadsImportCount, setLeadsImportCount] = useState(0);
  const [draftReady, setDraftReady] = useState(false);
  const [pendingTemplateId, setPendingTemplateId] = useState<
    string | undefined
  >();

  const [step1Page, setStep1Page] = useState(1);
  const [step3Page, setStep3Page] = useState(1);
  const [addName, setAddName] = useState("");
  const [addPhone, setAddPhone] = useState("");
  const [showBulkPaste, setShowBulkPaste] = useState(false);
  const [bulkPasteRaw, setBulkPasteRaw] = useState("");

  useEffect(() => {
    consumeBulkSendImport();
    const draft = loadBulkSendDraft();
    const phones = draft?.phonesRaw ?? "";
    const names = { ...(draft?.contactNamesByPhone ?? {}) };
    const draftSendMode = draft?.sendMode ?? "template";
    const draftTemplateId = draft?.selectedTemplateId;

    setRecipients(recipientsFromDraft(phones, names));
    setMessage(draft?.message ?? "");
    setLeadsImportCount(draft?.leadsImportCount ?? 0);
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
        if (!res.ok)
          throw new Error(data?.error ?? `Erreur ${res.status}`);
        if (!cancelled)
          setTemplates(Array.isArray(data.templates) ? data.templates : []);
      } catch (e) {
        if (!cancelled)
          toast.error(
            e instanceof Error
              ? e.message
              : "Impossible de charger les templates.",
          );
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
    const { phonesRaw, contactNamesByPhone } = draftFromRecipients(recipients);
    saveBulkSendDraft({
      phonesRaw,
      message,
      leadsImportCount,
      sendMode,
      selectedTemplateId: selectedTemplate?.id,
      contactNamesByPhone,
    });
  }, [
    draftReady,
    recipients,
    message,
    leadsImportCount,
    sendMode,
    selectedTemplate,
  ]);

  const step1TotalPages = Math.max(
    1,
    Math.ceil(recipients.length / PAGE_SIZE),
  );
  const step3TotalPages = Math.max(
    1,
    Math.ceil(recipients.length / PAGE_SIZE),
  );

  const step1PageRecipients = useMemo(() => {
    const start = (step1Page - 1) * PAGE_SIZE;
    return recipients.slice(start, start + PAGE_SIZE);
  }, [recipients, step1Page]);

  const step3PageRecipients = useMemo(() => {
    const start = (step3Page - 1) * PAGE_SIZE;
    return recipients.slice(start, start + PAGE_SIZE);
  }, [recipients, step3Page]);

  useEffect(() => {
    if (step1Page > step1TotalPages) setStep1Page(step1TotalPages);
  }, [step1Page, step1TotalPages]);

  useEffect(() => {
    if (step3Page > step3TotalPages) setStep3Page(step3TotalPages);
  }, [step3Page, step3TotalPages]);

  const progressPercent =
    sendProgress.total > 0
      ? Math.min(
          100,
          Math.round((sendProgress.current / sendProgress.total) * 100),
        )
      : 0;

  const resultSummary = useMemo(() => {
    if (!results) return null;
    const sent = results.filter((r) => r.success).length;
    return { sent, failed: results.length - sent, total: results.length };
  }, [results]);

  const templateBody =
    sendMode === "template" && selectedTemplate
      ? typeof selectedTemplate.body === "string"
        ? selectedTemplate.body
        : message
      : message;

  const hasVariable1 = templateBody.includes("{{1}}");

  const canGoStep2 = recipients.length > 0;
  const canGoStep3 =
    sendMode === "template"
      ? Boolean(selectedTemplate)
      : Boolean(message.trim());

  const goToStep = (step: WizardStep) => {
    setCurrentStep(step);
    setMaxReachedStep((prev) => (step > prev ? step : prev));
  };

  const goNext = () => {
    if (currentStep === 1) {
      if (!canGoStep2) {
        toast.error("Ajoutez au moins un destinataire.");
        return;
      }
      goToStep(2);
    } else if (currentStep === 2) {
      if (!canGoStep3) {
        toast.error(
          sendMode === "template"
            ? "Sélectionnez un template."
            : "Rédigez votre message.",
        );
        return;
      }
      setStep3Page(1);
      goToStep(3);
    }
  };

  const goBack = () => {
    if (currentStep > 1) setCurrentStep((s) => (s - 1) as WizardStep);
  };

  const handleImportFromLeads = () => {
    const { phonesRaw, contactNamesByPhone } = draftFromRecipients(recipients);
    saveBulkSendDraft({
      phonesRaw,
      message,
      leadsImportCount,
      sendMode,
      selectedTemplateId: selectedTemplate?.id,
      contactNamesByPhone,
    });
  };

  const addRecipient = () => {
    const phone = normalizeWhatsAppPhoneDigits(addPhone);
    if (phone.length < 9) {
      toast.error("Numéro invalide.");
      return;
    }
    if (recipients.some((r) => r.phone === phone)) {
      toast.error("Ce numéro est déjà dans la liste.");
      return;
    }
    setRecipients((prev) => [
      ...prev,
      { phone, name: addName.trim() },
    ]);
    setAddName("");
    setAddPhone("");
    toast.success("Contact ajouté.");
  };

  const removeRecipient = (phone: string) => {
    setRecipients((prev) => prev.filter((r) => r.phone !== phone));
  };

  const applyBulkPaste = () => {
    const lines = bulkPasteRaw
      .split(/\n+/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return;

    const existing = new Set(recipients.map((r) => r.phone));
    const added: Recipient[] = [];

    for (const line of lines) {
      const parts = line.split(/[,;\t|]/).map((p) => p.trim());
      let name = "";
      let phoneRaw = line;

      if (parts.length >= 2) {
        const a = normalizeWhatsAppPhoneDigits(parts[0]);
        const b = normalizeWhatsAppPhoneDigits(parts[1]);
        if (a.length >= 9 && b.length < 9) {
          phoneRaw = parts[0];
          name = parts.slice(1).join(" ");
        } else if (b.length >= 9) {
          phoneRaw = parts[1];
          name = parts[0];
        }
      }

      const phone = normalizeWhatsAppPhoneDigits(phoneRaw);
      if (phone.length < 9 || existing.has(phone)) continue;
      existing.add(phone);
      added.push({ phone, name });
    }

    if (added.length === 0) {
      toast.info("Aucun nouveau numéro valide détecté.");
      return;
    }

    setRecipients((prev) => [...prev, ...added]);
    setBulkPasteRaw("");
    setShowBulkPaste(false);
    toast.success(
      `${added.length} contact${added.length > 1 ? "s" : ""} ajouté${added.length > 1 ? "s" : ""}.`,
    );
  };

  const handleTemplateSelect = (template: any) => {
    setSelectedTemplate(template);
    setMessage(typeof template.body === "string" ? template.body : "");
    setSendMode("template");
  };

  const handleSend = async () => {
    const phones = recipients.map((r) => r.phone);
    if (phones.length === 0) {
      toast.error("Aucun destinataire.");
      return;
    }
    if (sendMode === "template" && !selectedTemplate) {
      toast.error("Sélectionnez un template.");
      return;
    }
    if (sendMode === "text" && !message.trim()) {
      toast.error("Message vide.");
      return;
    }

    setSending(true);
    setResults(null);
    setSendProgress({ current: 0, total: phones.length });

    const namesMap = Object.fromEntries(
      recipients.map((r) => [r.phone, r.name]),
    );

    let payload: BulkWhatsAppSendPayload;
    if (sendMode === "template" && selectedTemplate) {
      if (hasVariable1) {
        payload = {
          phoneNumbers: phones,
          templateName: selectedTemplate.name,
          templateLanguage: "fr",
          recipients: phones.map((phone) => ({
            phoneNumber: phone,
            variable1:
              namesMap[phone]?.trim() || FALLBACK_TEMPLATE_NAME,
          })),
        };
      } else {
        payload = {
          phoneNumbers: phones,
          templateName: selectedTemplate.name,
          templateLanguage: "fr",
          components: [],
        };
      }
    } else {
      payload = { phoneNumbers: phones, text: message.trim() };
    }

    try {
      const res = await sendBulkWhatsAppMessages(payload, {
        onProgress: (completed, total) => {
          setSendProgress({ current: completed, total });
        },
      });
      setResults(res.results);
      if (res.sent > 0)
        toast.success(
          `${res.sent} message${res.sent > 1 ? "s" : ""} envoyé${res.sent > 1 ? "s" : ""}.`,
        );
      if (res.failed > 0)
        toast.error(`${res.failed} échec${res.failed > 1 ? "s" : ""}.`);
    } catch (e) {
      toast.error(
        formatWhatsAppSendError(
          e instanceof Error ? e.message : "Envoi impossible.",
        ),
      );
    } finally {
      setSending(false);
    }
  };

  const handleNewSend = () => {
    setRecipients([]);
    setMessage("");
    setSelectedTemplate(null);
    setResults(null);
    setLeadsImportCount(0);
    setSendMode("template");
    setCurrentStep(1);
    setMaxReachedStep(1);
    setStep1Page(1);
    setStep3Page(1);
    saveBulkSendDraft({
      phonesRaw: "",
      message: "",
      leadsImportCount: 0,
      sendMode: "template",
      contactNamesByPhone: {},
    });
  };

  if (!draftReady) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center bg-zinc-950">
        <Loader2 className="size-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (results && results.length > 0) {
    return (
      <div className="app-scroll min-h-0 flex-1 overflow-y-auto bg-zinc-950">
        <div className="mx-auto max-w-4xl px-3 py-4 sm:px-6 sm:py-6">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-lg font-semibold text-white sm:text-xl">
                Résultats de l&apos;envoi
              </h1>
              <p className="mt-1 text-sm text-zinc-500">
                {resultSummary?.sent} envoyé
                {(resultSummary?.sent ?? 0) !== 1 ? "s" : ""}
                {(resultSummary?.failed ?? 0) > 0
                  ? ` · ${resultSummary?.failed} échec${(resultSummary?.failed ?? 0) !== 1 ? "s" : ""}`
                  : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={handleNewSend}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-800 px-4 py-2.5 text-sm font-medium text-zinc-200 ring-1 ring-zinc-700 hover:bg-zinc-700 sm:w-auto"
            >
              <RotateCcw className="size-4" />
              Nouvel envoi
            </button>
          </div>

          <div className="mb-6 grid grid-cols-3 gap-2 sm:gap-3">
            {[
              { label: "Total", value: resultSummary?.total, color: "text-white" },
              { label: "Envoyés", value: resultSummary?.sent, color: "text-emerald-400" },
              { label: "Échecs", value: resultSummary?.failed, color: "text-red-400" },
            ].map((card) => (
              <div
                key={card.label}
                className="rounded-xl bg-zinc-900 p-3 ring-1 ring-zinc-800 sm:rounded-2xl sm:p-4"
              >
                <p className="text-[10px] uppercase tracking-wider text-zinc-500 sm:text-xs">
                  {card.label}
                </p>
                <p className={cn("mt-1 text-xl font-bold tabular-nums sm:text-2xl", card.color)}>
                  {card.value ?? 0}
                </p>
              </div>
            ))}
          </div>

          <section>
            <div className="mb-4">
              <h3 className="text-base font-medium text-white">Résultats détaillés</h3>
              <p className="text-xs uppercase tracking-widest text-zinc-500">Aperçu</p>
            </div>
            <div className="md:hidden">
              <div className="space-y-2">
                {results.map((r) => (
                  <SendResultMobileCard key={r.phoneNumber} result={r} />
                ))}
              </div>
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className={BULK_TABLE_CLASS}>
                <thead>
                  <tr className={BULK_THEAD_ROW}>
                    <th className={BULK_TH}>Numéro</th>
                    <th className={BULK_TH}>Statut</th>
                    <th className={BULK_TH}>Détail</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => (
                    <tr key={r.phoneNumber} className={BULK_TR}>
                      <td className={BULK_TD}>{formatWhatsAppPhone(r.phoneNumber)}</td>
                      <td className={BULK_TD}>
                        {r.success ? (
                          <span className="text-emerald-400">Envoyé</span>
                        ) : (
                          <span className="text-red-400">Échec</span>
                        )}
                      </td>
                      <td className={BULK_TD}>
                        {r.success ? "Message transmis" : r.error ?? "Échec"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="app-scroll min-h-0 flex-1 overflow-y-auto bg-zinc-950">
      <div className="mx-auto max-w-5xl px-3 py-4 pb-28 sm:px-6 sm:py-6 sm:pb-6 lg:px-8">
        {/* Header */}
        <div className="mb-2 flex items-center gap-3">
          <Link
            href="/dashboard/conversations"
            className="flex size-9 shrink-0 items-center justify-center rounded-xl text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold text-white sm:text-xl">
              Envoi multiple
            </h1>
            <p className="truncate text-xs text-zinc-500 sm:text-sm">
              {recipients.length} destinataire
              {recipients.length !== 1 ? "s" : ""}
              {leadsImportCount > 0
                ? ` · ${leadsImportCount} depuis les Leads`
                : ""}
            </p>
          </div>
        </div>

        <StepIndicator
          current={currentStep}
          maxReached={maxReachedStep}
          onGoTo={goToStep}
        />

        {/* ─────────────── STEP 1 : Destinataires ─────────────── */}
        {currentStep === 1 ? (
          <div className="space-y-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-white sm:text-lg">
                  Destinataires
                </h2>
                <p className="text-xs text-zinc-500 sm:text-sm">
                  Importez ou ajoutez les contacts qui recevront le message
                </p>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
                <Link
                  href={BULK_SEND_IMPORT_PATH}
                  onClick={handleImportFromLeads}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-500/10 px-4 py-2.5 text-sm font-medium text-sky-300 ring-1 ring-sky-500/25 hover:bg-sky-500/20"
                >
                  <Download className="size-4 shrink-0" />
                  <span className="truncate">Importer les Leads</span>
                </Link>
                <button
                  type="button"
                  onClick={() => setShowBulkPaste((v) => !v)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-800 px-4 py-2.5 text-sm font-medium text-zinc-300 ring-1 ring-zinc-700 hover:bg-zinc-700"
                >
                  <Users className="size-4 shrink-0" />
                  Coller en masse
                </button>
              </div>
            </div>

            {/* Add single contact */}
            <div className="rounded-2xl bg-zinc-900 p-3 ring-1 ring-zinc-800 sm:p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Ajouter un contact
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <input
                  type="text"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  placeholder="Nom (optionnel)"
                  className="w-full rounded-xl bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100 ring-1 ring-zinc-800 placeholder:text-zinc-600 focus:ring-2 focus:ring-emerald-500/40 focus:outline-none sm:min-w-[140px] sm:flex-1"
                />
                <input
                  type="tel"
                  value={addPhone}
                  onChange={(e) => setAddPhone(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addRecipient()}
                  placeholder="212612345678"
                  className="w-full rounded-xl bg-zinc-950 px-4 py-2.5 font-mono text-sm text-zinc-100 ring-1 ring-zinc-800 placeholder:text-zinc-600 focus:ring-2 focus:ring-emerald-500/40 focus:outline-none sm:min-w-[160px] sm:flex-1"
                />
                <button
                  type="button"
                  onClick={addRecipient}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-400 sm:w-auto"
                >
                  <Plus className="size-4" />
                  Ajouter
                </button>
              </div>
            </div>

            {showBulkPaste ? (
              <div className="rounded-2xl bg-zinc-900 p-4 ring-1 ring-zinc-800">
                <p className="mb-2 text-xs text-zinc-500">
                  Un contact par ligne. Formats :{" "}
                  <code className="text-zinc-400">212612345678</code> ou{" "}
                  <code className="text-zinc-400">Nom, 0612345678</code>
                </p>
                <textarea
                  value={bulkPasteRaw}
                  onChange={(e) => setBulkPasteRaw(e.target.value)}
                  rows={4}
                  placeholder={"Ahmed Benali, 212612345678\nFatima Zahra, 0612345678"}
                  className="w-full rounded-xl bg-zinc-950 px-4 py-3 font-mono text-sm text-zinc-100 ring-1 ring-zinc-800 placeholder:text-zinc-600 focus:ring-2 focus:ring-emerald-500/40 focus:outline-none"
                />
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowBulkPaste(false);
                      setBulkPasteRaw("");
                    }}
                    className="rounded-xl px-4 py-2 text-sm text-zinc-400 hover:text-white"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={applyBulkPaste}
                    className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-400"
                  >
                    Importer
                  </button>
                </div>
              </div>
            ) : null}

            {/* Recipients table */}
            <section>
              <div className="mb-4">
                <h3 className="text-base font-medium text-white">Liste des destinataires</h3>
                <p className="text-xs uppercase tracking-widest text-zinc-500">
                  {recipients.length} contact{recipients.length !== 1 ? "s" : ""} — aperçu
                </p>
              </div>
              {recipients.length === 0 ? (
                <div className="py-12 text-center font-mono text-sm text-zinc-500">
                  Aucun destinataire pour le moment.
                </div>
              ) : (
                <>
                  <div className="space-y-2 md:hidden">
                    {step1PageRecipients.map((r, idx) => {
                      const globalIdx =
                        (step1Page - 1) * PAGE_SIZE + idx + 1;
                      return (
                        <RecipientMobileCard
                          key={r.phone}
                          index={globalIdx}
                          recipient={r}
                          onRemove={() => removeRecipient(r.phone)}
                        />
                      );
                    })}
                  </div>
                  <div className="hidden overflow-x-auto md:block">
                    <table className={BULK_TABLE_CLASS}>
                      <thead>
                        <tr className={BULK_THEAD_ROW}>
                          <th className={BULK_TH}>#</th>
                          <th className={BULK_TH}>Contact</th>
                          <th className={BULK_TH}>Téléphone</th>
                          <th className={BULK_TH_RIGHT}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {step1PageRecipients.map((r, idx) => {
                          const globalIdx =
                            (step1Page - 1) * PAGE_SIZE + idx + 1;
                          return (
                            <tr key={r.phone} className={BULK_TR}>
                              <td className={BULK_TD}>{globalIdx}</td>
                              <td className={BULK_TD}>
                                <div className="flex items-center gap-3">
                                  <RecipientAvatar
                                    name={r.name}
                                    phone={r.phone}
                                  />
                                  <span>{r.name || "—"}</span>
                                </div>
                              </td>
                              <td className={BULK_TD}>
                                {formatWhatsAppPhone(r.phone)}
                              </td>
                              <td className={BULK_TD_RIGHT}>
                                <button
                                  type="button"
                                  onClick={() => removeRecipient(r.phone)}
                                  className="inline-flex items-center justify-center rounded border border-red-700/60 p-1.5 text-red-300 hover:bg-red-900/30"
                                  aria-label="Supprimer"
                                >
                                  <Trash2 className="size-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <DevisTablePagination
                    page={step1Page}
                    totalPages={step1TotalPages}
                    totalItems={recipients.length}
                    itemLabel="destinataires"
                    onPageChange={setStep1Page}
                  />
                </>
              )}
            </section>
          </div>
        ) : null}

        {/* ─────────────── STEP 2 : Template ─────────────── */}
        {currentStep === 2 ? (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-white">
                Choisir le message
              </h2>
              <p className="text-sm text-zinc-500">
                Sélectionnez un template approuvé ou rédigez un texte libre
              </p>
            </div>

            <div className="flex rounded-xl bg-zinc-900 p-1 ring-1 ring-zinc-800">
              <button
                type="button"
                onClick={() => setSendMode("template")}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition",
                  sendMode === "template"
                    ? "bg-zinc-800 text-white"
                    : "text-zinc-500 hover:text-zinc-300",
                )}
              >
                <FileText className="size-4 shrink-0" />
                <span className="hidden sm:inline">Template WhatsApp</span>
                <span className="sm:hidden">Template</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSendMode("text");
                  setSelectedTemplate(null);
                }}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition",
                  sendMode === "text"
                    ? "bg-zinc-800 text-white"
                    : "text-zinc-500 hover:text-zinc-300",
                )}
              >
                <MessageSquare className="size-4" />
                Texte libre
              </button>
            </div>

            {sendMode === "template" ? (
              templatesLoading ? (
                <div className="flex items-center justify-center gap-3 py-16 text-zinc-500">
                  <Loader2 className="size-6 animate-spin text-emerald-500" />
                  Chargement des templates…
                </div>
              ) : templates.length === 0 ? (
                <div className="rounded-2xl bg-amber-500/5 p-6 text-center ring-1 ring-amber-500/20">
                  <p className="text-sm text-amber-400">
                    Aucun template trouvé. Vérifiez META_ACCESS_TOKEN.
                  </p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {templates.map((template) => {
                    const selected = selectedTemplate?.id === template.id;
                    const body =
                      typeof template.body === "string" ? template.body : "";
                    return (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => handleTemplateSelect(template)}
                        className={cn(
                          "rounded-2xl p-4 text-left ring-1 transition",
                          selected
                            ? "bg-emerald-500/10 ring-emerald-500/40"
                            : "bg-zinc-900 ring-zinc-800 hover:ring-zinc-700",
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-semibold text-white">
                            {template.name}
                          </p>
                          {selected ? (
                            <CheckCircle2 className="size-5 shrink-0 text-emerald-400" />
                          ) : null}
                        </div>
                        <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-zinc-400">
                          {body || "—"}
                        </p>
                        {body.includes("{{1}}") ? (
                          <p className="mt-2 text-xs text-emerald-400/70">
                            Variable {"{{1}}"} = nom du contact
                          </p>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              )
            ) : (
              <div className="rounded-2xl bg-zinc-900 p-4 ring-1 ring-zinc-800">
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={8}
                  placeholder="Bonjour, nous vous contactons au sujet de…"
                  className="w-full rounded-xl bg-zinc-950 px-4 py-3 text-sm leading-relaxed text-zinc-100 ring-1 ring-zinc-800 placeholder:text-zinc-600 focus:ring-2 focus:ring-emerald-500/40 focus:outline-none"
                />
                <p className="mt-2 text-right text-xs tabular-nums text-zinc-600">
                  {message.trim().length} caractères
                </p>
              </div>
            )}
          </div>
        ) : null}

        {/* ─────────────── STEP 3 : Confirmation ─────────────── */}
        {currentStep === 3 ? (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-white">
                Confirmation avant envoi
              </h2>
              <p className="text-sm text-zinc-500">
                Vérifiez le message et la liste des destinataires
              </p>
            </div>

            {/* Message preview */}
            <div className="rounded-2xl bg-zinc-900 p-5 ring-1 ring-zinc-800">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                {sendMode === "template" && selectedTemplate
                  ? `Template : ${selectedTemplate.name}`
                  : "Message texte libre"}
              </p>
              <div className="w-full max-w-md rounded-2xl rounded-tl-sm bg-[#005c4b] px-4 py-3 shadow-md">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#e9edef]">
                  {sendMode === "template"
                    ? formatTemplatePreview(templateBody)
                    : message.trim() || "—"}
                </p>
                <p className="mt-1 text-right text-[10px] text-[#8696a0]">
                  {new Date().toLocaleTimeString("fr-FR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              {hasVariable1 ? (
                <p className="mt-3 text-xs text-zinc-500">
                  Le nom de chaque contact remplacera{" "}
                  <code className="rounded bg-zinc-800 px-1 font-mono text-emerald-400">
                    {"{{1}}"}
                  </code>{" "}
                  dans le message envoyé.
                </p>
              ) : null}
            </div>

            {/* Recipients review table */}
            <section>
              <div className="mb-4">
                <h3 className="text-base font-medium text-white">Confirmation d&apos;envoi</h3>
                <p className="text-xs uppercase tracking-widest text-zinc-500">
                  {recipients.length} destinataire{recipients.length !== 1 ? "s" : ""} — aperçu
                </p>
              </div>
              <div className="space-y-2 md:hidden">
                {step3PageRecipients.map((r, idx) => {
                  const globalIdx = (step3Page - 1) * PAGE_SIZE + idx + 1;
                  const preview =
                    sendMode === "template"
                      ? personalizeMessage(
                          templateBody,
                          r.name || FALLBACK_TEMPLATE_NAME,
                        )
                      : message.trim();

                  return (
                    <RecipientMobileCard
                      key={r.phone}
                      index={globalIdx}
                      recipient={r}
                      messagePreview={
                        hasVariable1 || sendMode === "text"
                          ? preview || "—"
                          : undefined
                      }
                    />
                  );
                })}
              </div>
              <div className="hidden overflow-x-auto md:block">
                <table className={BULK_TABLE_CLASS}>
                  <thead>
                    <tr className={BULK_THEAD_ROW}>
                      <th className={BULK_TH}>#</th>
                      <th className={BULK_TH}>Contact</th>
                      <th className={BULK_TH}>Téléphone</th>
                      {hasVariable1 || sendMode === "text" ? (
                        <th className={BULK_TH}>Message</th>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody>
                    {step3PageRecipients.map((r, idx) => {
                      const globalIdx =
                        (step3Page - 1) * PAGE_SIZE + idx + 1;
                      const preview =
                        sendMode === "template"
                          ? personalizeMessage(
                              templateBody,
                              r.name || FALLBACK_TEMPLATE_NAME,
                            )
                          : message.trim();

                      return (
                        <tr key={r.phone} className={BULK_TR}>
                          <td className={BULK_TD}>{globalIdx}</td>
                          <td className={BULK_TD}>
                            <div className="flex items-center gap-3">
                              <RecipientAvatar
                                name={r.name}
                                phone={r.phone}
                              />
                              <span>{r.name || FALLBACK_TEMPLATE_NAME}</span>
                            </div>
                          </td>
                          <td className={BULK_TD}>
                            {formatWhatsAppPhone(r.phone)}
                          </td>
                          {hasVariable1 || sendMode === "text" ? (
                            <td className={BULK_TD}>
                              <span className="line-clamp-2 text-zinc-400">
                                {preview || "—"}
                              </span>
                            </td>
                          ) : null}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <DevisTablePagination
                page={step3Page}
                totalPages={step3TotalPages}
                totalItems={recipients.length}
                itemLabel="destinataires"
                onPageChange={setStep3Page}
              />
            </section>

            {sending ? (
              <div className="rounded-2xl bg-zinc-900 p-4 ring-1 ring-zinc-800">
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span>Envoi en cours…</span>
                  <span className="font-mono tabular-nums">
                    {sendProgress.current}/{sendProgress.total} ({progressPercent}
                    %)
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            ) : null}

            <div className="flex items-start gap-2.5 rounded-xl bg-amber-500/5 px-4 py-3 ring-1 ring-amber-500/15">
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-400/70" />
              <p className="text-xs leading-relaxed text-zinc-500">
                L&apos;envoi utilise les conversations déjà connues. Pour
                contacter de nouveaux numéros, un endpoint broadcast est
                nécessaire côté backend.
              </p>
            </div>
          </div>
        ) : null}

        {/* Navigation footer */}
        <div className="sticky bottom-0 z-10 -mx-3 mt-8 flex items-center justify-between gap-3 border-t border-zinc-800 bg-zinc-950/95 px-3 py-3 backdrop-blur-md sm:static sm:mx-0 sm:mt-8 sm:bg-transparent sm:px-0 sm:py-0 sm:pt-6 sm:backdrop-blur-none">
          <button
            type="button"
            onClick={goBack}
            disabled={currentStep === 1}
            className="inline-flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-zinc-400 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-30 sm:px-4"
          >
            <ArrowLeft className="size-4" />
            <span className="hidden sm:inline">Retour</span>
          </button>

          {currentStep < 3 ? (
            <button
              type="button"
              onClick={goNext}
              disabled={
                (currentStep === 1 && !canGoStep2) ||
                (currentStep === 2 && !canGoStep3)
              }
              className={cn(
                "inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition sm:px-6",
                (currentStep === 1 && canGoStep2) ||
                  (currentStep === 2 && canGoStep3)
                  ? "bg-emerald-500 text-white hover:bg-emerald-400"
                  : "cursor-not-allowed bg-zinc-800 text-zinc-500",
              )}
            >
              Continuer
              <ArrowRight className="size-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={sending || recipients.length === 0}
              onClick={() => void handleSend()}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition sm:px-8 sm:py-3",
                !sending && recipients.length > 0
                  ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-400"
                  : "cursor-not-allowed bg-zinc-800 text-zinc-500",
              )}
            >
              {sending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              {sending ? (
                `Envoi ${sendProgress.current}/${sendProgress.total}…`
              ) : (
                <>
                  <span className="hidden sm:inline">
                    {`Envoyer à ${recipients.length} contact${recipients.length !== 1 ? "s" : ""}`}
                  </span>
                  <span className="sm:hidden">
                    {`Envoyer (${recipients.length})`}
                  </span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
