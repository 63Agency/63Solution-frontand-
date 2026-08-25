"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  Filter,
  Loader2,
  Mail,
  RotateCcw,
  Search,
  Send,
  Square,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  fetchEmailRecipients,
  sendEmailBroadcast,
} from "@/lib/email/backend-email";
import type {
  EmailBroadcastResult,
  EmailRecipient,
} from "@/lib/email/types";
import { fetchLeadsFilters } from "@/lib/leads/api-leads";
import type { LeadListOption, LeadStatusOption } from "@/lib/leads/types";
import { cn } from "@/src/lib/utils";

const PAGE_SIZE = 20;

const TABLE_CLASS =
  "w-full min-w-[480px] border-collapse font-mono text-sm text-zinc-300";
const THEAD_ROW =
  "border-b border-zinc-700 text-left text-[10px] uppercase tracking-widest text-zinc-500";
const TH = "pb-2 pr-4 font-normal";
const TR = "border-b border-zinc-800 transition hover:bg-zinc-800/50";
const TD = "py-3 pr-4";

type WizardStep = 1 | 2 | 3;

const STEPS: { id: WizardStep; label: string }[] = [
  { id: 1, label: "Destinataires" },
  { id: 2, label: "Message" },
  { id: 3, label: "Confirmation" },
];

function personalize(text: string, name: string): string {
  return text.replace(/\{\{\s*name\s*\}\}/gi, name.trim() || "Client");
}

function recipientKey(r: EmailRecipient): string {
  return r.email.toLowerCase();
}

function recipientMatchesSearch(r: EmailRecipient, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (r.name.toLowerCase().includes(q)) return true;
  if (r.email.toLowerCase().includes(q)) return true;
  return false;
}

