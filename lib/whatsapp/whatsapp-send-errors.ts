/** Erreur fenêtre 24 h Meta — le contact doit répondre ou recevoir un template. */
export function isWhatsAppWindowClosedError(message: string): boolean {
  const err = message.toLowerCase();
  return err.includes("24 h") || err.includes("24h") || err.includes("template");
}

/** Message utilisateur — jamais « WhatChimp », privilégier le texte après « Meta: ». */
export function formatWhatsAppSendError(raw: string): string {
  const err = raw.trim();
  if (!err) return "Envoi impossible.";

  const metaMatch = err.match(/Meta:\s*(.+)/i);
  if (metaMatch?.[1]?.trim()) return metaMatch[1].trim();

  if (/whatchimp/i.test(err)) {
    return "Erreur WhatsApp. Réessayez ou envoyez un template approuvé.";
  }

  return err.replace(/WhatChimp/gi, "Meta");
}

export const WINDOW_CLOSED_HINT =
  "En attente d'une réponse du contact — utilisez un template";

export const WINDOW_CLOSED_TOAST =
  "Ce contact n'a pas répondu depuis 24h. Envoyez un template.";
