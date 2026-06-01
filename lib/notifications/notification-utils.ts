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
  return items.filter((n) => {
    if (n.read) return false;
    const convId = getNotificationConversationId(n);
    if (convId && isActiveConversation(convId)) return false;
    const key = convId ?? n.id;
    const prevBody = previous.get(key);
    if (prevBody === undefined) return false;
    return prevBody !== n.body;
  });
}
