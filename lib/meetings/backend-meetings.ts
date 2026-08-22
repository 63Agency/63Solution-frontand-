import { getApiBaseUrl, getStoredAccessToken } from "../auth/backend-login";
import type {
  BlockedDay,
  CreateBlockedDayPayload,
  CreateMeetingPayload,
  ListBlockedDaysQuery,
  ListMeetingsQuery,
  Meeting,
  MeetingAssignee,
  MeetingMember,
  MeetingReminderChannelConfig,
  MeetingReminderChannelStatus,
  MeetingReminderDeliveryStatus,
  MeetingRemindersConfig,
  MeetingRemindersStatus,
  MeetingStats,
  MeetingStatus,
  UpdateMeetingPayload,
} from "./types";
import {
  DEFAULT_MEETING_DURATION_MINUTES,
  defaultRemindersConfig,
  emptyRemindersStatus,
  MEETING_REMINDER_OFFSETS,
  MEETING_STATUSES,
} from "./types";
import {
  sanitizeCreateMeetingPayload,
  sanitizeUpdateMeetingPayload,
} from "./meeting-payload";

function buildAuthHeaders(): Record<string, string> {
  const token = getStoredAccessToken();
  if (!token) throw new Error("Session expirée. Reconnecte-toi.");
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

async function parseApiError(res: Response, context: string): Promise<never> {
  const raw = await res.text().catch(() => "");
  let message = raw || `Erreur ${res.status}`;
  try {
    const parsed = JSON.parse(raw) as { message?: string | string[] };
    if (typeof parsed.message === "string") message = parsed.message;
    else if (Array.isArray(parsed.message) && parsed.message.length > 0) {
      message = parsed.message.join(", ");
    }
  } catch {
    /* ignore */
  }
  throw new Error(message || `${context} (${res.status})`);
}

function isMeetingStatus(value: unknown): value is MeetingStatus {
  return (
    typeof value === "string" &&
    (MEETING_STATUSES as readonly string[]).includes(value)
  );
}

function parseChannelConfig(
  raw: unknown,
  fallbackEnabled: boolean,
): MeetingReminderChannelConfig {
  const base: MeetingReminderChannelConfig = {
    "2d": fallbackEnabled,
    "24h": fallbackEnabled,
    "2h": fallbackEnabled,
  };
  if (!raw || typeof raw !== "object") return base;
  const row = raw as Record<string, unknown>;
  for (const offset of MEETING_REMINDER_OFFSETS) {
    if (typeof row[offset] === "boolean") {
      base[offset] = row[offset];
      continue;
    }
    const alt =
      offset === "2d" ? "enabled2d" : offset === "24h" ? "enabled24h" : "enabled2h";
    if (typeof row[alt] === "boolean") base[offset] = row[alt];
  }
  return base;
}

function parseDeliveryStatus(value: unknown): MeetingReminderDeliveryStatus | null {
  if (typeof value !== "string") return null;
  const v = value.toLowerCase().trim();
  if (v === "pending" || v === "sent" || v === "skipped" || v === "failed") {
    return v;
  }
  return null;
}

function parseChannelStatus(
  raw: unknown,
  fallbackSent: boolean,
): MeetingReminderChannelStatus {
  const base: MeetingReminderChannelStatus = {
    "2d": fallbackSent ? "sent" : "pending",
    "24h": fallbackSent ? "sent" : "pending",
    "2h": fallbackSent ? "sent" : "pending",
  };
  if (!raw || typeof raw !== "object") return base;
  const row = raw as Record<string, unknown>;
  for (const offset of MEETING_REMINDER_OFFSETS) {
    const status = parseDeliveryStatus(row[offset]);
    if (status) {
      base[offset] = status;
      continue;
    }
    if (typeof row[offset] === "boolean") {
      base[offset] = row[offset] ? "sent" : "pending";
    }
  }
  return base;
}

function parseRemindersConfig(
  r: Record<string, unknown>,
  hasPhone: boolean,
  hasEmail: boolean,
): MeetingRemindersConfig {
  const nested = (r.reminders ?? r.reminderSettings ?? r.reminder_settings) as
    | Record<string, unknown>
    | undefined;
  if (nested && typeof nested === "object") {
    return {
      whatsapp: parseChannelConfig(nested.whatsapp, hasPhone),
      email: parseChannelConfig(nested.email, hasEmail),
    };
  }
  return defaultRemindersConfig(hasPhone, hasEmail);
}

function parseRemindersStatus(
  r: Record<string, unknown>,
  _waSent: boolean,
  _emailSent: boolean,
): MeetingRemindersStatus {
  const nested = (r.remindersStatus ??
    r.reminderStatus ??
    r.reminders_status ??
    r.reminder_status) as Record<string, unknown> | undefined;
  if (nested && typeof nested === "object") {
    return {
      // Ne pas dériver depuis reminderWhatsappSent / reminderEmailSent :
      // ces flags peuvent venir d’un envoi manuel et ne doivent pas
      // marquer J-2 / 24h / 2h comme « envoyé ».
      whatsapp: parseChannelStatus(nested.whatsapp, false),
      email: parseChannelStatus(nested.email, false),
    };
  }
  return emptyRemindersStatus();
}

function parseMeetingMember(row: unknown): MeetingMember | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const name = String(
    r.name ?? r.contactName ?? r.fullName ?? `${r.prenom ?? ""} ${r.nom ?? ""}`,
  ).trim();
  if (!name) return null;
  const phoneRaw = r.phone ?? r.telephone ?? r.contactPhone;
  const emailRaw = r.email ?? r.contactEmail;
  const leadIdRaw = r.leadId ?? r.lead_id;
  const userIdRaw = r.userId ?? r.user_id;
  return {
    leadId:
      leadIdRaw == null || leadIdRaw === ""
        ? null
        : String(leadIdRaw),
    userId:
      userIdRaw == null || userIdRaw === ""
        ? null
        : String(userIdRaw),
    name,
    phone:
      phoneRaw == null || phoneRaw === ""
        ? null
        : String(phoneRaw).trim(),
    email:
      emailRaw == null || emailRaw === ""
        ? null
        : String(emailRaw).trim(),
  };
}

