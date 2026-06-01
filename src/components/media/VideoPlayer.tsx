"use client";

import { useMemo } from "react";
import { getCloudinaryCloudName } from "@/lib/upload/backend-upload";
import type { MediaFile } from "@/lib/upload/types";
import { cn } from "@/src/lib/utils";

type Props = {
  media: Pick<MediaFile, "publicId" | "secureUrl" | "optimizedUrl" | "thumbnailUrl">;
  className?: string;
  /** Player Cloudinary embed (nécessite NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME). */
  useEmbed?: boolean;
  autoPlay?: boolean;
  controls?: boolean;
};

export function VideoPlayer({
  media,
  className,
  useEmbed = false,
  autoPlay = false,
  controls = true,
}: Props) {
  const cloudName = getCloudinaryCloudName();
  const src = media.optimizedUrl || media.secureUrl;
  const poster = media.thumbnailUrl;

  const embedSrc = useMemo(() => {
    if (!useEmbed || !cloudName) return null;
    const params = new URLSearchParams({
      cloud_name: cloudName,
      public_id: media.publicId,
    });
    if (autoPlay) params.set("autoplay", "true");
    return `https://player.cloudinary.com/embed/?${params.toString()}`;
  }, [autoPlay, cloudName, media.publicId, useEmbed]);

  if (embedSrc) {
    return (
      <div className={cn("relative aspect-video overflow-hidden rounded-xl bg-black", className)}>
        <iframe
          src={embedSrc}
          title="Lecture vidéo"
          className="absolute inset-0 size-full border-0"
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <video
      src={src}
      poster={poster}
      controls={controls}
      autoPlay={autoPlay}
      playsInline
      preload="metadata"
      className={cn("max-h-full w-full rounded-xl bg-black object-contain", className)}
    />
  );
}
