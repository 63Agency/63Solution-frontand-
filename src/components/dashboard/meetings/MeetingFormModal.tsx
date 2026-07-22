"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Loader2, Search, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { fetchLeads } from "@/lib/leads/api-leads";
import { cleanLeadDisplayName } from "@/lib/leads/phone-extract";
import type { ClickUpLead } from "@/lib/leads/types";
import {
  createMeeting,
  updateMeeting,
} from "@/lib/meetings/backend-meetings";
import {
  datetimeLocalToIso,
  isoToDatetimeLocal,
} from "@/lib/meetings/meeting-datetime";
import {
  MEETING_STATUSES,
  MEETING_STATUS_LABELS,
  type Meeting,
  type MeetingStatus,
} from "@/lib/meetings/types";
import { cn } from "@/src/lib/utils";

type FormState = {
  title: string;
  meetingDateLocal: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  leadId: string;
  status: MeetingStatus;
  notes: string;
  manualContact: boolean;
};

const emptyForm = (prefillDate?: Date | null): FormState => {
  let meetingDateLocal = "";
  if (prefillDate && !Number.isNaN(prefillDate.getTime())) {
    const pad = (n: number) => String(n).padStart(2, "0");
    meetingDateLocal = `${prefillDate.getFullYear()}-${pad(prefillDate.getMonth() + 1)}-${pad(prefillDate.getDate())}T${pad(prefillDate.getHours())}:${pad(prefillDate.getMinutes())}`;
  }
  return {
    title: "",
    meetingDateLocal,
    contactName: "",
    contactPhone: "",
    contactEmail: "",
    leadId: "",
    status: "scheduled",
    notes: "",
    manualContact: false,
  };
};

function meetingToForm(meeting: Meeting): FormState {
  return {
    title: meeting.title,
    meetingDateLocal: isoToDatetimeLocal(meeting.meetingDate),
    contactName: meeting.contactName,
    contactPhone: meeting.contactPhone ?? "",
    contactEmail: meeting.contactEmail ?? "",
    leadId: meeting.leadId ?? "",
    status: meeting.status,
    notes: meeting.notes ?? "",
    manualContact: !meeting.leadId,
  };
}

type Props = {
  open: boolean;
  meeting?: Meeting | null;
  prefillDate?: Date | null;
  onClose: () => void;
  onSaved: (meeting: Meeting) => void;
};

