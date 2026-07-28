"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  fetchNotificationsPage,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notifications/backend-notifications";
import { showBrowserNotification } from "@/lib/notifications/browser-notifications";
import {
  buildNewestPreviewByConversation,
  dedupeAlertsByConversation,
  detectNewApiNotifications,
  detectUnreadPreviewChanges,
  getNotificationConversationId,
  isFallbackWhatsAppNotificationId,
} from "@/lib/notifications/notification-utils";
import {
  buildConversationSnapshots,
  detectInboundWhatsAppAlerts,
} from "@/lib/notifications/whatsapp-notification-detect";
import {
  getWhatsAppPollIntervalMs,
  markWhatsAppConversationRead,
} from "@/lib/whatsapp/backend-whatsapp";
import type { AppNotification } from "@/lib/notifications/types";

const ACTIVE_CONVERSATION_KEY = "whatsapp-active-conversation";

type NotificationsContextValue = {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  source: "api" | "whatsapp";
  error: string | null;
  refresh: () => Promise<void>;
  markRead: (notification: AppNotification) => Promise<void>;
  markAllRead: () => Promise<void>;
  browserPermission: NotificationPermission | "unsupported";
  requestBrowserPermission: () => Promise<void>;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    throw new Error("useNotifications must be used within NotificationsProvider");
  }
  return ctx;
}

function getActiveConversationId(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(ACTIVE_CONVERSATION_KEY);
}

export function setActiveWhatsAppConversationId(id: string | null): void {
  if (typeof window === "undefined") return;
  if (id) sessionStorage.setItem(ACTIVE_CONVERSATION_KEY, id);
  else sessionStorage.removeItem(ACTIVE_CONVERSATION_KEY);
}

