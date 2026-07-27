"use client";

import { Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchLeadById } from "@/lib/leads/api-leads";
import type { ClickUpLead } from "@/lib/leads/types";
import { cn } from "@/src/lib/utils";
import { LeadStatusBadge } from "./LeadStatusBadge";

function formatCreatedAt(iso: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type LeadDetailModalProps = {
  leadId: string | null;
  onClose: () => void;
};

export function LeadDetailModal({ leadId, onClose }: LeadDetailModalProps) {
  const [lead, setLead] = useState<ClickUpLead | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!leadId) {
      setLead(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void fetchLeadById(leadId)
      .then((data) => {
        if (!cancelled) setLead(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setLead(null);
          setError(err instanceof Error ? err.message : "Impossible de charger le lead.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [leadId]);

  useEffect(() => {
    if (!leadId) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [leadId, onClose]);

  if (!leadId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div
        className="w-full max-w-lg rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Détail du lead"
      >
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
          <h3 className="text-lg font-semibold text-white">Fiche lead</h3>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
            aria-label="Fermer"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        <div className="px-5 py-5">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-zinc-400">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Chargement…
            </div>
          ) : error ? (
            <p className="py-8 text-center text-sm text-red-400">{error}</p>
          ) : lead ? (
            <dl className="space-y-4 font-mono text-sm">
              {[
                { label: "Nom", value: lead.name || "—" },
                { label: "Téléphone", value: lead.phone || "—" },
                { label: "Source", value: lead.list_name || "—" },
                { label: "Créé le", value: formatCreatedAt(lead.created_at) },
              ].map((field) => (
                <div key={field.label}>
                  <dt className="text-[10px] uppercase tracking-widest text-zinc-500">
                    {field.label}
                  </dt>
                  <dd className="mt-1 text-zinc-200">{field.value}</dd>
                </div>
              ))}
              <div>
                <dt className="text-[10px] uppercase tracking-widest text-zinc-500">Statut</dt>
                <dd className="mt-1">
                  <LeadStatusBadge status={lead.status} />
                </dd>
              </div>
            </dl>
          ) : null}
        </div>

        <div className="border-t border-zinc-800 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className={cn(
              "w-full border border-zinc-700 px-4 py-2 font-mono text-[11px] uppercase tracking-widest",
              "text-zinc-200 transition hover:bg-zinc-800",
            )}
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