export function MeetingFormModal({
  open,
  meeting,
  prefillDate,
  onClose,
  onSaved,
}: Props) {
  const isEdit = Boolean(meeting);
  const [form, setForm] = useState<FormState>(() => emptyForm(prefillDate));
  const [saving, setSaving] = useState(false);
  const [leadQuery, setLeadQuery] = useState("");
  const [leads, setLeads] = useState<ClickUpLead[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [leadPickerOpen, setLeadPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setForm(meeting ? meetingToForm(meeting) : emptyForm(prefillDate));
    setLeadQuery("");
    setLeadPickerOpen(false);
  }, [open, meeting, prefillDate]);

  useEffect(() => {
    if (!open || form.manualContact) return;
    let cancelled = false;
    const t = window.setTimeout(() => {
      setLeadsLoading(true);
      void fetchLeads({ page: 1, pageSize: 50 })
        .then((res) => {
          if (!cancelled) setLeads(res.leads);
        })
        .catch(() => {
          if (!cancelled) setLeads([]);
        })
        .finally(() => {
          if (!cancelled) setLeadsLoading(false);
        });
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [open, form.manualContact]);

  useEffect(() => {
    if (!leadPickerOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!pickerRef.current?.contains(e.target as Node)) {
        setLeadPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [leadPickerOpen]);

  const filteredLeads = useMemo(() => {
    const q = leadQuery.trim().toLowerCase();
    if (!q) return leads.slice(0, 30);
    return leads
      .filter((l) => {
        const name = cleanLeadDisplayName(l.name).toLowerCase();
        const phone = (l.phone ?? "").toLowerCase();
        return name.includes(q) || phone.includes(q);
      })
      .slice(0, 30);
  }, [leads, leadQuery]);

  if (!open) return null;

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const selectLead = (lead: ClickUpLead) => {
    setForm((prev) => ({
      ...prev,
      leadId: lead.id,
      contactName: cleanLeadDisplayName(lead.name) || lead.name,
      contactPhone: lead.phone ?? "",
      manualContact: false,
    }));
    setLeadQuery(cleanLeadDisplayName(lead.name) || lead.name);
    setLeadPickerOpen(false);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const title = form.title.trim();
    const contactName = form.contactName.trim();
    const meetingDate = datetimeLocalToIso(form.meetingDateLocal);
    const contactPhone = form.contactPhone.trim();
    const contactEmail = form.contactEmail.trim();

    if (!title) {
      toast.error("Le titre est requis.");
      return;
    }
    if (!meetingDate) {
      toast.error("La date et l'heure sont requises.");
      return;
    }
    if (!contactName) {
      toast.error("Le nom du contact est requis.");
      return;
    }
    if (!contactPhone && !contactEmail) {
      toast.error("Indiquez au moins un téléphone ou un email.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title,
        meetingDate,
        contactName,
        contactPhone: contactPhone || undefined,
        contactEmail: contactEmail || undefined,
        status: form.status,
        notes: form.notes.trim() || undefined,
        leadId: form.manualContact ? undefined : form.leadId || undefined,
      };

      const saved = isEdit && meeting
        ? await updateMeeting(meeting.id, {
            ...payload,
            contactPhone: contactPhone || null,
            contactEmail: contactEmail || null,
            notes: form.notes.trim() || null,
            leadId: form.manualContact ? null : form.leadId || null,
          })
        : await createMeeting(payload);

      toast.success(isEdit ? "Rendez-vous mis à jour." : "Rendez-vous créé.");
      onSaved(saved);
      onClose();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Enregistrement impossible.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4">
      <div
        className="app-scroll flex max-h-[min(920px,100dvh)] w-full max-w-lg flex-col overflow-y-auto rounded-t-2xl border border-zinc-700 bg-zinc-900 shadow-2xl sm:rounded-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="meeting-form-title"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-800 bg-zinc-900 px-5 py-4">
          <h3 id="meeting-form-title" className="text-lg font-semibold text-white">
            {isEdit ? "Modifier le rendez-vous" : "Nouveau rendez-vous"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="flex size-9 items-center justify-center rounded-xl text-zinc-400 hover:bg-zinc-800 hover:text-white"
            aria-label="Fermer"
          >
            <X className="size-5" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 px-5 py-4">
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Titre *
            </span>
            <input
              value={form.title}
              onChange={(e) => setField("title", e.target.value)}
              required
              className="mt-1.5 w-full rounded-xl border border-zinc-700 bg-zinc-950/80 px-3 py-2.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30"
              placeholder="Ex. Appel découverte"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Date et heure *
            </span>
            <input
              type="datetime-local"
              value={form.meetingDateLocal}
              onChange={(e) => setField("meetingDateLocal", e.target.value)}
              required
              className="mt-1.5 w-full rounded-xl border border-zinc-700 bg-zinc-950/80 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30"
            />
          </label>

          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Contact *
            </span>
            <button
              type="button"
              onClick={() =>
                setForm((prev) => ({
                  ...prev,
                  manualContact: !prev.manualContact,
                  leadId: "",
                }))
              }
              className="text-xs text-emerald-400 hover:text-emerald-300"
            >
              {form.manualContact
                ? "Choisir un lead"
                : "Saisir manuellement"}
            </button>
          </div>

          {!form.manualContact ? (
            <div ref={pickerRef} className="relative">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
                <input
                  value={leadQuery || form.contactName}
                  onChange={(e) => {
                    setLeadQuery(e.target.value);
                    setField("contactName", e.target.value);
                    setLeadPickerOpen(true);
                  }}
                  onFocus={() => setLeadPickerOpen(true)}
                  placeholder="Rechercher un lead…"
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950/80 py-2.5 pl-10 pr-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30"
                />
              </div>
              {leadPickerOpen ? (
                <div className="app-scroll absolute left-0 right-0 z-20 mt-1 max-h-48 overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-950 p-1 shadow-xl">
                  {leadsLoading ? (
                    <div className="flex items-center justify-center gap-2 py-4 text-xs text-zinc-500">
                      <Loader2 className="size-4 animate-spin" />
                      Chargement…
                    </div>
                  ) : filteredLeads.length === 0 ? (
                    <p className="px-3 py-3 text-xs text-zinc-500">
                      Aucun lead trouvé.
                    </p>
                  ) : (
                    filteredLeads.map((lead) => {
                      const name = cleanLeadDisplayName(lead.name) || lead.name;
                      return (
                        <button
                          key={lead.id}
                          type="button"
                          onClick={() => selectLead(lead)}
                          className="flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left hover:bg-zinc-800"
                        >
                          <UserRound className="mt-0.5 size-4 shrink-0 text-zinc-500" />
                          <span className="min-w-0">
                            <span className="block truncate text-sm text-zinc-100">
                              {name}
                            </span>
                            <span className="block truncate font-mono text-[11px] text-zinc-500">
                              {lead.phone || "Sans téléphone"}
                            </span>
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              ) : null}
            </div>
          ) : (
            <input
              value={form.contactName}
              onChange={(e) => setField("contactName", e.target.value)}
              placeholder="Nom du contact"
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950/80 px-3 py-2.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30"
            />
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                Téléphone
              </span>
              <input
                value={form.contactPhone}
                onChange={(e) => setField("contactPhone", e.target.value)}
                placeholder="2126…"
                className="mt-1.5 w-full rounded-xl border border-zinc-700 bg-zinc-950/80 px-3 py-2.5 font-mono text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                Email
              </span>
              <input
                type="email"
                value={form.contactEmail}
                onChange={(e) => setField("contactEmail", e.target.value)}
                placeholder="contact@exemple.com"
                className="mt-1.5 w-full rounded-xl border border-zinc-700 bg-zinc-950/80 px-3 py-2.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Statut
            </span>
            <select
              value={form.status}
              onChange={(e) =>
                setField("status", e.target.value as MeetingStatus)
              }
              className="mt-1.5 w-full rounded-xl border border-zinc-700 bg-zinc-950/80 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30"
            >
              {MEETING_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {MEETING_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Notes
            </span>
            <textarea
              value={form.notes}
              onChange={(e) => setField("notes", e.target.value)}
              rows={3}
              className="mt-1.5 w-full rounded-xl border border-zinc-700 bg-zinc-950/80 px-3 py-2.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30"
              placeholder="Contexte, objectifs…"
            />
          </label>

          <div className="flex justify-end gap-2 border-t border-zinc-800 pt-4 pb-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-zinc-700 px-4 py-2 font-mono text-[11px] uppercase tracking-widest text-zinc-300 hover:bg-zinc-800"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl border border-emerald-500 bg-emerald-600 px-4 py-2 font-mono text-[11px] uppercase tracking-widest text-white hover:bg-emerald-500 disabled:opacity-50",
              )}
            >
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : null}
              {isEdit ? "Enregistrer" : "Créer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