type MultiSelectFilterProps = {
  label: string;
  options: { value: string; label: string }[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  placeholder: string;
  clearLabel: string;
};

function MultiSelectFilter({
  label,
  options,
  selected,
  onChange,
  placeholder,
  clearLabel,
}: MultiSelectFilterProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  const toggle = (value: string) => {
    const next = new Set(selected);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    onChange(next);
  };

  const summary =
    selected.size === 0
      ? placeholder
      : selected.size === 1
        ? options.find((o) => o.value === [...selected][0])?.label ??
          [...selected][0]
        : `${selected.size} sélectionnés`;

  return (
    <div ref={ref} className="relative">
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
        {label}
      </span>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-left text-sm text-zinc-100 hover:border-zinc-600"
        aria-expanded={open}
      >
        <span className="truncate">{summary}</span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-zinc-500 transition",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>
      {open ? (
        <div className="app-scroll absolute left-0 right-0 z-20 mt-2 max-h-52 overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-950 p-2 shadow-xl">
          <button
            type="button"
            onClick={() => onChange(new Set())}
            className="mb-1 w-full rounded px-2 py-1.5 text-left text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
          >
            {clearLabel}
          </button>
          {options.length === 0 ? (
            <p className="px-2 py-2 text-xs text-zinc-500">Aucune option</p>
          ) : (
            options.map((option) => {
              const checked = selected.has(option.value);
              return (
                <label
                  key={option.value}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(option.value)}
                    className="size-3.5 rounded border-zinc-600 bg-zinc-900 text-emerald-500"
                  />
                  <span className="truncate">{option.label}</span>
                </label>
              );
            })
          )}
        </div>
      ) : null}
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
                  "flex flex-col items-center gap-1.5 disabled:cursor-default",
                  reachable && !active && "cursor-pointer",
                )}
              >
                <span
                  className={cn(
                    "flex size-8 items-center justify-center rounded-full text-xs font-semibold transition",
                    done && "bg-emerald-500 text-white",
                    active && "bg-emerald-500/20 text-emerald-300 ring-2 ring-emerald-500",
                    !done && !active && "bg-zinc-800 text-zinc-500",
                  )}
                >
                  {done ? <Check className="size-4" /> : step.id}
                </span>
                <span
                  className={cn(
                    "hidden text-[11px] font-medium sm:block",
                    active ? "text-zinc-200" : "text-zinc-500",
                  )}
                >
                  {step.label}
                </span>
              </button>
              {idx < STEPS.length - 1 ? (
                <div
                  className={cn(
                    "mx-2 h-px w-8 sm:mx-4 sm:w-16",
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

function TablePagination({
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

export function BulkEmailPage() {
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [maxReachedStep, setMaxReachedStep] = useState<WizardStep>(1);

  const [listOptions, setListOptions] = useState<LeadListOption[]>([]);
  const [statusOptions, setStatusOptions] = useState<LeadStatusOption[]>([]);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(
    new Set(),
  );

  const [recipients, setRecipients] = useState<EmailRecipient[]>([]);
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [search, setSearch] = useState("");

  const [subject, setSubject] = useState("Bonjour {{name}}");
  const [htmlBody, setHtmlBody] = useState(
    "<p>Bonjour {{name}},</p>\n<p>J'espère que vous allez bien.</p>\n<p>Cordialement,<br/>63 Agency</p>",
  );

  const [listPage, setListPage] = useState(1);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<EmailBroadcastResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const filters = await fetchLeadsFilters();
        if (cancelled) return;
        setListOptions(filters.lists ?? []);
        setStatusOptions(filters.statuses ?? []);
      } catch {
        if (!cancelled) {
          toast.error("Impossible de charger les filtres leads.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadRecipients = useCallback(async () => {
    setLoadingRecipients(true);
    try {
      const statuses = [...selectedStatuses];
      let list: EmailRecipient[];

      if (statuses.length === 0) {
        list = await fetchEmailRecipients({ listId: selectedListId });
      } else if (statuses.length === 1) {
        list = await fetchEmailRecipients({
          listId: selectedListId,
          status: statuses[0],
        });
      } else {
        // API: un seul `status` → fusionner les appels
        const batches = await Promise.all(
          statuses.map((status) =>
            fetchEmailRecipients({ listId: selectedListId, status }),
          ),
        );
        const seen = new Set<string>();
        list = [];
        for (const batch of batches) {
          for (const r of batch) {
            const key = recipientKey(r);
            if (seen.has(key)) continue;
            seen.add(key);
            list.push(r);
          }
        }
      }

      setRecipients(list);
      setSelectedEmails(new Set(list.map(recipientKey)));
      setListPage(1);
      setResults(null);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Impossible de charger les destinataires.",
      );
      setRecipients([]);
      setSelectedEmails(new Set());
    } finally {
      setLoadingRecipients(false);
    }
  }, [selectedListId, selectedStatuses]);

  useEffect(() => {
    void loadRecipients();
  }, [loadRecipients]);

  const selectedRecipients = useMemo(
    () => recipients.filter((r) => selectedEmails.has(recipientKey(r))),
    [recipients, selectedEmails],
  );

  const filteredRecipients = useMemo(
    () => recipients.filter((r) => recipientMatchesSearch(r, search)),
    [recipients, search],
  );

  useEffect(() => {
    setListPage(1);
  }, [search]);

  const activeFiltersCount =
    (selectedListId ? 1 : 0) +
    (selectedStatuses.size > 0 ? 1 : 0) +
    (search.trim() ? 1 : 0);

  const listTotalPages = Math.max(
    1,
    Math.ceil(filteredRecipients.length / PAGE_SIZE),
  );
  const safePage = Math.min(listPage, listTotalPages);
  const listSlice = filteredRecipients.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  const previewName =
    selectedRecipients[0]?.name?.trim() || "Client";
  const previewSubject = personalize(subject, previewName);
  const previewHtml = personalize(htmlBody, previewName);

  const canGoStep2 = selectedRecipients.length > 0;
  const canGoStep3 =
    subject.trim().length > 0 && htmlBody.trim().length > 0;

  const goToStep = (step: WizardStep) => {
    setCurrentStep(step);
    setMaxReachedStep((prev) => (step > prev ? step : prev));
  };

  const goNext = () => {
    if (currentStep === 1) {
      if (!canGoStep2) {
        toast.error("Sélectionnez au moins un destinataire.");
        return;
      }
      goToStep(2);
    } else if (currentStep === 2) {
      if (!canGoStep3) {
        toast.error("Sujet et corps de l'email sont obligatoires.");
        return;
      }
      goToStep(3);
    }
  };

  const goBack = () => {
    if (currentStep > 1) setCurrentStep((s) => (s - 1) as WizardStep);
  };

  const clearFilters = () => {
    setSelectedListId(null);
    setSelectedStatuses(new Set());
    setSearch("");
  };

  const toggleEmail = (email: string) => {
    setSelectedEmails((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  };

  const filteredKeys = useMemo(
    () => filteredRecipients.map(recipientKey),
    [filteredRecipients],
  );

  const allFilteredSelected =
    filteredKeys.length > 0 && filteredKeys.every((k) => selectedEmails.has(k));

  const toggleSelectAll = () => {
    setSelectedEmails((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        for (const key of filteredKeys) next.delete(key);
      } else {
        for (const key of filteredKeys) next.add(key);
      }
      return next;
    });
  };

  const handleSend = async () => {
    if (selectedRecipients.length === 0) {
      toast.error("Aucun destinataire.");
      return;
    }
    if (!subject.trim() || !htmlBody.trim()) {
      toast.error("Sujet et corps obligatoires.");
      return;
    }

    setSending(true);
    setConfirmOpen(false);
    try {
      const res = await sendEmailBroadcast({
        subject: subject.trim(),
        html: htmlBody.trim(),
        recipients: selectedRecipients,
      });
      setResults(res);
      if (res.failed === 0) {
        toast.success(
          `${res.sent} email${res.sent !== 1 ? "s" : ""} envoyé${res.sent !== 1 ? "s" : ""}.`,
        );
      } else if (res.sent === 0) {
        toast.error(`Échec : ${res.failed} email${res.failed !== 1 ? "s" : ""}.`);
      } else {
        toast.message(`${res.sent} envoyés · ${res.failed} échecs`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Envoi impossible.");
    } finally {
      setSending(false);
    }
  };

  const resetAll = () => {
    setResults(null);
    setCurrentStep(1);
    setMaxReachedStep(1);
    setConfirmOpen(false);
  };

  return (
    <div className="mx-auto max-w-4xl px-3 pb-28 pt-6 sm:px-6 sm:pb-10 sm:pt-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Link
            href="/dashboard/conversations"
            className="mt-0.5 flex size-9 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
            aria-label="Retour aux conversations"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-zinc-500">
              Email
            </p>
            <h1 className="mt-1 flex items-center gap-2 text-xl font-semibold text-white sm:text-2xl">
              <Mail className="size-5 text-emerald-400" aria-hidden />
              Envoi Email
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              Envoyez un email templated à plusieurs leads (variable{" "}
              <code className="rounded bg-zinc-800 px-1 text-emerald-300">
                {"{{name}}"}
              </code>
              ).
            </p>
          </div>
        </div>
        {results ? (
          <button
            type="button"
            onClick={resetAll}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
          >
            <RotateCcw className="size-4" />
            Nouvel envoi
          </button>
        ) : null}
      </div>

      {!results ? (
        <StepIndicator
          current={currentStep}
          maxReached={maxReachedStep}
          onGoTo={goToStep}
        />
      ) : null}

      {/* Results */}
      {results ? (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/50 px-4 py-4">
            <CheckCircle2 className="size-5 text-emerald-400" aria-hidden />
            <p className="text-sm text-zinc-200">
              <span className="font-semibold text-emerald-300">
                {results.sent} envoyé{results.sent !== 1 ? "s" : ""}
              </span>
              <span className="text-zinc-500"> · </span>
              <span
                className={cn(
                  "font-semibold",
                  results.failed > 0 ? "text-red-400" : "text-zinc-400",
                )}
              >
                {results.failed} échec{results.failed !== 1 ? "s" : ""}
              </span>
              <span className="text-zinc-500">
                {" "}
                sur {results.total}
              </span>
            </p>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
            <table className={TABLE_CLASS}>
              <thead>
                <tr className={THEAD_ROW}>
                  <th className={TH}>Email</th>
                  <th className={TH}>Statut</th>
                  <th className={TH}>Détail</th>
                </tr>
              </thead>
              <tbody>
                {results.results.map((row) => (
                  <tr key={row.email} className={TR}>
                    <td className={TD}>
                      <div>
                        <p className="text-zinc-200">{row.email}</p>
                        {row.name ? (
                          <p className="text-xs text-zinc-500">{row.name}</p>
                        ) : null}
                      </div>
                    </td>
                    <td className={TD}>
                      {row.success ? (
                        <span className="inline-flex items-center gap-1.5 text-emerald-400">
                          <CheckCircle2 className="size-3.5" />
                          Envoyé
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-red-400">
                          <XCircle className="size-3.5" />
                          Échec
                        </span>
                      )}
                    </td>
                    <td className={cn(TD, "max-w-xs text-xs text-zinc-500")}>
                      {row.error || (row.success ? "—" : "Erreur inconnue")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {/* Step 1 — Destinataires */}
      {!results && currentStep === 1 ? (
        <div className="space-y-4">
          <div className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Filter className="size-4 text-zinc-500" aria-hidden />
                <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  Filtres
                </span>
                {activeFiltersCount > 0 ? (
                  <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300 ring-1 ring-emerald-500/30">
                    {activeFiltersCount}
                  </span>
                ) : null}
              </div>
              {activeFiltersCount > 0 ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-xs text-zinc-500 hover:text-zinc-300"
                >
                  Réinitialiser
                </button>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  Source
                </span>
                <select
                  value={selectedListId ?? ""}
                  onChange={(e) => setSelectedListId(e.target.value || null)}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-emerald-600/80 focus:ring-2 focus:ring-emerald-600/20"
                  aria-label="Filtrer par source / liste ClickUp"
                >
                  <option value="">Toutes les listes</option>
                  {listOptions.map((list) => (
                    <option key={list.listId} value={list.listId}>
                      {list.label}
                      {list.total != null ? ` (${list.total})` : ""}
                    </option>
                  ))}
                </select>
              </label>

              <MultiSelectFilter
                label="Statut"
                options={statusOptions.map((s) => ({
                  value: s.value,
                  label:
                    s.total != null ? `${s.value} (${s.total})` : s.value,
                }))}
                selected={selectedStatuses}
                onChange={setSelectedStatuses}
                placeholder="Tous les statuts"
                clearLabel="Tous les statuts"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 pb-6">
            <div className="mb-4">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500"
                  aria-hidden
                />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher un client (nom ou email)…"
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 py-2.5 pl-10 pr-4 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-600/80 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                  aria-label="Rechercher un client"
                />
              </div>
            </div>

            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-zinc-400">
                {loadingRecipients ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin" />
                    Chargement…
                  </span>
                ) : (
                  <>
                    <span className="font-semibold text-white">
                      {filteredRecipients.length}
                    </span>
                    {search.trim() && filteredRecipients.length !== recipients.length
                      ? ` / ${recipients.length}`
                      : ""}{" "}
                    destinataire
                    {filteredRecipients.length !== 1 ? "s" : ""} avec email
                    {selectedEmails.size > 0 ? (
                      <>
                        {" · "}
                        <span className="font-semibold text-emerald-300">
                          {selectedEmails.size}
                        </span>{" "}
                        sélectionné
                        {selectedEmails.size !== 1 ? "s" : ""}
                      </>
                    ) : null}
                  </>
                )}
              </p>
              <button
                type="button"
                onClick={toggleSelectAll}
                disabled={loadingRecipients || filteredRecipients.length === 0}
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
              >
                {allFilteredSelected ? (
                  <CheckSquare className="size-3.5 text-emerald-400" />
                ) : (
                  <Square className="size-3.5" />
                )}
                {allFilteredSelected
                  ? "Tout désélectionner"
                  : "Tout sélectionner"}
              </button>
            </div>

            {loadingRecipients ? (
              <div className="flex justify-center py-12">
                <Loader2 className="size-6 animate-spin text-emerald-400" />
              </div>
            ) : recipients.length === 0 ? (
              <p className="py-10 text-center text-sm text-zinc-500">
                Aucun destinataire avec email pour ces filtres.
              </p>
            ) : filteredRecipients.length === 0 ? (
              <p className="py-10 text-center text-sm text-zinc-500">
                Aucun client ne correspond à « {search.trim()} ».
              </p>
            ) : (
              <>
                <div className="app-scroll max-h-[min(55vh,480px)] overflow-y-auto overscroll-contain rounded-xl border border-zinc-800/80">
                  <table className={TABLE_CLASS}>
                    <thead className="sticky top-0 z-[1] bg-zinc-900">
                      <tr className={THEAD_ROW}>
                        <th className={cn(TH, "w-10 pl-3 pt-2")}> </th>
                        <th className={cn(TH, "pt-2")}>Nom</th>
                        <th className={cn(TH, "pt-2")}>Email</th>
                      </tr>
                    </thead>
                    <tbody>
                      {listSlice.map((r) => {
                        const key = recipientKey(r);
                        const checked = selectedEmails.has(key);
                        return (
                          <tr
                            key={key}
                            className={cn(TR, "cursor-pointer")}
                            onClick={() => toggleEmail(key)}
                          >
                            <td className={cn(TD, "pl-3")}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleEmail(key)}
                                onClick={(e) => e.stopPropagation()}
                                className="size-3.5 rounded border-zinc-600 bg-zinc-900 text-emerald-500"
                                aria-label={`Sélectionner ${r.email}`}
                              />
                            </td>
                            <td className={TD}>
                              <span className="text-zinc-200">
                                {r.name || "—"}
                              </span>
                            </td>
                            <td className={TD}>{r.email}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <TablePagination
                  page={safePage}
                  totalPages={listTotalPages}
                  totalItems={filteredRecipients.length}
                  itemLabel="destinataires"
                  onPageChange={setListPage}
                />
              </>
            )}
          </div>
        </div>
      ) : null}

      {/* Step 2 — Composer */}
      {!results && currentStep === 2 ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
            <label className="block space-y-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Objet
              </span>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Ex. Bonjour {{name}}"
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-emerald-600/80 focus:ring-2 focus:ring-emerald-600/20"
              />
            </label>
            <p className="mt-2 text-xs text-zinc-500">
              Utilisez{" "}
              <code className="rounded bg-zinc-800 px-1 text-emerald-300">
                {"{{name}}"}
              </code>{" "}
              — remplacé par le nom de chaque destinataire.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
              <label className="block space-y-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  Corps HTML
                </span>
                <textarea
                  value={htmlBody}
                  onChange={(e) => setHtmlBody(e.target.value)}
                  rows={14}
                  spellCheck={false}
                  className="app-scroll w-full resize-y rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 font-mono text-[13px] leading-relaxed text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-emerald-600/80 focus:ring-2 focus:ring-emerald-600/20"
                  placeholder="<p>Bonjour {{name}},</p>"
                />
              </label>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Aperçu ({previewName})
              </p>
              <div className="rounded-xl border border-zinc-700 bg-white p-4 text-zinc-900 shadow-inner">
                <p className="mb-3 border-b border-zinc-200 pb-2 text-sm font-semibold">
                  {previewSubject || "(sans objet)"}
                </p>
                <div
                  className="prose prose-sm max-w-none text-sm"
                  dangerouslySetInnerHTML={{
                    __html: previewHtml || "<p class='text-zinc-400'>(vide)</p>",
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Step 3 — Confirmation */}
      {!results && currentStep === 3 ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
            <h2 className="text-sm font-semibold text-white">Récapitulatif</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500">Destinataires</dt>
                <dd className="font-medium text-zinc-200">
                  {selectedRecipients.length}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500">Objet</dt>
                <dd className="max-w-[60%] truncate text-right text-zinc-200">
                  {subject}
                </dd>
              </div>
            </dl>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
            <table className={TABLE_CLASS}>
              <thead>
                <tr className={THEAD_ROW}>
                  <th className={TH}>Nom</th>
                  <th className={TH}>Email</th>
                  <th className={TH}>Objet personnalisé</th>
                </tr>
              </thead>
              <tbody>
                {selectedRecipients.slice(0, 50).map((r) => (
                  <tr key={recipientKey(r)} className={TR}>
                    <td className={TD}>{r.name}</td>
                    <td className={TD}>{r.email}</td>
                    <td className={TD}>
                      <span className="line-clamp-1 text-zinc-400">
                        {personalize(subject, r.name)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {selectedRecipients.length > 50 ? (
              <p className="mt-3 text-xs text-zinc-500">
                … et {selectedRecipients.length - 50} autres
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Footer */}
      {!results ? (
        <div className="mt-8 flex items-center justify-between gap-3 border-t border-zinc-800 pt-4">
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
            </button>
          ) : (
            <button
              type="button"
              disabled={sending || selectedRecipients.length === 0}
              onClick={() => setConfirmOpen(true)}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition sm:px-8 sm:py-3",
                !sending && selectedRecipients.length > 0
                  ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-400"
                  : "cursor-not-allowed bg-zinc-800 text-zinc-500",
              )}
            >
              {sending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              {sending
                ? "Envoi…"
                : `Envoyer à ${selectedRecipients.length} destinataire${selectedRecipients.length !== 1 ? "s" : ""}`}
            </button>
          )}
        </div>
      ) : null}

      {/* Confirm dialog */}
      {confirmOpen ? (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-black/60 p-4 sm:items-center"
          role="dialog"
          aria-modal
          aria-label="Confirmer l'envoi"
          onClick={() => !sending && setConfirmOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-white">
              Confirmer l&apos;envoi ?
            </h2>
            <p className="mt-2 text-sm text-zinc-400">
              Vous allez envoyer{" "}
              <span className="font-medium text-zinc-200">
                {selectedRecipients.length}
              </span>{" "}
              email
              {selectedRecipients.length !== 1 ? "s" : ""} avec l&apos;objet «{" "}
              <span className="text-zinc-200">{subject}</span> ».
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={sending}
                onClick={() => setConfirmOpen(false)}
                className="rounded-xl px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-white disabled:opacity-40"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={sending}
                onClick={() => void handleSend()}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-400 disabled:opacity-50"
              >
                {sending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
                Confirmer
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
