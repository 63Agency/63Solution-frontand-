"use client";

import { useState } from "react";
import {
  Bell,
  BadgeCheck,
  CheckCircle2,
  Copy,
  ExternalLink,
  Flag,
  Loader2,
  Mail,
  MessageCircle,
  Pencil,
  PhoneOff,
  RefreshCw,
  Sparkles,
  ThumbsDown,
  Trash2,
  UserX,
  Video,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  deleteMeeting,
  regenerateMeetingMeetLink,
  sendMeetingReminder,
  updateMeeting,
} from "@/lib/meetings/backend-meetings";
import { formatMeetingDateTime } from "@/lib/meetings/meeting-datetime";
import type { Meeting, MeetingStatus } from "@/lib/meetings/types";
import {
  MEETING_REMINDER_OFFSETS,
} from "@/lib/meetings/types";
import { cn } from "@/src/lib/utils";
import { MeetingStatusBadge, ReminderOffsetBadge } from "./MeetingBadges";

type Props = {
  meeting: Meeting | null;
  isAdmin: boolean;
  /** Envoi manuel du rappel — admin, admin_whatsapp, fixed_meeting. */
  canSendReminder?: boolean;
  onClose: () => void;
  onEdit: (meeting: Meeting) => void;
  onChanged: (meeting: Meeting | null) => void;
};

