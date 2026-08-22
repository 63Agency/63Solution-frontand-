import type {
  CreateMeetingPayload,
  MeetingMember,
  UpdateMeetingPayload,
} from "./types";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value.trim());
}

/** Nest meetings : leadId = UUID interne leads.id (pas ClickUp task id). */
export function sanitizeLeadIdForApi(
  leadId: string | null | undefined,
): string | undefined {
  const trimmed = leadId?.trim();
  if (!trimmed || !isUuid(trimmed)) return undefined;
  return trimmed;
}

function sanitizeMemberForApi(member: MeetingMember): MeetingMember {
  const leadId = sanitizeLeadIdForApi(member.leadId ?? undefined);
  return {
    name: member.name.trim(),
    phone: member.phone?.trim() || null,
    email: member.email?.trim() || null,
    ...(leadId ? { leadId } : {}),
  };
}

/** Retire leadId invalides avant POST/PATCH (évite 400 « leadId invalide »). */
export function sanitizeCreateMeetingPayload(
  payload: CreateMeetingPayload,
): CreateMeetingPayload {
  const leadId = sanitizeLeadIdForApi(payload.leadId);
  const next: CreateMeetingPayload = { ...payload };
  if (leadId) next.leadId = leadId;
  else delete next.leadId;
  if (payload.members?.length) {
    next.members = payload.members.map(sanitizeMemberForApi);
  }
  return next;
}

export function sanitizeUpdateMeetingPayload(
  payload: UpdateMeetingPayload,
): UpdateMeetingPayload {
  const next: UpdateMeetingPayload = { ...payload };
  if ("leadId" in payload) {
    const leadId = sanitizeLeadIdForApi(payload.leadId ?? undefined);
    if (leadId) next.leadId = leadId;
    else next.leadId = null;
  }
  if (payload.members?.length) {
    next.members = payload.members.map(sanitizeMemberForApi);
  }
  return next;
}
