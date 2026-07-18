"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Loader2,
  MessageCircle,
  Mic,
  MoreVertical,
  Phone,
  Plus,
  Search,
  SendHorizontal,
  Smile,
  Video,
  X,
} from "lucide-react";
import { toast } from "sonner";
import EmojiPicker, { Theme, type EmojiClickData } from "emoji-picker-react";
import {
  classifyMediaFile,
  mediaDisplayUrl,
  uploadChatMedia,
} from "@/lib/upload/backend-upload";
import {
  fetchWhatsAppMessages,
  markWhatsAppConversationRead,
  sendWhatsAppMessage,
} from "@/lib/whatsapp/backend-whatsapp";
import type { WhatsAppConversation, WhatsAppMessage } from "@/lib/whatsapp/types";
import { cn } from "@/src/lib/utils";
import {
  AttachmentMenu,
  type AttachmentMenuAction,
} from "./AttachmentMenu";
import { ChatDateDivider } from "./ChatDateDivider";
import { ContactInfoPanel } from "./ContactInfoPanel";
import { ConversationAvatar } from "./ConversationAvatar";
import { MediaSendPreview, type MediaPreviewKind } from "./MediaSendPreview";
import { MessageBubble } from "./MessageBubble";
import {
  MessageContextMenu,
  type MessageMenuAction,
} from "./MessageContextMenu";
import {
  conversationDisplayName,
  formatMessageDayLabel,
} from "./whatsapp-utils";

const WHATSAPP_CHAT_BG = "/images/image.png";
const MEDIA_FOLDER = "63agency/whatsapp";

const WA = {
  bg: "#0b141a",
  header: "#202c33",
  text: "#e9edef",
  muted: "#8696a0",
  green: "#00a884",
  panel: "#233138",
  border: "rgba(134,150,160,0.2)",
  icon: "#aebac1",
} as const;

type Props = {
  conversation: WhatsAppConversation | null;
  pollTick?: number;
  onConversationUpdate: () => void;
  onBack?: () => void;
};

type PendingMedia = {
  file: File;
  kind: MediaPreviewKind;
  localId: string;
};

function messagePreview(message: WhatsAppMessage): string {
  if (message.type === "image") return message.body?.trim() || "Photo";
  if (message.type === "video") return message.body?.trim() || "Vidéo";
  if (message.type === "document")
    return message.fileName?.trim() || message.body?.trim() || "Document";
  if (message.type === "audio") return "Audio";
  const t = message.body?.trim() ?? "";
  if (!t) return "Message";
  return t.length > 80 ? `${t.slice(0, 80)}…` : t;
}

