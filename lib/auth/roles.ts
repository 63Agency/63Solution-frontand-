/** Slugs rôles alignés avec le backend Nest (évolution en cours). */
export const ROLE_FULL_ADMIN = "admin";
export const ROLE_ADMIN_WHATSAPP = "admin_whatsapp";

export type AppRole = typeof ROLE_FULL_ADMIN | typeof ROLE_ADMIN_WHATSAPP | string;

function normalizeRole(role: string): string {
  return role.toLowerCase().trim().replace(/[\s-]+/g, "_");
}

export function isFullAdminRole(role: string): boolean {
  const r = normalizeRole(role);
  return r === "admin" || r === "superadmin" || r === "super_admin";
}

export function isAdminWhatsAppRole(role: string): boolean {
  const r = normalizeRole(role);
  return r === "admin_whatsapp" || r === "adminwhatsapp";
}

/** Accès dashboard complet + gestion des utilisateurs. */
export function canManageTeamUsers(role: string): boolean {
  return isFullAdminRole(role);
}

/** Onglet / section Utilisateurs dans Paramètres. */
export function canViewTeamUsersSection(role: string): boolean {
  return canManageTeamUsers(role);
}

export function canAccessParametres(role: string): boolean {
  return isFullAdminRole(role) || isAdminWhatsAppRole(role);
}

const FULL_ADMIN_NAV = [
  "/dashboard",
  "/dashboard/factures",
  "/dashboard/clients",
  "/dashboard/leads",
  "/dashboard/calendrier",
  "/dashboard/conversations",
] as const;

const ADMIN_WHATSAPP_NAV = ["/dashboard/conversations"] as const;

export function getAllowedDashboardHrefs(role: string): readonly string[] {
  if (isFullAdminRole(role)) return FULL_ADMIN_NAV;
  if (isAdminWhatsAppRole(role)) return ADMIN_WHATSAPP_NAV;
  return FULL_ADMIN_NAV;
}

export function canAccessDashboardHref(href: string, role: string): boolean {
  if (href === "/dashboard/parametres" || href.startsWith("/dashboard/parametres/")) {
    return canAccessParametres(role);
  }
  const allowed = getAllowedDashboardHrefs(role);
  return allowed.some(
    (base) => href === base || href.startsWith(`${base}/`),
  );
}

export function getDefaultDashboardRoute(role: string): string {
  if (isAdminWhatsAppRole(role)) return "/dashboard/conversations";
  if (isFullAdminRole(role)) return "/dashboard";
  return "/home";
}

export function roleDisplayLabel(role: string): string {
  if (isFullAdminRole(role)) return "Administrateur";
  if (isAdminWhatsAppRole(role)) return "Admin WhatsApp";
  return "Admin WhatsApp";
}

/** Liste équipe : masquer le compte connecté et les comptes admin (non supprimables). */
export function shouldShowTeamUserInList(
  user: { id: string; role: string },
  currentUserId: string,
): boolean {
  if (user.id === currentUserId) return false;
  if (isFullAdminRole(user.role)) return false;
  return true;
}

/** @deprecated Préférer canManageTeamUsers */
export function isAdminRole(role: string): boolean {
  return canManageTeamUsers(role);
}
