export type BackendLoginUser = {
  id: string;
  email: string;
  role: string;
};

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

/** Aligne avec le backend Nest (admin → /dashboard, sinon /home). */
export function resolvePostLoginRoute(payload: BackendLoginSuccess): string {
  if (payload.route === "/dashboard" || payload.route === "/home") {
    return payload.route;
  }
  const r = payload.user.role?.toLowerCase().trim();
  if (r === "admin" || r === "superadmin" || r === "super_admin") {
    return "/dashboard";
  }
  return "/home";
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

  return {
    accessToken: ok.accessToken,
    refreshToken: ok.refreshToken ?? null,
    expiresIn: ok.expiresIn ?? null,
    tokenType: ok.tokenType ?? "Bearer",
    user: ok.user as BackendLoginUser,
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

  const user = ok.user as BackendLoginUser;
  let route: string;
  if (ok.route === "/dashboard" || ok.route === "/home") {
    route = ok.route;
  } else {
    route = resolvePostLoginRoute({
      accessToken: token,
      refreshToken: null,
      expiresIn: null,
      tokenType: "Bearer",
      user,
    });
  }

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
