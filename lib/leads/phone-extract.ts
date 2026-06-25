/** Extrait un numéro depuis le nom ClickUp (souvent "Client - … - 📞+212…"). */
export function extractPhoneFromLeadText(text: string): string | null {
  if (!text?.trim()) return null;

  const emojiMatch = text.match(/📞\s*([+]?\d[\d\s().-]{7,})/);
  if (emojiMatch) {
    const digits = emojiMatch[1].replace(/\D/g, "");
    if (digits.length >= 9) return normalizeLeadPhoneDigits(digits);
  }

  const intlMatch = text.match(/\+(\d[\d\s().-]{8,}\d)/);
  if (intlMatch) {
    const digits = intlMatch[0].replace(/\D/g, "");
    if (digits.length >= 9) return normalizeLeadPhoneDigits(digits);
  }

  const localMatch = text.match(/(?:^|[^0-9])(0[67]\d{8})(?:[^0-9]|$)/);
  if (localMatch) {
    return normalizeLeadPhoneDigits(`212${localMatch[1].slice(1)}`);
  }

  const embeddedMatch = text.match(/(?:^|[_\s-])(\d{10,12})(?:[^0-9]|$)/);
  if (embeddedMatch) {
    return normalizeLeadPhoneDigits(embeddedMatch[1]);
  }

  return null;
}

function normalizeLeadPhoneDigits(digits: string): string {
  let value = digits.replace(/\D/g, "");
  if (value.startsWith("00")) value = value.slice(2);
  if (value.length === 10 && value.startsWith("0")) {
    value = `212${value.slice(1)}`;
  }
  return value.length >= 9 ? value : digits;
}

/** Nom affichable sans téléphone ni emojis (ex. ClickUp task name). */
export function cleanLeadDisplayName(raw: string): string {
  if (!raw?.trim()) return "Sans nom";

  let name = raw.trim();

  name = name.replace(/\s*📞[\s\S]*$/u, "");
  name = name.replace(/\s*[-–—]\s*\+?\d[\d\s().-]{8,}\s*$/u, "");
  name = name.replace(/\s*\+\d[\d\s().-]{8,}(?:[-\s].*)?$/u, "");
  name = name.replace(/\s*[-–—_]\s*\d{10,12}(?:[^0-9]|$).*/u, "");
  name = name.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "");
  name = name.replace(/[\s\-–—_|]+$/g, "").trim();

  return name || "Sans nom";
}
