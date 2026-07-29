/** Slugs rôles alignés avec le backend Nest (évolution en cours). */
export const ROLE_FULL_ADMIN = "admin";
export const ROLE_ADMIN_WHATSAPP = "admin_whatsapp";

export type AppRole = typeof ROLE_FULL_ADMIN | typeof ROLE_ADMIN_WHATSAPP | string;

export type LeadsPermission = "list" | "detail" | "sync" | "meta" | "stats";

export const ALL_LEADS_PERMISSIONS: readonly LeadsPermission[] = [
  "list",
  "detail",
  "sync",
  "meta",
  "stats",
];

export type UserPermissions = {
  pages: string[];
  leadsPermissions?: LeadsPermission[];
};

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
  return isFullAdminRole(role);
}

const FULL_ADMIN_NAV = [
  "/dashboard",
  "/dashboard/factures",
  "/dashboard/clients",
  "/dashboard/leads",
  "/dashboard/calendrier",
  "/dashboard/conversations",
] as const;

const ADMIN_WHATSAPP_NAV = [
  "/dashboard/conversations",
  "/dashboard/leads",
  "/dashboard/calendrier",
] as const;

export function getAllowedDashboardHrefs(role: string): readonly string[] {
  if (isFullAdminRole(role)) return FULL_ADMIN_NAV;
  if (isAdminWhatsAppRole(role)) return ADMIN_WHATSAPP_NAV;
  return FULL_ADMIN_NAV;
}

export function resolveAllowedPages(
  role: string,
  permissions?: UserPermissions | null,
): readonly string[] {
  const pages = permissions?.pages?.filter((page) => page.startsWith("/")) ?? [];
  if (pages.length > 0) {
    // Admin WhatsApp : toujours autoriser le calendrier (même si absent de permissions.pages).
    if (
      isAdminWhatsAppRole(role) &&
      !pages.some(
        (page) =>
          page === "/dashboard/calendrier" ||
          page.startsWith("/dashboard/calendrier/"),
      )
    ) {
      return [...pages, "/dashboard/calendrier"];
    }
    return pages;
  }
  return getAllowedDashboardHrefs(role);
}

function hrefMatchesAllowed(href: string, allowed: readonly string[]): boolean {
  return allowed.some((base) => href === base || href.startsWith(`${base}/`));
}

export function canAccessDashboardHref(
  href: string,
  role: string,
  allowedPages?: readonly string[],
): boolean {
  const allowed = allowedPages ?? resolveAllowedPages(role);

  if (href === "/dashboard/parametres" || href.startsWith("/dashboard/parametres/")) {
    return canAccessParametres(role) && hrefMatchesAllowed(href, allowed);
  }

  return hrefMatchesAllowed(href, allowed);
}

export function getDefaultDashboardRoute(
  role: string,
  allowedPages?: readonly string[],
): string {
  const allowed = allowedPages ?? resolveAllowedPages(role);
  if (allowed.length > 0) {
    const conversations = allowed.find((page) =>
      page.startsWith("/dashboard/conversations"),
    );
    if (conversations) return conversations;
    return allowed[0];
  }
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

function parseLeadsPermission(value: unknown): LeadsPermission | null {
  if (typeof value !== "string") return null;
  const normalized = value.toLowerCase().trim();
  if (
    normalized === "list" ||
    normalized === "detail" ||
    normalized === "sync" ||
    normalized === "meta" ||
    normalized === "stats"
  ) {
    return normalized;
  }
  return null;
}

/** Permissions Leads depuis le backend ; défaut = tout si absent. */
export function resolveLeadsPermissions(
  permissions?: UserPermissions | null,
): readonly LeadsPermission[] {
  const raw = permissions?.leadsPermissions ?? [];
  const parsed = raw
    .map(parseLeadsPermission)
    .filter((item): item is LeadsPermission => item != null);
  if (parsed.length > 0) return parsed;
  return ALL_LEADS_PERMISSIONS;
}

export function hasLeadsPermission(
  permissions: UserPermissions | undefined | null,
  action: LeadsPermission,
): boolean {
  return resolveLeadsPermissions(permissions).includes(action);
}
