"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  Loader2,
  Search,
  UserPlus,
  UserRound,
  Users,
  X,
  CalendarOff,
} from "lucide-react";
import { toast } from "sonner";
import { fetchLeads } from "@/lib/leads/api-leads";
import { cleanLeadDisplayName } from "@/lib/leads/phone-extract";
import type { ClickUpLead } from "@/lib/leads/types";
import {
  createMeeting,
  updateMeeting,
} from "@/lib/meetings/backend-meetings";
import {
  casablancaDateTimeToIso,
  casablancaDayKey,
  isoToDateAndTime,
  isValidInternationalPhone,
} from "@/lib/meetings/meeting-datetime";
import { isBlockedDay, getBlockedDay } from "@/lib/meetings/blocked-days";
import {
  DEFAULT_MEETING_DURATION_MINUTES,
  MEETING_DURATION_OPTIONS,
  MEETING_STATUSES,
  MEETING_STATUS_LABELS,
  defaultRemindersConfig,
  type Meeting,
  type MeetingMember,
  type MeetingRemindersConfig,
  type MeetingStatus,
  type BlockedDay,
} from "@/lib/meetings/types";
import { cn } from "@/src/lib/utils";

type FormState = {
  title: string;
  date: string;
  time: string;
  durationMinutes: number;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  leadId: string;
  status: MeetingStatus;
  notes: string;
  manualContact: boolean;
  reminders: MeetingRemindersConfig;
  members: MeetingMember[];
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function leadToMember(lead: ClickUpLead): MeetingMember {
  const name = cleanLeadDisplayName(lead.name) || lead.name;
  return {
    leadId: lead.id,
    name,
    phone: lead.phone?.trim() || null,
    email: null,
  };
}

function memberKey(member: MeetingMember): string {
  if (member.leadId) return `l:${member.leadId}`;
  if (member.userId) return `u:${member.userId}`;
  return `n:${member.name.toLowerCase()}|${(member.email ?? "").toLowerCase()}|${member.phone ?? ""}`;
}

const emptyForm = (prefillDate?: Date | null): FormState => {
  let date = "";
  let time = "10:00";
  if (prefillDate && !Number.isNaN(prefillDate.getTime())) {
    date = `${prefillDate.getFullYear()}-${pad(prefillDate.getMonth() + 1)}-${pad(prefillDate.getDate())}`;
    const h = prefillDate.getHours();
    const m = prefillDate.getMinutes();
    if (h !== 0 || m !== 0) {
      time = `${pad(h)}:${pad(m)}`;
    }
  }
  return {
    title: "",
    date,
    time,
    durationMinutes: DEFAULT_MEETING_DURATION_MINUTES,
    contactName: "",
    contactPhone: "",
    contactEmail: "",
    leadId: "",
    status: "scheduled",
    notes: "",
    manualContact: false,
    reminders: defaultRemindersConfig(true, true),
    members: [],
  };
};

function meetingToForm(meeting: Meeting): FormState {
  const { date, time } = isoToDateAndTime(meeting.meetingDate);
  return {
    title: meeting.title,
    date,
    time: time || "10:00",
    durationMinutes: meeting.durationMinutes || DEFAULT_MEETING_DURATION_MINUTES,
    contactName: meeting.contactName,
    contactPhone: meeting.contactPhone ?? "",
    contactEmail: meeting.contactEmail ?? "",
    leadId: meeting.leadId ?? "",
    status: meeting.status,
    notes: meeting.notes ?? "",
    manualContact: !meeting.leadId,
    reminders: meeting.reminders ?? defaultRemindersConfig(
      Boolean(meeting.contactPhone?.trim()),
      Boolean(meeting.contactEmail?.trim()),
    ),
    members: meeting.members ?? [],
  };
}

type Props = {
  open: boolean;
  meeting?: Meeting | null;
  prefillDate?: Date | null;
  blockedDayKeys?: Set<string>;
  blockedDays?: BlockedDay[];
  onClose: () => void;
  onSaved: (meeting: Meeting) => void;
};

export function MeetingFormModal({
  open,
  meeting,
  prefillDate,
  blockedDayKeys,
  blockedDays,
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

  const [memberQuery, setMemberQuery] = useState("");
  const [memberLeads, setMemberLeads] = useState<ClickUpLead[]>([]);
  const [memberLeadsLoading, setMemberLeadsLoading] = useState(false);
  const [memberPickerOpen, setMemberPickerOpen] = useState(false);
  const memberPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setForm(meeting ? meetingToForm(meeting) : emptyForm(prefillDate));
    setLeadQuery(meeting ? meeting.contactName : "");
    setLeadPickerOpen(false);
    setMemberQuery("");
    setMemberPickerOpen(false);
    setLeads([]);
    setMemberLeads([]);
  }, [open, meeting, prefillDate]);

  // Contact: recherche serveur GET /leads?search= (page Leads — pas /clients)
  useEffect(() => {
    if (!open || form.manualContact) return;
    let cancelled = false;
    const t = window.setTimeout(() => {
      setLeadsLoading(true);
      void fetchLeads({
        page: 1,
        pageSize: 40,
        search: leadQuery.trim() || null,
      })
        .then((res) => {
          if (!cancelled) setLeads(res.leads);
        })
        .catch(() => {
          if (!cancelled) setLeads([]);
        })
        .finally(() => {
          if (!cancelled) setLeadsLoading(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [open, form.manualContact, leadQuery]);

  // Membres côté client: même API leads
  useEffect(() => {
    if (!open || !memberPickerOpen) return;
    let cancelled = false;
    const t = window.setTimeout(() => {
      setMemberLeadsLoading(true);
      void fetchLeads({
        page: 1,
        pageSize: 40,
        search: memberQuery.trim() || null,
      })
        .then((res) => {
          if (!cancelled) setMemberLeads(res.leads);
        })
        .catch(() => {
          if (!cancelled) setMemberLeads([]);
        })
        .finally(() => {
          if (!cancelled) setMemberLeadsLoading(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [open, memberPickerOpen, memberQuery]);

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

  useEffect(() => {
    if (!memberPickerOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!memberPickerRef.current?.contains(e.target as Node)) {
        setMemberPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [memberPickerOpen]);

  const selectedMemberLeadIds = useMemo(
    () =>
      new Set(
        form.members
          .map((m) => m.leadId)
          .filter((id): id is string => Boolean(id)),
      ),
    [form.members],
  );

  const contactLeadResults = useMemo(() => leads.slice(0, 40), [leads]);

  const memberLeadResults = useMemo(() => {
    return memberLeads
      .filter((l) => {
        if (form.leadId && l.id === form.leadId) return false;
        if (selectedMemberLeadIds.has(l.id)) return false;
        return true;
      })
      .slice(0, 40);
  }, [memberLeads, form.leadId, selectedMemberLeadIds]);

  const dateIsBlocked =
    Boolean(form.date.trim()) &&
    blockedDayKeys != null &&
    isBlockedDay(form.date, blockedDayKeys);

  const blockedReason =
    dateIsBlocked && form.date
      ? getBlockedDay(form.date, blockedDays ?? [])?.reason
      : null;

  if (!open) return null;

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const selectLead = (lead: ClickUpLead) => {
    const name = cleanLeadDisplayName(lead.name) || lead.name;
    setForm((prev) => ({
      ...prev,
      leadId: lead.id,
      contactName: name,
      contactPhone: lead.phone ?? "",
      manualContact: false,
      members: prev.members.filter((m) => m.leadId !== lead.id),
    }));
    setLeadQuery(name);
    setLeadPickerOpen(false);
  };

  const addMemberFromLead = (lead: ClickUpLead) => {
    if (form.leadId && lead.id === form.leadId) {
      toast.message("Ce lead est déjà le contact principal.");
      return;
    }
    const next = leadToMember(lead);
    setForm((prev) => {
      if (prev.members.some((m) => memberKey(m) === memberKey(next))) {
        return prev;
      }
      return { ...prev, members: [...prev.members, next] };
    });
    setMemberQuery("");
    setMemberPickerOpen(false);
    if (!next.phone) {
      toast.message("Lead ajouté sans téléphone", {
        description: "Ajoutez un email ci-dessous pour les rappels.",
      });
    }
  };

  const removeMember = (key: string) => {
    setForm((prev) => ({
      ...prev,
      members: prev.members.filter((m) => memberKey(m) !== key),
    }));
  };

  const updateMemberEmail = (key: string, email: string) => {
    setForm((prev) => ({
      ...prev,
      members: prev.members.map((m) =>
        memberKey(m) === key ? { ...m, email: email.trim() || null } : m,
      ),
    }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const title = form.title.trim();
    const contactName = form.contactName.trim();
    const meetingDate = casablancaDateTimeToIso(form.date, form.time);
    const contactPhone = form.contactPhone.trim();
    const contactEmail = form.contactEmail.trim();

    if (!title) {
      toast.error("Le titre est requis.");
      return;
    }
    if (!form.date.trim()) {
      toast.error("La date est obligatoire.");
      return;
    }
    if (!meetingDate) {
      toast.error("Date ou heure invalide.");
      return;
    }
    if (blockedDayKeys && isBlockedDay(form.date, blockedDayKeys)) {
      toast.error("Date indisponible", {
        description:
          blockedReason ??
          "Cette date a été bloquée par l'administrateur.",
      });
      return;
    }
    if (!contactName) {
      toast.error(
        form.manualContact
          ? "Le nom du contact est requis."
          : "Sélectionnez un client dans les leads.",
      );
      return;
    }
    if (!form.manualContact && !form.leadId.trim()) {
      toast.error("Choisissez un client depuis la liste des leads.");
      return;
    }
    if (contactPhone && !isValidInternationalPhone(contactPhone)) {
      toast.error(
        "Téléphone invalide. Utilisez un format international (ex. +2126…).",
      );
      return;
    }
    if (!contactPhone && !contactEmail) {
      toast.error("Indiquez au moins un téléphone ou un email.");
      return;
    }

    for (const m of form.members) {
      if (m.phone && !isValidInternationalPhone(m.phone)) {
        toast.error(`Téléphone invalide pour ${m.name}.`);
        return;
      }
    }

    const membersPayload: MeetingMember[] = form.members.map((m) => ({
      leadId: m.leadId ?? null,
      name: m.name.trim(),
      phone: m.phone?.trim() || null,
      email: m.email?.trim() || null,
    }));

    setSaving(true);
    try {
      const payload = {
        title,
        meetingDate,
        contactName,
        contactPhone: contactPhone || undefined,
        contactEmail: contactEmail || undefined,
        members: membersPayload,
        status: form.status,
        notes: form.notes.trim() || undefined,
        leadId: form.manualContact ? undefined : form.leadId || undefined,
        reminders: form.reminders,
      };

      const saved =
        isEdit && meeting
          ? await updateMeeting(meeting.id, {
              ...payload,
              contactPhone: contactPhone || null,
              contactEmail: contactEmail || null,
              notes: form.notes.trim() || null,
              leadId: form.manualContact ? null : form.leadId || null,
              members: membersPayload,
            })
          : await createMeeting(payload);

      onSaved({
        ...saved,
        durationMinutes: form.durationMinutes,
        members: saved.members?.length ? saved.members : membersPayload,
      });
      toast.success(isEdit ? "Rendez-vous mis à jour." : "Rendez-vous créé.");
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
          <h3
            id="meeting-form-title"
            className="text-lg font-semibold text-white"
          >
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

        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="space-y-4 px-5 py-4"
        >
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

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block sm:col-span-1">
              <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                Date *
              </span>
              <input
                type="date"
                value={form.date}
                min={isEdit ? undefined : casablancaDayKey()}
                onChange={(e) => setField("date", e.target.value)}
                required
                className={cn(
                  "mt-1.5 w-full rounded-xl border bg-zinc-950/80 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:ring-1",
                  dateIsBlocked
                    ? "border-red-500/70 focus:border-red-500 focus:ring-red-500/30"
                    : "border-zinc-700 focus:border-emerald-500 focus:ring-emerald-500/30",
                )}
              />
              {dateIsBlocked ? (
                <div className="mt-2 flex items-start gap-2 rounded-xl border border-red-500/25 bg-red-500/8 px-3 py-2.5">
                  <CalendarOff className="mt-0.5 size-4 shrink-0 text-red-400" />
                  <div>
                    <p className="text-xs font-medium text-red-200">
                      Date indisponible
                    </p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-red-300/80">
                      {blockedReason
                        ? blockedReason
                        : "Aucun rendez-vous ne peut être planifié ce jour."}
                    </p>
                  </div>
                </div>
              ) : null}
            </label>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                Heure *
              </span>
              <input
                type="time"
                value={form.time}
                onChange={(e) => setField("time", e.target.value)}
                required
                className="mt-1.5 w-full rounded-xl border border-zinc-700 bg-zinc-950/80 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                Durée
              </span>
              <select
                value={form.durationMinutes}
                onChange={(e) =>
                  setField("durationMinutes", Number(e.target.value))
                }
                className="mt-1.5 w-full rounded-xl border border-zinc-700 bg-zinc-950/80 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30"
              >
                {MEETING_DURATION_OPTIONS.map((mins) => (
                  <option key={mins} value={mins}>
                    {mins} min
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div>
              <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                Lead *
              </span>
              {!form.manualContact ? (
                <p className="mt-0.5 text-[11px] text-zinc-500">
                  Recherche via <span className="text-zinc-400">GET /leads</span>{" "}
                  (page Leads) — pas la page Clients.
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() =>
                setForm((prev) => ({
                  ...prev,
                  manualContact: !prev.manualContact,
                  leadId: prev.manualContact ? prev.leadId : "",
                }))
              }
              className="shrink-0 text-xs text-emerald-400 hover:text-emerald-300"
            >
              {form.manualContact ? "Choisir un lead" : "Saisir manuellement"}
            </button>
          </div>

          {!form.manualContact ? (
            <div ref={pickerRef} className="relative">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
                <input
                  value={leadQuery}
                  onChange={(e) => {
                    const q = e.target.value;
                    setLeadQuery(q);
                    setLeadPickerOpen(true);
                    setForm((prev) => ({
                      ...prev,
                      contactName: q,
                      leadId: "",
                    }));
                  }}
                  onFocus={() => setLeadPickerOpen(true)}
                  placeholder="Rechercher un lead (nom ou téléphone)…"
                  autoComplete="off"
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950/80 py-2.5 pl-10 pr-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30"
                />
              </div>
              {form.leadId ? (
                <p className="mt-1.5 text-[11px] text-emerald-400/90">
                  Lead sélectionné · {form.contactName}
                </p>
              ) : null}
              {leadPickerOpen ? (
                <div className="app-scroll absolute left-0 right-0 z-20 mt-1 max-h-48 overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-950 p-1 shadow-xl">
                  {leadsLoading ? (
                    <div className="flex items-center justify-center gap-2 py-4 text-xs text-zinc-500">
                      <Loader2 className="size-4 animate-spin" />
                      Recherche dans les leads…
                    </div>
                  ) : contactLeadResults.length === 0 ? (
                    <p className="px-3 py-3 text-xs text-zinc-500">
                      Aucun lead trouvé. Essayez un autre nom / téléphone.
                    </p>
                  ) : (
                    contactLeadResults.map((lead) => {
                      const name = cleanLeadDisplayName(lead.name) || lead.name;
                      const selected = form.leadId === lead.id;
                      return (
                        <button
                          key={lead.id}
                          type="button"
                          onClick={() => selectLead(lead)}
                          className={cn(
                            "flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left hover:bg-zinc-800",
                            selected && "bg-emerald-500/10",
                          )}
                        >
                          <UserRound className="mt-0.5 size-4 shrink-0 text-zinc-500" />
                          <span className="min-w-0">
                            <span className="block truncate text-sm text-zinc-100">
                              {name}
                            </span>
                            <span className="block truncate font-mono text-[11px] text-zinc-500">
                              {lead.phone || "Sans téléphone"}
                              {lead.list_name ? ` · ${lead.list_name}` : ""}
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
                placeholder="+212 6 …"
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

          <div className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
            <div className="flex items-center gap-2">
              <Users className="size-4 text-emerald-400" />
              <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                Membres de l&apos;équipe client
              </span>
            </div>
            <p className="text-[11px] leading-relaxed text-zinc-500">
              Autres personnes côté client (owner, assistant…) — aussi depuis
              la page Leads. Ils recevront les rappels WhatsApp / email.
            </p>

            {form.members.length > 0 ? (
              <ul className="space-y-2">
                {form.members.map((m) => {
                  const key = memberKey(m);
                  return (
                    <li
                      key={key}
                      className="rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-zinc-100">
                            {m.name}
                          </p>
                          <p className="truncate font-mono text-[11px] text-zinc-500">
                            {m.phone || "Sans téléphone"}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeMember(key)}
                          className="flex size-7 shrink-0 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-800 hover:text-red-300"
                          aria-label={`Retirer ${m.name}`}
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                      <input
                        type="email"
                        value={m.email ?? ""}
                        onChange={(e) =>
                          updateMemberEmail(key, e.target.value)
                        }
                        placeholder="Email (optionnel)"
                        className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950/80 px-2.5 py-1.5 text-xs text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-emerald-500"
                      />
                    </li>
                  );
                })}
              </ul>
            ) : null}

            <div ref={memberPickerRef} className="relative">
              <div className="relative">
                <UserPlus className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
                <input
                  value={memberQuery}
                  onChange={(e) => {
                    setMemberQuery(e.target.value);
                    setMemberPickerOpen(true);
                  }}
                  onFocus={() => setMemberPickerOpen(true)}
                  placeholder="Rechercher un lead (membre)…"
                  autoComplete="off"
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950/80 py-2.5 pl-10 pr-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30"
                />
              </div>
              {memberPickerOpen ? (
                <div className="app-scroll absolute left-0 right-0 z-20 mt-1 max-h-52 overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-950 p-1 shadow-xl">
                  {memberLeadsLoading ? (
                    <div className="flex items-center justify-center gap-2 py-4 text-xs text-zinc-500">
                      <Loader2 className="size-4 animate-spin" />
                      Recherche dans les leads…
                    </div>
                  ) : memberLeadResults.length === 0 ? (
                    <p className="px-3 py-3 text-xs text-zinc-500">
                      Aucun lead trouvé — ou déjà ajouté / contact principal.
                    </p>
                  ) : (
                    memberLeadResults.map((lead) => {
                      const name = cleanLeadDisplayName(lead.name) || lead.name;
                      return (
                        <button
                          key={lead.id}
                          type="button"
                          onClick={() => addMemberFromLead(lead)}
                          className="flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left hover:bg-zinc-800"
                        >
                          <UserRound className="mt-0.5 size-4 shrink-0 text-emerald-500/80" />
                          <span className="min-w-0">
                            <span className="block truncate text-sm text-zinc-100">
                              {name}
                            </span>
                            <span className="block truncate font-mono text-[11px] text-zinc-500">
                              {lead.phone || "Sans téléphone"}
                              {lead.list_name ? ` · ${lead.list_name}` : ""}
                            </span>
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              ) : null}
            </div>
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
              disabled={saving || dateIsBlocked}
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
