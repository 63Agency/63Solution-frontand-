"use client";

import { useCallback, useRef, useState } from "react";
import { ImageIcon, Loader2, Upload, Video } from "lucide-react";
import { toast } from "sonner";
import { useCloudinaryUpload } from "@/src/hooks/useCloudinaryUpload";
import { mediaDisplayUrl } from "@/lib/upload/backend-upload";
import type { UploadMediaResponse } from "@/lib/upload/types";
import { cn } from "@/src/lib/utils";

type Props = {
  folder?: string;
  multiple?: boolean;
  maxFiles?: number;
  accept?: string;
  onUploaded?: (items: UploadMediaResponse[]) => void;
  className?: string;
};

export function MediaUploader({
  folder = "63agency",
  multiple = true,
  maxFiles = 10,
  accept = "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/x-msvideo,video/x-matroska",
  onUploaded,
  className,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const { progress, isUploading, error, results, uploadFile, uploadFiles, reset } =
    useCloudinaryUpload(folder);

  const processFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList).slice(0, maxFiles);
      if (files.length === 0) return;

      try {
        const uploaded =
          files.length === 1
            ? [await uploadFile(files[0]!)]
            : await uploadFiles(files);
        onUploaded?.(uploaded);
        toast.success(
          files.length === 1 ? "Fichier envoyé." : `${uploaded.length} fichier(s) envoyé(s).`,
        );
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Upload échoué.");
      }
    },
    [maxFiles, onUploaded, results, uploadFile, uploadFiles],
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (isUploading) return;
    void processFiles(e.dataTransfer.files);
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => !isUploading && inputRef.current?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors",
          dragOver
            ? "border-emerald-500 bg-emerald-950/20"
            : "border-zinc-700 bg-zinc-900/40 hover:border-zinc-500 hover:bg-zinc-900/60",
          isUploading && "pointer-events-none opacity-60",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept={accept}
          multiple={multiple}
          onChange={(e) => {
            if (e.target.files?.length) void processFiles(e.target.files);
            e.target.value = "";
          }}
        />
        {isUploading ? (
          <Loader2 className="size-10 animate-spin text-emerald-400" aria-hidden />
        ) : (
          <Upload className="size-10 text-zinc-500" aria-hidden />
        )}
        <p className="mt-3 text-sm font-medium text-zinc-200">
          {isUploading ? `Envoi en cours… ${progress}%` : "Glissez-déposez ou cliquez pour envoyer"}
        </p>
        <p className="mt-1 flex flex-wrap items-center justify-center gap-3 text-xs text-zinc-500">
          <span className="inline-flex items-center gap-1">
            <ImageIcon className="size-3.5" aria-hidden />
            Images ≤ 10 Mo
          </span>
          <span className="inline-flex items-center gap-1">
            <Video className="size-3.5" aria-hidden />
            Vidéos ≤ 100 Mo
          </span>
        </p>
        {multiple ? (
          <p className="mt-1 text-[11px] text-zinc-600">Jusqu&apos;à {maxFiles} fichiers</p>
        ) : null}
      </div>

      {isUploading ? (
        <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      {results.length > 0 ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Derniers uploads ({results.length})
            </p>
            <button
              type="button"
              onClick={reset}
              className="text-xs text-zinc-400 hover:text-zinc-200"
            >
              Effacer la liste
            </button>
          </div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {results.map((item) => (
              <li
                key={item.media.id}
                className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 p-2"
              >
                {item.media.resourceType === "video" ? (
                  <Video className="size-8 shrink-0 text-emerald-400" aria-hidden />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={mediaDisplayUrl(item.media)}
                    alt=""
                    className="size-12 shrink-0 rounded object-cover"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-[11px] text-zinc-400">
                    {item.media.publicId}
                  </p>
                  <p className="truncate text-xs text-zinc-500">{item.optimizedUrl}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
