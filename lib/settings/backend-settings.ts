import { fetchCurrentUser } from "../auth/backend-login";
import { canManageTeamUsers } from "../auth/roles";
import type {
  AdminProfile,
  ChangePasswordPayload,
  CreateTeamUserPayload,
  TeamUser,
  UpdateAdminProfilePayload,
} from "./settings-types";

const PROFILE_EXT_KEY = "agency_profile_extensions";
const TEAM_USERS_KEY = "agency_team_users";

type ProfileExtensions = Record<
  string,
  {
    prenom: string;
    nom: string;
    telephone?: string;
    ville?: string;
    avatarUrl?: string;
    titre?: string;
    dateNaissance?: string;
    fuseauHoraire?: string;
    adresse?: string;
    codePostal?: string;
    pays?: string;
  }
>;

function pickAvatarUrl(row: Record<string, unknown>): string {
  const candidates = [
    row.avatarUrl,
    row.avatar_url,
    row.photoUrl,
    row.photo_url,
    row.profileImageUrl,
    row.profile_image_url,
    row.imageUrl,
    row.image_url,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim().startsWith("http")) return c.trim();
  }
  return "";
}

function readProfileExtensions(): ProfileExtensions {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(PROFILE_EXT_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as ProfileExtensions) : {};
  } catch {
    return {};
  }
}

function writeProfileExtensions(data: ProfileExtensions): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PROFILE_EXT_KEY, JSON.stringify(data));
}

function readTeamUsersLocal(): TeamUser[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(TEAM_USERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (u): u is TeamUser =>
          !!u &&
          typeof u === "object" &&
          typeof (u as TeamUser).id === "string" &&
          typeof (u as TeamUser).email === "string",
      )
      .map((u) => ({
        ...u,
        telephone: typeof u.telephone === "string" ? u.telephone : "",
        ville: typeof u.ville === "string" ? u.ville : "",
      }));
  } catch {
    return [];
  }
}

function writeTeamUsersLocal(users: TeamUser[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TEAM_USERS_KEY, JSON.stringify(users));
}

function splitNameFromEmail(email: string): { prenom: string; nom: string } {
  const local = email.split("@")[0] ?? "";
  const parts = local.replace(/[._-]+/g, " ").trim().split(/\s+/);
  if (parts.length >= 2) {
    return {
      prenom: parts[0] ?? "",
      nom: parts.slice(1).join(" "),
    };
  }
  return { prenom: local, nom: "" };
}

/** Profil admin — GET /auth/me + champs étendus (PATCH /users/me si disponible). */
export async function fetchAdminProfile(): Promise<AdminProfile> {
  const { user } = await fetchCurrentUser();
  const u = user as unknown as Record<string, unknown>;
  const ext = readProfileExtensions()[user.id];
  const fallback = splitNameFromEmail(user.email);
  const apiAvatar = pickAvatarUrl(u);
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    prenom: String(u.prenom ?? u.firstName ?? ext?.prenom ?? fallback.prenom).trim(),
    nom: String(u.nom ?? u.lastName ?? ext?.nom ?? fallback.nom).trim(),
    telephone: String(u.telephone ?? u.phone ?? ext?.telephone ?? "").trim(),
    ville: String(u.ville ?? u.city ?? ext?.ville ?? "").trim(),
    avatarUrl: apiAvatar || ext?.avatarUrl?.trim() || "",
    titre: String(ext?.titre ?? "M.").trim() || "M.",
    dateNaissance: String(ext?.dateNaissance ?? "").trim(),
    fuseauHoraire: String(
      ext?.fuseauHoraire ??
        "+01:00 Western European Time - Casablanca, Rabat, Fes, Tangier",
    ).trim(),
    adresse: String(ext?.adresse ?? "").trim(),
    codePostal: String(ext?.codePostal ?? "").trim(),
    pays: String(ext?.pays ?? "Morocco").trim() || "Morocco",
  };
}

