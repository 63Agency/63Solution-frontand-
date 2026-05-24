"use client";

import { Search } from "lucide-react";
import type { WhatsAppConversation } from "@/lib/whatsapp/types";
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

  return (
    <div className="flex h-full min-h-0 flex-col border-r border-zinc-800 bg-zinc-900/80">
      <div className="border-b border-zinc-800 p-3">
        <h1 className="font-mono text-xs uppercase tracking-widest text-zinc-300">
          WhatsApp
        </h1>
        <div className="relative mt-3">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500"
            aria-hidden
          />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Rechercher une conversation…"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 py-2 pl-9 pr-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-600 focus:outline-none"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading && filtered.length === 0 ? (
          <p className="p-4 text-center text-sm text-zinc-500">Chargement…</p>
        ) : null}
        {!loading && filtered.length === 0 ? (
          <p className="p-4 text-center text-sm text-zinc-500">
            Aucune conversation. Les leads apparaîtront ici après le premier message WhatsApp
            (webhook Meta).
          </p>
        ) : null}
        <ul>
          {filtered.map((c) => {
            const active = c.id === selectedId;
            const title = conversationDisplayName(c.contactName, c.phoneNumber);
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => onSelect(c.id)}
                  className={`flex w-full gap-3 border-b border-zinc-800/80 px-3 py-3 text-left transition-colors hover:bg-zinc-800/60 ${
                    active ? "bg-zinc-800" : ""
                  }`}
                >
                  <div
                    className="flex size-11 shrink-0 items-center justify-center rounded-full bg-emerald-900/50 font-mono text-sm font-semibold text-emerald-200"
                    aria-hidden
                  >
                    {title.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate font-medium text-zinc-100">{title}</span>
                      <span className="shrink-0 text-[11px] text-zinc-500">
                        {formatChatTime(c.lastMessageAt)}
                      </span>
                    </div>
                    <p className="truncate text-xs text-zinc-500">
                      {formatWhatsAppPhone(c.phoneNumber)}
                    </p>
                    <div className="mt-0.5 flex items-center justify-between gap-2">
                      <p className="truncate text-sm text-zinc-400">
                        {c.lastMessageText?.trim() || "—"}
                      </p>
                      {c.unreadCount > 0 ? (
                        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white">
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
      </div>
    </div>
  );
}
