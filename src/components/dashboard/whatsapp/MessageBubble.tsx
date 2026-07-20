"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  CheckCheck,
  ChevronDown,
  Download,
  FileText,
  Loader2,
  Mic,
  Pause,
  Play,
  RotateCcw,
} from "lucide-react";
import { formatFileSize } from "@/lib/upload/backend-upload";
import { fetchWhatsAppMediaObjectUrl } from "@/lib/whatsapp/backend-whatsapp";
import type { WhatsAppMessage } from "@/lib/whatsapp/types";
import { cn } from "@/src/lib/utils";
import { ImageLightbox } from "./ImageLightbox";
import { formatChatTime } from "./whatsapp-utils";

type Props = {
  message: WhatsAppMessage;
  showTail?: boolean;
  tightNext?: boolean;
  highlightQuery?: string;
  isActiveMatch?: boolean;
  onOpenMenu?: (message: WhatsAppMessage, x: number, y: number) => void;
  onQuickReply?: (message: WhatsAppMessage) => void;
  onRetryUpload?: (message: WhatsAppMessage) => void;
  onRetrySend?: (message: WhatsAppMessage) => void;
};

const WA = {
  out: "#005c4b",
  in: "#202c33",
  text: "#e9edef",
  muted: "#8696a0",
  link: "#53bdeb",
  read: "#53bdeb",
  delivered: "#8696a0",
} as const;

/** Deterministic bar heights so each mediaId looks like a stable WhatsApp waveform. */
function buildWaveHeights(seed: string, count = 32): number[] {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const heights: number[] = [];
  for (let i = 0; i < count; i += 1) {
    hash = (hash * 1664525 + 1013904223) >>> 0;
    const n = (hash % 1000) / 1000;
    heights.push(0.28 + n * 0.72);
  }
  return heights;
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function StatusIcon({ status }: { status: WhatsAppMessage["status"] }) {
  if (status === "failed") {
    return <span className="text-[11px] font-bold text-red-400">!</span>;
  }
  if (status === "pending") {
    return <Loader2 className="size-[13px] animate-spin text-[#8696a0]/80" aria-hidden />;
  }
  if (status === "read") {
    return <CheckCheck className="size-[16px]" style={{ color: WA.read }} strokeWidth={2} aria-hidden />;
  }
  if (status === "delivered") {
    return <CheckCheck className="size-[16px]" style={{ color: WA.delivered }} strokeWidth={2} aria-hidden />;
  }
  // sent — une seule coche (HTTP 200 ≠ livré)
  return <Check className="size-[14px]" style={{ color: WA.delivered }} strokeWidth={2.5} aria-hidden />;
}

function renderTextWithLinks(text: string, highlightQuery?: string) {
  const linkParts = text.split(/(https?:\/\/[^\s]+)/g);

  const paint = (chunk: string, keyPrefix: string) => {
    const q = highlightQuery?.trim();
    if (!q) return <span key={keyPrefix}>{chunk}</span>;
    const lower = chunk.toLowerCase();
    const needle = q.toLowerCase();
    const nodes: React.ReactNode[] = [];
    let cursor = 0;
    let idx = lower.indexOf(needle);
    let n = 0;
    while (idx !== -1) {
      if (idx > cursor) nodes.push(chunk.slice(cursor, idx));
      nodes.push(
        <mark
          key={`${keyPrefix}-h-${n}`}
          className="rounded-[2px] bg-[#00a884]/45 px-0.5 text-inherit"
        >
          {chunk.slice(idx, idx + needle.length)}
        </mark>,
      );
      cursor = idx + needle.length;
      idx = lower.indexOf(needle, cursor);
      n += 1;
    }
    if (cursor < chunk.length) nodes.push(chunk.slice(cursor));
    return <span key={keyPrefix}>{nodes}</span>;
  };

  return linkParts.map((part, i) => {
    if (/^https?:\/\//.test(part)) {
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2"
          style={{ color: WA.link }}
        >
          {paint(part, `a-${i}`)}
        </a>
      );
    }
    return paint(part, `t-${i}`);
  });
}

