/** Fenêtre de session Meta WhatsApp (message libre) — 24 h après le dernier message entrant. */
export const WHATSAPP_SESSION_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * true si seul un template approuvé peut être envoyé (pas de texte libre).
 * - Aucun message entrant → template obligatoire.
 * - Dernier entrant > 24 h → template obligatoire.
 */
export function isWhatsAppSessionWindowClosed(lastInboundAtMs: number): boolean {
  if (!lastInboundAtMs || !Number.isFinite(lastInboundAtMs)) return true;
  return Date.now() - lastInboundAtMs >= WHATSAPP_SESSION_WINDOW_MS;
}
