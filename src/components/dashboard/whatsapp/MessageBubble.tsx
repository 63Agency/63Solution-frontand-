"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, CheckCheck, Loader2, Mic, Pause, Play } from "lucide-react";
import {
  fetchWhatsAppMediaObjectUrl,
} from "@/lib/whatsapp/backend-whatsapp";
import type { WhatsAppMessage } from "@/lib/whatsapp/types";
import { cn } from "@/src/lib/utils";
import { formatChatTime } from "./whatsapp-utils";

type Props = {
  message: WhatsAppMessage;
};

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
 * WhatsApp-style voice note player.
 * Loads via GET /whatsapp/media/:id then /content → blob URL.
 */
function AudioPlayer({
  mediaId,
  outbound,
}: {
  mediaId: string;
  outbound: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const waveHeights = useMemo(() => buildWaveHeights(mediaId), [mediaId]);
  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    setLoading(true);
    setError(null);
    setBlobUrl(null);
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);

    void (async () => {
      try {
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

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTime = () => setCurrentTime(audio.currentTime || 0);
    const onMeta = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => {
      setPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("durationchange", onMeta);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("durationchange", onMeta);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
    };
  }, [blobUrl]);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    try {
      if (audio.paused) {
        await audio.play();
      } else {
        audio.pause();
      }
    } catch {
      setError("Lecture impossible");
    }
  };

  const seekFromWave = (event: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    audio.currentTime = ratio * duration;
    setCurrentTime(audio.currentTime);
  };

  if (loading) {
    return (
      <div className="flex min-w-[240px] items-center gap-3 py-1">
        <div
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-full",
            outbound ? "bg-white/20" : "bg-emerald-600/30",
          )}
        >
          <Loader2 className="size-5 animate-spin text-white/80" aria-hidden />
        </div>
        <div className="flex-1">
          <div className="h-6 w-full rounded bg-white/10" />
          <p className="mt-1 text-[11px] text-white/50">Chargement…</p>
        </div>
      </div>
    );
  }

  if (error || !blobUrl) {
    return (
      <p className="py-1 text-xs text-red-300/90">{error ?? "Audio indisponible"}</p>
    );
  }

  return (
    <div className="flex min-w-[240px] max-w-[300px] items-center gap-2.5 py-0.5">
      <audio ref={audioRef} src={blobUrl} preload="metadata" className="hidden" />

      <button
        type="button"
        onClick={() => void togglePlay()}
        aria-label={playing ? "Pause" : "Lecture"}
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-full transition",
          outbound
            ? "bg-white/20 text-white hover:bg-white/30"
            : "bg-[#00a884] text-white hover:bg-[#019875]",
        )}
      >
        {playing ? (
          <Pause className="size-5 fill-current" aria-hidden />
        ) : (
          <Play className="size-5 fill-current pl-0.5" aria-hidden />
        )}
      </button>

      <div className="min-w-0 flex-1">
        <div
          role="slider"
          tabIndex={0}
          aria-valuemin={0}
          aria-valuemax={Math.floor(duration) || 0}
          aria-valuenow={Math.floor(currentTime)}
          aria-label="Progression audio"
          onClick={seekFromWave}
          onKeyDown={(e) => {
            const audio = audioRef.current;
            if (!audio || !duration) return;
            if (e.key === "ArrowRight") {
              audio.currentTime = Math.min(duration, audio.currentTime + 2);
            }
            if (e.key === "ArrowLeft") {
              audio.currentTime = Math.max(0, audio.currentTime - 2);
            }
          }}
          className="flex h-7 cursor-pointer items-end gap-[2px]"
        >
          {waveHeights.map((h, index) => {
            const filled = index / waveHeights.length <= progress;
            return (
              <span
                key={index}
                className={cn(
                  "w-[3px] rounded-full transition-colors",
                  filled
                    ? outbound
                      ? "bg-white"
                      : "bg-[#00a884]"
                    : outbound
                      ? "bg-white/35"
                      : "bg-white/25",
                )}
                style={{ height: `${Math.round(h * 28)}px` }}
              />
            );
          })}
        </div>

        <div className="mt-0.5 flex items-center justify-between gap-2">
          <span
            className={cn(
              "font-mono text-[11px] tabular-nums",
              outbound ? "text-emerald-100/80" : "text-zinc-400",
            )}
          >
            {formatDuration(playing || currentTime > 0 ? currentTime : duration)}
          </span>
        </div>
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
          <AudioPlayer mediaId={mediaId} outbound={outbound} />
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
