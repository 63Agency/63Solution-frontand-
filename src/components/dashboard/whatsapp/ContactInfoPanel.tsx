"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  ChevronRight,
  Clock,
  FileText,
  FolderOpen,
  Loader2,
  Lock,
  Pencil,
  Phone,
  Search,
  Shield,
  Star,
  Video,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { fetchWhatsAppMediaObjectUrl } from "@/lib/whatsapp/backend-whatsapp";
import type { WhatsAppConversation, WhatsAppMessage } from "@/lib/whatsapp/types";
import { cn } from "@/src/lib/utils";
import { ConversationAvatar } from "./ConversationAvatar";
import {
  conversationDisplayName,
  formatWhatsAppPhone,
} from "./whatsapp-utils";

const WA = {
  bg: "#111b21",
  header: "#202c33",
  card: "#202c33",
  text: "#e9edef",
  muted: "#8696a0",
  icon: "#aebac1",
  green: "#00a884",
  border: "#222d34",
  thumb: "#2a3942",
} as const;

type Props = {
  conversation: WhatsAppConversation;
  messages: WhatsAppMessage[];
  open: boolean;
  onClose: () => void;
  onSearchInChat?: () => void;
};

function isRealMediaId(value: string | null | undefined): boolean {
  const v = value?.trim() ?? "";
  if (!v || v.startsWith("[")) return false;
  return /^\d+$/.test(v);
}

function resolveMediaId(message: WhatsAppMessage): string {
  if (isRealMediaId(message.mediaId)) return message.mediaId!.trim();
  if (isRealMediaId(message.body)) return message.body.trim();
  return "";
}

function noteStorageKey(conversationId: string): string {
  return `wa-contact-note:${conversationId}`;
}