/** PATCH /users/me — API Nest si disponible, sinon cache localStorage. */
export async function updateAdminProfile(
  payload: UpdateAdminProfilePayload,
): Promise<AdminProfile> {
  const current = await fetchAdminProfile();
  const avatarUrl =
    payload.avatarUrl !== undefined ? payload.avatarUrl.trim() : current.avatarUrl;
  const titre = (payload.titre ?? current.titre).trim() || "M.";
  const dateNaissance = (payload.dateNaissance ?? current.dateNaissance).trim();
  const fuseauHoraire = (payload.fuseauHoraire ?? current.fuseauHoraire).trim();
  const adresse = (payload.adresse ?? current.adresse).trim();
  const codePostal = (payload.codePostal ?? current.codePostal).trim();
  const pays = (payload.pays ?? current.pays).trim() || "Morocco";

  const base = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
  if (base) {
    const token = window.localStorage.getItem("agency_auth_access_token");
    const body = {
      prenom: payload.prenom.trim(),
      nom: payload.nom.trim(),
      telephone: payload.telephone.trim(),
      ville: payload.ville.trim(),
      avatarUrl: avatarUrl || null,
    };
    const res = await fetch(`${base}/users/me`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: "include",
      body: JSON.stringify(body),
    }).catch(() => null);

    if (res?.ok) {
      const raw = (await res.json().catch(() => null)) as unknown;
      const row =
        raw && typeof raw === "object" && (raw as { user?: unknown }).user
          ? ((raw as { user: unknown }).user as Record<string, unknown>)
          : raw && typeof raw === "object"
            ? (raw as Record<string, unknown>)
            : null;
      if (row) {
        const ext = readProfileExtensions();
        ext[current.id] = {
          prenom: String(row.prenom ?? body.prenom).trim(),
          nom: String(row.nom ?? body.nom).trim(),
          telephone: String(row.telephone ?? body.telephone).trim(),
          ville: String(row.ville ?? body.ville).trim(),
          avatarUrl: pickAvatarUrl(row) || avatarUrl,
          titre,
          dateNaissance,
          fuseauHoraire,
          adresse,
          codePostal,
          pays,
        };
        writeProfileExtensions(ext);
        return {
          id: String(row.id ?? current.id),
          email: String(row.email ?? current.email),
          role: String(row.role ?? current.role),
          prenom: ext[current.id]!.prenom,
          nom: ext[current.id]!.nom,
          telephone: ext[current.id]!.telephone ?? "",
          ville: ext[current.id]!.ville ?? "",
          avatarUrl: ext[current.id]!.avatarUrl ?? "",
          titre,
          dateNaissance,
          fuseauHoraire,
          adresse,
          codePostal,
          pays,
        };
      }
    }
  }

  const ext = readProfileExtensions();
  ext[current.id] = {
    prenom: payload.prenom.trim(),
    nom: payload.nom.trim(),
    telephone: payload.telephone.trim(),
    ville: payload.ville.trim(),
    avatarUrl,
    titre,
    dateNaissance,
    fuseauHoraire,
    adresse,
    codePostal,
    pays,
  };
  writeProfileExtensions(ext);
  return {
    ...current,
    prenom: payload.prenom.trim(),
    nom: payload.nom.trim(),
    telephone: payload.telephone.trim(),
    ville: payload.ville.trim(),
    avatarUrl,
    titre,
    dateNaissance,
    fuseauHoraire,
    adresse,
    codePostal,
    pays,
  };
}

