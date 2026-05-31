export function profileInitials(prenom: string, nom: string, email: string): string {
  const a = prenom.trim()[0] ?? "";
  const b = nom.trim()[0] ?? "";
  if (a || b) return `${a}${b}`.toUpperCase();
  return (email[0] ?? "?").toUpperCase();
}

import { roleDisplayLabel } from "@/lib/auth/roles";

export function roleLabel(role: string): string {
  return roleDisplayLabel(role);
}

export function fullName(prenom: string, nom: string): string {
  return [prenom.trim(), nom.trim()].filter(Boolean).join(" ") || "—";
}
