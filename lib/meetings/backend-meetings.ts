import { getApiBaseUrl, getStoredAccessToken } from "../auth/backend-login";
import type {
  CreateMeetingPayload,
  ListMeetingsQuery,
  Meeting,
  MeetingStats,
  MeetingStatus,
  UpdateMeetingPayload,
} from "./types";
import { MEETING_STATUSES } from "./types";

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

  return {
    id,
    leadId:
      r.leadId == null && r.lead_id == null
        ? null
        : String(r.leadId ?? r.lead_id),
    title,
    meetingDate,
    contactName,
    contactPhone:
      r.contactPhone == null && r.contact_phone == null
        ? null
        : String(r.contactPhone ?? r.contact_phone),
    contactEmail:
      r.contactEmail == null && r.contact_email == null
        ? null
        : String(r.contactEmail ?? r.contact_email),
    status,
    reminderWhatsappSent: Boolean(
      r.reminderWhatsappSent ?? r.reminder_whatsapp_sent,
    ),
    reminderEmailSent: Boolean(r.reminderEmailSent ?? r.reminder_email_sent),
    notes:
      r.notes == null || r.notes === ""
        ? null
        : String(r.notes),
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

  return {
    today: typeof raw.today === "number" ? raw.today : 0,
    thisWeek: typeof raw.thisWeek === "number" ? raw.thisWeek : 0,
    pending: typeof raw.pending === "number" ? raw.pending : 0,
    noShow: typeof raw.noShow === "number" ? raw.noShow : 0,
  };
}

export async function createMeeting(
  payload: CreateMeetingPayload,
): Promise<Meeting> {
  const base = requireApiBase();
  const res = await fetch(`${base}/meetings`, {
    method: "POST",
    headers: buildAuthHeaders(),
    credentials: "include",
    body: JSON.stringify(payload),
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
  const res = await fetch(`${base}/meetings/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: buildAuthHeaders(),
    credentials: "include",
    body: JSON.stringify(payload),
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

export async function sendMeetingReminder(id: string): Promise<unknown> {
  const base = requireApiBase();
  const res = await fetch(
    `${base}/meetings/${encodeURIComponent(id)}/send-reminder`,
    {
      method: "POST",
      headers: buildAuthHeaders(),
      credentials: "include",
    },
  );
  if (!res.ok) return parseApiError(res, `POST /meetings/${id}/send-reminder`);
  return res.json().catch(() => ({ ok: true }));
}