function MessageTimeline({
  messages,
  highlightQuery,
  activeMatchId,
  onOpenMenu,
  onQuickReply,
  onRetryUpload,
}: {
  messages: WhatsAppMessage[];
  highlightQuery?: string;
  activeMatchId?: string | null;
  onOpenMenu: (message: WhatsAppMessage, x: number, y: number) => void;
  onQuickReply: (message: WhatsAppMessage) => void;
  onRetryUpload: (message: WhatsAppMessage) => void;
}) {
  const nodes: React.ReactNode[] = [];
  let lastDay = "";

  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    const day = formatMessageDayLabel(m.sentAt ?? m.createdAt);
    if (day && day !== lastDay) {
      nodes.push(<ChatDateDivider key={`day-${day}-${m.id}`} label={day} />);
      lastDay = day;
    }

    const prev = messages[i - 1];
    const next = messages[i + 1];
    const showTail =
      !prev ||
      prev.direction !== m.direction ||
      formatMessageDayLabel(prev.sentAt ?? prev.createdAt) !== day;
    const tightNext =
      !!next &&
      next.direction === m.direction &&
      formatMessageDayLabel(next.sentAt ?? next.createdAt) === day;

    nodes.push(
      <MessageBubble
        key={m.id}
        message={m}
        showTail={showTail}
        tightNext={tightNext}
        highlightQuery={highlightQuery}
        isActiveMatch={activeMatchId === m.id}
        onOpenMenu={onOpenMenu}
        onQuickReply={onQuickReply}
        onRetryUpload={onRetryUpload}
      />,
    );
  }

  return <div className="flex flex-col px-2 sm:px-4">{nodes}</div>;
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
  const [searchOpen, setSearchOpen] = useState(false);
  const [threadSearch, setThreadSearch] = useState("");
  const [matchIndex, setMatchIndex] = useState(0);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [replyTo, setReplyTo] = useState<WhatsAppMessage | null>(null);
  const [menu, setMenu] = useState<{
    message: WhatsAppMessage;
    x: number;
    y: number;
  } | null>(null);
  const [contactInfoOpen, setContactInfoOpen] = useState(false);
  const [preview, setPreview] = useState<{
    file: File;
    kind: MediaPreviewKind;
  } | null>(null);
  const [previewSending, setPreviewSending] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const pendingFilesRef = useRef<Map<string, PendingMedia>>(new Map());

  const conversationId = conversation?.id ?? null;
  const hasDraft = draft.trim().length > 0;

  const matchIds = useMemo(() => {
    const q = threadSearch.trim().toLowerCase();
    if (!q) return [] as string[];
    return messages
      .filter((m) => {
        const hay = `${m.body ?? ""} ${m.fileName ?? ""}`.toLowerCase();
        return hay.includes(q);
      })
      .map((m) => m.id);
  }, [messages, threadSearch]);

  const activeMatchId = matchIds[matchIndex] ?? null;

  const loadMessages = async (silent = false) => {
    if (!conversationId) return;
    if (!silent) setLoading(true);
    try {
      const page = await fetchWhatsAppMessages(conversationId);
      setMessages((prev) => {
        const locals = prev.filter(
          (m) =>
            m.id.startsWith("local-") &&
            (m.uploadProgress != null || m.uploadError),
        );
        const remoteIds = new Set(page.items.map((m) => m.id));
        const keepLocals = locals.filter((m) => !remoteIds.has(m.id));
        return [...page.items, ...keepLocals].sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
      });
      void markWhatsAppConversationRead(conversationId).then(() => {
        onConversationUpdate();
      });
    } catch (e) {
      if (!silent) {
        toast.error(e instanceof Error ? e.message : "Chargement impossible.");
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    void loadMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  useEffect(() => {
    if (pollTick == null || !conversationId) return;
    void loadMessages(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollTick]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, conversationId]);

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (composerRef.current && !composerRef.current.contains(target)) {
        setEmojiOpen(false);
        setAttachOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const insertAtCursor = (text: string) => {
    const el = textareaRef.current;
    if (!el) {
      setDraft((prev) => prev + text);
      return;
    }
    const start = el.selectionStart ?? draft.length;
    const end = el.selectionEnd ?? draft.length;
    const next = draft.slice(0, start) + text + draft.slice(end);
    setDraft(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + text.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const onEmojiClick = (emojiData: EmojiClickData) => {
    insertAtCursor(emojiData.emoji);
  };

  const startReply = (message: WhatsAppMessage) => {
    setReplyTo(message);
    setMenu(null);
    setEmojiOpen(false);
    setAttachOpen(false);
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const handleMenuAction = (action: MessageMenuAction, reaction?: string) => {
    if (!menu) return;
    const msg = menu.message;
    setMenu(null);

    if (action === "reply") {
      startReply(msg);
      return;
    }
    if (action === "copy") {
      const text = msg.body?.trim() || messagePreview(msg);
      void navigator.clipboard.writeText(text).then(
        () => toast.success("Message copié"),
        () => toast.error("Impossible de copier"),
      );
      return;
    }
    if (action === "reaction" && reaction) {
      toast.message(`Réaction ${reaction}`, {
        description: "Les réactions seront synchronisées bientôt.",
      });
      return;
    }
    if (action === "delete") {
      toast.message("Suppression non disponible pour le moment.");
      return;
    }
    toast.message("Bientôt disponible");
  };

  const handleSend = async () => {
    if (!conversationId || !draft.trim()) return;
    setSending(true);
    setEmojiOpen(false);
    setAttachOpen(false);
    const text = draft.trim();
    const quoting = replyTo;
    setDraft("");
    setReplyTo(null);
    try {
      const replyToMessageId =
        quoting?.metaMessageId?.trim() ||
        quoting?.watiMessageId?.trim() ||
        quoting?.id ||
        undefined;
      const sent = await sendWhatsAppMessage(conversationId, {
        text,
        replyToMessageId,
      });
      const withQuote: WhatsAppMessage = quoting
        ? {
            ...sent,
            replyTo: {
              id: quoting.id,
              body: messagePreview(quoting),
              authorLabel:
                quoting.direction === "outbound"
                  ? "Vous"
                  : conversationDisplayName(
                      conversation?.contactName,
                      conversation?.phoneNumber,
                    ),
            },
          }
        : sent;
      setMessages((prev) => [...prev, withQuote]);
      onConversationUpdate();
    } catch (e) {
      setDraft(text);
      if (quoting) setReplyTo(quoting);
      toast.error(e instanceof Error ? e.message : "Envoi impossible.");
    } finally {
      setSending(false);
    }
  };

  const patchLocalMessage = (
    localId: string,
    patch: Partial<WhatsAppMessage>,
  ) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === localId ? { ...m, ...patch } : m)),
    );
  };

  const sendMediaMessage = async (
    file: File,
    kind: MediaPreviewKind,
    caption: string,
    localId: string,
    quoting: WhatsAppMessage | null,
  ) => {
    if (!conversationId) return;

    pendingFilesRef.current.set(localId, { file, kind, localId });

    const localPreviewUrl = URL.createObjectURL(file);
    const optimistic: WhatsAppMessage = {
      id: localId,
      conversationId,
      direction: "outbound",
      body: caption || file.name,
      type: kind,
      mediaUrl: kind === "document" ? null : localPreviewUrl,
      fileName: file.name,
      fileSize: file.size,
      status: "pending",
      createdAt: new Date().toISOString(),
      uploadProgress: 0,
      uploadError: null,
      replyTo: quoting
        ? {
            id: quoting.id,
            body: messagePreview(quoting),
            authorLabel:
              quoting.direction === "outbound"
                ? "Vous"
                : conversationDisplayName(
                    conversation?.contactName,
                    conversation?.phoneNumber,
                  ),
          }
        : null,
    };

    setMessages((prev) => {
      if (prev.some((m) => m.id === localId)) {
        return prev.map((m) => (m.id === localId ? optimistic : m));
      }
      return [...prev, optimistic];
    });

    try {
      const uploaded = await uploadChatMedia(file, {
        folder: MEDIA_FOLDER,
        forceKind: kind === "document" ? "document" : undefined,
        onProgress: (percent) => {
          patchLocalMessage(localId, {
            uploadProgress: Math.min(percent, 95),
            uploadError: null,
          });
        },
      });

      const mediaUrl = mediaDisplayUrl(uploaded.media);
      const resolvedKind =
        kind === "document"
          ? "document"
          : uploaded.kind === "video"
            ? "video"
            : uploaded.kind === "image"
              ? "image"
              : kind;

      patchLocalMessage(localId, {
        mediaUrl,
        type: resolvedKind,
        uploadProgress: 98,
      });

      const replyToMessageId =
        quoting?.metaMessageId?.trim() ||
        quoting?.watiMessageId?.trim() ||
        quoting?.id ||
        undefined;

      const sent = await sendWhatsAppMessage(conversationId, {
        text: caption || undefined,
        type: resolvedKind,
        mediaUrl,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || undefined,
        replyToMessageId,
      });

      pendingFilesRef.current.delete(localId);
      URL.revokeObjectURL(localPreviewUrl);

      setMessages((prev) =>
        prev.map((m) =>
          m.id === localId
            ? {
                ...sent,
                replyTo: optimistic.replyTo,
                uploadProgress: null,
                uploadError: null,
              }
            : m,
        ),
      );
      onConversationUpdate();
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Échec de l'envoi du média.";
      patchLocalMessage(localId, {
        status: "failed",
        uploadProgress: null,
        uploadError: message,
      });
    }
  };

  const onConfirmPreview = async (caption: string) => {
    if (!preview || !conversationId) return;
    const { file, kind } = preview;
    const quoting = replyTo;
    const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    setPreviewSending(true);
    setPreview(null);
    setReplyTo(null);
    setPreviewSending(false);

    await sendMediaMessage(file, kind, caption, localId, quoting);
  };

  const onRetryUpload = (message: WhatsAppMessage) => {
    const pending = pendingFilesRef.current.get(message.id);
    if (!pending || !conversationId) {
      toast.error("Impossible de réessayer — fichier perdu.");
      return;
    }
    const caption =
      message.body?.trim() && message.body !== pending.file.name
        ? message.body.trim()
        : "";
    void sendMediaMessage(pending.file, pending.kind, caption, message.id, null);
  };

  const onAttachSelect = (action: AttachmentMenuAction) => {
    setAttachOpen(false);
    setEmojiOpen(false);
    if (action === "document") {
      fileInputRef.current?.click();
      return;
    }
    if (action === "media") {
      imageInputRef.current?.click();
    }
  };

  const onPickMedia = (file: File | undefined, mode: "media" | "document") => {
    setAttachOpen(false);
    if (!file) return;

    if (mode === "document") {
      setPreview({ file, kind: "document" });
      return;
    }

    const classified = classifyMediaFile(file);
    if (classified === "document") {
      toast.error("Choisissez une image ou une vidéo.");
      return;
    }
    setPreview({ file, kind: classified });
  };

  if (!conversation) {
    return (
      <div
        className="flex h-full min-h-0 flex-col items-center justify-center p-8 text-center"
        style={{ backgroundColor: WA.bg }}
      >
        <div
          className="flex size-[120px] items-center justify-center rounded-full"
          style={{ backgroundColor: WA.header }}
        >
          <MessageCircle className="size-14" style={{ color: WA.green }} strokeWidth={1.25} aria-hidden />
        </div>
        <h2 className="mt-8 text-[28px] font-light tracking-tight" style={{ color: WA.text }}>
          WhatsApp Web
        </h2>
        <p className="mt-3 max-w-md text-[14px] leading-relaxed" style={{ color: WA.muted }}>
          Sélectionnez une conversation à gauche pour lire et répondre aux messages.
        </p>
      </div>
    );
  }

  const title = conversationDisplayName(
    conversation.contactName,
    conversation.phoneNumber,
  );

  return (
    <div className="relative flex h-full min-h-0 flex-1 overflow-hidden">
      <div className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div
          className="flex h-[59px] shrink-0 items-center gap-2 px-2 sm:px-4"
          style={{ backgroundColor: WA.header }}
        >
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="flex size-10 items-center justify-center rounded-full hover:bg-white/5 lg:hidden"
              style={{ color: WA.icon }}
              aria-label="Retour"
            >
              <ArrowLeft className="size-5" />
            </button>
          ) : null}

          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-3 rounded-lg py-1 text-left"
            onClick={() => setContactInfoOpen(true)}
          >
            <ConversationAvatar
              seed={conversation.phoneNumber}
              label={title}
              size="md"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[16px] font-medium" style={{ color: WA.text }}>
                {title}
              </p>
              <p className="truncate text-[13px]" style={{ color: WA.muted }}>
                {conversation.phoneNumber}
              </p>
            </div>
          </button>

          {searchOpen ? (
            <div className="flex min-w-0 flex-[1.2] items-center gap-1">
              <input
                ref={searchInputRef}
                value={threadSearch}
                onChange={(e) => {
                  setThreadSearch(e.target.value);
                  setMatchIndex(0);
                }}
                placeholder="Rechercher…"
                className="h-9 min-w-0 flex-1 rounded-lg px-3 text-[14px] outline-none"
                style={{ backgroundColor: "#2a3942", color: WA.text }}
              />
              <span className="shrink-0 text-[12px]" style={{ color: WA.muted }}>
                {matchIds.length ? `${matchIndex + 1}/${matchIds.length}` : "0"}
              </span>
              <button
                type="button"
                disabled={!matchIds.length}
                className="flex size-8 items-center justify-center rounded-full hover:bg-white/5 disabled:opacity-40"
                style={{ color: WA.icon }}
                aria-label="Résultat précédent"
                onClick={() =>
                  setMatchIndex((i) =>
                    matchIds.length ? (i - 1 + matchIds.length) % matchIds.length : 0,
                  )
                }
              >
                <ChevronUp className="size-4" />
              </button>
              <button
                type="button"
                disabled={!matchIds.length}
                className="flex size-8 items-center justify-center rounded-full hover:bg-white/5 disabled:opacity-40"
                style={{ color: WA.icon }}
                aria-label="Résultat suivant"
                onClick={() =>
                  setMatchIndex((i) =>
                    matchIds.length ? (i + 1) % matchIds.length : 0,
                  )
                }
              >
                <ChevronDown className="size-4" />
              </button>
              <button
                type="button"
                className="flex size-8 items-center justify-center rounded-full hover:bg-white/5"
                style={{ color: WA.icon }}
                aria-label="Fermer la recherche"
                onClick={() => {
                  setSearchOpen(false);
                  setThreadSearch("");
                  setMatchIndex(0);
                }}
              >
                <X className="size-4" />
              </button>
            </div>
          ) : (
            <div className="flex shrink-0 items-center">
              <HeaderIcon label="Appel vidéo" onClick={() => toast.message("Bientôt disponible")}>
                <Video className="size-5" strokeWidth={1.75} />
              </HeaderIcon>
              <HeaderIcon label="Appeler" onClick={() => toast.message("Bientôt disponible")}>
                <Phone className="size-5" strokeWidth={1.75} />
              </HeaderIcon>
              <HeaderIcon
                label="Rechercher"
                onClick={() => {
                  setSearchOpen(true);
                  setContactInfoOpen(false);
                }}
              >
                <Search className="size-5" strokeWidth={1.75} />
              </HeaderIcon>
              <HeaderIcon label="Menu" onClick={() => toast.message("Bientôt disponible")}>
                <MoreVertical className="size-5" strokeWidth={1.75} />
              </HeaderIcon>
            </div>
          )}
        </div>

        {/* Wallpaper behind messages + composer (no solid strip under input) */}
        <div
          className="relative flex min-h-0 flex-1 flex-col overflow-hidden"
          style={{
            backgroundColor: WA.bg,
            backgroundImage: `url(${WHATSAPP_CHAT_BG})`,
            backgroundRepeat: "repeat",
            backgroundSize: "auto",
          }}
        >
          <div className="wa-scroll relative min-h-0 flex-1 overflow-y-auto">
            <div className="py-3">
              {loading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="size-6 animate-spin" style={{ color: WA.green }} />
                </div>
              ) : null}
              {!loading && messages.length === 0 ? (
                <div className="px-6 py-10 text-center">
                  <p className="text-[14px]" style={{ color: WA.muted }}>
                    Aucun message pour le moment. Envoyez le premier !
                  </p>
                </div>
              ) : null}
              {!loading && messages.length > 0 ? (
                <MessageTimeline
                  messages={messages}
                  highlightQuery={threadSearch.trim() || undefined}
                  activeMatchId={activeMatchId}
                  onOpenMenu={(message, x, y) => setMenu({ message, x, y })}
                  onQuickReply={startReply}
                  onRetryUpload={onRetryUpload}
                />
              ) : null}
              <div ref={bottomRef} className="h-2" />
            </div>
          </div>

          <div ref={composerRef} className="relative shrink-0 bg-transparent px-3 pb-3 pt-1.5">
            {attachOpen ? <AttachmentMenu onSelect={onAttachSelect} /> : null}

          {emojiOpen ? (
            <div
              className="wa-emoji-picker absolute bottom-[calc(100%+4px)] left-2 z-30 w-[min(350px,calc(100vw-1.5rem))] overflow-hidden rounded-xl shadow-xl sm:left-12"
              style={{ border: `1px solid ${WA.border}`, colorScheme: "dark" }}
            >
              <EmojiPicker
                theme={Theme.DARK}
                onEmojiClick={onEmojiClick}
                width="100%"
                height={360}
                searchPlaceHolder="Rechercher un emoji"
                previewConfig={{ showPreview: false }}
                lazyLoadEmojis
                skinTonesDisabled
              />
            </div>
          ) : null}

          <input
            ref={imageInputRef}
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={(e) => {
              onPickMedia(e.target.files?.[0], "media");
              e.target.value = "";
            }}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="*/*"
            className="hidden"
            onChange={(e) => {
              onPickMedia(e.target.files?.[0], "document");
              e.target.value = "";
            }}
          />

          <form
            className="overflow-hidden rounded-[24px]"
            style={{ backgroundColor: "#2a3942" }}
            onSubmit={(e) => {
              e.preventDefault();
              void handleSend();
            }}
          >
            {replyTo ? (
              <div
                className="flex items-stretch gap-2 border-b px-3 pt-2.5 pb-2"
                style={{ borderColor: "rgba(134,150,160,0.25)" }}
              >
                <div
                  className="min-w-0 flex-1 overflow-hidden rounded-md border-l-4 px-2.5 py-1.5"
                  style={{
                    backgroundColor: "rgba(0,0,0,0.2)",
                    borderLeftColor: "#06cf9c",
                  }}
                >
                  <p className="truncate text-[13px] font-medium" style={{ color: "#06cf9c" }}>
                    {replyTo.direction === "outbound"
                      ? "Vous"
                      : conversationDisplayName(
                          conversation.contactName,
                          conversation.phoneNumber,
                        )}
                  </p>
                  <p className="truncate text-[13px]" style={{ color: WA.muted }}>
                    {messagePreview(replyTo)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setReplyTo(null)}
                  className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full hover:bg-white/5"
                  style={{ color: WA.icon }}
                  aria-label="Annuler la réponse"
                >
                  <X className="size-5" />
                </button>
              </div>
            ) : null}

            <div className="flex min-h-[52px] items-end gap-1 py-1 pl-1.5 pr-1.5">
              <button
                type="button"
                onClick={() => {
                  setAttachOpen((v) => !v);
                  setEmojiOpen(false);
                }}
                className="mb-0.5 flex size-10 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-white/5"
                style={{ color: attachOpen ? WA.green : "#aebac1" }}
                aria-label="Joindre"
                aria-expanded={attachOpen}
              >
                <Plus className="size-[26px]" strokeWidth={1.75} aria-hidden />
              </button>

              <button
                type="button"
                onClick={() => {
                  setEmojiOpen((v) => !v);
                  setAttachOpen(false);
                }}
                className="mb-0.5 flex size-10 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-white/5"
                style={{ color: emojiOpen ? WA.green : "#aebac1" }}
                aria-label="Emoji"
                aria-expanded={emojiOpen}
              >
                <Smile className="size-[24px]" strokeWidth={1.75} aria-hidden />
              </button>

              <textarea
                ref={textareaRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape" && replyTo) {
                    e.preventDefault();
                    setReplyTo(null);
                    return;
                  }
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleSend();
                  }
                }}
                rows={1}
                placeholder={replyTo ? "Répondre…" : "Entrez un message"}
                className={cn(
                  "max-h-[120px] min-h-[40px] flex-1 resize-none bg-transparent py-[10px] pr-1",
                  "text-[15px] leading-[20px] outline-none placeholder:text-[#8696a0]",
                )}
                style={{ color: WA.text }}
              />

              {hasDraft || sending ? (
                <button
                  type="submit"
                  disabled={sending || !hasDraft}
                  className="mb-0.5 flex size-10 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-white/5 disabled:opacity-40"
                  style={{ color: "#aebac1" }}
                  aria-label="Envoyer"
                >
                  {sending ? (
                    <Loader2 className="size-5 animate-spin" style={{ color: WA.green }} aria-hidden />
                  ) : (
                    <SendHorizontal className="size-[22px]" strokeWidth={1.75} aria-hidden />
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => toast.message("Messages vocaux bientôt disponibles.")}
                  className="mb-0.5 flex size-10 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-white/5"
                  style={{ color: "#aebac1" }}
                  aria-label="Message vocal"
                >
                  <Mic className="size-[24px]" strokeWidth={1.75} aria-hidden />
                </button>
              )}
            </div>
          </form>
          </div>
        </div>
      </div>

      {menu ? (
        <MessageContextMenu
          x={menu.x}
          y={menu.y}
          onAction={handleMenuAction}
          onClose={() => setMenu(null)}
        />
      ) : null}

      <ContactInfoPanel
        conversation={conversation}
        messages={messages}
        open={contactInfoOpen}
        onClose={() => setContactInfoOpen(false)}
        onSearchInChat={() => {
          setContactInfoOpen(false);
          setSearchOpen(true);
        }}
      />

      {preview ? (
        <MediaSendPreview
          file={preview.file}
          kind={preview.kind}
          open
          sending={previewSending}
          onClose={() => {
            if (!previewSending) setPreview(null);
          }}
          onSend={(caption) => {
            void onConfirmPreview(caption);
          }}
        />
      ) : null}
    </div>
  );
}

function HeaderIcon({
  label,
  children,
  onClick,
  disabled,
}: {
  label: string;
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex size-10 items-center justify-center rounded-full transition-colors hover:bg-white/5 disabled:opacity-40"
      style={{ color: "#aebac1" }}
      aria-label={label}
    >
      {children}
    </button>
  );
}