function pushNotificationAlerts(
  alerts: { title: string; body: string; href: string; tag: string }[],
  router: ReturnType<typeof useRouter>,
) {
  for (const alert of alerts) {
    toast.info(alert.title, {
      id: alert.tag,
      description: alert.body,
      duration: 8000,
      action: {
        label: "Ouvrir",
        onClick: () => {
          router.push(alert.href);
        },
      },
    });
    showBrowserNotification({
      title: alert.title,
      body: alert.body,
      href: alert.href,
      tag: alert.tag,
    });
  }
}

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<"api" | "whatsapp">("whatsapp");
  const [error, setError] = useState<string | null>(null);
  const [browserPermission, setBrowserPermission] = useState<
    NotificationPermission | "unsupported"
  >("default");

  const snapshotRef = useRef(buildConversationSnapshots([]));
  const knownNotificationIdsRef = useRef<Set<string>>(new Set());
  const previewByConvoRef = useRef<Map<string, string>>(new Map());
  const bootstrappedRef = useRef(false);
  const lastSourceRef = useRef<"api" | "whatsapp" | null>(null);
  const refreshInFlightRef = useRef<Promise<void> | null>(null);
  const pendingRefreshRef = useRef(false);

  const isActiveConversation = useCallback(
    (conversationId: string) => {
      if (!pathname?.startsWith("/dashboard/conversations")) return false;
      return getActiveConversationId() === conversationId;
    },
    [pathname],
  );

  const bootstrapDetectors = useCallback(
    (page: Awaited<ReturnType<typeof fetchNotificationsPage>>) => {
      knownNotificationIdsRef.current = new Set(page.items.map((n) => n.id));
      previewByConvoRef.current = buildNewestPreviewByConversation(page.items);
      if (page.source === "whatsapp") {
        snapshotRef.current = buildConversationSnapshots(page.conversations ?? []);
      } else {
        snapshotRef.current = buildConversationSnapshots([]);
      }
      lastSourceRef.current = page.source;
    },
    [],
  );

  const refresh = useCallback(async () => {
    if (refreshInFlightRef.current) {
      pendingRefreshRef.current = true;
      await refreshInFlightRef.current;
      return;
    }

    const run = (async () => {
      try {
        setError(null);
        const page = await fetchNotificationsPage();
        setSource(page.source);
        setNotifications(page.items);
        setUnreadCount(page.unreadCount);

        if (!bootstrappedRef.current) {
          bootstrappedRef.current = true;
          bootstrapDetectors(page);
          return;
        }

        // Changement de source → réinitialiser sans alerter (évite flood de faux "nouveaux")
        if (lastSourceRef.current && lastSourceRef.current !== page.source) {
          bootstrapDetectors(page);
          return;
        }

        if (page.source === "api") {
          const newOnes = detectNewApiNotifications(
            knownNotificationIdsRef.current,
            page.items,
            isActiveConversation,
          );
          const previewChanges = detectUnreadPreviewChanges(
            previewByConvoRef.current,
            page.items,
            isActiveConversation,
          );
          const toAlert = dedupeAlertsByConversation([...newOnes, ...previewChanges]);
          pushNotificationAlerts(
            toAlert.map((n) => ({
              title: n.type === "whatsapp.message" ? `WhatsApp · ${n.title}` : n.title,
              body: n.body,
              href: n.href,
              tag: getNotificationConversationId(n) ?? n.id,
            })),
            router,
          );
          knownNotificationIdsRef.current = new Set(page.items.map((n) => n.id));
          previewByConvoRef.current = buildNewestPreviewByConversation(page.items);
        } else {
          const conversations = page.conversations ?? [];
          const alerts = detectInboundWhatsAppAlerts(
            snapshotRef.current,
            conversations,
            { isActiveConversation },
          );
          pushNotificationAlerts(
            alerts.map((a) => ({
              title: `WhatsApp · ${a.title}`,
              body: a.body,
              href: a.href,
              tag: `wa-${a.conversationId}`,
            })),
            router,
          );
          snapshotRef.current = buildConversationSnapshots(conversations);
        }

        lastSourceRef.current = page.source;
      } catch (e) {
        const msg =
          e instanceof Error ? e.message : "Impossible de charger les notifications.";
        setError(msg);
        console.warn("[notifications]", e);
      } finally {
        setLoading(false);
      }
    })();

    refreshInFlightRef.current = run;
    try {
      await run;
    } finally {
      refreshInFlightRef.current = null;
      if (pendingRefreshRef.current) {
        pendingRefreshRef.current = false;
        void refresh();
      }
    }
  }, [bootstrapDetectors, isActiveConversation, router]);

  useEffect(() => {
    void refresh();
    const ms = getWhatsAppPollIntervalMs();
    const id = window.setInterval(() => void refresh(), ms);
    return () => window.clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setBrowserPermission("unsupported");
      return;
    }
    setBrowserPermission(Notification.permission);
  }, []);

  const markRead = useCallback(
    async (notification: AppNotification) => {
      const convId = getNotificationConversationId(notification);

      if (isFallbackWhatsAppNotificationId(notification.id)) {
        if (convId) {
          await markWhatsAppConversationRead(convId).catch(() => undefined);
        }
      } else {
        await markNotificationRead(notification.id).catch(() => undefined);
        if (convId) {
          await markWhatsAppConversationRead(convId).catch(() => undefined);
        }
      }

      await refresh();
    },
    [refresh],
  );

  const markAllRead = useCallback(async () => {
    if (source === "api") {
      await markAllNotificationsRead().catch(() => undefined);
    }
    const withConvo = notifications.filter(
      (n) => !n.read && getNotificationConversationId(n),
    );
    await Promise.all(
      withConvo.map((n) =>
        markWhatsAppConversationRead(getNotificationConversationId(n)!).catch(
          () => undefined,
        ),
      ),
    );
    await refresh();
  }, [notifications, refresh, source]);

  const requestBrowserPermission = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const result = await Notification.requestPermission();
    setBrowserPermission(result);
  }, []);

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      loading,
      source,
      error,
      refresh,
      markRead,
      markAllRead,
      browserPermission,
      requestBrowserPermission,
    }),
    [
      notifications,
      unreadCount,
      loading,
      source,
      error,
      refresh,
      markRead,
      markAllRead,
      browserPermission,
      requestBrowserPermission,
    ],
  );

  return (
    <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
  );
}
