import type { LeadsPermission, UserPermissions } from "./roles";

export type BackendLoginUser = {
  id: string;
  email: string;
  role: string;
  permissions?: UserPermissions;
};

function parseUserPermissions(raw: unknown): UserPermissions | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const obj = raw as Record<string, unknown>;

  const pagesRaw = obj.pages;
  const pages = Array.isArray(pagesRaw)
    ? pagesRaw
        .filter((page): page is string => typeof page === "string" && page.startsWith("/"))
        .map((page) => page.trim())
    : [];

  const leadsRaw = obj.leadsPermissions;
  const leadsPermissions = Array.isArray(leadsRaw)
    ? leadsRaw
        .map((item) => {
          if (typeof item !== "string") return null;
          const normalized = item.toLowerCase().trim();
          if (
            normalized === "list" ||
            normalized === "detail" ||
            normalized === "sync" ||
            normalized === "meta" ||
            normalized === "stats"
          ) {
            return normalized as LeadsPermission;
          }
          return null;
        })
        .filter((item): item is LeadsPermission => item != null)
    : [];

  if (pages.length === 0 && leadsPermissions.length === 0) return undefined;

  return {
    pages,
    ...(leadsPermissions.length > 0 ? { leadsPermissions } : {}),
  };
}

function parseBackendUser(raw: unknown): BackendLoginUser | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = String(row.id ?? "").trim();
  const email = String(row.email ?? "").trim();
  if (!id || !email) return null;
  const role = String(row.role ?? "").trim();
  const permissions = parseUserPermissions(row.permissions);
  return { id, email, role, ...(permissions ? { permissions } : {}) };
}

export type BackendLoginSuccess = {
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number | null;
  tokenType: string;
  user: BackendLoginUser;
  route?: string;
};

const STORAGE_ACCESS = "agency_auth_access_token";
const STORAGE_REFRESH = "agency_auth_refresh_token";
const STORAGE_TOKEN_TYPE = "agency_auth_token_type";
const STORAGE_EXPIRES_IN = "agency_auth_expires_in";
const STORAGE_USER = "agency_auth_user";

export function getApiBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL ?? "";
  return raw.replace(/\/$/, "");
}

export function getStoredAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_ACCESS);
}

export function getStoredUser(): BackendLoginUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_USER);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BackendLoginUser;
    if (!parsed?.id || !parsed?.email) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearAuthSession(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_ACCESS);
  window.localStorage.removeItem(STORAGE_REFRESH);
  window.localStorage.removeItem(STORAGE_TOKEN_TYPE);
  window.localStorage.removeItem(STORAGE_EXPIRES_IN);
  window.localStorage.removeItem(STORAGE_USER);
}

export function persistAuthSession(payload: BackendLoginSuccess): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_ACCESS, payload.accessToken);
  if (payload.refreshToken != null && payload.refreshToken !== "") {
    window.localStorage.setItem(STORAGE_REFRESH, payload.refreshToken);
  } else {
    window.localStorage.removeItem(STORAGE_REFRESH);
  }
  window.localStorage.setItem(STORAGE_TOKEN_TYPE, payload.tokenType || "Bearer");
  window.localStorage.setItem(
    STORAGE_EXPIRES_IN,
    payload.expiresIn != null ? String(payload.expiresIn) : "",
  );
  window.localStorage.setItem(STORAGE_USER, JSON.stringify(payload.user));
}

import { getDefaultDashboardRoute, resolveAllowedPages } from "./roles";

/** Aligne avec le backend Nest (admin → /dashboard, admin WhatsApp → conversations). */
export function resolvePostLoginRoute(payload: BackendLoginSuccess): string {
  const route = payload.route?.trim();
  if (route?.startsWith("/")) {
    return route;
  }
  return getDefaultDashboardRoute(
    payload.user.role ?? "",
    resolveAllowedPages(payload.user.role ?? "", payload.user.permissions),
  );
}

