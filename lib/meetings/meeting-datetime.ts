import { formatInTimeZone, toZonedTime } from "date-fns-tz";
import { fr } from "date-fns/locale";
import { addDays, format, parseISO } from "date-fns";

export const CASABLANCA_TZ = "Africa/Casablanca";

export function meetingDateObj(iso: string): Date {
  return parseISO(iso);
}

/** YYYY-MM-DD in Africa/Casablanca */
export function casablancaDayKey(date: Date | string = new Date()): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return formatInTimeZone(d, CASABLANCA_TZ, "yyyy-MM-dd");
}

export function casablancaTodayKey(): string {
  return casablancaDayKey(new Date());
}

export function casablancaTomorrowKey(): string {
  const tomorrow = addDays(toZonedTime(new Date(), CASABLANCA_TZ), 1);
  return format(tomorrow, "yyyy-MM-dd");
}

export function formatMeetingDate(iso: string, pattern = "dd MMM yyyy"): string {
  try {
    return formatInTimeZone(parseISO(iso), CASABLANCA_TZ, pattern, {
      locale: fr,
    });
  } catch {
    return iso;
  }
}

export function formatMeetingTime(iso: string): string {
  try {
    return formatInTimeZone(parseISO(iso), CASABLANCA_TZ, "HH:mm", {
      locale: fr,
    });
  } catch {
    return "";
  }
}

export function formatMeetingDateTime(iso: string): string {
  try {
    return formatInTimeZone(
      parseISO(iso),
      CASABLANCA_TZ,
      "dd MMM yyyy · HH:mm",
      { locale: fr },
    );
  } catch {
    return iso;
  }
}

/** Convert datetime-local value (local browser) to ISO for API. */
export function datetimeLocalToIso(value: string): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString();
}

/** ISO → value for <input type="datetime-local"> in Casablanca wall time. */
export function isoToDatetimeLocal(iso: string): string {
  try {
    return formatInTimeZone(parseISO(iso), CASABLANCA_TZ, "yyyy-MM-dd'T'HH:mm");
  } catch {
    return "";
  }
}

export function startOfMonthIso(date: Date): string {
  const z = toZonedTime(date, CASABLANCA_TZ);
  const y = z.getFullYear();
  const m = z.getMonth();
  return new Date(Date.UTC(y, m, 1, 0, 0, 0)).toISOString();
}

export function endOfMonthIso(date: Date): string {
  const z = toZonedTime(date, CASABLANCA_TZ);
  const y = z.getFullYear();
  const m = z.getMonth();
  return new Date(Date.UTC(y, m + 1, 0, 23, 59, 59, 999)).toISOString();
}

/** Broad range for calendar month navigation (pad ±7 days). */
export function calendarRangeIso(date: Date): { from: string; to: string } {
  const z = toZonedTime(date, CASABLANCA_TZ);
  const y = z.getFullYear();
  const m = z.getMonth();
  const from = new Date(Date.UTC(y, m, 1 - 7, 0, 0, 0));
  const to = new Date(Date.UTC(y, m + 1, 7, 23, 59, 59, 999));
  return { from: from.toISOString(), to: to.toISOString() };
}

export function formatMonthTitle(date: Date): string {
  return format(toZonedTime(date, CASABLANCA_TZ), "MMMM yyyy", { locale: fr });
}