function parseMeetingMembers(raw: unknown): MeetingMember[] {
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as { items?: unknown[] }).items)
      ? (raw as { items: unknown[] }).items
      : [];
  return list
    .map((row) => parseMeetingMember(row))
    .filter((m): m is MeetingMember => m != null);
}

function parseMeetingAssignee(row: unknown): MeetingAssignee | null {
  if (typeof row === "string" && row.trim()) {
    return { userId: row.trim() };
  }
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const userId = String(r.userId ?? r.user_id ?? r.id ?? "").trim();
  if (!userId) return null;
  return {
    userId,
    prenom:
      r.prenom == null && r.firstName == null
        ? null
        : String(r.prenom ?? r.firstName).trim() || null,
    nom:
      r.nom == null && r.lastName == null
        ? null
        : String(r.nom ?? r.lastName).trim() || null,
    email: r.email == null ? null : String(r.email).trim() || null,
    role: r.role == null ? null : String(r.role).trim() || null,
  };
}

function parseMeetingAssignees(raw: unknown): MeetingAssignee[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: MeetingAssignee[] = [];
  for (const row of raw) {
    const parsed = parseMeetingAssignee(row);
    if (!parsed || seen.has(parsed.userId)) continue;
    seen.add(parsed.userId);
    out.push(parsed);
  }
  return out;
}

function parseAssignedUserIds(
  rawIds: unknown,
  assignees: MeetingAssignee[],
): string[] {
  const fromIds = Array.isArray(rawIds)
    ? rawIds
        .map((id) => String(id ?? "").trim())
        .filter((id) => id.length > 0)
    : [];
  if (fromIds.length > 0) return [...new Set(fromIds)];
  return assignees.map((a) => a.userId);
}

