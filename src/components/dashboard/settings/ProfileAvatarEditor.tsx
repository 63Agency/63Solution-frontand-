"use client";

import { useRef, useState } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  mediaDisplayUrl,
  uploadImage,
  validateImageFile,
} from "@/lib/upload/backend-upload";
import type { UploadMediaResponse } from "@/lib/upload/types";
import { profileInitials } from "./settings-profile-utils";
import { cn } from "@/src/lib/utils";

const PROFILE_AVATAR_FOLDER = "63agency/profiles";

type Props = {
  prenom: string;
  nom: string;
  email: string;
  avatarUrl: string;
  disabled?: boolean;
  onAvatarChange: (url: string) => void;
};

export function ProfileAvatarEditor({
  prenom,
  nom,
  email,
  avatarUrl,
  disabled,
  onAvatarChange,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleFile = async (file: File) => {
    const err = validateImageFile(file);
    if (err) {
      toast.error(err);
      return;
    }

    setUploading(true);
    setProgress(0);
    try {
      const res: UploadMediaResponse = await uploadImage(file, {
        folder: PROFILE_AVATAR_FOLDER,
        onProgress: setProgress,
      });
      const url = mediaDisplayUrl(res.media);
      onAvatarChange(url);
      toast.success("Photo de profil mise à jour.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import impossible.");
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
      <div className="relative">
        <div
          className={cn(
            "flex size-28 items-center justify-center overflow-hidden rounded-full border-4 border-zinc-800 bg-linear-to-br from-indigo-600 to-violet-700 text-2xl font-bold text-white shadow-lg ring-2 ring-indigo-500/20",
            uploading && "opacity-70",
          )}
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" className="size-full object-cover" />
          ) : (
            profileInitials(prenom, nom, email)
          )}
        </div>
        {uploading ? (
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50">
            <Loader2 className="size-8 animate-spin text-white" aria-hidden />
          </div>
        ) : null}
      </div>

      <div className="flex flex-col items-center gap-2 sm:items-start">
        <p className="text-sm font-medium text-zinc-200">Photo de profil</p>
        <p className="max-w-xs text-center text-xs text-zinc-500 sm:text-left">
          JPG, PNG, WebP ou GIF — max 10 Mo. La photo est envoyée via l&apos;API sécurisée.
        </p>
        {uploading ? (
          <div className="h-1.5 w-full max-w-[200px] overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full bg-indigo-500 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        ) : null}
        <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            disabled={disabled || uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            disabled={disabled || uploading}
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-2 border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-zinc-200 transition hover:bg-zinc-800 disabled:opacity-50"
          >
            <Camera className="size-3.5" aria-hidden />
            Importer une image
          </button>
          {avatarUrl ? (
            <button
              type="button"
              disabled={disabled || uploading}
              onClick={() => onAvatarChange("")}
              className="inline-flex items-center gap-2 border border-red-700/60 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-red-300 transition hover:bg-red-900/30 disabled:opacity-50"
            >
              <Trash2 className="size-3.5" aria-hidden />
              Supprimer
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
