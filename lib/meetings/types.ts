export const MEETING_STATUSES = [
  "scheduled",
  "done",
  "cancelled",
  "no_show",
] as const;

export type MeetingStatus = (typeof MEETING_STATUSES)[number];

/** Offsets avant le rendez-vous : 2 jours, 24 heures, 2 heures. */
export const MEETING_REMINDER_OFFSETS = ["2d", "24h", "2h"] as const;
export type MeetingReminderOffset = (typeof MEETING_REMINDER_OFFSETS)[number];

export const MEETING_REMINDER_OFFSET_LABELS: Record<MeetingReminderOffset, string> = {
  "2d": "J-2 (2 jours)",
  "24h": "J-1 (24 h)",
  "2h": "H-2 (2 h)",
};

export const MEETING_REMINDER_OFFSET_SHORT: Record<MeetingReminderOffset, string> = {
  "2d": "J-2",
  "24h": "24 h",
  "2h": "2 h",
};

export type MeetingReminderChannelConfig = Record<MeetingReminderOffset, boolean>;

/** Préférences d’envoi automatique (configurables à la création / édition). */
export type MeetingRemindersConfig = {
  whatsapp: MeetingReminderChannelConfig;
  email: MeetingReminderChannelConfig;
};

export type MeetingReminderDeliveryStatus =
  | "pending"
  | "sent"
  | "skipped"
  | "failed";

export type MeetingReminderChannelStatus = Record<
  MeetingReminderOffset,
  MeetingReminderDeliveryStatus
>;

/** État d’envoi par canal / offset (renseigné par le backend). */
export type MeetingRemindersStatus = {
  whatsapp: MeetingReminderChannelStatus;
  email: MeetingReminderChannelStatus;
};

export function defaultRemindersConfig(
  hasPhone = true,
  hasEmail = true,
): MeetingRemindersConfig {
  return {
    whatsapp: { "2d": hasPhone, "24h": hasPhone, "2h": hasPhone },
    email: { "2d": hasEmail, "24h": hasEmail, "2h": hasEmail },
  };
}

export function emptyRemindersStatus(): MeetingRemindersStatus {
  return {
    whatsapp: { "2d": "pending", "24h": "pending", "2h": "pending" },
    email: { "2d": "pending", "24h": "pending", "2h": "pending" },
  };
}

export type Meeting = {
  id: string;
  leadId: string | null;
  title: string;
  /** ISO timestamptz — API field `meetingDate` / DB `meeting_date`. */
  meetingDate: string;
  contactName: string;
  contactPhone: string | null;
  contactEmail: string | null;
  /**
   * Autres personnes du côté client (owner, assistant…) qui participent au RDV.
   * Choisies depuis les leads — pas le staff interne 63Agency.
   * Reçoivent aussi les rappels WhatsApp / email.
   */
  members: MeetingMember[];
  status: MeetingStatus;
  /** Agrégat legacy — true si au moins un rappel WhatsApp a été envoyé. */
  reminderWhatsappSent: boolean;
  /** Agrégat legacy — true si au moins un rappel email a été envoyé. */
  reminderEmailSent: boolean;
  /** Canaux / offsets activés pour les rappels automatiques. */
  reminders: MeetingRemindersConfig;
  /** Statut d’envoi détaillé (si fourni par l’API). */
  remindersStatus: MeetingRemindersStatus;
  notes: string | null;
  meetLink: string | null;
  meetSpace: string | null;
  /** Minutes; API may omit — default 60 for calendar layout. */
  durationMinutes: number;
  createdAt: string;
  updatedAt: string;
};

/** Autre participant côté client (hors contact principal). */
export type MeetingMember = {
  /** Id lead ClickUp si choisi depuis la liste des leads. */
  leadId?: string | null;
  /** @deprecated Ancien champ staff interne — ignoré côté front. */
  userId?: string | null;
  name: string;
  phone?: string | null;
  email?: string | null;
};

export type MeetingStats = {
  today: number;
  thisWeek: number;
  /** Scheduled / upcoming (API `pending`). */
  upcoming: number;
  /** API may expose `total`; falls back to upcoming + noShow when absent. */
  total: number;
  noShow: number;
};

export type CreateMeetingPayload = {
  leadId?: string;
  title: string;
  meetingDate: string;
  contactName: string;
  contactPhone?: string;
  contactEmail?: string;
  /** Autres participants côté client (leads) — rappels fan-out. */
  members?: MeetingMember[];
  status?: MeetingStatus;
  notes?: string;
  reminders?: MeetingRemindersConfig;
  /**
   * true = à la création, envoyer immédiatement une notification / rappel
   * au contact (+ members) via WhatsApp / email.
   */
  notifyOnCreate?: boolean;
};

export type UpdateMeetingPayload = {
  leadId?: string | null;
  title?: string;
  meetingDate?: string;
  contactName?: string;
  contactPhone?: string | null;
  contactEmail?: string | null;
  members?: MeetingMember[];
  status?: MeetingStatus;
  notes?: string | null;
  reminders?: MeetingRemindersConfig;
};

export type ListMeetingsQuery = {
  from?: string;
  to?: string;
  status?: MeetingStatus;
};

export const MEETING_STATUS_LABELS: Record<MeetingStatus, string> = {
  scheduled: "Planifié",
  done: "Fait",
  cancelled: "Annulé",
  no_show: "No-show",
};

export const MEETING_STATUS_COLORS: Record<
  MeetingStatus,
  { bg: string; text: string; border: string; calendar: string }
> = {
  scheduled: {
    bg: "bg-sky-500/15",
    text: "text-sky-300",
    border: "border-sky-500/30",
    calendar: "#0ea5e9",
  },
  done: {
    bg: "bg-emerald-500/20",
    text: "text-emerald-300",
    border: "border-emerald-500/40",
    calendar: "#10b981",
  },
  cancelled: {
    bg: "bg-red-500/15",
    text: "text-red-300",
    border: "border-red-500/30",
    calendar: "#ef4444",
  },
  no_show: {
    bg: "bg-amber-500/15",
    text: "text-amber-300",
    border: "border-amber-500/30",
    calendar: "#f59e0b",
  },
};

export const DEFAULT_MEETING_DURATION_MINUTES = 60;

export const MEETING_DURATION_OPTIONS = [15, 30, 45, 60, 90, 120] as const;

/** Jour bloqué — aucun RDV ne peut être planifié (timezone Casablanca, clé `date`). */
export type BlockedDay = {
  id: string;
  /** YYYY-MM-DD (Africa/Casablanca). */
  date: string;
  reason: string | null;
  createdAt: string;
  createdBy: string | null;
};

export type CreateBlockedDayPayload = {
  date: string;
  reason?: string;
};

export type ListBlockedDaysQuery = {
  from?: string;
  to?: string;
};