function BubbleTail({ outbound }: { outbound: boolean }) {
  if (outbound) {
    return (
      <svg
        className="absolute -right-[8px] top-0"
        width="8"
        height="13"
        viewBox="0 0 8 13"
        aria-hidden
      >
        <path d="M0 0 C0 0 8 0 8 0 C3 0 0 4 0 13 Z" fill={WA.out} />
      </svg>
    );
  }
  return (
    <svg
      className="absolute -left-[8px] top-0"
      width="8"
      height="13"
      viewBox="0 0 8 13"
      aria-hidden
    >
      <path d="M8 0 C8 0 0 0 0 0 C5 0 8 4 8 13 Z" fill={WA.in} />
    </svg>
  );
}

function UploadOverlay({
  progress,
  error,
  onRetry,
}: {
  progress?: number | null;
  error?: string | null;
  onRetry?: () => void;
}) {
  if (error) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-md bg-black/55 px-3 text-center">
        <p className="text-[12px] leading-snug text-red-200">{error}</p>
        {onRetry ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRetry();
            }}
            className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-white/25"
          >
            <RotateCcw className="size-3.5" />
            Réessayer
          </button>
        ) : null}
      </div>
    );
  }
  if (progress == null) return null;
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-md bg-black/45">
      <Loader2 className="size-7 animate-spin text-white/90" aria-hidden />
      <p className="text-[12px] font-medium text-white/90">{Math.round(progress)}%</p>
    </div>
  );
}

