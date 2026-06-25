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
} from "@/lib/whatsapp/bulk-send-storage";
import { sendBulkWhatsAppMessages } from "@/lib/whatsapp/backend-whatsapp";
import type { BulkWhatsAppSendResultItem } from "@/lib/whatsapp/types";
import { cn } from "@/src/lib/utils";
import {
  formatWhatsAppPhone,
  normalizeWhatsAppPhoneDigits,
  parsePhoneNumbersInput,
} from "./whatsapp-utils";

function mergePhonesIntoTextarea(existing: string, newPhones: string[]): string {
  const current = parsePhoneNumbersInput(existing);
  const seen = new Set(current);
  const added: string[] = [];

  for (const phone of newPhones) {
    const digits = normalizeWhatsAppPhoneDigits(phone);
    if (digits.length < 9 || seen.has(digits)) continue;
    seen.add(digits);
    added.push(digits);
  }

  if (added.length === 0) return existing;
  const merged = [...current, ...added];
  return merged.join("\n");
}

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
  const [sending, setSending] = useState(false);
  const [sendProgress, setSendProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState<BulkWhatsAppSendResultItem[] | null>(null);
  const [leadsImportCount, setLeadsImportCount] = useState(0);
  const [draftReady, setDraftReady] = useState(false);

  useEffect(() => {
    const draft = loadBulkSendDraft();
    let phones = draft?.phonesRaw ?? "";
    let messageText = draft?.message ?? "";
    let importCount = draft?.leadsImportCount ?? 0;

    const imported = consumeBulkSendImport();
    if (imported && imported.length > 0) {
      const before = parsePhoneNumbersInput(phones).length;
      phones = mergePhonesIntoTextarea(phones, imported);
      const added = parsePhoneNumbersInput(phones).length - before;
      if (added > 0) {
        importCount += added;
        toast.success(
          `${added} numéro${added > 1 ? "s" : ""} importé${added > 1 ? "s" : ""} depuis les Leads.`,
        );
      } else {
        toast.info("Ces numéros sont déjà dans la liste.");
      }
    }

    setPhonesRaw(phones);
    setMessage(messageText);
    setLeadsImportCount(importCount);
    setDraftReady(true);
  }, []);

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
    });
  };

  const handleSend = async () => {
    if (parsedPhones.length === 0) {
      toast.error("Ajoutez au moins un numéro valide (un par ligne).");
      return;
    }
    if (!message.trim()) {
      toast.error("Écrivez le message à envoyer.");
      return;
    }

    setSending(true);
    setResults(null);
    setSendProgress({ current: 0, total: parsedPhones.length });

    try {
      const res = await sendBulkWhatsAppMessages(
        {
          phoneNumbers: parsedPhones,
          text: message.trim(),
        },
        {
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
            </section>
          </div>

          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 shadow-lg shadow-black/10">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-zinc-100">Lancer l&apos;envoi</h3>
                <p className="mt-1 text-xs text-zinc-500">
                  {parsedPhones.length > 0
                    ? `Prêt à envoyer à ${parsedPhones.length} numéro${parsedPhones.length !== 1 ? "s" : ""}.`
                    : "Ajoutez au moins un destinataire et un message."}
                </p>
              </div>

              <button
                type="button"
                disabled={sending || parsedPhones.length === 0 || !message.trim()}
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
