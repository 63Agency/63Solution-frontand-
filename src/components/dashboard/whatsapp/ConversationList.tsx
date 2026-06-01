"use client";

import { MessageCircle, Search } from "lucide-react";
import type { WhatsAppConversation } from "@/lib/whatsapp/types";
import { cn } from "@/src/lib/utils";
import { ConversationAvatar } from "./ConversationAvatar";
import {
  conversationDisplayName,
  formatChatTime,
  formatWhatsAppPhone,
} from "./whatsapp-utils";

type Props = {
  conversations: WhatsAppConversation[];
  selectedId: string | null;
  search: string;
  onSearchChange: (value: string) => void;
  onSelect: (id: string) => void;
  loading: boolean;
};

function ConversationSkeleton() {
  return (
    <li className="flex gap-3 border-b border-zinc-800/60 px-4 py-3.5">
      <div className="size-11 shrink-0 animate-pulse rounded-full bg-zinc-800" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="h-3.5 w-2/3 animate-pulse rounded bg-zinc-800" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-zinc-800/80" />
        <div className="h-3 w-full animate-pulse rounded bg-zinc-800/60" />
      </div>
    </li>
  );
}

export function ConversationList({
  conversations,
  selectedId,
  search,
  onSearchChange,
  onSelect,
  loading,
}: Props) {
  const q = search.trim().toLowerCase();
  const filtered = conversations.filter((c) => {
    if (!q) return true;
    const name = conversationDisplayName(c.contactName, c.phoneNumber).toLowerCase();
    const phone = c.phoneNumber.toLowerCase();
    const preview = (c.lastMessageText ?? "").toLowerCase();
    return name.includes(q) || phone.includes(q) || preview.includes(q);
  });

  const totalUnread = conversations.reduce((sum, c) => sum + (c.unreadCount > 0 ? c.unreadCount : 0), 0);

  return (
    <div className="flex h-full min-h-0 flex-col bg-zinc-900/50 md:rounded-xl md:border md:border-zinc-800">
      <div className="shrink-0 border-b border-zinc-800 bg-zinc-950/80 px-4 py-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600/15 ring-1 ring-emerald-500/25">
              <MessageCircle className="size-4 text-emerald-400" aria-hidden />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold tracking-tight text-zinc-100">Conversations</h2>
              <p className="truncate text-[11px] text-zinc-500">
                {loading
                  ? "Chargement…"
                  : `${filtered.length} discussion${filtered.length !== 1 ? "s" : ""}`}
              </p>
            </div>
          </div>
          {totalUnread > 0 ? (
            <span className="shrink-0 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">
              {totalUnread > 99 ? "99+" : totalUnread} non lu{totalUnread > 1 ? "s" : ""}
            </span>
          ) : null}
        </div>
        <div className="relative mt-3">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500"
            aria-hidden
          />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Rechercher nom, numéro, message…"
            className="w-full rounded-xl border border-zinc-700/80 bg-zinc-950/90 py-2.5 pl-9 pr-3 text-sm text-zinc-100 shadow-inner placeholder:text-zinc-600 focus:border-emerald-600/80 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
        {loading && filtered.length === 0 ? (
          <ul aria-busy="true" aria-label="Chargement des conversations">
            {Array.from({ length: 6 }).map((_, i) => (
              <ConversationSkeleton key={i} />
            ))}
          </ul>
        ) : null}

        {!loading && filtered.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-14 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-zinc-800/80 ring-1 ring-zinc-700/50">
              <MessageCircle className="size-7 text-zinc-500" aria-hidden />
            </div>
            <p className="mt-4 text-sm font-medium text-zinc-300">
              {q ? "Aucun résultat" : "Aucune conversation"}
            </p>
            <p className="mt-1.5 max-w-[240px] text-xs leading-relaxed text-zinc-500">
              {q
                ? "Essayez un autre nom, numéro ou extrait de message."
                : "Les leads apparaîtront ici après le premier message WhatsApp (webhook Meta)."}
            </p>
          </div>
        ) : null}

        {filtered.length > 0 ? (
          <ul>
            {filtered.map((c) => {
              const active = c.id === selectedId;
              const unread = c.unreadCount > 0;
              const title = conversationDisplayName(c.contactName, c.phoneNumber);
              const preview = c.lastMessageText?.trim() || "—";

              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(c.id)}
                    className={cn(
                      "flex w-full gap-3 border-b border-zinc-800/50 px-4 py-3.5 text-left transition-colors",
                      active
                        ? "border-l-2 border-l-emerald-500 bg-emerald-950/25 pl-[14px]"
                        : "border-l-2 border-l-transparent hover:bg-zinc-800/40",
                    )}
                  >
                    <ConversationAvatar seed={c.id} label={title} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span
                          className={cn(
                            "truncate text-[15px]",
                            unread ? "font-semibold text-zinc-50" : "font-medium text-zinc-200",
                          )}
                        >
                          {title}
                        </span>
                        <span
                          className={cn(
                            "shrink-0 text-[11px]",
                            unread ? "font-medium text-emerald-400" : "text-zinc-500",
                          )}
                        >
                          {formatChatTime(c.lastMessageAt)}
                        </span>
                      </div>
                      <p className="truncate text-[11px] text-zinc-600">
                        {formatWhatsAppPhone(c.phoneNumber)}
                      </p>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <p
                          className={cn(
                            "truncate text-sm",
                            unread ? "font-medium text-zinc-300" : "text-zinc-500",
                          )}
                        >
                          {preview}
                        </p>
                        {unread ? (
                          <span className="flex min-w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                            {c.unreadCount > 9 ? "9+" : c.unreadCount}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
