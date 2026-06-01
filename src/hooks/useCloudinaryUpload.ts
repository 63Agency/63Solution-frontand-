"use client";

import { useCallback, useState } from "react";
import {
  uploadImage,
  uploadMultiple,
  uploadVideo,
} from "@/lib/upload/backend-upload";
import type { UploadMediaResponse } from "@/lib/upload/types";

type UploadKind = "image" | "video" | "auto";

type UploadOptions = {
  folder?: string;
  kind?: UploadKind;
};

export function useCloudinaryUpload(defaultFolder = "63agency") {
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<UploadMediaResponse[]>([]);

  const reset = useCallback(() => {
    setProgress(0);
    setError(null);
    setResults([]);
  }, []);

  const uploadFile = useCallback(
    async (file: File, options?: UploadOptions): Promise<UploadMediaResponse> => {
      setIsUploading(true);
      setError(null);
      setProgress(0);
      const folder = options?.folder ?? defaultFolder;
      const kind = options?.kind ?? "auto";

      try {
        const onProgress = (percent: number) => setProgress(percent);
        const isVideo =
          kind === "video" || (kind === "auto" && file.type.startsWith("video/"));

        const result = isVideo
          ? await uploadVideo(file, { folder, onProgress })
          : await uploadImage(file, { folder, onProgress });

        setResults((prev) => [...prev, result]);
        setProgress(100);
        return result;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Upload impossible.";
        setError(msg);
        throw e;
      } finally {
        setIsUploading(false);
      }
    },
    [defaultFolder],
  );

  const uploadFiles = useCallback(
    async (files: File[], options?: UploadOptions): Promise<UploadMediaResponse[]> => {
      if (files.length === 0) return [];
      setIsUploading(true);
      setError(null);
      setProgress(0);
      const folder = options?.folder ?? defaultFolder;

      try {
        const onProgress = (percent: number) => setProgress(percent);
        const res = await uploadMultiple(files, { folder, onProgress });
        setResults((prev) => [...prev, ...res.items]);
        setProgress(100);
        return res.items;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Upload impossible.";
        setError(msg);
        throw e;
      } finally {
        setIsUploading(false);
      }
    },
    [defaultFolder],
  );

  return {
    progress,
    isUploading,
    error,
    results,
    uploadFile,
    uploadFiles,
    reset,
  };
}
