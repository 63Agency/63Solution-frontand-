export const MEETING_STATUSES = [
  "scheduled",
  "done",
  "cancelled",
  "no_show",
] as const;

export type MeetingStatus = (typeof MEETING_STATUSES)[number];

export type Meeting = {
  id: string;
  leadId: string | null;
  title: string;
  /** ISO timestamptz — API field `meetingDate` / DB `meeting_date`. */
  meetingDate: string;
  contactName: string;
  contactPhone: string | null;
  contactEmail: string | null;
  status: MeetingStatus;
  reminderWhatsappSent: boolean;
  reminderEmailSent: boolean;
  notes: string | null;
  meetLink: string | null;
  meetSpace: string | null;
  /** Minutes; API may omit — default 60 for calendar layout. */
  durationMinutes: number;
  createdAt: string;
  updatedAt: string;
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
  status?: MeetingStatus;
  notes?: string;
};

export type UpdateMeetingPayload = {
  leadId?: string | null;
  title?: string;
  meetingDate?: string;
  contactName?: string;
  contactPhone?: string | null;
  contactEmail?: string | null;
  status?: MeetingStatus;
  notes?: string | null;
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
    bg: "bg-emerald-500/15",
    text: "text-emerald-300",
    border: "border-emerald-500/30",
    calendar: "#10b981",
  },
  done: {
    bg: "bg-zinc-500/20",
    text: "text-zinc-300",
    border: "border-zinc-500/30",
    calendar: "#71717a",
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
