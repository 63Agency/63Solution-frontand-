"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import {
  fetchWhatsAppMessages,
  markWhatsAppConversationRead,
  sendWhatsAppMessage,
} from "@/lib/whatsapp/backend-whatsapp";
import type { WhatsAppConversation, WhatsAppMessage } from "@/lib/whatsapp/types";
import { MessageBubble } from "./MessageBubble";
import {
  conversationDisplayName,
  formatWhatsAppPhone,
} from "./whatsapp-utils";

type Props = {
  conversation: WhatsAppConversation | null;
  pollTick: number;
  onConversationUpdate: () => void;
  onBack?: () => void;
};

export function ChatThread({
  conversation,
  pollTick,
  onConversationUpdate,
  onBack,
}: Props) {
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const conversationId = conversation?.id ?? null;

  const loadMessages = async (silent = false) => {
    if (!conversationId) return;
    if (!silent) setLoading(true);
    try {
      const page = await fetchWhatsAppMessages(conversationId, { limit: 200 });
      setMessages(page.items);
    } catch (e) {
      if (!silent) {
        toast.error(e instanceof Error ? e.message : "Impossible de charger les messages.");
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      return;
    }
    setDraft("");
    void loadMessages();
    void markWhatsAppConversationRead(conversationId)
      .then(() => onConversationUpdate())
      .catch(() => undefined);
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId || pollTick === 0) return;
    void loadMessages(true);
  }, [pollTick, conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, conversationId]);

  const handleSend = async () => {
    if (!conversationId || !draft.trim()) return;
    setSending(true);
    const text = draft.trim();
    setDraft("");
    try {
      const sent = await sendWhatsAppMessage(conversationId, { text });
      setMessages((prev) => [...prev, sent]);
      onConversationUpdate();
    } catch (e) {
      setDraft(text);
      toast.error(e instanceof Error ? e.message : "Envoi impossible.");
    } finally {
      setSending(false);
    }
  };

  if (!conversation) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-zinc-950/50 p-8 text-center">
        <p className="max-w-sm text-sm text-zinc-500">
          Sélectionne une conversation pour répondre aux leads WhatsApp (N8N + Wati).
        </p>
      </div>
    );
  }

  const title = conversationDisplayName(
    conversation.contactName,
    conversation.phoneNumber,
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#0b141a]">
      <header className="flex shrink-0 items-center gap-3 border-b border-zinc-800 bg-zinc-900 px-4 py-3">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="rounded-md p-2 text-zinc-400 hover:bg-zinc-800 md:hidden"
            aria-label="Retour aux conversations"
          >
            <ArrowLeft className="size-5" aria-hidden />
          </button>
        ) : null}
        <div className="flex size-10 items-center justify-center rounded-full bg-emerald-800/60 text-sm font-semibold text-emerald-100">
          {title.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <h2 className="truncate font-medium text-zinc-100">{title}</h2>
          <p className="truncate text-xs text-zinc-500">
            {formatWhatsAppPhone(conversation.phoneNumber)}
            {conversation.source ? ` · ${conversation.source}` : ""}
          </p>
        </div>
      </header>

      <div
        ref={listRef}
        className="min-h-0 flex-1 overflow-y-auto px-4 py-4"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgb(39 39 42 / 0.35) 1px, transparent 0)",
          backgroundSize: "24px 24px",
        }}
      >
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="size-6 animate-spin text-zinc-500" aria-hidden />
          </div>
        ) : null}
        {!loading && messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-500">Aucun message pour l’instant.</p>
        ) : null}
        <div className="flex flex-col gap-2">
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}
        </div>
        <div ref={bottomRef} />
      </div>

      <footer className="shrink-0 border-t border-zinc-800 bg-zinc-900 p-3">
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void handleSend();
          }}
        >
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
            rows={1}
            placeholder="Écrire un message…"
            className="max-h-32 min-h-[42px] flex-1 resize-y rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-600 focus:outline-none"
          />
          <button
            type="submit"
            disabled={sending || !draft.trim()}
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-40"
            aria-label="Envoyer"
          >
            {sending ? (
              <Loader2 className="size-5 animate-spin" aria-hidden />
            ) : (
              <Send className="size-5" aria-hidden />
            )}
          </button>
        </form>
      </footer>
    </div>
  );
}
