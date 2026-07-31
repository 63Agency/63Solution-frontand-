import { casablancaDayKey } from "./meeting-datetime";
import type { Meeting } from "./types";

/** Nombre de RDV par jour (clé YYYY-MM-DD, fuseau Casablanca). */
export function countMeetingsByDate(meetings: Meeting[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const meeting of meetings) {
    const key = casablancaDayKey(meeting.meetingDate);
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return map;
}

export function getMeetingCountForDate(
  date: Date | string,
  counts: Map<string, number>,
): number {
  return counts.get(casablancaDayKey(date)) ?? 0;
}

export function getMeetingsForDate(
  meetings: Meeting[],
  date: Date | string,
): Meeting[] {
  const key = casablancaDayKey(date);
  return meetings
    .filter((m) => casablancaDayKey(m.meetingDate) === key)
    .sort(
      (a, b) =>
        new Date(a.meetingDate).getTime() - new Date(b.meetingDate).getTime(),
    );
}
