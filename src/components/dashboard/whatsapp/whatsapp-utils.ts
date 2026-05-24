export function formatWhatsAppPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("212") && digits.length >= 12) {
    return `+${digits.slice(0, 3)} ${digits.slice(3, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 9)} ${digits.slice(9)}`;
  }
  if (digits.length >= 10) return `+${digits}`;
  return value || "—";
}

export function formatChatTime(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  if (sameDay) {
    return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
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