export function ContactInfoPanel({
  conversation,
  messages,
  open,
  onClose,
  onSearchInChat,
}: Props) {
  const [muted, setMuted] = useState(false);
  const [note, setNote] = useState("");
  const [editingNote, setEditingNote] = useState(false);
  const [viewer, setViewer] = useState<WhatsAppMessage | null>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLElement>(null);

  const title = conversationDisplayName(
    conversation.contactName,
    conversation.phoneNumber,
  );
  const phone = formatWhatsAppPhone(conversation.phoneNumber);

  const mediaMessages = useMemo(() => {
    const media = messages.filter(
      (m) => m.type === "image" || m.type === "video" || m.type === "document",
    );
    // Newest first for preview
    return [...media].reverse();
  }, [messages]);

  const linkCount = useMemo(() => {
    const re = /https?:\/\/[^\s]+/gi;
    let n = 0;
    for (const m of messages) {
      if (m.type !== "text") continue;
      const matches = m.body?.match(re);
      if (matches) n += matches.length;
    }
    return n;
  }, [messages]);

  const mediaTotal = mediaMessages.length + linkCount;

  useEffect(() => {
    if (!open) return;
    try {
      setNote(localStorage.getItem(noteStorageKey(conversation.id)) ?? "");
    } catch {
      setNote("");
    }
    setEditingNote(false);
    setViewer(null);
  }, [open, conversation.id]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (viewer) setViewer(null);
        else onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, viewer]);

  const saveNote = () => {
    setEditingNote(false);
    try {
      localStorage.setItem(noteStorageKey(conversation.id), note);
    } catch {
      /* ignore */
    }
  };

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            key="contact-info-backdrop"
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/55"
            aria-label="Fermer les infos du contact"
            onClick={onClose}
          />

          <motion.aside
            key="contact-info-panel"
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Infos du contact"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 36 }}
            className={cn(
              "fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l shadow-2xl",
              "max-w-[100vw] sm:max-w-[400px]",
            )}
            style={{
              backgroundColor: WA.bg,
              borderColor: WA.border,
              color: WA.text,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top bar */}
            <div
              className="flex h-[59px] shrink-0 items-center gap-2 px-2 sm:px-3"
              style={{ backgroundColor: WA.header }}
            >
              <button
                type="button"
                onClick={onClose}
                className="flex size-11 items-center justify-center rounded-full transition-colors hover:bg-white/5"
                style={{ color: WA.icon }}
                aria-label="Fermer"
              >
                <X className="size-5" strokeWidth={1.75} />
              </button>
              <h2 className="flex-1 text-center text-[16px] font-medium tracking-tight">
                Infos du contact
              </h2>
              <button
                type="button"
                className="flex size-11 items-center justify-center rounded-full transition-colors hover:bg-white/5"
                style={{ color: WA.icon }}
                aria-label="Modifier le contact"
                onClick={() => toast.message("Édition du contact bientôt disponible.")}
              >
                <Pencil className="size-[18px]" strokeWidth={1.75} />
              </button>
            </div>

            <div className="wa-scroll min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
              {/* Profile */}
              <div className="flex flex-col items-center px-5 pb-6 pt-8">
                <ConversationAvatar
                  seed={conversation.id}
                  label={title}
                  className="size-[140px] text-[52px] shadow-lg"
                />
                <h3 className="mt-4 max-w-full truncate px-2 text-center text-[22px] font-semibold leading-tight sm:text-[24px]">
                  {title}
                </h3>
                <p className="mt-1.5 text-[15px] sm:text-[16px]" style={{ color: WA.muted }}>
                  {phone}
                </p>

                <div className="mt-6 flex items-start justify-center gap-5 sm:gap-6">
                  <QuickAction
                    icon={<Phone className="size-5" strokeWidth={1.75} />}
                    label="Vocal"
                    onClick={() => toast.message("Appels vocaux bientôt disponibles.")}
                  />
                  <QuickAction
                    icon={<Video className="size-5" strokeWidth={1.75} />}
                    label="Vidéo"
                    onClick={() => toast.message("Appels vidéo bientôt disponibles.")}
                  />
                  <QuickAction
                    icon={<Search className="size-5" strokeWidth={1.75} />}
                    label="Rechercher"
                    onClick={() => {
                      onClose();
                      onSearchInChat?.();
                    }}
                  />
                </div>
              </div>

              {/* Note */}
              <section
                className="border-y px-4 py-3.5"
                style={{ borderColor: WA.border, backgroundColor: WA.card }}
              >
                <div className="flex items-start gap-2">
                  {editingNote ? (
                    <textarea
                      ref={noteRef}
                      autoFocus
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      onBlur={saveNote}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          saveNote();
                        }
                        if (e.key === "Escape") {
                          e.preventDefault();
                          try {
                            setNote(
                              localStorage.getItem(noteStorageKey(conversation.id)) ?? "",
                            );
                          } catch {
                            /* ignore */
                          }
                          setEditingNote(false);
                        }
                      }}
                      placeholder="Ajoutez une note sur ce·tte client·e."
                      rows={2}
                      className="min-h-[48px] w-full resize-none bg-transparent text-[14px] leading-snug outline-none placeholder:text-[#8696a0]"
                      style={{ color: WA.text }}
                    />
                  ) : (
                    <button
                      type="button"
                      className="min-h-[44px] min-w-0 flex-1 py-1 text-left text-[14px] leading-snug"
                      style={{ color: note.trim() ? WA.text : WA.muted }}
                      onClick={() => setEditingNote(true)}
                    >
                      {note.trim() || "Ajoutez une note sur ce·tte client·e."}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setEditingNote(true)}
                    className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full hover:bg-white/5"
                    style={{ color: WA.icon }}
                    aria-label="Modifier la note"
                  >
                    <Pencil className="size-4" />
                  </button>
                </div>
              </section>

              {/* Media */}
              <section
                className="mt-2 border-y px-4 py-3"
                style={{ borderColor: WA.border, backgroundColor: WA.card }}
              >
                <button
                  type="button"
                  className="flex min-h-[44px] w-full items-center gap-3 text-left"
                  onClick={() => {
                    if (mediaMessages[0]) setViewer(mediaMessages[0]);
                    else toast.message("Aucun média dans cette discussion.");
                  }}
                >
                  <FolderOpen className="size-5 shrink-0" style={{ color: WA.icon }} strokeWidth={1.75} />
                  <span className="min-w-0 flex-1 text-[15px]">Médias, liens et documents</span>
                  <span className="tabular-nums text-[14px]" style={{ color: WA.muted }}>
                    {mediaTotal}
                  </span>
                  <ChevronRight className="size-4" style={{ color: WA.muted }} />
                </button>

                {mediaMessages.length > 0 ? (
                  <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {mediaMessages.slice(0, 4).map((m) => (
                      <MediaThumb
                        key={m.id}
                        message={m}
                        onOpen={() => setViewer(m)}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-[13px]" style={{ color: WA.muted }}>
                    Aucun média pour le moment
                  </p>
                )}
              </section>

              {/* Settings */}
              <section
                className="mt-2 border-y"
                style={{ borderColor: WA.border, backgroundColor: WA.card }}
              >
                <InfoRow
                  icon={<Star className="size-5" strokeWidth={1.75} />}
                  label="Messages importants"
                  onClick={() => toast.message("Messages importants bientôt disponibles.")}
                />
                <InfoRow
                  icon={<Bell className="size-5" strokeWidth={1.75} />}
                  label="Mode silencieux"
                  trailing={
                    <button
                      type="button"
                      role="switch"
                      aria-checked={muted}
                      onClick={(e) => {
                        e.stopPropagation();
                        setMuted((v) => !v);
                      }}
                      className={cn(
                        "relative h-[20px] w-[36px] shrink-0 rounded-full transition-colors",
                        muted ? "bg-[#00a884]" : "bg-[#3b4a54]",
                      )}
                    >
                      <span
                        className={cn(
                          "absolute top-[2px] size-4 rounded-full bg-white transition-transform",
                          muted ? "translate-x-[16px]" : "translate-x-[2px]",
                        )}
                      />
                    </button>
                  }
                  onClick={() => setMuted((v) => !v)}
                />
                <InfoRow
                  icon={<Clock className="size-5" strokeWidth={1.75} />}
                  label="Messages éphémères"
                  sublabel="Non"
                  onClick={() => toast.message("Messages éphémères bientôt disponibles.")}
                />
                <InfoRow
                  icon={<Shield className="size-5" strokeWidth={1.75} />}
                  label="Confidentialité avancée de la discussion"
                  sublabel="Désactivée"
                  onClick={() => toast.message("Confidentialité bientôt disponible.")}
                />
                <InfoRow
                  icon={<Lock className="size-5" strokeWidth={1.75} />}
                  label="Chiffrement"
                  sublabel="Les messages sont chiffrés de bout en bout."
                  last
                  onClick={() =>
                    toast.message("Les messages sont chiffrés de bout en bout.")
                  }
                />
              </section>

              <div className="h-10" />
            </div>
          </motion.aside>

          <AnimatePresence>
            {viewer ? (
              <MediaViewer
                message={viewer}
                onClose={() => setViewer(null)}
              />
            ) : null}
          </AnimatePresence>
        </>
      ) : null}
    </AnimatePresence>
  );
}

