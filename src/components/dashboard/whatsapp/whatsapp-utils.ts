/** Normalise pour comparaison / envoi (chiffres uniquement, ex. 212612345678). */
export function normalizeWhatsAppPhoneDigits(value: string): string {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 10 && digits.startsWith("0")) {
    digits = `212${digits.slice(1)}`;
  }
  return digits;
}

/** Parse une liste (lignes, virgules, point-virgules). */
export function parsePhoneNumbersInput(raw: string): string[] {
  const parts = raw
    .split(/[\n,;]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of parts) {
    const digits = normalizeWhatsAppPhoneDigits(part);
    if (digits.length < 9) continue;
    if (seen.has(digits)) continue;
    seen.add(digits);
    out.push(digits);
  }
  return out;
}

export function formatWhatsAppPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("212") && digits.length >= 12) {
    const rest = digits.slice(3);
    return `+212 ${rest[0]} ${rest.slice(1, 3)} ${rest.slice(3, 5)} ${rest.slice(5, 7)} ${rest.slice(7, 9)}`;
  }
  if (digits.length >= 10) return `+${digits}`;
  return value || "—";
}

function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getDate() === b.getDate() &&
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear()
  );
}

export function formatChatTime(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

/** Timestamps style WhatsApp Web (liste de conversations). */
export function formatChatListTime(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  if (isSameCalendarDay(d, now)) {
    return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameCalendarDay(d, yesterday)) return "Hier";

  const startOfWeek = new Date(now);
  startOfWeek.setHours(0, 0, 0, 0);
  startOfWeek.setDate(now.getDate() - ((now.getDay() + 6) % 7)); // lundi
  if (d >= startOfWeek) {
    return d.toLocaleDateString("fr-FR", { weekday: "long" });
  }
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function conversationDisplayName(
  contactName?: string,
  phoneNumber?: string,
): string {
  const name = contactName?.trim();
  if (name) return name;
  return formatWhatsAppPhone(phoneNumber ?? "");
}

const AVATAR_PALETTES = [
  "from-emerald-600 to-teal-800",
  "from-cyan-600 to-blue-800",
  "from-violet-600 to-purple-800",
  "from-amber-600 to-orange-800",
  "from-rose-600 to-pink-800",
  "from-lime-600 to-green-800",
] as const;

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = value.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

export function avatarGradientClass(seed: string): (typeof AVATAR_PALETTES)[number] {
  return AVATAR_PALETTES[hashString(seed) % AVATAR_PALETTES.length];
}

export function formatMessageDayLabel(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  if (isSameCalendarDay(d, now)) return "Aujourd'hui";
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameCalendarDay(d, yesterday)) return "Hier";
  return d.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}
