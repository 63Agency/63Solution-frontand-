import { casablancaDayKey } from "./meeting-datetime";
import type { BlockedDay } from "./types";

export const BLOCKED_DAY_REASON_PRESETS = [
  "Congé équipe",
  "Jour férié",
  "Formation",
  "Événement interne",
] as const;

export function blockedDayKeys(days: BlockedDay[]): Set<string> {
  return new Set(days.map((d) => d.date));
}

export function blockedDayMap(days: BlockedDay[]): Map<string, BlockedDay> {
  return new Map(days.map((d) => [d.date, d]));
}

export function isBlockedDay(
  date: Date | string,
  blocked: Set<string> | BlockedDay[] | Map<string, BlockedDay>,
): boolean {
  if (blocked instanceof Map) {
    return blocked.has(casablancaDayKey(date));
  }
  const set = blocked instanceof Set ? blocked : blockedDayKeys(blocked);
  return set.has(casablancaDayKey(date));
}

export function getBlockedDay(
  date: Date | string,
  days: BlockedDay[] | Map<string, BlockedDay>,
): BlockedDay | undefined {
  const map = days instanceof Map ? days : blockedDayMap(days);
  return map.get(casablancaDayKey(date));
}

export function formatBlockedDayLabel(dateKey: string): string {
  try {
    return new Date(`${dateKey}T12:00:00`).toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return dateKey;
  }
}

export function formatBlockedDayShort(dateKey: string): string {
  try {
    return new Date(`${dateKey}T12:00:00`).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
    });
  } catch {
    return dateKey;
  }
}

export function blockedDayToastMessage(
  date: Date | string,
  days: BlockedDay[],
): string {
  const blocked = getBlockedDay(date, days);
  if (blocked?.reason) {
    return `Indisponible — ${blocked.reason}`;
  }
  return "Cette date est bloquée par l'administrateur.";
}

export function partitionBlockedDays(days: BlockedDay[], todayKey?: string) {
  const today = todayKey ?? casablancaDayKey();
  const upcoming: BlockedDay[] = [];
  const past: BlockedDay[] = [];

  for (const day of days) {
    if (day.date >= today) upcoming.push(day);
    else past.push(day);
  }

  upcoming.sort((a, b) => a.date.localeCompare(b.date));
  past.sort((a, b) => b.date.localeCompare(a.date));

  return { upcoming, past };
}

/** Jours bloqués encore actifs (aujourd'hui et futur uniquement). */
export function filterUpcomingBlockedDays(
  days: BlockedDay[],
  todayKey?: string,
): BlockedDay[] {
  return partitionBlockedDays(days, todayKey).upcoming;
}

/** Bloqué et encore pertinent (pas une date passée). */
export function isActiveBlockedDay(
  date: Date | string,
  blocked: Set<string> | BlockedDay[] | Map<string, BlockedDay>,
  todayKey?: string,
): boolean {
  const today = todayKey ?? casablancaDayKey();
  const key = casablancaDayKey(date);
  if (key < today) return false;
  return isBlockedDay(key, blocked);
}
