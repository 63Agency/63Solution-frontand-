"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  fetchWhatsAppConversations,
  getWhatsAppPollIntervalMs,
} from "@/lib/whatsapp/backend-whatsapp";
import type { WhatsAppConversation } from "@/lib/whatsapp/types";
import { ChatThread } from "./ChatThread";
import { ConversationList } from "./ConversationList";

export function ConversationsPage() {
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
    const ms = getWhatsAppPollIntervalMs();
    const id = window.setInterval(() => {
      setPollTick((t) => t + 1);
      void loadConversations(true);
    }, ms);
    return () => window.clearInterval(id);
  }, [loadConversations]);

  return (
    <div className="flex h-dvh max-h-dvh flex-col overflow-hidden">
      {apiUnavailable ? (
        <div className="shrink-0 border-b border-amber-800/50 bg-amber-950/40 px-4 py-2 text-center text-xs text-amber-200">
          API WhatsApp non disponible — le backend doit exposer GET /whatsapp/conversations
          (voir instructions envoyées au dev backend).
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 md:grid-cols-[minmax(280px,360px)_1fr]">
        <div
          className={`min-h-0 ${selectedId ? "hidden md:block" : "block"}`}
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
          className={`min-h-0 ${selectedId ? "block" : "hidden md:block"}`}
        >
          <ChatThread
            conversation={selected}
            pollTick={pollTick}
            onConversationUpdate={() => void loadConversations(true)}
            onBack={() => setSelectedId(null)}
          />
        </div>
      </div>
    </div>
  );
}