export async function loginWithBackend(
  email: string,
  password: string,
): Promise<BackendLoginSuccess> {
  const base = getApiBaseUrl();
  if (!base) {
    throw new Error(
      "Variable NEXT_PUBLIC_API_URL manquante (URL du backend Nest, ex. http://localhost:3000 si Next tourne sur un autre port).",
    );
  }

  const res = await fetch(`${base}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    credentials: "include",
  });

  const data: unknown = await res.json().catch(() => null);
  const body = data as { message?: string } | null;

  if (!res.ok) {
    const message =
      typeof body?.message === "string" && body.message.length > 0
        ? body.message
        : `Erreur ${res.status}`;
    throw new Error(message);
  }

  const ok = data as Partial<BackendLoginSuccess>;
  if (!ok?.accessToken || !ok?.user?.id || !ok?.user?.email) {
    throw new Error("Réponse backend invalide après login.");
  }

  const user = parseBackendUser(ok.user);
  if (!user) {
    throw new Error("Réponse backend invalide après login.");
  }

  const rootPermissions = parseUserPermissions(
    (data as { permissions?: unknown } | null)?.permissions,
  );
  if (rootPermissions && !user.permissions) {
    user.permissions = rootPermissions;
  }

  return {
    accessToken: ok.accessToken,
    refreshToken: ok.refreshToken ?? null,
    expiresIn: ok.expiresIn ?? null,
    tokenType: ok.tokenType ?? "Bearer",
    user,
    route: ok.route,
  };
}

export type BackendMeResponse = {
  user: BackendLoginUser;
  route: string;
};

export async function fetchCurrentUser(): Promise<BackendMeResponse> {
  const base = getApiBaseUrl();
  const token = getStoredAccessToken();
  if (!base) {
    throw new Error("NEXT_PUBLIC_API_URL manquante.");
  }
  if (!token) {
    throw new Error("Non authentifié.");
  }

  const res = await fetch(`${base}/auth/me`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
    credentials: "include",
  });

  const data: unknown = await res.json().catch(() => null);
  const body = data as { message?: string } | null;

  if (!res.ok) {
    const message =
      typeof body?.message === "string" && body.message.length > 0
        ? body.message
        : `Erreur ${res.status}`;
    throw new Error(message);
  }

  const ok = data as Partial<BackendMeResponse>;
  if (!ok?.user?.id || !ok?.user?.email) {
    throw new Error("Réponse /auth/me invalide.");
  }

  const user = parseBackendUser(ok.user);
  if (!user) {
    throw new Error("Réponse /auth/me invalide.");
  }

  const rootPermissions = parseUserPermissions(
    (data as { permissions?: unknown } | null)?.permissions,
  );
  if (rootPermissions && !user.permissions) {
    user.permissions = rootPermissions;
  }

  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_USER, JSON.stringify(user));
  }

  const route = resolvePostLoginRoute({
    accessToken: token,
    refreshToken: null,
    expiresIn: null,
    tokenType: "Bearer",
    user,
    route: ok.route,
  });

  return { user, route };
}

export async function registerWithBackend(
  email: string,
  password: string,
): Promise<{ message: string; userId: string }> {
  const base = getApiBaseUrl();
  if (!base) {
    throw new Error("NEXT_PUBLIC_API_URL manquante.");
  }

  const res = await fetch(`${base}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    credentials: "include",
  });

  const data: unknown = await res.json().catch(() => null);
  const body = data as { message?: string; userId?: string } | null;

  if (!res.ok) {
    const message =
      typeof body?.message === "string" && body.message.length > 0
        ? body.message
        : `Erreur ${res.status}`;
    throw new Error(message);
  }

  if (
    !body ||
    typeof body.message !== "string" ||
    typeof body.userId !== "string"
  ) {
    throw new Error("Réponse /auth/register invalide.");
  }

  return { message: body.message, userId: body.userId };
}
