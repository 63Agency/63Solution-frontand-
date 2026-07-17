"use client";

import { useEffect, useState } from "react";
import { Check, CheckCheck, Loader2, Mic } from "lucide-react";
import {
  fetchWhatsAppMediaObjectUrl,
} from "@/lib/whatsapp/backend-whatsapp";
import type { WhatsAppMessage } from "@/lib/whatsapp/types";
import { cn } from "@/src/lib/utils";
import { formatChatTime } from "./whatsapp-utils";

type Props = {
  message: WhatsAppMessage;
};

function StatusIcon({ status }: { status: WhatsAppMessage["status"] }) {
  if (status === "failed") {
    return <span className="text-[10px] font-bold text-red-300">!</span>;
  }
  if (status === "read") {
    return <CheckCheck className="size-3.5 text-sky-300" aria-hidden />;
  }
  if (status === "delivered") {
    return <CheckCheck className="size-3.5 text-emerald-200/70" aria-hidden />;
  }
  return <Check className="size-3.5 text-emerald-200/50" aria-hidden />;
}

/**
 * Loads WhatsApp audio via:
 * 1) GET /whatsapp/media/:mediaId
 * 2) GET /whatsapp/media/:mediaId/content → blob → object URL
 */
function AudioPlayer({ mediaId }: { mediaId: string }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    setLoading(true);
    setError(null);
    setBlobUrl(null);

    void (async () => {
      try {
        // Resolves media metadata then downloads /content as blob (creates object URL).
        const url = await fetchWhatsAppMediaObjectUrl(mediaId);
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        objectUrl = url;
        setBlobUrl(url);
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Audio indisponible");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [mediaId]);

  if (loading) {
    return (
      <div className="flex min-w-[220px] items-center gap-2 rounded-lg border border-zinc-700/50 bg-zinc-950/40 px-3 py-2.5 text-xs text-zinc-400">
        <Loader2 className="size-4 shrink-0 animate-spin text-emerald-400" aria-hidden />
        Chargement audio…
      </div>
    );
  }

  if (error || !blobUrl) {
    return (
      <div className="rounded-lg border border-red-900/40 bg-red-950/20 px-3 py-2 text-xs text-red-300">
        {error ?? "Audio indisponible"}
      </div>
    );
  }

  return (
    <div className="min-w-[220px] max-w-full rounded-lg border border-zinc-700/50 bg-zinc-950/40 p-2.5">
      <div className="mb-2 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-emerald-300/80">
        <Mic className="size-3 shrink-0" aria-hidden />
        Message vocal
      </div>
      <audio
        controls
        preload="metadata"
        src={blobUrl}
        className="w-full max-w-[280px] accent-emerald-500"
      >
        Votre navigateur ne prend pas en charge l&apos;audio.
      </audio>
    </div>
  );
}

/** True for a real Meta media id (numeric), not placeholders like "[audio]". */
function isRealMetaMediaId(value: string | null | undefined): boolean {
  const v = value?.trim() ?? "";
  if (!v || v.startsWith("[")) return false;
  return /^\d+$/.test(v);
}

/**
 * Prefer message.mediaId or message.body — whichever holds the numeric Meta media id.
 * If mediaId is "[audio]" / null / invalid, fall back to body.
 */
function resolveAudioMediaId(message: WhatsAppMessage): string {
  if (isRealMetaMediaId(message.mediaId)) return message.mediaId!.trim();
  if (isRealMetaMediaId(message.body)) return message.body.trim();
  return "";
}

export function MessageBubble({ message }: Props) {
  const outbound = message.direction === "outbound";
  const time = formatChatTime(message.sentAt ?? message.createdAt);
  const isAudio = message.type === "audio";
  const mediaId = resolveAudioMediaId(message);
  const body =
    message.body || (message.type !== "text" ? `[${message.type}]` : "");

  return (
    <div
      className={cn("flex", outbound ? "justify-end" : "justify-start")}
      data-message-id={message.id}
    >
      <div
        className={cn(
          "relative max-w-[min(88%,440px)] px-3 py-2 shadow-md",
          outbound
            ? "rounded-2xl rounded-br-sm bg-[#005c4b] text-[#e9edef]"
            : "rounded-2xl rounded-bl-sm bg-[#202c33] text-[#e9edef]",
        )}
      >
        {isAudio && mediaId ? (
          <AudioPlayer mediaId={mediaId} />
        ) : (
          <p className="wrap-break-word whitespace-pre-wrap text-[14.5px] leading-relaxed">
            {isAudio ? "[Audio]" : body}
          </p>
        )}
        <div
          className={cn(
            "mt-1 flex items-center justify-end gap-1 text-[11px]",
            outbound ? "text-emerald-100/75" : "text-zinc-400",
          )}
        >
          <span>{time}</span>
          {outbound ? <StatusIcon status={message.status} /> : null}
        </div>
      </div>
    </div>
  );
}
