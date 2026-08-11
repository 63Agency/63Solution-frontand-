import { canSeeAllMeetings, isFixedMeetingRole } from "../auth/roles";
import type { Meeting } from "./types";

/**
 * Filtre client des RDV selon le rôle.
 * - admin / admin_whatsapp → tous les RDV (legacy inclus)
 * - fixed_meeting → seulement si userId ∈ assignedUserIds (pas les legacy vides)
 */
export function filterMeetingsForViewer(
  meetings: Meeting[],
  role: string,
  userId: string | null | undefined,
): Meeting[] {
  if (canSeeAllMeetings(role)) return meetings;
  if (!isFixedMeetingRole(role) || !userId) return [];

  return meetings.filter((m) => {
    const ids =
      m.assignedUserIds?.length > 0
        ? m.assignedUserIds
        : (m.assignees ?? []).map((a) => a.userId);
    return ids.includes(userId);
  });
}