function parseMeeting(row: unknown): Meeting | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const id = String(r.id ?? "");
  const title = String(r.title ?? "").trim();
  const meetingDate = String(r.meetingDate ?? r.meeting_date ?? "");
  const contactName = String(r.contactName ?? r.contact_name ?? "").trim();
  if (!id || !title || !meetingDate || !contactName) return null;

  const statusRaw = r.status;
  const status: MeetingStatus = isMeetingStatus(statusRaw)
    ? statusRaw
    : "scheduled";

  const durationRaw = r.durationMinutes ?? r.duration_minutes;
  const durationParsed =
    typeof durationRaw === "number"
      ? durationRaw
      : Number.parseInt(String(durationRaw ?? ""), 10);
  const durationMinutes =
    Number.isFinite(durationParsed) && durationParsed > 0
      ? durationParsed
      : DEFAULT_MEETING_DURATION_MINUTES;

  const meetLinkRaw = r.meetLink ?? r.meet_link;
  const meetSpaceRaw = r.meetSpace ?? r.meet_space;

  const contactPhone =
    r.contactPhone == null && r.contact_phone == null
      ? null
      : String(r.contactPhone ?? r.contact_phone);
  const contactEmail =
    r.contactEmail == null && r.contact_email == null
      ? null
      : String(r.contactEmail ?? r.contact_email);

  const reminderWhatsappSent = Boolean(
    r.reminderWhatsappSent ?? r.reminder_whatsapp_sent,
  );
  const reminderEmailSent = Boolean(r.reminderEmailSent ?? r.reminder_email_sent);

  const members = parseMeetingMembers(
    r.members ?? r.attendees ?? r.teamMembers ?? r.team_members,
  );

  const assignees = parseMeetingAssignees(
    r.assignees ?? r.assignedUsers ?? r.assigned_users,
  );
  const assignedUserIds = parseAssignedUserIds(
    r.assignedUserIds ?? r.assigned_user_ids,
    assignees,
  );
  const assigneesResolved =
    assignees.length > 0
      ? assignees
      : assignedUserIds.map((userId) => ({ userId }));

  return {
    id,
    leadId:
      r.leadId == null && r.lead_id == null
        ? null
        : String(r.leadId ?? r.lead_id),
    title,
    meetingDate,
    contactName,
    contactPhone,
    contactEmail,
    members,
    assignees: assigneesResolved,
    assignedUserIds:
      assignedUserIds.length > 0
        ? assignedUserIds
        : assigneesResolved.map((a) => a.userId),
    status,
    reminderWhatsappSent,
    reminderEmailSent,
    reminders: parseRemindersConfig(
      r,
      Boolean(contactPhone?.trim()),
      Boolean(contactEmail?.trim()),
    ),
    remindersStatus: parseRemindersStatus(r, reminderWhatsappSent, reminderEmailSent),
    notes: r.notes == null || r.notes === "" ? null : String(r.notes),
    meetLink:
      meetLinkRaw == null || meetLinkRaw === ""
        ? null
        : String(meetLinkRaw).trim(),
    meetSpace:
      meetSpaceRaw == null || meetSpaceRaw === ""
        ? null
        : String(meetSpaceRaw).trim(),
    durationMinutes,
    createdAt: String(r.createdAt ?? r.created_at ?? ""),
    updatedAt: String(r.updatedAt ?? r.updated_at ?? ""),
  };
}

function parseMeetingList(raw: unknown): Meeting[] {
  if (Array.isArray(raw)) {
    return raw.map(parseMeeting).filter((m): m is Meeting => m != null);
  }
  if (raw && typeof raw === "object") {
    const items = (raw as { items?: unknown }).items;
    if (Array.isArray(items)) {
      return items.map(parseMeeting).filter((m): m is Meeting => m != null);
    }
  }
  return [];
}

function requireApiBase(): string {
  const base = getApiBaseUrl();
  if (!base) throw new Error("NEXT_PUBLIC_API_URL manquante.");
  return base;
}

export async function fetchMeetings(
  query: ListMeetingsQuery = {},
): Promise<Meeting[]> {
  const base = requireApiBase();
  const params = new URLSearchParams();
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  if (query.status) params.set("status", query.status);

  const qs = params.toString();
  const res = await fetch(`${base}/meetings${qs ? `?${qs}` : ""}`, {
    method: "GET",
    headers: buildAuthHeaders(),
    credentials: "include",
    cache: "no-store",
  });

  if (!res.ok) return parseApiError(res, "GET /meetings");
  const raw = await res.json().catch(() => null);
  return parseMeetingList(raw);
}

