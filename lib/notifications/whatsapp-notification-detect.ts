import type { WhatsAppConversation } from "../whatsapp/types";

export type ConversationSnapshot = {
  lastMessageAt?: string;
  unreadCount: number;
  lastMessageText?: string;
};

export type InboundWhatsAppAlert = {
  conversationId: string;
  title: string;
  body: string;
  href: string;
};

export function buildConversationSnapshots(
  conversations: WhatsAppConversation[],
): Map<string, ConversationSnapshot> {
  const map = new Map<string, ConversationSnapshot>();
  for (const c of conversations) {
    map.set(c.id, {
      lastMessageAt: c.lastMessageAt,
      unreadCount: c.unreadCount,
      lastMessageText: c.lastMessageText,
    });
  }
  return map;
}

export function detectInboundWhatsAppAlerts(
  previous: Map<string, ConversationSnapshot>,
  current: WhatsAppConversation[],
  options: { isActiveConversation: (id: string) => boolean },
): InboundWhatsAppAlert[] {
  const alerts: InboundWhatsAppAlert[] = [];

  for (const c of current) {
    if (options.isActiveConversation(c.id)) continue;

    const prev = previous.get(c.id);
    if (!prev) continue;

    const unreadIncreased = c.unreadCount > prev.unreadCount;
    const messageChanged =
      Boolean(c.lastMessageAt) &&
      c.lastMessageAt !== prev.lastMessageAt &&
      new Date(c.lastMessageAt!).getTime() >
        new Date(prev.lastMessageAt ?? 0).getTime();

    if (!unreadIncreased && !messageChanged) continue;

    const title =
      c.contactName?.trim() ||
      c.phoneNumber ||
      "Contact WhatsApp";
    const body = c.lastMessageText?.trim() || "Nouveau message WhatsApp";

    alerts.push({
      conversationId: c.id,
      title,
      body,
      href: `/dashboard/conversations?c=${encodeURIComponent(c.id)}`,
    });
  }

  return alerts;
}
