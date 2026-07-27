import { getStoredUser } from "./backend-login";
import { isAdminWhatsAppRole } from "./roles";

const ADMIN_WHATSAPP_FALLBACK = "/dashboard/conversations";

/** Redirige admin_whatsapp vers conversations sur 403 ; retourne true si traité. */
export function handleForbiddenForLimitedRole(res: Response): boolean {
  if (res.status !== 403 || typeof window === "undefined") return false;
  const role = getStoredUser()?.role ?? "";
  if (!isAdminWhatsAppRole(role)) return false;
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