export function MeetingDetailPanel({
  meeting,
  isAdmin,
  canSendReminder = false,
  onClose,
  onEdit,
  onChanged,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [confirmReminder, setConfirmReminder] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);

  if (!meeting) return null;

  const setStatus = async (status: MeetingStatus) => {
    setBusy(true);
    try {
      const updated = await updateMeeting(meeting.id, { status });
      toast.success("Statut mis à jour.");
      onChanged(updated);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Mise à jour impossible.");
    } finally {
      setBusy(false);
    }
  };

  const handleReminder = async () => {
    setBusy(true);
    try {
      const result = await sendMeetingReminder(meeting.id, { force: true });
      setConfirmReminder(false);

      const parts: string[] = [];
      if (result.whatsappSent) parts.push("WhatsApp");
      if (result.emailSent) parts.push("email");

      if (parts.length > 0) {
        if (result.whatsappSent && result.emailSent) {
          toast.success("Rappel envoyé (WhatsApp + email).");
        } else if (result.emailSent && !result.whatsappSent) {
          toast.message("Email envoyé — WhatsApp non envoyé", {
            description:
              result.whatsappError ||
              "Voir whatsappError / logs Meta côté Nest.",
          });
        } else if (result.whatsappSent && !result.emailSent) {
          toast.message("WhatsApp envoyé — email non envoyé", {
            description:
              result.emailError || "Voir emailError / SMTP côté Nest.",
          });
        }
        onChanged({
          ...meeting,
          reminderWhatsappSent:
            meeting.reminderWhatsappSent || result.whatsappSent,
          reminderEmailSent: meeting.reminderEmailSent || result.emailSent,
        });
        return;
      }

      const details = [result.whatsappError, result.emailError]
        .filter(Boolean)
        .join(" · ");

      if (details) {
        toast.error(`Rappel non envoyé : ${details}`);
        return;
      }

      toast.message("Rappel demandé", {
        description:
          "Le backend n’a pas confirmé l’envoi WhatsApp/email. Vérifie les logs Nest / Meta.",
      });
      onChanged({ ...meeting });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Envoi du rappel impossible.");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    setBusy(true);
    try {
      await deleteMeeting(meeting.id);
      toast.success("Rendez-vous supprimé.");
      setConfirmDelete(false);
      onChanged(null);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Suppression impossible.");
    } finally {
      setBusy(false);
    }
  };

  const handleCopyMeet = async () => {
    if (!meeting.meetLink) return;
    try {
      await navigator.clipboard.writeText(meeting.meetLink);
      toast.success("Lien Meet copié.");
    } catch {
      toast.error("Impossible de copier le lien.");
    }
  };

  const handleRegenerate = async () => {
    setBusy(true);
    try {
      const updated = await regenerateMeetingMeetLink(meeting.id);
      toast.success("Lien Meet régénéré.");
      setConfirmRegenerate(false);
      onChanged(updated);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Régénération Meet impossible.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 bg-black/55"
        aria-label="Fermer le détail"
        onClick={onClose}
      />
      <aside
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[420px] flex-col border-l border-zinc-800 bg-zinc-950 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Détail du rendez-vous"
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-800 px-4">
          <h2 className="text-base font-semibold text-white">Rendez-vous</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex size-9 items-center justify-center rounded-xl text-zinc-400 hover:bg-zinc-800 hover:text-white"
            aria-label="Fermer"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="app-scroll min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-xl font-semibold text-white">{meeting.title}</h3>
              <p className="mt-1 text-sm text-zinc-400">
                {formatMeetingDateTime(meeting.meetingDate)}
                <span className="text-zinc-600"> · </span>
                {meeting.durationMinutes} min
              </p>
            </div>
            <MeetingStatusBadge status={meeting.status} />
          </div>

          <dl className="mt-6 space-y-4 text-sm">
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-zinc-500">
                Contact
              </dt>
              <dd className="mt-1 text-zinc-100">{meeting.contactName}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-zinc-500">
                Téléphone
              </dt>
              <dd className="mt-1 font-mono text-zinc-300">
                {meeting.contactPhone || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-zinc-500">
                Email
              </dt>
              <dd className="mt-1 text-zinc-300">{meeting.contactEmail || "—"}</dd>
            </div>
            {meeting.assignees && meeting.assignees.length > 0 ? (
              <div>
                <dt className="text-[11px] uppercase tracking-wider text-zinc-500">
                  Visible pour l&apos;équipe
                </dt>
                <dd className="mt-2 space-y-2">
                  {meeting.assignees.map((a) => {
                    const name =
                      `${a.prenom ?? ""} ${a.nom ?? ""}`.trim() ||
                      a.email ||
                      a.userId;
                    return (
                      <div
                        key={a.userId}
                        className="rounded-lg border border-sky-500/20 bg-sky-500/5 px-3 py-2"
                      >
                        <p className="text-sm text-zinc-100">{name}</p>
                        <p className="mt-0.5 text-[11px] text-zinc-500">
                          {[a.role, a.email].filter(Boolean).join(" · ") ||
                            a.userId}
                        </p>
                      </div>
                    );
                  })}
                </dd>
              </div>
            ) : meeting.assignedUserIds && meeting.assignedUserIds.length > 0 ? (
              <div>
                <dt className="text-[11px] uppercase tracking-wider text-zinc-500">
                  Visible pour l&apos;équipe
                </dt>
                <dd className="mt-2 space-y-1">
                  {meeting.assignedUserIds.map((id) => (
                    <p key={id} className="font-mono text-xs text-zinc-400">
                      {id}
                    </p>
                  ))}
                </dd>
              </div>
            ) : null}
            {meeting.members && meeting.members.length > 0 ? (
              <div>
                <dt className="text-[11px] uppercase tracking-wider text-zinc-500">
                  Membres de l&apos;équipe client
                </dt>
                <dd className="mt-2 space-y-2">
                  {meeting.members.map((m, idx) => (
                    <div
                      key={`${m.leadId ?? m.userId ?? m.name}-${idx}`}
                      className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2"
                    >
                      <p className="text-sm text-zinc-100">{m.name}</p>
                      <p className="mt-0.5 font-mono text-[11px] text-zinc-500">
                        {[m.phone, m.email].filter(Boolean).join(" · ") ||
                          "Sans contact"}
                      </p>
                    </div>
                  ))}
                </dd>
              </div>
            ) : null}
            {meeting.notes ? (
              <div>
                <dt className="text-[11px] uppercase tracking-wider text-zinc-500">
                  Notes
                </dt>
                <dd className="mt-1 whitespace-pre-wrap text-zinc-300">
                  {meeting.notes}
                </dd>
              </div>
            ) : null}
          </dl>

          <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              <Video className="size-3.5" />
              Google Meet
            </p>
            {meeting.meetLink ? (
              <>
                <p className="mt-2 break-all font-mono text-xs text-emerald-300/90">
                  {meeting.meetLink}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void handleCopyMeet()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800"
                  >
                    <Copy className="size-3.5" />
                    Copier
                  </button>
                  <a
                    href={meeting.meetLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20"
                  >
                    <ExternalLink className="size-3.5" />
                    Rejoindre
                  </a>
                </div>
              </>
            ) : (
              <p className="mt-2 text-sm text-zinc-500">Aucun lien Meet.</p>
            )}
          </div>

          <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Rappels automatiques
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Envois prévus à J-2, 24 h et 2 h avant le rendez-vous.
              L’envoi manuel n’impacte pas ce planning.
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <p className="mb-2 flex items-center gap-2 text-xs font-medium text-zinc-300">
                  <MessageCircle className="size-3.5 text-emerald-400" />
                  WhatsApp
                  {!meeting.contactPhone ? (
                    <span className="font-normal text-zinc-600">· pas de téléphone</span>
                  ) : null}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {MEETING_REMINDER_OFFSETS.map((offset) => (
                    <ReminderOffsetBadge
                      key={`wa-${offset}`}
                      offset={offset}
                      enabled={Boolean(
                        meeting.contactPhone && meeting.reminders.whatsapp[offset],
                      )}
                      status={meeting.remindersStatus.whatsapp[offset]}
                    />
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 flex items-center gap-2 text-xs font-medium text-zinc-300">
                  <Mail className="size-3.5 text-sky-400" />
                  Email
                  {!meeting.contactEmail ? (
                    <span className="font-normal text-zinc-600">· pas d&apos;email</span>
                  ) : null}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {MEETING_REMINDER_OFFSETS.map((offset) => (
                    <ReminderOffsetBadge
                      key={`em-${offset}`}
                      offset={offset}
                      enabled={Boolean(
                        meeting.contactEmail && meeting.reminders.email[offset],
                      )}
                      status={meeting.remindersStatus.email[offset]}
                    />
                  ))}
                </div>
              </div>

              {meeting.reminderWhatsappSent || meeting.reminderEmailSent ? (
                <p className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-[11px] text-zinc-500">
                  Rappel manuel déjà envoyé
                  {meeting.reminderWhatsappSent && meeting.reminderEmailSent
                    ? " (WhatsApp + email)"
                    : meeting.reminderWhatsappSent
                      ? " (WhatsApp)"
                      : " (email)"}
                  . Les rappels automatiques restent inchangés.
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-6">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Statut rapide
            </p>
            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                disabled={busy || meeting.status === "confirmed"}
                onClick={() => void setStatus("confirmed")}
                className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 px-3 py-2.5 text-sm text-zinc-200 hover:bg-zinc-800 disabled:opacity-40"
              >
                <BadgeCheck className="size-4 text-violet-400" />
                Confirmé
              </button>
              <button
                type="button"
                disabled={busy || meeting.status === "bon_qualified"}
                onClick={() => void setStatus("bon_qualified")}
                className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 px-3 py-2.5 text-sm text-zinc-200 hover:bg-zinc-800 disabled:opacity-40"
              >
                <Sparkles className="size-4 text-teal-400" />
                Bon Qualified
              </button>
              <button
                type="button"
                disabled={busy || meeting.status === "non_qualified"}
                onClick={() => void setStatus("non_qualified")}
                className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 px-3 py-2.5 text-sm text-zinc-200 hover:bg-zinc-800 disabled:opacity-40"
              >
                <ThumbsDown className="size-4 text-rose-400" />
                Non qualifier
              </button>
              <button
                type="button"
                disabled={busy || meeting.status === "no_answer"}
                onClick={() => void setStatus("no_answer")}
                className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 px-3 py-2.5 text-sm text-zinc-200 hover:bg-zinc-800 disabled:opacity-40"
              >
                <PhoneOff className="size-4 text-zinc-400" />
                No answer
              </button>
              <button
                type="button"
                disabled={busy || meeting.status === "reported"}
                onClick={() => void setStatus("reported")}
                className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 px-3 py-2.5 text-sm text-zinc-200 hover:bg-zinc-800 disabled:opacity-40"
              >
                <Flag className="size-4 text-orange-400" />
                Reported
              </button>
              <button
                type="button"
                disabled={busy || meeting.status === "done"}
                onClick={() => void setStatus("done")}
                className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 px-3 py-2.5 text-sm text-zinc-200 hover:bg-zinc-800 disabled:opacity-40"
              >
                <CheckCircle2 className="size-4 text-emerald-400" />
                Done
              </button>
              <button
                type="button"
                disabled={busy || meeting.status === "cancelled"}
                onClick={() => void setStatus("cancelled")}
                className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 px-3 py-2.5 text-sm text-zinc-200 hover:bg-zinc-800 disabled:opacity-40"
              >
                <XCircle className="size-4 text-red-400" />
                Annulé
              </button>
              <button
                type="button"
                disabled={busy || meeting.status === "no_show"}
                onClick={() => void setStatus("no_show")}
                className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 px-3 py-2.5 text-sm text-zinc-200 hover:bg-zinc-800 disabled:opacity-40"
              >
                <UserX className="size-4 text-amber-400" />
                No-show
              </button>
            </div>
          </div>
        </div>

        <div className="shrink-0 space-y-2 border-t border-zinc-800 p-4">
          {canSendReminder ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirmReminder(true)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-sm font-medium text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50"
            >
              <Bell className="size-4" />
              Envoyer le rappel maintenant
            </button>
          ) : null}
          {isAdmin ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirmRegenerate(true)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-700 px-4 py-2.5 text-sm text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
            >
              <RefreshCw className="size-4" />
              Régénérer le lien Meet
            </button>
          ) : null}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => onEdit(meeting)}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-zinc-700 px-4 py-2.5 text-sm text-zinc-200 hover:bg-zinc-800"
            >
              <Pencil className="size-4" />
              Modifier
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirmDelete(true)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-700/50 px-4 py-2.5 text-sm text-red-300 hover:bg-red-950/40"
            >
              <Trash2 className="size-4" />
              Supprimer
            </button>
          </div>
        </div>
      </aside>

      {confirmReminder ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl">
            <h3 className="text-lg font-semibold text-white">Envoyer un rappel ?</h3>
            <p className="mt-2 text-sm text-zinc-300">
              Un rappel WhatsApp / email sera envoyé immédiatement pour «{" "}
              {meeting.title} ».
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmReminder(false)}
                className="border border-zinc-700 px-4 py-2 font-mono text-[11px] uppercase tracking-widest text-zinc-200 hover:bg-zinc-800"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleReminder()}
                className="inline-flex items-center gap-2 border border-emerald-500 bg-emerald-600 px-4 py-2 font-mono text-[11px] uppercase tracking-widest text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                {busy ? <Loader2 className="size-3.5 animate-spin" /> : null}
                Confirmer
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmRegenerate ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl">
            <h3 className="text-lg font-semibold text-white">
              Régénérer le lien Meet ?
            </h3>
            <p className="mt-2 text-sm text-zinc-300">
              L’ancien lien ne fonctionnera plus. Un nouveau lien unique sera
              créé pour « {meeting.title} ».
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmRegenerate(false)}
                className="border border-zinc-700 px-4 py-2 font-mono text-[11px] uppercase tracking-widest text-zinc-200 hover:bg-zinc-800"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleRegenerate()}
                className="inline-flex items-center gap-2 border border-emerald-500 bg-emerald-600 px-4 py-2 font-mono text-[11px] uppercase tracking-widest text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                {busy ? <Loader2 className="size-3.5 animate-spin" /> : null}
                Régénérer
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmDelete ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl">
            <h3 className="text-lg font-semibold text-white">Supprimer ?</h3>
            <p className="mt-2 text-sm text-zinc-300">
              Cette action est définitive. Le rendez-vous « {meeting.title} »
              sera supprimé.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="border border-zinc-700 px-4 py-2 font-mono text-[11px] uppercase tracking-widest text-zinc-200 hover:bg-zinc-800"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleDelete()}
                className={cn(
                  "inline-flex items-center gap-2 border border-red-700 bg-red-700/80 px-4 py-2 font-mono text-[11px] uppercase tracking-widest text-white hover:bg-red-600 disabled:opacity-50",
                )}
              >
                {busy ? <Loader2 className="size-3.5 animate-spin" /> : null}
                Supprimer
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
