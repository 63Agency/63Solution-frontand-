"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  buildSrcSet,
  deleteMedia,
  fetchMediaGallery,
  mediaDisplayUrl,
} from "@/lib/upload/backend-upload";
import type { MediaFile } from "@/lib/upload/types";
import { cn } from "@/src/lib/utils";
import { VideoPlayer } from "./VideoPlayer";

type Props = {
  folder?: string;
  className?: string;
  onSelect?: (media: MediaFile) => void;
  selectable?: boolean;
};

export function MediaGallery({
  folder = "63agency",
  className,
  onSelect,
  selectable = false,
}: Props) {
  const [items, setItems] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchMediaGallery(folder);
      setItems(res.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible de charger la galerie.");
    } finally {
      setLoading(false);
    }
  }, [folder]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDelete = async (media: MediaFile) => {
    if (!window.confirm("Supprimer ce média ?")) return;
    setDeletingId(media.id);
    try {
      await deleteMedia(media.publicId, media.folder ?? folder);
      setItems((prev) => prev.filter((m) => m.id !== media.id));
      if (selectedId === media.id) setSelectedId(null);
      toast.success("Média supprimé.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Suppression impossible.");
    } finally {
      setDeletingId(null);
    }
  };

  const selected = items.find((m) => m.id === selectedId) ?? null;

  if (loading) {
    return (
      <div className={cn("flex justify-center py-16", className)}>
        <Loader2 className="size-8 animate-spin text-zinc-500" aria-hidden />
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("rounded-xl border border-red-900/50 bg-red-950/20 p-6 text-center", className)}>
        <p className="text-sm text-red-300">{error}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-3 text-xs text-zinc-400 underline hover:text-zinc-200"
        >
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {items.length === 0 ? (
        <p className="py-12 text-center text-sm text-zinc-500">Aucun média dans ce dossier.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((media) => {
            const isSelected = selectedId === media.id;
            const srcSet = buildSrcSet(media.breakpoints);
            return (
              <article
                key={media.id}
                className={cn(
                  "group overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50",
                  isSelected && "ring-2 ring-emerald-500",
                  selectable && "cursor-pointer",
                )}
                onClick={() => {
                  if (!selectable) return;
                  setSelectedId(media.id);
                  onSelect?.(media);
                }}
              >
                <div className="relative aspect-video bg-zinc-950">
                  {media.resourceType === "video" ? (
                    media.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={media.thumbnailUrl}
                        alt=""
                        className="size-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <VideoPlayer media={media} className="size-full" controls={false} />
                    )
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={mediaDisplayUrl(media)}
                      srcSet={srcSet}
                      sizes="(max-width: 640px) 100vw, 25vw"
                      alt={media.publicId}
                      className="size-full object-cover"
                      loading="lazy"
                    />
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleDelete(media);
                    }}
                    disabled={deletingId === media.id}
                    className="absolute right-2 top-2 rounded-md bg-black/60 p-1.5 text-zinc-300 opacity-0 transition-opacity hover:bg-red-900/80 hover:text-white group-hover:opacity-100"
                    aria-label="Supprimer"
                  >
                    {deletingId === media.id ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : (
                      <Trash2 className="size-4" aria-hidden />
                    )}
                  </button>
                </div>
                <div className="px-3 py-2">
                  <p className="truncate font-mono text-[10px] text-zinc-500">{media.publicId}</p>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {selected?.resourceType === "video" ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <p className="mb-3 text-sm font-medium text-zinc-300">Aperçu</p>
          <VideoPlayer media={selected} useEmbed />
        </div>
      ) : null}
    </div>
  );
}