function MediaThumb({
  message,
  onOpen,
}: {
  message: WhatsAppMessage;
  onOpen: () => void;
}) {
  const mediaId = resolveMediaId(message);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (message.type !== "image" || !mediaId) return;
    let objectUrl: string | null = null;
    let cancelled = false;
    void (async () => {
      try {
        const blob = await fetchWhatsAppMediaObjectUrl(mediaId);
        if (cancelled) {
          URL.revokeObjectURL(blob);
          return;
        }
        objectUrl = blob;
        setUrl(blob);
      } catch {
        /* keep placeholder */
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [message.type, mediaId]);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="relative size-[72px] shrink-0 overflow-hidden rounded-md"
      style={{ backgroundColor: WA.thumb }}
      aria-label={`Ouvrir ${message.type}`}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="size-full object-cover" />
      ) : (
        <span
          className="flex size-full flex-col items-center justify-center gap-1 text-[10px] font-medium uppercase"
          style={{ color: WA.muted }}
        >
          {message.type === "image" ? (
            <Loader2 className="size-4 animate-spin opacity-50" />
          ) : message.type === "video" ? (
            <Video className="size-5" />
          ) : (
            <FileText className="size-5" />
          )}
          {message.type === "image" ? "" : message.type === "video" ? "Vidéo" : "Doc"}
        </span>
      )}
    </button>
  );
}

function MediaViewer({
  message,
  onClose,
}: {
  message: WhatsAppMessage;
  onClose: () => void;
}) {
  const mediaId = resolveMediaId(message);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!mediaId || (message.type !== "image" && message.type !== "video")) {
      setError(true);
      return;
    }
    let objectUrl: string | null = null;
    let cancelled = false;
    void (async () => {
      try {
        const blob = await fetchWhatsAppMediaObjectUrl(mediaId);
        if (cancelled) {
          URL.revokeObjectURL(blob);
          return;
        }
        objectUrl = blob;
        setUrl(blob);
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [mediaId, message.type]);

  return (
    <motion.div
      className="fixed inset-0 z-60 flex flex-col bg-black/90"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <div className="flex h-14 shrink-0 items-center justify-between px-3">
        <button
          type="button"
          onClick={onClose}
          className="flex size-11 items-center justify-center rounded-full text-white hover:bg-white/10"
          aria-label="Fermer"
        >
          <X className="size-5" />
        </button>
        <span className="text-sm text-white/80 capitalize">{message.type}</span>
        <span className="size-11" />
      </div>
      <div
        className="flex min-h-0 flex-1 items-center justify-center p-4"
        onClick={(e) => e.stopPropagation()}
      >
        {error ? (
          <p className="text-sm text-white/70">
            {message.type === "document"
              ? `Document${message.body ? ` · ${message.body.slice(0, 40)}` : ""}`
              : "Média indisponible"}
          </p>
        ) : !url ? (
          <Loader2 className="size-8 animate-spin text-white/60" />
        ) : message.type === "video" ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video src={url} controls className="max-h-full max-w-full rounded-lg" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="max-h-full max-w-full rounded-lg object-contain" />
        )}
      </div>
    </motion.div>
  );
}

function QuickAction({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-[76px] cursor-pointer flex-col items-center gap-1.5"
    >
      <span
        className="flex size-12 items-center justify-center rounded-full"
        style={{ backgroundColor: WA.thumb, color: WA.green }}
      >
        {icon}
      </span>
      <span className="text-[12px] font-medium" style={{ color: WA.green }}>
        {label}
      </span>
    </button>
  );
}

function InfoRow({
  icon,
  label,
  sublabel,
  trailing,
  last,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  trailing?: React.ReactNode;
  last?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={cn(
        "flex w-full items-center gap-4 px-4 py-3.5 text-left transition-colors",
        onClick && "cursor-pointer",
        !last && "border-b",
      )}
      style={{ borderColor: WA.border }}
    >
      <span className="shrink-0" style={{ color: WA.icon }}>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] leading-snug">{label}</p>
        {sublabel ? (
          <p className="mt-0.5 text-[13px] leading-snug" style={{ color: WA.muted }}>
            {sublabel}
          </p>
        ) : null}
      </div>
      {trailing}
    </div>
  );
}
