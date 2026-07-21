"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Bell, CheckCheck, MessageCircle } from "lucide-react";
import { cn } from "@/src/lib/utils";
import type { AppNotification } from "@/lib/notifications/types";
import { formatChatTime } from "../whatsapp/whatsapp-utils";
import { useNotifications } from "./NotificationsProvider";

const PANEL_WIDTH = 380;
const PANEL_GAP = 8;

function NotificationRow({
  notification,
  onRead,
}: {
  notification: AppNotification;
  onRead: (n: AppNotification) => void;
}) {
  const isWhatsApp = notification.type === "whatsapp.message";

  return (
    <Link
      href={notification.href}
      onClick={() => {
        if (!notification.read) void onRead(notification);
      }}
      className={cn(
        "block px-4 py-3.5 transition-colors hover:bg-zinc-800/60",
        !notification.read && "bg-emerald-950/20",
      )}
    >
      <div className="flex gap-3">
        <div
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-full",
            isWhatsApp ? "bg-emerald-600/20 text-emerald-400" : "bg-zinc-800 text-zinc-400",
          )}
        >
          {isWhatsApp ? (
            <MessageCircle className="size-4" aria-hidden />
          ) : (
            <Bell className="size-4" aria-hidden />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <p
              className={cn(
                "min-w-0 flex-1 break-words text-sm leading-snug",
                !notification.read ? "font-semibold text-zinc-100" : "font-medium text-zinc-300",
              )}
            >
              {notification.title}
            </p>
            <span className="shrink-0 pt-0.5 text-[10px] leading-none text-zinc-500">
              {formatChatTime(notification.createdAt)}
            </span>
          </div>
          <p className="mt-1.5 break-words text-xs leading-relaxed text-zinc-400">
            {notification.body}
          </p>
        </div>
      </div>
    </Link>
  );
}

export function DashboardNotificationsBell() {
  const {
    notifications,
    unreadCount,
    loading,
    source,
    error,
    markRead,
    markAllRead,
    browserPermission,
    requestBrowserPermission,
  } = useNotifications();

  const visibleNotifications = useMemo(() => {
    const unread = notifications.filter((n) => !n.read);
    return unread.length > 0 ? unread : notifications;
  }, [notifications]);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [panelRect, setPanelRect] = useState({ top: 0, left: 0, width: PANEL_WIDTH });
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const updatePanelPosition = useCallback(() => {
    const btn = buttonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const width = Math.min(PANEL_WIDTH, window.innerWidth - 16);
    const left = Math.max(
      8,
      Math.min(rect.right - width, window.innerWidth - width - 8),
    );
    setPanelRect({
      top: rect.bottom + PANEL_GAP,
      left,
      width,
    });
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePanelPosition();
    const onResize = () => updatePanelPosition();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [open, updatePanelPosition]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (buttonRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const displayCount = unreadCount > 99 ? "99+" : String(unreadCount);

  const panel =
    open && mounted ? (
      <div
        ref={rootRef}
        role="dialog"
        aria-label="Notifications"
        className="fixed z-[200] flex max-h-[min(75vh,520px)] flex-col rounded-xl border border-zinc-700 bg-zinc-950 shadow-2xl ring-1 ring-black/40"
        style={{
          top: panelRect.top,
          left: panelRect.left,
          width: panelRect.width,
        }}
      >
        <div className="shrink-0 border-b border-zinc-800 px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-zinc-100">Notifications</p>
              <p className="mt-0.5 text-[11px] text-zinc-500">
                {loading
                  ? "Chargement…"
                  : error
                    ? error
                    : unreadCount > 0
                      ? `${unreadCount} non lue${unreadCount > 1 ? "s" : ""} · ${source === "api" ? "API" : "WhatsApp"}`
                      : `Tout est à jour · ${source === "api" ? "API" : "WhatsApp"}`}
              </p>
            </div>
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-emerald-400 hover:bg-zinc-800"
              >
                <CheckCheck className="size-3.5" aria-hidden />
                Tout lire
              </button>
            ) : null}
          </div>
        </div>

        <div className="app-scroll min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
          {error ? (
            <p className="px-4 py-6 text-center text-xs leading-relaxed text-amber-400/90">
              {error}
              <span className="mt-2 block text-zinc-500">
                Vérifie la connexion et que la migration notifications est appliquée sur Supabase.
              </span>
            </p>
          ) : null}

          {!error && visibleNotifications.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-zinc-500">
              Aucune notification pour le moment.
              <span className="mt-2 block text-xs text-zinc-600">
                Envoyez un message WhatsApp test vers le numéro business.
              </span>
            </p>
          ) : null}

          {!error && visibleNotifications.length > 0 ? (
            <ul className="divide-y divide-zinc-800/80">
              {visibleNotifications.map((n) => (
                <li key={n.id}>
                  <NotificationRow notification={n} onRead={markRead} />
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {browserPermission !== "granted" && browserPermission !== "unsupported" ? (
          <div className="shrink-0 border-t border-zinc-800 px-4 py-2.5">
            <button
              type="button"
              onClick={() => void requestBrowserPermission()}
              className="w-full rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800"
            >
              Activer les alertes sur le bureau
            </button>
          </div>
        ) : null}
      </div>
    ) : null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-md p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
        aria-label={
          unreadCount > 0
            ? `Notifications, ${unreadCount} non lue${unreadCount > 1 ? "s" : ""}`
            : "Notifications"
        }
        aria-expanded={open}
      >
        <Bell className="size-5" aria-hidden />
        {unreadCount > 0 ? (
          <span className="absolute right-0.5 top-0.5 flex min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {displayCount}
          </span>
        ) : null}
      </button>

      {mounted && panel ? createPortal(panel, document.body) : null}
    </>
  );
}