export async function fetchUpcomingMeetings(): Promise<Meeting[]> {
  const base = requireApiBase();
  const res = await fetch(`${base}/meetings/upcoming`, {
    method: "GET",
    headers: buildAuthHeaders(),
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) return parseApiError(res, "GET /meetings/upcoming");
  const raw = await res.json().catch(() => null);
  return parseMeetingList(raw);
}

export async function fetchTodayMeetings(): Promise<Meeting[]> {
  const base = requireApiBase();
  const res = await fetch(`${base}/meetings/today`, {
    method: "GET",
    headers: buildAuthHeaders(),
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) return parseApiError(res, "GET /meetings/today");
  const raw = await res.json().catch(() => null);
  return parseMeetingList(raw);
}

export async function fetchMeetingStats(): Promise<MeetingStats> {
  const base = requireApiBase();
  const res = await fetch(`${base}/meetings/stats`, {
    method: "GET",
    headers: buildAuthHeaders(),
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) return parseApiError(res, "GET /meetings/stats");

  const raw = (await res.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!raw || typeof raw !== "object") {
    throw new Error("Réponse stats rendez-vous invalide.");
  }

  const today = typeof raw.today === "number" ? raw.today : 0;
  const thisWeek =
    typeof raw.thisWeek === "number"
      ? raw.thisWeek
      : typeof raw.this_week === "number"
        ? raw.this_week
        : 0;
  const upcoming =
    typeof raw.upcoming === "number"
      ? raw.upcoming
      : typeof raw.pending === "number"
        ? raw.pending
        : 0;
  const noShow =
    typeof raw.noShow === "number"
      ? raw.noShow
      : typeof raw.no_show === "number"
        ? raw.no_show
        : 0;
  const total =
    typeof raw.total === "number"
      ? raw.total
      : upcoming + noShow;

  return { today, thisWeek, upcoming, total, noShow };
}

export async function createMeeting(
  payload: CreateMeetingPayload,
): Promise<Meeting> {
  const base = requireApiBase();
  const body = sanitizeCreateMeetingPayload(payload);
  const res = await fetch(`${base}/meetings`, {
    method: "POST",
    headers: buildAuthHeaders(),
    credentials: "include",
    body: JSON.stringify(body),
  });
  if (!res.ok) return parseApiError(res, "POST /meetings");
  const meeting = parseMeeting(await res.json().catch(() => null));
  if (!meeting) throw new Error("Réponse création rendez-vous invalide.");
  return meeting;
}

export async function updateMeeting(
  id: string,
  payload: UpdateMeetingPayload,
): Promise<Meeting> {
  const base = requireApiBase();
  const body = sanitizeUpdateMeetingPayload(payload);
  const res = await fetch(`${base}/meetings/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: buildAuthHeaders(),
    credentials: "include",
    body: JSON.stringify(body),
  });
  if (!res.ok) return parseApiError(res, `PATCH /meetings/${id}`);
  const meeting = parseMeeting(await res.json().catch(() => null));
  if (!meeting) throw new Error("Réponse mise à jour rendez-vous invalide.");
  return meeting;
}

export async function deleteMeeting(id: string): Promise<void> {
  const base = requireApiBase();
  const res = await fetch(`${base}/meetings/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: buildAuthHeaders(),
    credentials: "include",
  });
  if (!res.ok) return parseApiError(res, `DELETE /meetings/${id}`);
}

export type SendMeetingReminderResult = {
  ok: boolean;
  whatsappSent: boolean;
  emailSent: boolean;
  whatsappError?: string | null;
  emailError?: string | null;
  raw?: unknown;
};

function parseSendReminderResult(raw: unknown): SendMeetingReminderResult {
  if (!raw || typeof raw !== "object") {
    return { ok: true, whatsappSent: false, emailSent: false, raw };
  }
  const r = raw as Record<string, unknown>;
  const nested =
    r.notificationSent && typeof r.notificationSent === "object"
      ? (r.notificationSent as Record<string, unknown>)
      : r.result && typeof r.result === "object"
        ? (r.result as Record<string, unknown>)
        : r;

  const whatsappSent = Boolean(
    nested.whatsapp === true ||
      nested.whatsappSent === true ||
      nested.whatsapp_sent === true ||
      r.reminderWhatsappSent === true ||
      r.whatsappSent === true,
  );
  const emailSent = Boolean(
    nested.email === true ||
      nested.emailSent === true ||
      nested.email_sent === true ||
      r.reminderEmailSent === true ||
      r.emailSent === true,
  );

  const whatsappError =
    typeof nested.whatsappError === "string"
      ? nested.whatsappError
      : typeof nested.whatsapp_error === "string"
        ? nested.whatsapp_error
        : typeof r.whatsappError === "string"
          ? r.whatsappError
          : null;
  const emailError =
    typeof nested.emailError === "string"
      ? nested.emailError
      : typeof nested.email_error === "string"
        ? nested.email_error
        : typeof r.emailError === "string"
          ? r.emailError
          : null;

  // If backend returns explicit channel flags, trust them.
  // If body is empty/{ok:true} without channel info, treat as unknown success (legacy).
  const hasChannelInfo =
    "whatsapp" in nested ||
    "whatsappSent" in nested ||
    "whatsapp_sent" in nested ||
    "email" in nested ||
    "emailSent" in nested ||
    "email_sent" in nested ||
    "reminderWhatsappSent" in r ||
    "reminderEmailSent" in r ||
    Boolean(whatsappError) ||
    Boolean(emailError);

  if (!hasChannelInfo) {
    return {
      ok: r.ok !== false,
      whatsappSent: false,
      emailSent: false,
      whatsappError: null,
      emailError: null,
      raw,
    };
  }

  return {
    ok: whatsappSent || emailSent,
    whatsappSent,
    emailSent,
    whatsappError,
    emailError,
    raw,
  };
}

export async function sendMeetingReminder(
  id: string,
  options: { force?: boolean } = {},
): Promise<SendMeetingReminderResult> {
  const base = requireApiBase();
  const body: Record<string, boolean> = {};
  if (options.force === true) body.force = true;

  const res = await fetch(
    `${base}/meetings/${encodeURIComponent(id)}/send-reminder`,
    {
      method: "POST",
      headers: buildAuthHeaders(),
      credentials: "include",
      body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined,
    },
  );
  if (!res.ok) return parseApiError(res, `POST /meetings/${id}/send-reminder`);
  const raw = await res.json().catch(() => ({ ok: true }));
  return parseSendReminderResult(raw);
}

export async function regenerateMeetingMeetLink(id: string): Promise<Meeting> {
  const base = requireApiBase();
  const res = await fetch(
    `${base}/meetings/${encodeURIComponent(id)}/regenerate-meet`,
    {
      method: "POST",
      headers: buildAuthHeaders(),
      credentials: "include",
    },
  );
  if (!res.ok) {
    return parseApiError(res, `POST /meetings/${id}/regenerate-meet`);
  }
  const meeting = parseMeeting(await res.json().catch(() => null));
  if (!meeting) throw new Error("Réponse régénération Meet invalide.");
  return meeting;
}

function parseBlockedDay(row: unknown): BlockedDay | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const id = String(r.id ?? "");
  const date = String(r.date ?? r.blockedDate ?? r.blocked_date ?? "").trim();
  if (!id || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;

  const reasonRaw = r.reason ?? r.note ?? r.notes;
  const createdByRaw = r.createdBy ?? r.created_by;

  return {
    id,
    date,
    reason:
      reasonRaw == null || reasonRaw === "" ? null : String(reasonRaw).trim(),
    createdAt: String(r.createdAt ?? r.created_at ?? ""),
    createdBy:
      createdByRaw == null || createdByRaw === ""
        ? null
        : String(createdByRaw),
  };
}

function parseBlockedDayList(raw: unknown): BlockedDay[] {
  if (Array.isArray(raw)) {
    return raw.map(parseBlockedDay).filter((d): d is BlockedDay => d != null);
  }
  if (raw && typeof raw === "object") {
    const items = (raw as { items?: unknown }).items;
    if (Array.isArray(items)) {
      return items
        .map(parseBlockedDay)
        .filter((d): d is BlockedDay => d != null);
    }
  }
  return [];
}

export async function fetchBlockedDays(
  query: ListBlockedDaysQuery = {},
): Promise<BlockedDay[]> {
  const base = requireApiBase();
  const params = new URLSearchParams();
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);

  const qs = params.toString();
  const res = await fetch(
    `${base}/meetings/blocked-days${qs ? `?${qs}` : ""}`,
    {
      method: "GET",
      headers: buildAuthHeaders(),
      credentials: "include",
      cache: "no-store",
    },
  );

  if (!res.ok) return parseApiError(res, "GET /meetings/blocked-days");
  const raw = await res.json().catch(() => null);
  return parseBlockedDayList(raw);
}

export async function createBlockedDay(
  payload: CreateBlockedDayPayload,
): Promise<BlockedDay> {
  const base = requireApiBase();
  const res = await fetch(`${base}/meetings/blocked-days`, {
    method: "POST",
    headers: buildAuthHeaders(),
    credentials: "include",
    body: JSON.stringify(payload),
  });
  if (!res.ok) return parseApiError(res, "POST /meetings/blocked-days");
  const day = parseBlockedDay(await res.json().catch(() => null));
  if (!day) throw new Error("Réponse jour bloqué invalide.");
  return day;
}

export async function deleteBlockedDay(id: string): Promise<void> {
  const base = requireApiBase();
  const res = await fetch(
    `${base}/meetings/blocked-days/${encodeURIComponent(id)}`,
    {
      method: "DELETE",
      headers: buildAuthHeaders(),
      credentials: "include",
    },
  );
  if (!res.ok) return parseApiError(res, `DELETE /meetings/blocked-days/${id}`);
}