function MetaImageMessage({ mediaId }: { mediaId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [lightbox, setLightbox] = useState(false);

  useEffect(() => {
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
  }, [mediaId]);

  if (error) {
    return <p className="text-[13px]" style={{ color: WA.muted }}>[Image indisponible]</p>;
  }
  if (!url) {
    return (
      <div className="flex h-40 w-56 items-center justify-center rounded-md bg-black/20">
        <Loader2 className="size-6 animate-spin text-white/50" aria-hidden />
      </div>
    );
  }
  return (
    <>
      <button type="button" className="block overflow-hidden rounded-md" onClick={() => setLightbox(true)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="" className="max-h-[320px] max-w-full object-cover" />
      </button>
      <ImageLightbox url={url} open={lightbox} onClose={() => setLightbox(false)} />
    </>
  );
}

function CloudinaryImageMessage({
  url,
  progress,
  error,
  onRetry,
}: {
  url: string;
  progress?: number | null;
  error?: string | null;
  onRetry?: () => void;
}) {
  const [lightbox, setLightbox] = useState(false);
  return (
    <div className="relative overflow-hidden rounded-md">
      <button
        type="button"
        className="block max-w-full"
        onClick={() => {
          if (error || progress != null) return;
          setLightbox(true);
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="" className="max-h-[320px] max-w-full object-cover" />
      </button>
      <UploadOverlay progress={progress} error={error} onRetry={onRetry} />
      <ImageLightbox url={url} open={lightbox} onClose={() => setLightbox(false)} />
    </div>
  );
}

function VideoMessage({
  url,
  progress,
  error,
  onRetry,
}: {
  url: string;
  progress?: number | null;
  error?: string | null;
  onRetry?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  return (
    <div className="relative overflow-hidden rounded-md bg-black/30">
      <video
        ref={videoRef}
        src={url}
        className="max-h-[320px] max-w-full"
        controls={playing}
        playsInline
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />
      {!playing && progress == null && !error ? (
        <button
          type="button"
          className="absolute inset-0 flex items-center justify-center bg-black/25"
          aria-label="Lire la vidéo"
          onClick={() => {
            void videoRef.current?.play();
          }}
        >
          <span className="flex size-14 items-center justify-center rounded-full bg-black/55 text-white shadow-lg">
            <Play className="size-7 fill-white" />
          </span>
        </button>
      ) : null}
      <UploadOverlay progress={progress} error={error} onRetry={onRetry} />
    </div>
  );
}

function DocumentCard({
  url,
  fileName,
  fileSize,
  progress,
  error,
  onRetry,
  outbound,
}: {
  url: string | null;
  fileName: string;
  fileSize?: number | null;
  progress?: number | null;
  error?: string | null;
  onRetry?: () => void;
  outbound: boolean;
}) {
  const sizeLabel = formatFileSize(fileSize);
  const ext = fileName.includes(".")
    ? fileName.slice(fileName.lastIndexOf(".") + 1).toUpperCase()
    : "FILE";

  return (
    <div className="relative min-w-[220px] max-w-[280px]">
      <div
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2.5",
          outbound ? "bg-black/15" : "bg-black/20",
        )}
      >
        <div
          className="flex size-11 shrink-0 flex-col items-center justify-center rounded-lg"
          style={{ backgroundColor: "#7f66ff" }}
        >
          <FileText className="size-5 text-white" strokeWidth={2} />
          <span className="mt-0.5 text-[8px] font-bold tracking-wide text-white/90">
            {ext.slice(0, 4)}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-medium" style={{ color: WA.text }}>
            {fileName}
          </p>
          {sizeLabel ? (
            <p className="text-[12px]" style={{ color: WA.muted }}>
              {sizeLabel}
            </p>
          ) : null}
        </div>
        {url && !error && progress == null ? (
          <a
            href={url}
            download={fileName}
            target="_blank"
            rel="noopener noreferrer"
            className="flex size-9 shrink-0 items-center justify-center rounded-full hover:bg-white/10"
            style={{ color: WA.muted }}
            aria-label="Télécharger"
            onClick={(e) => e.stopPropagation()}
          >
            <Download className="size-5" />
          </a>
        ) : null}
      </div>
      <UploadOverlay progress={progress} error={error} onRetry={onRetry} />
    </div>
  );
}

function AudioPlayer({
  src,
  mediaId,
  outbound,
}: {
  src?: string | null;
  mediaId?: string | null;
  outbound: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [url, setUrl] = useState<string | null>(src?.trim() || null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(!src?.trim());
  const [error, setError] = useState(false);
  const waveSeed = src?.trim() || mediaId?.trim() || "audio";
  const heights = useMemo(() => buildWaveHeights(waveSeed), [waveSeed]);

  useEffect(() => {
    if (src?.trim()) {
      setUrl(src.trim());
      setLoading(false);
      setError(false);
      return;
    }

    const id = mediaId?.trim();
    if (!id || !isRealMetaMediaId(id)) {
      setError(true);
      setLoading(false);
      return;
    }

    let objectUrl: string | null = null;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const blob = await fetchWhatsAppMediaObjectUrl(id);
        if (cancelled) {
          URL.revokeObjectURL(blob);
          return;
        }
        objectUrl = blob;
        setUrl(blob);
        setLoading(false);
      } catch {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src, mediaId]);

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
      setPlaying(false);
    } else {
      void el.play().then(
        () => setPlaying(true),
        () => setPlaying(false),
      );
    }
  };

  if (error) {
    return (
      <p className="text-[13px]" style={{ color: WA.muted }}>
        Media unavailable
      </p>
    );
  }

  return (
    <div className="flex min-w-[240px] items-center gap-2 py-1 pr-1">
      {url ? (
        <audio
          ref={audioRef}
          src={url}
          preload="metadata"
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
          onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime || 0)}
          onEnded={() => {
            setPlaying(false);
            setCurrent(0);
          }}
        />
      ) : null}
      <button
        type="button"
        onClick={toggle}
        disabled={loading || !url}
        className="flex size-9 shrink-0 items-center justify-center rounded-full disabled:opacity-50"
        style={{ backgroundColor: outbound ? "rgba(255,255,255,0.15)" : "#00a884" }}
        aria-label={playing ? "Pause" : "Lecture"}
      >
        {loading ? (
          <Loader2 className="size-4 animate-spin text-white" />
        ) : playing ? (
          <Pause className="size-4 fill-white text-white" />
        ) : (
          <Play className="size-4 fill-white text-white" />
        )}
      </button>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex h-6 items-end gap-[2px]">
          {heights.map((h, i) => {
            const progress = duration > 0 ? current / duration : 0;
            const active = i / heights.length <= progress;
            return (
              <span
                key={i}
                className="w-[2.5px] rounded-full"
                style={{
                  height: `${Math.round(h * 22)}px`,
                  backgroundColor: active
                    ? outbound
                      ? "#e9edef"
                      : "#00a884"
                    : outbound
                      ? "rgba(233,237,239,0.35)"
                      : "rgba(134,150,160,0.55)",
                }}
              />
            );
          })}
        </div>
        <span className="text-[11px]" style={{ color: WA.muted }}>
          {formatDuration(playing || current > 0 ? current : duration)}
        </span>
      </div>
      <div
        className={cn(
          "relative flex size-8 shrink-0 items-center justify-center rounded-full",
          outbound ? "bg-white/15" : "bg-zinc-700/80",
        )}
      >
        <Mic
          className={cn(
            "size-3.5",
            outbound ? "text-emerald-100/90" : "text-[#00a884]",
          )}
          aria-hidden
        />
        <span
          className={cn(
            "absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2",
            outbound ? "border-[#005c4b] bg-[#00a884]" : "border-[#202c33] bg-[#00a884]",
          )}
          aria-hidden
        />
      </div>
    </div>
  );
}

/** True for a real Meta media id (numeric), not placeholders like "[audio]". */
function isRealMetaMediaId(value: string | null | undefined): boolean {
  const v = value?.trim() ?? "";
  if (!v || v.startsWith("[")) return false;
  return /^\d+$/.test(v);
}

function isHttpUrl(value: string | null | undefined): boolean {
  return Boolean(value && /^https?:\/\//i.test(value.trim()));
}

function resolveMediaId(message: WhatsAppMessage): string {
  if (isRealMetaMediaId(message.mediaId)) return message.mediaId!.trim();
  if (isRealMetaMediaId(message.body)) return message.body.trim();
  return "";
}

function captionText(message: WhatsAppMessage): string {
  const body = message.body?.trim() ?? "";
  if (!body) return "";
  if (body === "Media unavailable") return "";
  if (message.type === "document" && body === (message.fileName ?? "").trim()) {
    return "";
  }
  if (
    (message.type === "image" || message.type === "video" || message.type === "audio") &&
    (body === "Photo" ||
      body === "Vidéo" ||
      body === "Audio" ||
      body === `[${message.type}]`)
  ) {
    return "";
  }
  return body;
}

function MediaUnavailableLabel() {
  return (
    <p className="py-1 text-[13px]" style={{ color: WA.muted }}>
      Media unavailable
    </p>
  );
}

export function MessageBubble({
  message,
  showTail = true,
  tightNext = false,
  highlightQuery,
  isActiveMatch = false,
  onOpenMenu,
  onQuickReply,
  onRetryUpload,
  onRetrySend,
}: Props) {
  const outbound = message.direction === "outbound";
  const time = formatChatTime(message.sentAt ?? message.createdAt);
  const isAudio = message.type === "audio";
  const isImage = message.type === "image";
  const isVideo = message.type === "video";
  const isDocument = message.type === "document";
  const mediaId = resolveMediaId(message);
  const cloudUrl = isHttpUrl(message.mediaUrl) ? message.mediaUrl!.trim() : null;
  const body =
    message.body || (message.type !== "text" ? `[${message.type}]` : "");
  const replyTo = message.replyTo;
  const caption = captionText(message);
  const uploading = message.uploadProgress != null && !message.uploadError;
  const hasMediaChrome = isAudio || isImage || isVideo || isDocument;

  const retry = onRetryUpload ? () => onRetryUpload(message) : undefined;
  const failedOutbound = outbound && message.status === "failed";
  const showSendRetry = failedOutbound && onRetrySend && !message.uploadError;

  return (
    <div
      className={cn(
        "group relative flex rounded-lg transition-shadow",
        outbound ? "justify-end" : "justify-start",
        tightNext ? "mb-[2px]" : "mb-2",
        isActiveMatch && "ring-2 ring-[#00a884]/70",
      )}
      data-message-id={message.id}
      data-meta-message-id={message.metaMessageId || message.watiMessageId || undefined}
      onContextMenu={(e) => {
        e.preventDefault();
        onOpenMenu?.(message, e.clientX, e.clientY);
      }}
      onDoubleClick={() => onQuickReply?.(message)}
    >
      <div
        className={cn(
          "relative max-w-[min(85%,520px)] px-[9px] pt-[6px] pb-[4px] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)]",
          outbound
            ? showTail
              ? "rounded-lg rounded-tr-none"
              : "rounded-lg"
            : showTail
              ? "rounded-lg rounded-tl-none"
              : "rounded-lg",
        )}
        style={{
          backgroundColor: outbound ? WA.out : WA.in,
          color: WA.text,
        }}
      >
        {showTail ? <BubbleTail outbound={outbound} /> : null}

        {replyTo ? (
          <button
            type="button"
            className="mb-1.5 w-full overflow-hidden rounded-[6px] border-l-4 px-2 py-1.5 text-left"
            style={{
              backgroundColor: outbound ? "rgba(0,0,0,0.15)" : "rgba(0,0,0,0.2)",
              borderLeftColor: "#06cf9c",
            }}
            onClick={(e) => {
              e.stopPropagation();
              const byId = document.querySelector(
                `[data-message-id="${CSS.escape(replyTo.id)}"]`,
              );
              const byMeta = document.querySelector(
                `[data-meta-message-id="${CSS.escape(replyTo.id)}"]`,
              );
              (byId ?? byMeta)?.scrollIntoView({ behavior: "smooth", block: "center" });
            }}
          >
            <p className="truncate text-[12.5px] font-medium" style={{ color: "#06cf9c" }}>
              {replyTo.authorLabel}
            </p>
            <p className="truncate text-[12.5px]" style={{ color: WA.muted }}>
              {replyTo.body}
            </p>
          </button>
        ) : null}

        {isAudio && (cloudUrl || mediaId) ? (
          <AudioPlayer src={cloudUrl} mediaId={mediaId || null} outbound={outbound} />
        ) : isAudio ? (
          <MediaUnavailableLabel />
        ) : isImage && cloudUrl ? (
          <div className="mb-1">
            <CloudinaryImageMessage
              url={cloudUrl}
              progress={uploading ? message.uploadProgress : null}
              error={message.uploadError}
              onRetry={retry}
            />
          </div>
        ) : isImage && mediaId ? (
          <div className="mb-1">
            <MetaImageMessage mediaId={mediaId} />
          </div>
        ) : isImage ? (
          <MediaUnavailableLabel />
        ) : isVideo && cloudUrl ? (
          <div className="mb-1">
            <VideoMessage
              url={cloudUrl}
              progress={uploading ? message.uploadProgress : null}
              error={message.uploadError}
              onRetry={retry}
            />
          </div>
        ) : isVideo ? (
          <MediaUnavailableLabel />
        ) : isDocument && (cloudUrl || message.fileName || body) ? (
          <div className="mb-1">
            <DocumentCard
              url={cloudUrl}
              fileName={message.fileName?.trim() || body || "Document"}
              fileSize={message.fileSize}
              progress={uploading ? message.uploadProgress : null}
              error={
                message.uploadError ||
                (!cloudUrl && !uploading ? "Media unavailable" : null)
              }
              onRetry={retry}
              outbound={outbound}
            />
          </div>
        ) : isDocument ? (
          <MediaUnavailableLabel />
        ) : (
          <p className="wrap-break-word whitespace-pre-wrap text-[14.2px] leading-[19px]">
            {renderTextWithLinks(body, highlightQuery)}
          </p>
        )}

        {caption && (isImage || isVideo || isDocument) ? (
          <p className="wrap-break-word whitespace-pre-wrap text-[14.2px] leading-[19px]">
            {renderTextWithLinks(caption, highlightQuery)}
          </p>
        ) : null}

        <div
          className={cn(
            "-mb-0.5 mt-0.5 flex flex-wrap items-center justify-end gap-x-[3px] gap-y-1 select-none",
            hasMediaChrome ? "" : "float-right ml-2 relative top-[2px]",
          )}
        >
          {showSendRetry ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRetrySend?.(message);
              }}
              className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[11px] font-medium text-red-300 hover:bg-red-500/25"
            >
              <RotateCcw className="size-3" aria-hidden />
              Réessayer
            </button>
          ) : null}
          <span className="text-[11px] leading-none" style={{ color: WA.muted }}>
            {time}
          </span>
          {outbound ? <StatusIcon status={message.status} /> : null}
        </div>
        {!hasMediaChrome ? <div className="clear-both" /> : null}

        <div
          className={cn(
            "absolute top-0.5 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100",
            outbound ? "left-[-52px]" : "right-[-52px]",
          )}
        >
          <button
            type="button"
            className="flex size-7 items-center justify-center rounded-full bg-[#202c33] text-[#aebac1] shadow hover:bg-[#2a3942]"
            aria-label="Répondre"
            onClick={(e) => {
              e.stopPropagation();
              onQuickReply?.(message);
            }}
          >
            <span className="text-[14px]" aria-hidden>
              ↩
            </span>
          </button>
          <button
            type="button"
            className="flex size-7 items-center justify-center rounded-full bg-[#202c33] text-[#aebac1] shadow hover:bg-[#2a3942]"
            aria-label="Plus d'options"
            onClick={(e) => {
              e.stopPropagation();
              const rect = e.currentTarget.getBoundingClientRect();
              onOpenMenu?.(message, rect.left, rect.bottom + 4);
            }}
          >
            <ChevronDown className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
