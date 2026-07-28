import { getApiBaseUrl, getStoredAccessToken } from "../auth/backend-login";
import { fetchWhatsAppConversations } from "../whatsapp/backend-whatsapp";
import type { WhatsAppConversation } from "../whatsapp/types";
import { conversationIdFromNotificationHref } from "./notification-utils";
import type { AppNotification, NotificationsPage } from "./types";

function whatsappContactTitle(c: WhatsAppConversation): string {
  const name = c.contactName?.trim();
  if (name) return name;
  return c.phoneNumber || "Contact WhatsApp";
}

function authHeadersOrNull(): Record<string, string> | null {
  const token = getStoredAccessToken();
  if (!token) return null;
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

function normalizeHref(href: string): string {
  const trimmed = href.trim();
  if (!trimmed) return "/dashboard";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function unwrapNotificationRows(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (!raw || typeof raw !== "object") return [];
  const o = raw as Record<string, unknown>;
  if (Array.isArray(o.items)) return o.items;
  if (Array.isArray(o.data)) return o.data;
  if (o.data && typeof o.data === "object") {
    const d = o.data as Record<string, unknown>;
    if (Array.isArray(d.items)) return d.items;
  }
  return [];
}

function isNotificationRead(r: Record<string, unknown>): boolean {
  if (r.read === true || r.isRead === true) return true;
  const readAt = r.readAt ?? r.read_at;
  if (typeof readAt === "string" && readAt.length > 0 && readAt !== "null") {
    return true;
  }
  return false;
}

function parseNotification(row: unknown): AppNotification | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const id = String(r.id ?? "");
  if (!id) return null;

  const body = String(r.body ?? r.message ?? r.text ?? "").trim();
  const titleRaw = String(
    r.title ?? r.contactName ?? r.contact_name ?? r.name ?? "",
  ).trim();
  const title =
    titleRaw || (body ? body.slice(0, 60) : "") || "Message WhatsApp";

  const href = normalizeHref(
    String(r.href ?? r.link ?? r.url ?? "/dashboard/conversations"),
  );
  const createdAt = String(
    r.createdAt ?? r.created_at ?? r.sentAt ?? new Date().toISOString(),
  );

  const rawType = String(r.type ?? "whatsapp.message").toLowerCase();
  const type = rawType.includes("whatsapp") ? "whatsapp.message" : "system";

  const metaFromRow =
    r.meta && typeof r.meta === "object" ? (r.meta as AppNotification["meta"]) : undefined;

  const conversationId =
    metaFromRow?.conversationId ??
    (typeof r.conversationId === "string"
      ? r.conversationId
      : typeof r.conversation_id === "string"
        ? r.conversation_id
        : conversationIdFromNotificationHref(href));

  const meta: AppNotification["meta"] = {
    ...metaFromRow,
    conversationId,
    phoneNumber:
      metaFromRow?.phoneNumber ??
      (typeof r.phoneNumber === "string"
        ? r.phoneNumber
        : typeof r.phone_number === "string"
          ? r.phone_number
          : undefined),
  };

  return {
    id,
    type,
    title,
    body: body || "Nouveau message",
    href: conversationId && !href.includes("?c=")
      ? `/dashboard/conversations?c=${encodeURIComponent(conversationId)}`
      : href,
    createdAt,
    read: isNotificationRead(r),
    meta,
  };
}

function conversationsToNotifications(
  conversations: WhatsAppConversation[],
): AppNotification[] {
  return conversations
    .filter((c) => c.unreadCount > 0)
    .sort(
      (a, b) =>
        new Date(b.lastMessageAt ?? 0).getTime() -
        new Date(a.lastMessageAt ?? 0).getTime(),
    )
    .map((c) => ({
      id: `whatsapp-${c.id}`,
      type: "whatsapp.message" as const,
      title: whatsappContactTitle(c),
      body: c.lastMessageText?.trim() || "Nouveau message WhatsApp",
      href: `/dashboard/conversations?c=${encodeURIComponent(c.id)}`,
      createdAt: c.lastMessageAt ?? new Date().toISOString(),
      read: false,
      meta: {
        conversationId: c.id,
        phoneNumber: c.phoneNumber,
      },
    }));
}

function buildWhatsAppFallbackPage(
  conversations: WhatsAppConversation[],
): NotificationsPage {
  const items = conversationsToNotifications(conversations);
  const unreadCount = conversations.reduce(
    (sum, c) => sum + (c.unreadCount > 0 ? c.unreadCount : 0),
    0,
  );
  return { items, unreadCount, source: "whatsapp", conversations };
}

export async function fetchNotificationsFromApi(): Promise<NotificationsPage | null> {
  const base = getApiBaseUrl();
  const headers = authHeadersOrNull();
  if (!base || !headers) return null;

  try {
    const res = await fetch(`${base}/notifications?limit=50`, {
      method: "GET",
      headers,
      credentials: "include",
    });

    if (res.status === 404) return null;

    if (!res.ok) {
      console.warn(`[notifications] GET /notifications → ${res.status}`);
      return null;
    }

    const raw = (await res.json().catch(() => null)) as unknown;
    const list = unwrapNotificationRows(raw);

    const items = list
      .map((row) => parseNotification(row))
      .filter((v): v is AppNotification => v !== null)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );

    const unreadFromApi =
      raw && typeof raw === "object"
        ? (raw as { unreadCount?: number; unread_count?: number })
        : null;
    const unreadCount =
      typeof unreadFromApi?.unreadCount === "number"
        ? unreadFromApi.unreadCount
        : typeof unreadFromApi?.unread_count === "number"
          ? unreadFromApi.unread_count
          : items.filter((n) => !n.read).length;

    return { items, unreadCount, source: "api" };
  } catch (e) {
    console.warn("[notifications] GET /notifications failed", e);
    return null;
  }
}

export async function fetchNotificationsPage(): Promise<NotificationsPage> {
  const conversations = await fetchWhatsAppConversations().catch(() => []);
  const whatsappPage = buildWhatsAppFallbackPage(conversations);

  const fromApi = await fetchNotificationsFromApi();

  if (!fromApi) {
    return whatsappPage;
  }

  // API disponible : faire confiance à unreadCount backend (1 notif / conversation, pas / message).
  if (fromApi.items.length > 0 || fromApi.unreadCount > 0) {
    return { ...fromApi, conversations };
  }

  if (whatsappPage.items.length > 0 || whatsappPage.unreadCount > 0) {
    return whatsappPage;
  }

  return fromApi;
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  if (notificationId.startsWith("whatsapp-")) return;

  const base = getApiBaseUrl();
  const headers = authHeadersOrNull();
  if (!base || !headers) return;

  const res = await fetch(
    `${base}/notifications/${encodeURIComponent(notificationId)}/read`,
    {
      method: "PATCH",
      headers,
      credentials: "include",
    },
  );

  if (res.status === 404) return;
  if (!res.ok) {
    console.warn(`[notifications] PATCH read → ${res.status}`);
  }
}

export async function markAllNotificationsRead(): Promise<void> {
  const base = getApiBaseUrl();
  const headers = authHeadersOrNull();
  if (!base || !headers) return;

  const res = await fetch(`${base}/notifications/read-all`, {
    method: "PATCH",
    headers,
    credentials: "include",
  });

  if (res.status === 404) return;
  if (!res.ok) {
    console.warn(`[notifications] PATCH read-all → ${res.status}`);
  }
}
