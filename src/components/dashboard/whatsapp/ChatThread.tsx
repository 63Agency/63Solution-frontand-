"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Loader2, MessageCircle, Send } from "lucide-react";
import { toast } from "sonner";
import {
  fetchWhatsAppMessages,
  markWhatsAppConversationRead,
  sendWhatsAppMessage,
} from "@/lib/whatsapp/backend-whatsapp";
import type { WhatsAppConversation, WhatsAppMessage } from "@/lib/whatsapp/types";
import { cn } from "@/src/lib/utils";
import { ChatDateDivider } from "./ChatDateDivider";
import { ConversationAvatar } from "./ConversationAvatar";
import { MessageBubble } from "./MessageBubble";
import {
  conversationDisplayName,
  formatMessageDayLabel,
  formatWhatsAppPhone,
} from "./whatsapp-utils";

const WHATSAPP_CHAT_BG = "/images/image.png";

type Props = {
  conversation: WhatsAppConversation | null;
  pollTick: number;
  onConversationUpdate: () => void;
  onBack?: () => void;
};

function MessageTimeline({ messages }: { messages: WhatsAppMessage[] }) {
  const nodes: React.ReactNode[] = [];
  let lastDay = "";

  for (const m of messages) {
    const day = formatMessageDayLabel(m.sentAt ?? m.createdAt);
    if (day && day !== lastDay) {
      nodes.push(<ChatDateDivider key={`day-${day}-${m.id}`} label={day} />);
      lastDay = day;
    }
    nodes.push(<MessageBubble key={m.id} message={m} />);
  }

  return <div className="flex flex-col gap-1.5">{nodes}</div>;
}

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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }, [draft]);

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
      <div className="flex h-full min-h-0 flex-col items-center justify-center bg-[#0b141a] p-8 text-center md:rounded-xl md:border md:border-zinc-800">
        <div className="flex size-20 items-center justify-center rounded-3xl bg-[#202c33] ring-1 ring-zinc-700/40">
          <MessageCircle className="size-10 text-emerald-500/80" aria-hidden />
        </div>
        <h2 className="mt-6 text-lg font-semibold text-zinc-200">WhatsApp Business</h2>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-zinc-500">
          Sélectionnez une conversation à gauche pour lire et répondre aux messages de vos leads.
        </p>
        <p className="mt-4 text-xs text-zinc-600">
          Entrée pour envoyer · Maj+Entrée pour un saut de ligne
        </p>
      </div>
    );
  }

  const title = conversationDisplayName(
    conversation.contactName,
    conversation.phoneNumber,
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#0b141a] md:rounded-xl md:border md:border-zinc-800 md:overflow-hidden">
      <header className="flex shrink-0 items-center gap-3 border-b border-zinc-800/80 bg-[#202c33] px-4 py-3 shadow-sm">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="rounded-full p-2 text-zinc-400 transition-colors hover:text-zinc-100 md:hidden"
            aria-label="Retour aux conversations"
          >
            <ArrowLeft className="size-5" aria-hidden />
          </button>
        ) : null}
        <ConversationAvatar seed={conversation.id} label={title} size="md" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[15px] font-semibold text-zinc-100">{title}</h2>
          <p className="truncate text-xs text-zinc-500">
            {formatWhatsAppPhone(conversation.phoneNumber)}
            {conversation.source ? (
              <span className="text-zinc-600"> · {conversation.source}</span>
            ) : null}
          </p>
        </div>
        {conversation.unreadCount > 0 ? (
          <span className="hidden shrink-0 rounded-full bg-emerald-600/20 px-2 py-0.5 text-[10px] font-medium text-emerald-300 sm:inline">
            {conversation.unreadCount} non lu{conversation.unreadCount > 1 ? "s" : ""}
          </span>
        ) : null}
      </header>

      <div
        className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain bg-[#0b141a] bg-cover bg-center bg-no-repeat px-3 py-4 sm:px-5"
        style={{ backgroundImage: `url(${WHATSAPP_CHAT_BG})` }}
      >
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="size-7 animate-spin text-emerald-600/80" aria-hidden />
          </div>
        ) : null}
        {!loading && messages.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <p className="text-sm text-zinc-500">Aucun message pour l’instant.</p>
            <p className="mt-1 text-xs text-zinc-600">Envoyez le premier message ci-dessous.</p>
          </div>
        ) : null}
        {!loading && messages.length > 0 ? <MessageTimeline messages={messages} /> : null}
        <div ref={bottomRef} className="h-1" />
      </div>

      <footer className="shrink-0 border-t border-zinc-800/80 bg-[#202c33] px-3 py-3 sm:px-4">
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void handleSend();
          }}
        >
          <textarea
            ref={textareaRef}
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
            className={cn(
              "max-h-32 min-h-[44px] flex-1 resize-none rounded-2xl border border-zinc-700/60",
              "bg-[#2a3942] px-4 py-2.5 text-sm text-zinc-100 shadow-inner",
              "placeholder:text-zinc-500 focus:border-emerald-600/60 focus:outline-none focus:ring-2 focus:ring-emerald-600/15",
            )}
          />
          <button
            type="submit"
            disabled={sending || !draft.trim()}
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-900/30 transition-transform hover:bg-emerald-500 active:scale-95 disabled:scale-100 disabled:opacity-40 disabled:shadow-none"
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
