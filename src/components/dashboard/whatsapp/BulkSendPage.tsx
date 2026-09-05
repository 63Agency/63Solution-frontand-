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
  Save,
  Send,
  Trash2,
  Users,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { sendEmailBroadcast, fetchEmailTemplateMapping, saveEmailTemplateMapping } from "@/lib/email/backend-email";
import type { EmailBroadcastResultItem } from "@/lib/email/types";
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
type Recipient = { phone: string; name: string; email?: string };

type ChannelStatus = "sent" | "failed" | "na";

type CombinedResultRow = {
  key: string;
  name: string;
  phone: string;
  email: string;
  whatsapp: ChannelStatus;
  emailStatus: ChannelStatus;
  whatsappDetail?: string;
  emailDetail?: string;
};

const STEPS: { id: WizardStep; label: string }[] = [
  { id: 1, label: "Destinataires" },
  { id: 2, label: "Template" },
  { id: 3, label: "Confirmation" },
];

function personalizeEmail(text: string, name: string): string {
  return text.replace(/\{\{\s*name\s*\}\}/gi, name.trim() || FALLBACK_TEMPLATE_NAME);
}

function isValidEmail(value: string | undefined): boolean {
  if (!value) return false;
  const email = value.trim().toLowerCase();
  return email.includes("@") && email.includes(".");
}

function recipientsFromDraft(
  phonesRaw: string,
  names: Record<string, string>,
  emails: Record<string, string>,
  emailOnly: Array<{ email: string; name: string }>,
): Recipient[] {
  const phoneRecipients = parsePhoneNumbersInput(phonesRaw).map((phone) => ({
    phone,
    name: names[phone]?.trim() ?? "",
    ...(emails[phone] ? { email: emails[phone] } : {}),
  }));
  const emailOnlyRecipients = emailOnly.map((c) => ({
    phone: "",
    name: c.name,
    email: c.email,
  }));
  return [...phoneRecipients, ...emailOnlyRecipients];
}

