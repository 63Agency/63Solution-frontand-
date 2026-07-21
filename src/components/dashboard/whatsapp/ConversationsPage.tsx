"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  fetchWhatsAppConversations,
  getWhatsAppPollIntervalMs,
} from "@/lib/whatsapp/backend-whatsapp";
import type { WhatsAppConversation } from "@/lib/whatsapp/types";
import {
  setActiveWhatsAppConversationId,
  useNotifications,
} from "../notifications/NotificationsProvider";
import { ChatThread } from "./ChatThread";
import { ConversationList } from "./ConversationList";

export function ConversationsPage() {
  const searchParams = useSearchParams();
  const { refresh: refreshNotifications } = useNotifications();
  const [conversations, setConversations] = useState<WhatsAppConversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [apiUnavailable, setApiUnavailable] = useState(false);
  const [pollTick, setPollTick] = useState(0);

  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  const loadConversations = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const list = await fetchWhatsAppConversations();
      setConversations(list);
      setApiUnavailable(false);
      setSelectedId((prev) => {
        if (prev && list.some((c) => c.id === prev)) return prev;
        return list[0]?.id ?? null;
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur chargement conversations.";
      if (!silent) toast.error(msg);
      if (
        msg.includes("404") ||
        msg.toLowerCase().includes("cannot get") ||
        msg.toLowerCase().includes("not found")
      ) {
        setApiUnavailable(true);
      }
      setConversations([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    const fromUrl = searchParams.get("c");
    if (fromUrl) setSelectedId(fromUrl);
  }, [searchParams]);

  useEffect(() => {
    setActiveWhatsAppConversationId(selectedId);
    return () => setActiveWhatsAppConversationId(null);
  }, [selectedId]);

  useEffect(() => {
    const ms = getWhatsAppPollIntervalMs();
    const id = window.setInterval(() => {
      setPollTick((t) => t + 1);
      void loadConversations(true);
    }, ms);
    return () => window.clearInterval(id);
  }, [loadConversations]);

  return (
    <div
      className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden"
      style={{ backgroundColor: "#0b141a" }}
    >
      {apiUnavailable ? (
        <div className="shrink-0 flex items-center justify-center gap-2 border-b border-amber-800/40 bg-amber-950/50 px-4 py-2.5 text-center text-xs text-amber-100/90">
          <span className="size-1.5 shrink-0 rounded-full bg-amber-400" aria-hidden />
          API WhatsApp indisponible — le backend doit exposer{" "}
          <code className="rounded bg-amber-950/80 px-1 py-0.5 font-mono text-[10px] text-amber-200">
            GET /whatsapp/conversations
          </code>
        </div>
      ) : null}

      <div className="grid min-h-0 min-w-0 flex-1 gap-0 overflow-hidden md:grid-cols-[minmax(320px,410px)_1fr]">
        <div
          className={`min-h-0 min-w-0 w-full max-w-full border-r border-[#222d34] ${selectedId ? "hidden md:block" : "block"}`}
        >
          <ConversationList
            conversations={conversations}
            selectedId={selectedId}
            search={search}
            onSearchChange={setSearch}
            onSelect={setSelectedId}
            loading={loading}
          />
        </div>
        <div
          className={`min-h-0 min-w-0 w-full max-w-full overflow-hidden ${selectedId ? "block" : "hidden md:block"}`}
        >
          <ChatThread
            conversation={selected}
            pollTick={pollTick}
            onConversationUpdate={() => {
              void loadConversations(true);
              void refreshNotifications();
            }}
            onBack={() => setSelectedId(null)}
          />
        </div>
      </div>
    </div>
  );
}
