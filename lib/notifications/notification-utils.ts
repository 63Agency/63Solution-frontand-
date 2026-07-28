import type { AppNotification } from "./types";

/** Extrait `c` depuis href backend (`/dashboard/conversations?c=uuid`). */
export function conversationIdFromNotificationHref(href: string): string | undefined {
  try {
    const path = href.startsWith("http") ? href : `https://local${href.startsWith("/") ? "" : "/"}${href}`;
    const url = new URL(path);
    const id = url.searchParams.get("c");
    return id && id.length > 0 ? id : undefined;
  } catch {
    return undefined;
  }
}

export function getNotificationConversationId(notification: AppNotification): string | undefined {
  return (
    notification.meta?.conversationId ??
    conversationIdFromNotificationHref(notification.href)
  );
}

export function isFallbackWhatsAppNotificationId(id: string): boolean {
  return id.startsWith("whatsapp-");
}

export function detectNewApiNotifications(
  previousIds: Set<string>,
  items: AppNotification[],
  isActiveConversation: (conversationId: string) => boolean,
): AppNotification[] {
  const unread = items.filter((n) => !n.read);
  return unread.filter((n) => {
    if (previousIds.has(n.id)) return false;
    const convId = getNotificationConversationId(n);
    if (convId && isActiveConversation(convId)) return false;
    return true;
  });
}

/** Nouveaux messages WhatsApp quand l’API renvoie des notifs déjà connues mais le preview change. */
export function detectUnreadPreviewChanges(
  previous: Map<string, string>,
  items: AppNotification[],
  isActiveConversation: (conversationId: string) => boolean,
): AppNotification[] {
  const seenKeys = new Set<string>();
  const alerts: AppNotification[] = [];

  // items = newest first → garder une alerte max par conversation
  for (const n of items) {
    if (n.read) continue;
    const convId = getNotificationConversationId(n);
    if (convId && isActiveConversation(convId)) continue;
    const key = convId ?? n.id;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);

    const prevBody = previous.get(key);
    if (prevBody === undefined) continue;
    if (prevBody === n.body) continue;
    alerts.push(n);
  }

  return alerts;
}

/** Garde le body le plus récent par conversation (items triés newest-first). */
export function buildNewestPreviewByConversation(
  items: AppNotification[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const n of items) {
    const key = getNotificationConversationId(n) ?? n.id;
    if (map.has(key)) continue; // already have newest
    map.set(key, n.body);
  }
  return map;
}

/** Une alerte max par conversation (évite newId + previewChange pour le même message). */
export function dedupeAlertsByConversation(
  alerts: AppNotification[],
): AppNotification[] {
  const seen = new Set<string>();
  const out: AppNotification[] = [];
  for (const n of alerts) {
    const key = getNotificationConversationId(n) ?? n.id;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(n);
  }
  return out;
}
