import { getStoredUser } from "./backend-login";
import { isAdminWhatsAppRole, isFixedMeetingRole } from "./roles";

const ADMIN_WHATSAPP_FALLBACK = "/dashboard/conversations";
const FIXED_MEETING_FALLBACK = "/dashboard/calendrier";

function isAlreadyOnFallback(pathname: string, fallback: string): boolean {
  return pathname === fallback || pathname.startsWith(`${fallback}/`);
}

/**
 * Redirige les rôles limités vers leur page d’accueil sur 403 (accès page interdite).
 * Ne redirige pas si on y est déjà — sinon boucle (ex. poll /notifications → 403).
 */
export function handleForbiddenForLimitedRole(res: Response): boolean {
  if (res.status !== 403 || typeof window === "undefined") return false;
  const role = getStoredUser()?.role ?? "";
  const path = window.location.pathname;

  if (isFixedMeetingRole(role)) {
    if (isAlreadyOnFallback(path, FIXED_MEETING_FALLBACK)) return false;
    window.location.replace(FIXED_MEETING_FALLBACK);
    return true;
  }
  if (!isAdminWhatsAppRole(role)) return false;
  if (isAlreadyOnFallback(path, ADMIN_WHATSAPP_FALLBACK)) return false;
  window.location.replace(ADMIN_WHATSAPP_FALLBACK);
  return true;
}

export async function parseBackendApiError(
  res: Response,
  context: string,
): Promise<never> {
  if (handleForbiddenForLimitedRole(res)) {
    throw new Error("Accès non autorisé.");
  }

  const raw = await res.text().catch(() => "");
  let message = raw || `Erreur ${res.status}`;
  try {
    const parsed = JSON.parse(raw) as { message?: string | string[]; error?: string };
    if (typeof parsed.message === "string") message = parsed.message;
    else if (Array.isArray(parsed.message) && parsed.message.length > 0) {
      message = parsed.message.join(", ");
    } else if (typeof parsed.error === "string" && parsed.error.length > 0) {
      message = parsed.error;
    }
  } catch {
    /* ignore */
  }
  throw new Error(message || `${context} (${res.status})`);
}
