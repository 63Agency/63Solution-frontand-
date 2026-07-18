"use client";

import { useEffect, useMemo, useState } from "react";
import { FileText, Loader2, SendHorizontal, X } from "lucide-react";
import { formatFileSize } from "@/lib/upload/backend-upload";
import { cn } from "@/src/lib/utils";

const WA = {
  bg: "#0b141a",
  panel: "#1f2c34",
  input: "#2a3942",
  text: "#e9edef",
  muted: "#8696a0",
  green: "#00a884",
} as const;

export type MediaPreviewKind = "image" | "video" | "document";

type Props = {
  file: File;
  kind: MediaPreviewKind;
  open: boolean;
  sending?: boolean;
  onClose: () => void;
  onSend: (caption: string) => void;
};

export function MediaSendPreview({
  file,
  kind,
  open,
  sending = false,
  onClose,
  onSend,
}: Props) {
  const [caption, setCaption] = useState("");
  const previewUrl = useMemo(() => {
    if (!open) return null;
    if (kind === "document") return null;
    return URL.createObjectURL(file);
  }, [file, kind, open]);

  useEffect(() => {
    if (!open) setCaption("");
  }, [open, file]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !sending) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, sending, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex flex-col"
      style={{ backgroundColor: "rgba(11,20,26,0.96)" }}
      role="dialog"
      aria-modal
      aria-label="Aperçu du média"
    >
      <div
        className="flex h-14 shrink-0 items-center gap-3 px-3"
        style={{ backgroundColor: WA.panel }}
      >
        <button
          type="button"
          onClick={onClose}
          disabled={sending}
          className="flex size-10 items-center justify-center rounded-full hover:bg-white/5 disabled:opacity-40"
          style={{ color: WA.text }}
          aria-label="Fermer"
        >
          <X className="size-6" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[16px] font-medium" style={{ color: WA.text }}>
            {file.name}
          </p>
          <p className="text-[12px]" style={{ color: WA.muted }}>
            {formatFileSize(file.size)}
          </p>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center p-4">
        {kind === "image" && previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt=""
            className="max-h-full max-w-full object-contain"
          />
        ) : null}
        {kind === "video" && previewUrl ? (
          <video
            src={previewUrl}
            controls
            className="max-h-full max-w-full rounded-lg"
          />
        ) : null}
        {kind === "document" ? (
          <div
            className="flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl px-8 py-10"
            style={{ backgroundColor: WA.panel }}
          >
            <div
              className="flex size-20 items-center justify-center rounded-2xl"
              style={{ backgroundColor: "#7f66ff" }}
            >
              <FileText className="size-10 text-white" strokeWidth={1.75} />
            </div>
            <div className="text-center">
              <p className="break-all text-[16px] font-medium" style={{ color: WA.text }}>
                {file.name}
              </p>
              <p className="mt-1 text-[13px]" style={{ color: WA.muted }}>
                {formatFileSize(file.size)}
              </p>
            </div>
          </div>
        ) : null}
      </div>

      <div
        className="shrink-0 px-3 pb-4 pt-2"
        style={{ backgroundColor: WA.panel }}
      >
        <form
          className="mx-auto flex max-w-3xl items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (sending) return;
            onSend(caption.trim());
          }}
        >
          <div
            className="flex min-h-[48px] flex-1 items-center rounded-[24px] px-4"
            style={{ backgroundColor: WA.input }}
          >
            <input
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Ajouter une légende…"
              disabled={sending}
              className="w-full bg-transparent py-3 text-[15px] outline-none placeholder:text-[#8696a0] disabled:opacity-60"
              style={{ color: WA.text }}
            />
          </div>
          <button
            type="submit"
            disabled={sending}
            className={cn(
              "mb-0.5 flex size-12 shrink-0 items-center justify-center rounded-full transition-opacity",
              sending && "opacity-70",
            )}
            style={{ backgroundColor: WA.green }}
            aria-label="Envoyer"
          >
            {sending ? (
              <Loader2 className="size-5 animate-spin text-[#111b21]" />
            ) : (
              <SendHorizontal className="size-5 text-[#111b21]" strokeWidth={2} />
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
