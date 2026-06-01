"use client";

import { useMemo, useState } from "react";
import { Loader2, Send, Users } from "lucide-react";
import { toast } from "sonner";
import { sendBulkWhatsAppMessages } from "@/lib/whatsapp/backend-whatsapp";
import type { BulkWhatsAppSendResultItem } from "@/lib/whatsapp/types";
import { cn } from "@/src/lib/utils";
import {
  formatWhatsAppPhone,
  parsePhoneNumbersInput,
} from "./whatsapp-utils";

export function BulkSendPage() {
  const [phonesRaw, setPhonesRaw] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<BulkWhatsAppSendResultItem[] | null>(null);

  const parsedPhones = useMemo(() => parsePhoneNumbersInput(phonesRaw), [phonesRaw]);

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
    try {
      const res = await sendBulkWhatsAppMessages({
        phoneNumbers: parsedPhones,
        text: message.trim(),
      });
      setResults(res.results);
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
      <div className="mx-auto max-w-3xl px-6 py-8 md:px-8">
        <div className="mb-8 flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600/15 ring-1 ring-emerald-500/25">
            <Users className="size-5 text-emerald-400" aria-hidden />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">Envoi à plusieurs numéros</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Un même message WhatsApp vers plusieurs contacts. Un numéro par ligne (ex.{" "}
              <span className="font-mono text-zinc-400">212612345678</span> ou{" "}
              <span className="font-mono text-zinc-400">0612345678</span>).
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <label
              htmlFor="bulk-phones"
              className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400"
            >
              Numéros ({parsedPhones.length})
            </label>
            <textarea
              id="bulk-phones"
              value={phonesRaw}
              onChange={(e) => setPhonesRaw(e.target.value)}
              rows={8}
              placeholder={"212612345678\n0612345678\n+212 6 12 34 56 78"}
              className="mt-2 w-full rounded-xl border border-zinc-700/80 bg-zinc-950/90 px-4 py-3 font-mono text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-600/80 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
            />
          </div>

          <div>
            <label
              htmlFor="bulk-message"
              className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400"
            >
              Message
            </label>
            <textarea
              id="bulk-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              placeholder="Votre message…"
              className="mt-2 w-full rounded-xl border border-zinc-700/80 bg-zinc-950/90 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-600/80 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
            />
          </div>

          <button
            type="button"
            disabled={sending || parsedPhones.length === 0 || !message.trim()}
            onClick={() => void handleSend()}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-emerald-900/25 hover:bg-emerald-500 disabled:opacity-40"
          >
            {sending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Send className="size-4" aria-hidden />
            )}
            Envoyer à {parsedPhones.length || "…"} numéro
            {parsedPhones.length !== 1 ? "s" : ""}
          </button>

          {results && results.length > 0 ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40">
              <p className="border-b border-zinc-800 px-4 py-3 text-sm font-medium text-zinc-300">
                Résultat de l&apos;envoi
              </p>
              <ul className="divide-y divide-zinc-800/80">
                {results.map((r) => (
                  <li
                    key={r.phoneNumber}
                    className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm"
                  >
                    <span className="font-mono text-zinc-300">
                      {formatWhatsAppPhone(r.phoneNumber)}
                    </span>
                    <span
                      className={cn(
                        "text-xs font-medium",
                        r.success ? "text-emerald-400" : "text-red-400",
                      )}
                    >
                      {r.success ? "Envoyé" : r.error ?? "Échec"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <p className="text-xs leading-relaxed text-zinc-600">
            Sans endpoint <span className="font-mono">POST /whatsapp/broadcast</span>, l&apos;envoi
            utilise les conversations déjà connues (contact ayant déjà écrit). Demandez au backend un
            envoi proactif si vous devez contacter de nouveaux numéros.
          </p>
        </div>
      </div>
    </div>
  );
}