/** POST /auth/change-password — stub front (API à brancher). */
export async function changeAdminPassword(payload: ChangePasswordPayload): Promise<void> {
  const base = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
  if (base) {
    const token = window.localStorage.getItem("agency_auth_access_token");
    const res = await fetch(`${base}/auth/change-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: "include",
      body: JSON.stringify(payload),
    }).catch(() => null);

    if (res?.ok) return;
    if (res && res.status !== 404) {
      const body = (await res.json().catch(() => null)) as { message?: string } | null;
      throw new Error(
        typeof body?.message === "string"
          ? body.message
          : `Changement de mot de passe impossible (${res.status})`,
      );
    }
  }

  if (!payload.currentPassword.trim() || !payload.newPassword.trim()) {
    throw new Error("Tous les champs mot de passe sont obligatoires.");
  }
  if (payload.newPassword.length < 8) {
    throw new Error("Le nouveau mot de passe doit contenir au moins 8 caractères.");
  }
  // Front-only fallback until backend is ready
  await new Promise((r) => setTimeout(r, 400));
}

/** GET /users — liste équipe (localStorage en attendant le backend). */
export async function fetchTeamUsers(): Promise<TeamUser[]> {
  const base = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
  if (base) {
    const token = window.localStorage.getItem("agency_auth_access_token");
    const res = await fetch(`${base}/users`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: "include",
    }).catch(() => null);

    if (res?.ok) {
      const raw = (await res.json().catch(() => null)) as unknown;
      const list = Array.isArray(raw)
        ? raw
        : raw && typeof raw === "object" && Array.isArray((raw as { items?: unknown[] }).items)
          ? (raw as { items: unknown[] }).items
          : [];
      const parsed = list
        .map((row) => parseTeamUser(row))
        .filter((u): u is TeamUser => u !== null);
      if (parsed.length > 0) {
        writeTeamUsersLocal(parsed);
        return parsed.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
      }
    }
  }

  return readTeamUsersLocal().sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

function parseTeamUser(row: unknown): TeamUser | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const id = String(r.id ?? "");
  const email = String(r.email ?? "").trim();
  if (!id || !email) return null;
  const roleRaw = String(r.role ?? "admin_whatsapp").toLowerCase().replace(/[\s-]+/g, "_");
  let role: TeamUser["role"] = "admin_whatsapp";
  if (roleRaw === "admin" || roleRaw === "superadmin" || roleRaw === "super_admin") {
    role = "admin";
  } else if (roleRaw === "admin_whatsapp" || roleRaw === "adminwhatsapp") {
    role = "admin_whatsapp";
  } else if (roleRaw === "fixed_meeting" || roleRaw === "fixedmeeting") {
    role = "fixed_meeting";
  }
  return {
    id,
    email,
    prenom: String(r.prenom ?? r.firstName ?? "").trim(),
    nom: String(r.nom ?? r.lastName ?? r.name ?? "").trim(),
    telephone: String(r.telephone ?? r.phone ?? "").trim(),
    ville: String(r.ville ?? r.city ?? "").trim(),
    role,
    createdAt: String(r.createdAt ?? new Date().toISOString()),
  };
}

/** POST /users — création utilisateur (localStorage si API absente). */
export async function createTeamUser(payload: CreateTeamUserPayload): Promise<TeamUser> {
  const email = payload.email.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Email invalide.");
  }
  if (payload.password.length < 8) {
    throw new Error("Le mot de passe doit contenir au moins 8 caractères.");
  }

  const base = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
  if (base) {
    const token = window.localStorage.getItem("agency_auth_access_token");
    const res = await fetch(`${base}/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: "include",
      body: JSON.stringify({
        prenom: payload.prenom.trim(),
        nom: payload.nom.trim(),
        email,
        telephone: payload.telephone.trim(),
        ville: payload.ville.trim(),
        password: payload.password,
        role: payload.role,
      }),
    }).catch(() => null);

    if (res?.ok) {
      const raw = await res.json().catch(() => null);
      const row =
        raw && typeof raw === "object" && (raw as { user?: unknown }).user
          ? (raw as { user: unknown }).user
          : raw;
      const parsed = parseTeamUser(row);
      if (parsed) {
        // Preserve assignable role if API omits/normalizes it oddly.
        if (
          payload.role === "fixed_meeting" ||
          payload.role === "admin_whatsapp" ||
          payload.role === "admin"
        ) {
          parsed.role = payload.role;
        }
        return parsed;
      }
    }
    if (res && !res.ok && res.status !== 404) {
      const body = (await res.json().catch(() => null)) as { message?: string } | null;
      throw new Error(
        typeof body?.message === "string"
          ? body.message
          : `Création utilisateur impossible (${res.status}). Vérifier que le rôle "${payload.role}" est accepté par le backend.`,
      );
    }
  }

  const existing = readTeamUsersLocal();
  if (existing.some((u) => u.email.toLowerCase() === email)) {
    throw new Error("Un utilisateur avec cet email existe déjà.");
  }

  const user: TeamUser = {
    id: crypto.randomUUID(),
    prenom: payload.prenom.trim(),
    nom: payload.nom.trim(),
    email,
    telephone: payload.telephone.trim(),
    ville: payload.ville.trim(),
    role: payload.role,
    createdAt: new Date().toISOString(),
  };
  writeTeamUsersLocal([user, ...existing]);
  return user;
}

/** DELETE /users/:id — stub local. */
export async function deleteTeamUser(userId: string): Promise<void> {
  const base = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
  if (base) {
    const token = window.localStorage.getItem("agency_auth_access_token");
    const res = await fetch(`${base}/users/${encodeURIComponent(userId)}`, {
      method: "DELETE",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: "include",
    }).catch(() => null);

    if (res?.ok || res?.status === 204) {
      writeTeamUsersLocal(readTeamUsersLocal().filter((u) => u.id !== userId));
      return;
    }
    if (res && res.status !== 404) {
      const body = (await res.json().catch(() => null)) as { message?: string } | null;
      throw new Error(
        typeof body?.message === "string"
          ? body.message
          : `Suppression impossible (${res.status})`,
      );
    }
  }

  writeTeamUsersLocal(readTeamUsersLocal().filter((u) => u.id !== userId));
}

export function isAdminRole(role: string): boolean {
  return canManageTeamUsers(role);
}

export { canManageTeamUsers, shouldShowTeamUserInList } from "../auth/roles";