function draftFromRecipients(recipients: Recipient[]) {
  const withPhone = recipients.filter((r) => r.phone.length >= 9);
  const emailOnly = recipients.filter(
    (r) => r.phone.length < 9 && isValidEmail(r.email),
  );
  return {
    phonesRaw: withPhone.map((r) => r.phone).join("\n"),
    contactNamesByPhone: Object.fromEntries(
      withPhone
        .filter((r) => r.name.trim())
        .map((r) => [r.phone, r.name.trim()]),
    ),
    contactEmailsByPhone: Object.fromEntries(
      withPhone
        .filter((r) => isValidEmail(r.email))
        .map((r) => [r.phone, r.email!.trim().toLowerCase()]),
    ),
    emailOnlyContacts: emailOnly.map((r) => ({
      email: r.email!.trim().toLowerCase(),
      name: r.name.trim() || r.email!.split("@")[0] || "Client",
    })),
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

function ChannelStatusCell({ status }: { status: ChannelStatus }) {
  if (status === "sent") {
    return <span className="text-emerald-400">Envoyé</span>;
  }
  if (status === "failed") {
    return <span className="text-red-400">Échec</span>;
  }
  return <span className="text-zinc-600">—</span>;
}

function CombinedResultMobileCard({ row }: { row: CombinedResultRow }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
      <p className="text-sm font-medium text-zinc-100">
        {row.name || row.email || formatWhatsAppPhone(row.phone) || "—"}
      </p>
      {row.phone ? (
        <p className="mt-0.5 font-mono text-xs text-zinc-500">
          {formatWhatsAppPhone(row.phone)}
        </p>
      ) : null}
      {row.email ? (
        <p className="mt-0.5 text-xs text-zinc-500">{row.email}</p>
      ) : null}
      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
        <div>
          <p className="text-zinc-500">WhatsApp</p>
          <ChannelStatusCell status={row.whatsapp} />
        </div>
        <div>
          <p className="text-zinc-500">Email</p>
          <ChannelStatusCell status={row.emailStatus} />
        </div>
      </div>
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
  const [emailResults, setEmailResults] = useState<
    EmailBroadcastResultItem[] | null
  >(null);
  const [alsoSendEmail, setAlsoSendEmail] = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailHtml, setEmailHtml] = useState("");
  const [emailMappingFound, setEmailMappingFound] = useState(false);
  const [emailMappingLoading, setEmailMappingLoading] = useState(false);
  const [emailMappingSaving, setEmailMappingSaving] = useState(false);
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
    const emails = { ...(draft?.contactEmailsByPhone ?? {}) };
    const emailOnly = [...(draft?.emailOnlyContacts ?? [])];
    const draftSendMode = draft?.sendMode ?? "template";
    const draftTemplateId = draft?.selectedTemplateId;

    setRecipients(recipientsFromDraft(phones, names, emails, emailOnly));
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
    const {
      phonesRaw,
      contactNamesByPhone,
      contactEmailsByPhone,
      emailOnlyContacts,
    } = draftFromRecipients(recipients);
    saveBulkSendDraft({
      phonesRaw,
      message,
      leadsImportCount,
      sendMode,
      selectedTemplateId: selectedTemplate?.id,
      contactNamesByPhone,
      contactEmailsByPhone,
      emailOnlyContacts,
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
    if (!results && !emailResults) return null;
    const waSent = results?.filter((r) => r.success).length ?? 0;
    const waFailed = results?.filter((r) => !r.success).length ?? 0;
    const emSent = emailResults?.filter((r) => r.success).length ?? 0;
    const emFailed = emailResults?.filter((r) => !r.success).length ?? 0;
    return {
      waSent,
      waFailed,
      emSent,
      emFailed,
      sent: waSent + emSent,
      failed: waFailed + emFailed,
      total: recipients.length,
    };
  }, [results, emailResults, recipients.length]);

  const combinedResults = useMemo((): CombinedResultRow[] | null => {
    if (!results && !emailResults) return null;

    const waByPhone = new Map(
      (results ?? []).map((r) => [
        normalizeWhatsAppPhoneDigits(r.phoneNumber),
        r,
      ]),
    );
    const emByEmail = new Map(
      (emailResults ?? []).map((r) => [r.email.toLowerCase(), r]),
    );

    return recipients.map((r, index) => {
      const phone = r.phone.length >= 9 ? r.phone : "";
      const email = isValidEmail(r.email) ? r.email!.trim().toLowerCase() : "";
      const wa = phone ? waByPhone.get(phone) : undefined;
      const em = email ? emByEmail.get(email) : undefined;

      let whatsapp: ChannelStatus = "na";
      if (phone) {
        if (wa) whatsapp = wa.success ? "sent" : "failed";
        else if (results) whatsapp = "failed";
      }

      let emailStatus: ChannelStatus = "na";
      if (email && alsoSendEmail) {
        if (em) emailStatus = em.success ? "sent" : "failed";
        else if (emailResults) emailStatus = "failed";
      }

      return {
        key: phone || email || `row-${index}`,
        name: r.name,
        phone,
        email,
        whatsapp,
        emailStatus,
        whatsappDetail: wa
          ? wa.success
            ? "Message transmis"
            : wa.error
          : phone
            ? undefined
            : "Pas de téléphone",
        emailDetail: em
          ? em.success
            ? "Email transmis"
            : em.error
          : email
            ? alsoSendEmail
              ? undefined
              : "Email non demandé"
            : "Pas d'email",
      };
    });
  }, [results, emailResults, recipients, alsoSendEmail]);

  const emailRecipientsCount = useMemo(
    () => recipients.filter((r) => isValidEmail(r.email)).length,
    [recipients],
  );

  const emailPreviewName =
    recipients.find((r) => r.name.trim())?.name.trim() || FALLBACK_TEMPLATE_NAME;
  const emailPreviewSubject = personalizeEmail(emailSubject, emailPreviewName);
  const emailPreviewHtml = personalizeEmail(emailHtml, emailPreviewName);

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
      ? Boolean(selectedTemplate) &&
        (!alsoSendEmail ||
          (emailSubject.trim().length > 0 && emailHtml.trim().length > 0))
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
      if (sendMode === "template" && !selectedTemplate) {
        toast.error("Sélectionnez un template.");
        return;
      }
      if (sendMode === "text" && !message.trim()) {
        toast.error("Rédigez votre message.");
        return;
      }
      if (alsoSendEmail && sendMode === "template") {
        if (!emailSubject.trim() || !emailHtml.trim()) {
          toast.error("Objet et corps email obligatoires.");
          return;
        }
      }
      setStep3Page(1);
      goToStep(3);
    }
  };

  const goBack = () => {
    if (currentStep > 1) setCurrentStep((s) => (s - 1) as WizardStep);
  };

  const loadEmailMappingForTemplate = async (template: any) => {
    const waName = String(template?.name ?? "").trim();
    if (!waName) {
      setEmailSubject("");
      setEmailHtml("");
      setEmailMappingFound(false);
      return;
    }
    setEmailMappingLoading(true);
    try {
      const mapping = await fetchEmailTemplateMapping(waName);
      console.log(
        "[email mapping] applied to state",
        { subject: mapping.subject, htmlLen: mapping.html.length, found: mapping.found },
      );
      setEmailSubject(mapping.subject);
      setEmailHtml(mapping.html);
      setEmailMappingFound(mapping.found);
    } catch (e) {
      setEmailSubject("");
      setEmailHtml("");
      setEmailMappingFound(false);
      toast.error(
        e instanceof Error
          ? e.message
          : "Impossible de charger la version email.",
      );
    } finally {
      setEmailMappingLoading(false);
    }
  };

  const handleSaveEmailMapping = async () => {
    const waName = String(selectedTemplate?.name ?? "").trim();
    if (!waName) {
      toast.error("Sélectionnez un template WhatsApp.");
      return;
    }
    if (!emailSubject.trim() || !emailHtml.trim()) {
      toast.error("Objet et corps email obligatoires pour enregistrer.");
      return;
    }
    setEmailMappingSaving(true);
    try {
      await saveEmailTemplateMapping(waName, {
        subject: emailSubject,
        html: emailHtml,
      });
      setEmailMappingFound(true);
      toast.success("Version email enregistrée comme défaut.");
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Enregistrement impossible.",
      );
    } finally {
      setEmailMappingSaving(false);
    }
  };

  const handleImportFromLeads = () => {
    const {
      phonesRaw,
      contactNamesByPhone,
      contactEmailsByPhone,
      emailOnlyContacts,
    } = draftFromRecipients(recipients);
    saveBulkSendDraft({
      phonesRaw,
      message,
      leadsImportCount,
      sendMode,
      selectedTemplateId: selectedTemplate?.id,
      contactNamesByPhone,
      contactEmailsByPhone,
      emailOnlyContacts,
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

  const removeRecipient = (key: string) => {
    setRecipients((prev) =>
      prev.filter((r) => {
        const rKey = r.phone.length >= 9 ? r.phone : r.email ?? "";
        return rKey !== key;
      }),
    );
  };

  const recipientKey = (r: Recipient, index = 0) =>
    r.phone.length >= 9
      ? r.phone
      : isValidEmail(r.email)
        ? `email:${r.email!.toLowerCase()}`
        : `row:${index}`;

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
    if (alsoSendEmail) {
      void loadEmailMappingForTemplate(template);
    }
  };

  const handleSend = async () => {
    const phoneRecipients = recipients.filter((r) => r.phone.length >= 9);
    const emailRecipients = recipients.filter((r) => isValidEmail(r.email));

    if (phoneRecipients.length === 0 && !(alsoSendEmail && emailRecipients.length > 0)) {
      toast.error("Aucun destinataire joignable.");
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
    if (alsoSendEmail) {
      if (!emailSubject.trim() || !emailHtml.trim()) {
        toast.error("Objet et corps email obligatoires.");
        return;
      }
      if (emailRecipients.length === 0) {
        toast.message("Aucun email trouvé — WhatsApp uniquement.");
      }
    }

    const phones = phoneRecipients.map((r) => r.phone);
    setSending(true);
    setResults(null);
    setEmailResults(null);
    setSendProgress({ current: 0, total: Math.max(phones.length, 1) });

    const namesMap = Object.fromEntries(
      phoneRecipients.map((r) => [r.phone, r.name]),
    );

    let waPayload: BulkWhatsAppSendPayload | null = null;
    if (phones.length > 0) {
      if (sendMode === "template" && selectedTemplate) {
        if (hasVariable1) {
          waPayload = {
            phoneNumbers: phones,
            templateName: selectedTemplate.name,
            templateLanguage: "fr",
            recipients: phones.map((phone) => ({
              phoneNumber: phone,
              variable1: namesMap[phone]?.trim() || FALLBACK_TEMPLATE_NAME,
            })),
          };
        } else {
          waPayload = {
            phoneNumbers: phones,
            templateName: selectedTemplate.name,
            templateLanguage: "fr",
            components: [],
          };
        }
      } else {
        waPayload = { phoneNumbers: phones, text: message.trim() };
      }
    }

    try {
      let waSent = 0;
      let waFailed = 0;
      let emSent = 0;
      let emFailed = 0;

      if (waPayload) {
        const res = await sendBulkWhatsAppMessages(waPayload, {
          onProgress: (completed, total) => {
            setSendProgress({ current: completed, total });
          },
        });
        setResults(res.results);
        waSent = res.sent;
        waFailed = res.failed;
      } else {
        setResults([]);
      }

      if (alsoSendEmail && emailRecipients.length > 0) {
        const emailRes = await sendEmailBroadcast({
          subject: emailSubject.trim(),
          html: emailHtml.trim(),
          recipients: emailRecipients.map((r) => ({
            email: r.email!.trim().toLowerCase(),
            name: r.name.trim() || FALLBACK_TEMPLATE_NAME,
          })),
          ...(selectedTemplate
            ? {
                templateId: String(selectedTemplate.id ?? ""),
                templateName: String(selectedTemplate.name ?? ""),
              }
            : {}),
        });
        setEmailResults(emailRes.results);
        emSent = emailRes.sent;
        emFailed = emailRes.failed;
      }

      if (waSent + emSent > 0) {
        const parts: string[] = [];
        if (waSent > 0) parts.push(`${waSent} WhatsApp`);
        if (emSent > 0) parts.push(`${emSent} email`);
        toast.success(`Envoyé : ${parts.join(" · ")}`);
      }
      if (waFailed + emFailed > 0) {
        toast.error(
          `${waFailed + emFailed} échec${waFailed + emFailed > 1 ? "s" : ""}.`,
        );
      }
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
    setEmailResults(null);
    setAlsoSendEmail(false);
    setEmailSubject("");
    setEmailHtml("");
    setEmailMappingFound(false);
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
      contactEmailsByPhone: {},
      emailOnlyContacts: [],
    });
  };

  if (!draftReady) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center bg-zinc-950">
        <Loader2 className="size-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  if ((results && results.length > 0) || (emailResults && emailResults.length > 0)) {
    const rows = combinedResults ?? [];
    return (
      <div className="app-scroll min-h-0 flex-1 overflow-y-auto bg-zinc-950">
        <div className="mx-auto max-w-4xl px-3 py-4 sm:px-6 sm:py-6">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-lg font-semibold text-white sm:text-xl">
                Résultats de l&apos;envoi
              </h1>
              <p className="mt-1 text-sm text-zinc-500">
                WhatsApp : {resultSummary?.waSent ?? 0} envoyé
                {(resultSummary?.waSent ?? 0) !== 1 ? "s" : ""}
                {(resultSummary?.waFailed ?? 0) > 0
                  ? ` · ${resultSummary?.waFailed} échec${(resultSummary?.waFailed ?? 0) !== 1 ? "s" : ""}`
                  : ""}
                {alsoSendEmail ? (
                  <>
                    {" · "}
                    Email : {resultSummary?.emSent ?? 0} envoyé
                    {(resultSummary?.emSent ?? 0) !== 1 ? "s" : ""}
                    {(resultSummary?.emFailed ?? 0) > 0
                      ? ` · ${resultSummary?.emFailed} échec${(resultSummary?.emFailed ?? 0) !== 1 ? "s" : ""}`
                      : ""}
                  </>
                ) : null}
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

          <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
            {[
              {
                label: "WA envoyés",
                value: resultSummary?.waSent,
                color: "text-emerald-400",
              },
              {
                label: "WA échecs",
                value: resultSummary?.waFailed,
                color: "text-red-400",
              },
              {
                label: "Email envoyés",
                value: alsoSendEmail ? resultSummary?.emSent : 0,
                color: "text-emerald-400",
              },
              {
                label: "Email échecs",
                value: alsoSendEmail ? resultSummary?.emFailed : 0,
                color: "text-red-400",
              },
            ].map((card) => (
              <div
                key={card.label}
                className="rounded-xl bg-zinc-900 p-3 ring-1 ring-zinc-800 sm:rounded-2xl sm:p-4"
              >
                <p className="text-[10px] uppercase tracking-wider text-zinc-500 sm:text-xs">
                  {card.label}
                </p>
                <p
                  className={cn(
                    "mt-1 text-xl font-bold tabular-nums sm:text-2xl",
                    card.color,
                  )}
                >
                  {card.value ?? 0}
                </p>
              </div>
            ))}
          </div>

          <section>
            <div className="mb-4">
              <h3 className="text-base font-medium text-white">
                Résultats détaillés
              </h3>
              <p className="text-xs uppercase tracking-widest text-zinc-500">
                WhatsApp · Email
              </p>
            </div>
            <div className="md:hidden">
              <div className="space-y-2">
                {rows.map((row) => (
                  <CombinedResultMobileCard key={row.key} row={row} />
                ))}
              </div>
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className={BULK_TABLE_CLASS}>
                <thead>
                  <tr className={BULK_THEAD_ROW}>
                    <th className={BULK_TH}>Contact</th>
                    <th className={BULK_TH}>WhatsApp</th>
                    <th className={BULK_TH}>Email</th>
                    <th className={BULK_TH}>Détail</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.key} className={BULK_TR}>
                      <td className={BULK_TD}>
                        <p className="text-zinc-200">
                          {row.name || "—"}
                        </p>
                        {row.phone ? (
                          <p className="text-xs text-zinc-500">
                            {formatWhatsAppPhone(row.phone)}
                          </p>
                        ) : null}
                        {row.email ? (
                          <p className="text-xs text-zinc-500">{row.email}</p>
                        ) : null}
                      </td>
                      <td className={BULK_TD}>
                        <ChannelStatusCell status={row.whatsapp} />
                      </td>
                      <td className={BULK_TD}>
                        <ChannelStatusCell status={row.emailStatus} />
                      </td>
                      <td className={cn(BULK_TD, "max-w-xs text-xs text-zinc-500")}>
                        {[
                          row.whatsapp === "failed" ? row.whatsappDetail : null,
                          row.emailStatus === "failed" ? row.emailDetail : null,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "—"}
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
                          key={recipientKey(r)}
                          index={globalIdx}
                          recipient={r}
                          onRemove={() => removeRecipient(recipientKey(r))}
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
                          <th className={BULK_TH}>Email</th>
                          <th className={BULK_TH_RIGHT}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {step1PageRecipients.map((r, idx) => {
                          const globalIdx =
                            (step1Page - 1) * PAGE_SIZE + idx + 1;
                          return (
                            <tr key={recipientKey(r)} className={BULK_TR}>
                              <td className={BULK_TD}>{globalIdx}</td>
                              <td className={BULK_TD}>
                                <div className="flex items-center gap-3">
                                  <RecipientAvatar
                                    name={r.name}
                                    phone={r.phone || r.email || ""}
                                  />
                                  <span>{r.name || "—"}</span>
                                </div>
                              </td>
                              <td className={BULK_TD}>
                                {r.phone
                                  ? formatWhatsAppPhone(r.phone)
                                  : "—"}
                              </td>
                              <td className={BULK_TD}>
                                {r.email || "—"}
                              </td>
                              <td className={BULK_TD_RIGHT}>
                                <button
                                  type="button"
                                  onClick={() =>
                                    removeRecipient(recipientKey(r))
                                  }
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
                  setAlsoSendEmail(false);
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

            {sendMode === "template" && selectedTemplate ? (
              <div className="space-y-3 rounded-2xl bg-zinc-900 p-4 ring-1 ring-zinc-800">
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={alsoSendEmail}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setAlsoSendEmail(checked);
                      if (checked && selectedTemplate) {
                        void loadEmailMappingForTemplate(selectedTemplate);
                      }
                    }}
                    className="mt-1 size-4 rounded border-zinc-600 bg-zinc-950 text-emerald-500"
                  />
                  <span>
                    <span className="block text-sm font-medium text-zinc-100">
                      Envoyer aussi par email
                    </span>
                    <span className="mt-0.5 block text-xs text-zinc-500">
                      L&apos;email sera envoyé uniquement aux leads ayant une
                      adresse email. ({emailRecipientsCount} contact
                      {emailRecipientsCount !== 1 ? "s" : ""} avec email)
                    </span>
                  </span>
                </label>

                {alsoSendEmail ? (
                  <div className="space-y-4 border-t border-zinc-800 pt-4">
                    {emailMappingLoading ? (
                      <div className="flex items-center gap-2 py-6 text-sm text-zinc-500">
                        <Loader2 className="size-4 animate-spin text-emerald-500" />
                        Chargement de la version email…
                      </div>
                    ) : (
                      <>
                        {!emailMappingFound ? (
                          <p className="rounded-xl bg-amber-500/5 px-3 py-2 text-xs text-amber-300/90 ring-1 ring-amber-500/20">
                            Aucune version email enregistrée pour ce template —
                            vous pouvez la saisir ici.
                          </p>
                        ) : null}

                        <label className="block space-y-1.5">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                            Objet
                          </span>
                          <input
                            type="text"
                            value={emailSubject}
                            onChange={(e) => setEmailSubject(e.target.value)}
                            placeholder="Ex. Message de 63 Agency — {{name}}"
                            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-emerald-600/80 focus:ring-2 focus:ring-emerald-600/20"
                          />
                        </label>
                        <div className="grid gap-4 lg:grid-cols-2">
                          <label className="block space-y-1.5">
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                              Corps du message (HTML)
                            </span>
                            <textarea
                              value={emailHtml}
                              onChange={(e) => setEmailHtml(e.target.value)}
                              rows={10}
                              spellCheck={false}
                              className="app-scroll w-full resize-y rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 font-mono text-[13px] leading-relaxed text-zinc-100 outline-none focus:border-emerald-600/80 focus:ring-2 focus:ring-emerald-600/20"
                            />
                            <p className="text-xs text-zinc-500">
                              Variable{" "}
                              <code className="rounded bg-zinc-800 px-1 text-emerald-300">
                                {"{{name}}"}
                              </code>{" "}
                              = nom du contact
                            </p>
                          </label>
                          <div>
                            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                              Aperçu ({emailPreviewName})
                            </p>
                            <div className="rounded-xl border border-zinc-700 bg-white p-4 text-zinc-900 shadow-inner">
                              <p className="mb-3 border-b border-zinc-200 pb-2 text-sm font-semibold">
                                {emailPreviewSubject || "(sans objet)"}
                              </p>
                              <div
                                className="prose prose-sm max-w-none text-sm"
                                dangerouslySetInnerHTML={{
                                  __html:
                                    emailPreviewHtml ||
                                    "<p class='text-zinc-400'>(vide)</p>",
                                }}
                              />
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={
                            emailMappingSaving ||
                            !emailSubject.trim() ||
                            !emailHtml.trim()
                          }
                          onClick={() => void handleSaveEmailMapping()}
                          className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs font-medium text-zinc-200 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {emailMappingSaving ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Save className="size-3.5" />
                          )}
                          Enregistrer comme version par défaut
                        </button>
                      </>
                    )}
                  </div>
                ) : null}
              </div>
            ) : null}
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

            {alsoSendEmail && sendMode === "template" ? (
              <div className="rounded-2xl bg-zinc-900 p-5 ring-1 ring-zinc-800">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Email ({emailRecipientsCount} destinataire
                  {emailRecipientsCount !== 1 ? "s" : ""})
                </p>
                <div className="rounded-xl border border-zinc-700 bg-white p-4 text-zinc-900">
                  <p className="mb-2 text-sm font-semibold">
                    {emailPreviewSubject}
                  </p>
                  <div
                    className="prose prose-sm max-w-none text-sm"
                    dangerouslySetInnerHTML={{ __html: emailPreviewHtml }}
                  />
                </div>
              </div>
            ) : null}

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
                    {alsoSendEmail
                      ? `Envoyer WhatsApp + email (${recipients.length})`
                      : `Envoyer à ${recipients.length} contact${recipients.length !== 1 ? "s" : ""}`}
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
