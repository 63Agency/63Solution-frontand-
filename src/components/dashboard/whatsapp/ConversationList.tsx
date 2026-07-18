"use client";

import { useMemo, useState } from "react";
import { MoreVertical, Plus, Search, SquarePlus } from "lucide-react";
import type { WhatsAppConversation } from "@/lib/whatsapp/types";
import { cn } from "@/src/lib/utils";
import { ConversationAvatar } from "./ConversationAvatar";
import {
  conversationDisplayName,
  formatChatListTime,
} from "./whatsapp-utils";

type FilterId = "all" | "unread" | "favorites" | "groups";

type Props = {
  conversations: WhatsAppConversation[];
  selectedId: string | null;
  search: string;
  onSearchChange: (value: string) => void;
  onSelect: (id: string) => void;
  loading: boolean;
};

const WA = {
  bg: "#111b21",
  panel: "#111b21",
  header: "#202c33",
  search: "#202c33",
  hover: "#202c33",
  active: "#2a3942",
  border: "#222d34",
  text: "#e9edef",
  muted: "#8696a0",
  green: "#00a884",
  greenBadge: "#25d366",
  filterBorder: "#3b4a54",
} as const;

function ConversationSkeleton() {
  return (
    <li className="flex items-center gap-3 px-3 py-3">
      <div className="size-[49px] shrink-0 animate-pulse rounded-full bg-[#2a3942]" />
      <div className="min-w-0 flex-1 space-y-2 border-b border-[#222d34] pb-3">
        <div className="flex justify-between gap-2">
          <div className="h-3.5 w-1/2 animate-pulse rounded bg-[#2a3942]" />
          <div className="h-3 w-10 animate-pulse rounded bg-[#2a3942]" />
        </div>
        <div className="h-3 w-3/4 animate-pulse rounded bg-[#2a3942]/80" />
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
  const [filter, setFilter] = useState<FilterId>("all");

  const unreadTotal = useMemo(
    () => conversations.reduce((sum, c) => sum + Math.max(0, c.unreadCount), 0),
    [conversations],
  );

  const q = search.trim().toLowerCase();

  const filtered = useMemo(() => {
    let list = conversations;

    if (filter === "unread") {
      list = list.filter((c) => c.unreadCount > 0);
    } else if (filter === "favorites" || filter === "groups") {
      list = [];
    }

    if (!q) return list;
    return list.filter((c) => {
      const name = conversationDisplayName(c.contactName, c.phoneNumber).toLowerCase();
      const phone = c.phoneNumber.toLowerCase();
      const preview = (c.lastMessageText ?? "").toLowerCase();
      return name.includes(q) || phone.includes(q) || preview.includes(q);
    });
  }, [conversations, filter, q]);

  const filters: { id: FilterId; label: string; count?: number }[] = [
    { id: "all", label: "Toutes" },
    { id: "unread", label: "Non lues", count: unreadTotal > 0 ? unreadTotal : undefined },
    { id: "favorites", label: "Favoris" },
    { id: "groups", label: "Groupes" },
  ];

  return (
    <div
      className="flex h-full min-h-0 flex-col overflow-hidden"
      style={{ backgroundColor: WA.bg, color: WA.text }}
    >
      {/* Header */}
      <div className="shrink-0 px-4 pb-2 pt-3" style={{ backgroundColor: WA.panel }}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[22px] font-bold leading-none tracking-tight" style={{ color: WA.text }}>
            WhatsApp
          </h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="flex size-10 items-center justify-center rounded-full transition-colors hover:bg-white/5"
              aria-label="Nouvelle discussion"
            >
              <SquarePlus className="size-[22px]" style={{ color: WA.text }} strokeWidth={1.75} />
            </button>
            <button
              type="button"
              className="flex size-10 items-center justify-center rounded-full transition-colors hover:bg-white/5"
              aria-label="Menu"
            >
              <MoreVertical className="size-[22px]" style={{ color: WA.text }} strokeWidth={1.75} />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2"
            style={{ color: WA.muted }}
            strokeWidth={2}
            aria-hidden
          />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Rechercher ou démarrer une discussion"
            className="w-full rounded-lg py-[9px] pl-11 pr-3 text-[14px] outline-none placeholder:text-[#8696a0]"
            style={{
              backgroundColor: WA.search,
              color: WA.text,
            }}
          />
        </div>

        {/* Filter pills */}
        <div className="mt-2.5 flex items-center gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {filters.map((f) => {
            const active = filter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={cn(
                  "shrink-0 rounded-full px-3 py-[6px] text-[14px] leading-none transition-colors",
                  active ? "font-medium" : "border",
                )}
                style={
                  active
                    ? { backgroundColor: "#182229", color: WA.green, border: "1px solid transparent" }
                    : {
                        backgroundColor: "transparent",
                        color: WA.muted,
                        borderColor: WA.filterBorder,
                      }
                }
              >
                {f.label}
                {f.count != null ? (
                  <span className="ml-1.5 tabular-nums">{f.count > 99 ? "99+" : f.count}</span>
                ) : null}
              </button>
            );
          })}
          <button
            type="button"
            className="flex size-8 shrink-0 items-center justify-center rounded-full border transition-colors hover:bg-white/5"
            style={{ borderColor: WA.filterBorder, color: WA.muted }}
            aria-label="Plus de filtres"
          >
            <Plus className="size-4" strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* Chat list */}
      <div className="wa-scroll min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
        {loading && filtered.length === 0 ? (
          <ul aria-busy="true" aria-label="Chargement des conversations">
            {Array.from({ length: 8 }).map((_, i) => (
              <ConversationSkeleton key={i} />
            ))}
          </ul>
        ) : null}

        {!loading && filtered.length === 0 ? (
          <div className="flex flex-col items-center px-8 py-16 text-center">
            <p className="text-[16px] font-medium" style={{ color: WA.text }}>
              {q
                ? "Aucun résultat"
                : filter === "unread"
                  ? "Aucune discussion non lue"
                  : filter === "favorites"
                    ? "Aucun favori"
                    : filter === "groups"
                      ? "Aucun groupe"
                      : "Aucune conversation"}
            </p>
            <p className="mt-2 max-w-[260px] text-[14px] leading-relaxed" style={{ color: WA.muted }}>
              {q
                ? "Essayez un autre nom, numéro ou extrait de message."
                : "Les conversations apparaîtront ici après le premier message WhatsApp."}
            </p>
          </div>
        ) : null}

        {filtered.length > 0 ? (
          <ul>
            {filtered.map((c) => {
              const active = c.id === selectedId;
              const unread = c.unreadCount > 0;
              const title = conversationDisplayName(c.contactName, c.phoneNumber);
              const preview = c.lastMessageText?.trim() || "\u00A0";

              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(c.id)}
                    className="group flex w-full items-stretch gap-0 text-left transition-colors"
                    style={{
                      backgroundColor: active ? WA.active : "transparent",
                    }}
                    onMouseEnter={(e) => {
                      if (!active) e.currentTarget.style.backgroundColor = WA.hover;
                    }}
                    onMouseLeave={(e) => {
                      if (!active) e.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    <div className="flex shrink-0 items-center pl-3 pr-3.5 py-2.5">
                      <ConversationAvatar
                        seed={c.id}
                        label={title}
                        className="size-[49px] text-[18px]"
                      />
                    </div>

                    <div
                      className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 py-3 pr-3"
                      style={{ borderBottom: `1px solid ${WA.border}` }}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span
                          className="truncate text-[17px] leading-tight"
                          style={{
                            color: WA.text,
                            fontWeight: unread ? 500 : 400,
                          }}
                        >
                          {title}
                        </span>
                        <span
                          className="shrink-0 text-[12px] leading-none"
                          style={{
                            color: unread ? WA.green : WA.muted,
                          }}
                        >
                          {formatChatListTime(c.lastMessageAt)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <p
                          className="truncate text-[14px] leading-snug"
                          style={{ color: WA.muted }}
                        >
                          {preview}
                        </p>
                        <div className="flex shrink-0 items-center gap-1.5">
                          {unread ? (
                            <span
                              className="flex min-w-[20px] items-center justify-center rounded-full px-[5px] py-[2px] text-[12px] font-medium leading-none text-[#111b21]"
                              style={{ backgroundColor: WA.greenBadge }}
                            >
                              {c.unreadCount > 99 ? "99+" : c.unreadCount}
                            </span>
                          ) : null}
                        </div>
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
