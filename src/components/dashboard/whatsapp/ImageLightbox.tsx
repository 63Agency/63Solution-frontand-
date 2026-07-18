"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

type Props = {
  url: string;
  open: boolean;
  onClose: () => void;
  alt?: string;
};

export function ImageLightbox({ url, open, onClose, alt = "" }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex flex-col bg-black/95"
      role="dialog"
      aria-modal
      aria-label="Aperçu image"
      onClick={onClose}
    >
      <div className="flex h-14 shrink-0 items-center justify-end px-3">
        <button
          type="button"
          onClick={onClose}
          className="flex size-10 items-center justify-center rounded-full text-white/90 hover:bg-white/10"
          aria-label="Fermer"
        >
          <X className="size-6" />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={alt}
          className="max-h-full max-w-full object-contain"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    </div>
  );
}
