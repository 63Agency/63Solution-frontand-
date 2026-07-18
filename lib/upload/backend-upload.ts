import { getApiBaseUrl, getStoredAccessToken } from "../auth/backend-login";
import type {
  MediaFile,
  MediaGalleryResponse,
  TransformUrlParams,
  UploadMediaResponse,
  UploadMultipleResponse,
} from "./types";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const VIDEO_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/x-msvideo",
  "video/x-matroska",
];
const IMAGE_MAX_BYTES = 10 * 1024 * 1024;
const VIDEO_MAX_BYTES = 100 * 1024 * 1024;
const RAW_MAX_BYTES = 40 * 1024 * 1024;

export function getCloudinaryCloudName(): string | undefined {
  return process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME?.trim() || undefined;
}

export function validateImageFile(file: File): string | null {
  if (!IMAGE_TYPES.includes(file.type)) {
    return "Format image accepté : JPG, PNG, WebP, GIF.";
  }
  if (file.size > IMAGE_MAX_BYTES) {
    return "Image trop volumineuse (max 10 Mo).";
  }
  return null;
}

export function validateVideoFile(file: File): string | null {
  if (!VIDEO_TYPES.includes(file.type)) {
    return "Format vidéo accepté : MP4, MOV, AVI, MKV.";
  }
  if (file.size > VIDEO_MAX_BYTES) {
    return "Vidéo trop volumineuse (max 100 Mo).";
  }
  return null;
}

export function validateRawFile(file: File): string | null {
  if (!file?.name) return "Fichier invalide.";
  if (file.size <= 0) return "Fichier vide.";
  if (file.size > RAW_MAX_BYTES) {
    return "Document trop volumineux (max 40 Mo).";
  }
  return null;
}

export function classifyMediaFile(
  file: File,
): "image" | "video" | "document" {
  if (file.type.startsWith("image/") || IMAGE_TYPES.includes(file.type)) {
    return "image";
  }
  if (file.type.startsWith("video/") || VIDEO_TYPES.includes(file.type)) {
    return "video";
  }
  return "document";
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return "";
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function authHeadersJson(): Record<string, string> {
  const token = getStoredAccessToken();
  if (!token) throw new Error("Session expirée. Reconnecte-toi.");
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

async function parseApiError(res: Response, context: string): Promise<never> {
  const raw = await res.text().catch(() => "");
  let message = raw || `Erreur ${res.status}`;
  try {
    const parsed = JSON.parse(raw) as { message?: string | string[] };
    if (typeof parsed.message === "string") message = parsed.message;
    else if (Array.isArray(parsed.message) && parsed.message.length > 0) {
      message = parsed.message.join(", ");
    }
  } catch {
    /* ignore */
  }
  throw new Error(message || `${context} (${res.status})`);
}

function unwrapMedia(row: unknown): MediaFile | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const media = (r.media && typeof r.media === "object" ? r.media : r) as Record<
    string,
    unknown
  >;

  const id = String(media.id ?? "");
  const publicId = String(media.publicId ?? media.public_id ?? "");
  const optimizedUrl = String(
    r.optimizedUrl ?? media.optimizedUrl ?? media.optimized_url ?? "",
  );
  const secureUrl = String(r.secureUrl ?? media.secureUrl ?? media.secure_url ?? "");
  if (!publicId || (!optimizedUrl && !secureUrl)) return null;

  const rawType = String(media.resourceType ?? media.resource_type ?? "image").toLowerCase();
  const resourceType =
    rawType === "video" ? "video" : rawType === "raw" ? "raw" : "image";

  const breakpointsRaw = (r.breakpoints ?? media.breakpoints) as unknown;
  const breakpoints = Array.isArray(breakpointsRaw)
    ? breakpointsRaw
        .map((b) => {
          if (!b || typeof b !== "object") return null;
          const br = b as Record<string, unknown>;
          const width = Number(br.width);
          const url = String(br.url ?? "");
          if (!width || !url) return null;
          return { width, url };
        })
        .filter((v): v is { width: number; url: string } => v !== null)
    : undefined;

  return {
    id: id || publicId,
    publicId,
    resourceType,
    format: typeof media.format === "string" ? media.format : undefined,
    folder: typeof media.folder === "string" ? media.folder : undefined,
    bytes: typeof media.bytes === "number" ? media.bytes : undefined,
    width: typeof media.width === "number" ? media.width : undefined,
    height: typeof media.height === "number" ? media.height : undefined,
    duration: typeof media.duration === "number" ? media.duration : undefined,
    optimizedUrl: optimizedUrl || secureUrl,
    secureUrl: secureUrl || optimizedUrl,
    thumbnailUrl:
      typeof (r.thumbnailUrl ?? media.thumbnailUrl ?? media.thumbnail_url) === "string"
        ? String(r.thumbnailUrl ?? media.thumbnailUrl ?? media.thumbnail_url)
        : undefined,
    breakpoints,
    createdAt:
      typeof media.createdAt === "string"
        ? media.createdAt
        : typeof media.created_at === "string"
          ? media.created_at
          : undefined,
  };
}

function unwrapUploadResponse(raw: unknown): UploadMediaResponse | null {
  if (!raw || typeof raw !== "object") return null;
  const media = unwrapMedia(raw);
  if (!media) return null;
  return {
    media,
    optimizedUrl: media.optimizedUrl,
    secureUrl: media.secureUrl,
    thumbnailUrl: media.thumbnailUrl,
    breakpoints: media.breakpoints,
  };
}

function uploadFormDataWithProgress<T>(
  path: string,
  formData: FormData,
  onProgress?: (percent: number) => void,
): Promise<T> {
  const base = getApiBaseUrl();
  const token = getStoredAccessToken();
  if (!base) throw new Error("NEXT_PUBLIC_API_URL manquante.");
  if (!token) throw new Error("Session expirée. Reconnecte-toi.");

  const url = `${base}${path}`;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || !onProgress) return;
      onProgress(Math.round((event.loaded / event.total) * 100));
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as T);
        } catch {
          reject(new Error("Réponse serveur invalide."));
        }
        return;
      }
      let message = xhr.responseText || `Erreur ${xhr.status}`;
      try {
        const parsed = JSON.parse(xhr.responseText) as { message?: string | string[] };
        if (typeof parsed.message === "string") message = parsed.message;
        else if (Array.isArray(parsed.message)) message = parsed.message.join(", ");
      } catch {
        /* ignore */
      }
      reject(new Error(message));
    };

    xhr.onerror = () => reject(new Error("Erreur réseau pendant l'upload."));
    xhr.onabort = () => reject(new Error("Upload annulé."));
    xhr.send(formData);
  });
}

function appendFolder(formData: FormData, folder?: string): void {
  if (folder?.trim()) formData.append("folder", folder.trim());
}

export async function uploadImage(
  file: File,
  options?: { folder?: string; onProgress?: (percent: number) => void },
): Promise<UploadMediaResponse> {
  const err = validateImageFile(file);
  if (err) throw new Error(err);

  const formData = new FormData();
  formData.append("file", file);
  appendFolder(formData, options?.folder);

  const raw = await uploadFormDataWithProgress<unknown>(
    "/upload/image",
    formData,
    options?.onProgress,
  );
  const parsed = unwrapUploadResponse(raw);
  if (!parsed) throw new Error("Réponse upload image invalide.");
  return parsed;
}

export async function uploadVideo(
  file: File,
  options?: { folder?: string; onProgress?: (percent: number) => void },
): Promise<UploadMediaResponse> {
  const err = validateVideoFile(file);
  if (err) throw new Error(err);

  const formData = new FormData();
  formData.append("file", file);
  appendFolder(formData, options?.folder);

  const raw = await uploadFormDataWithProgress<unknown>(
    "/upload/video",
    formData,
    options?.onProgress,
  );
  const parsed = unwrapUploadResponse(raw);
  if (!parsed) throw new Error("Réponse upload vidéo invalide.");
  return parsed;
}

export async function uploadRaw(
  file: File,
  options?: { folder?: string; onProgress?: (percent: number) => void },
): Promise<UploadMediaResponse> {
  const err = validateRawFile(file);
  if (err) throw new Error(err);

  const formData = new FormData();
  formData.append("file", file);
  appendFolder(formData, options?.folder);

  const raw = await uploadFormDataWithProgress<unknown>(
    "/upload/raw",
    formData,
    options?.onProgress,
  );
  const parsed = unwrapUploadResponse(raw);
  if (!parsed) throw new Error("Réponse upload document invalide.");
  return parsed;
}

/** Upload image, video or document to Cloudinary via Nest. */
export async function uploadChatMedia(
  file: File,
  options?: {
    folder?: string;
    onProgress?: (percent: number) => void;
    /** Force document upload even if the file is an image/video. */
    forceKind?: "image" | "video" | "document";
  },
): Promise<UploadMediaResponse & { kind: "image" | "video" | "document" }> {
  const kind = options?.forceKind ?? classifyMediaFile(file);
  if (kind === "image") {
    const res = await uploadImage(file, options);
    return { ...res, kind };
  }
  if (kind === "video") {
    const res = await uploadVideo(file, options);
    return { ...res, kind };
  }
  const res = await uploadRaw(file, options);
  return { ...res, kind };
}

export async function uploadMultiple(
  files: File[],
  options?: { folder?: string; onProgress?: (percent: number) => void },
): Promise<UploadMultipleResponse> {
  if (files.length === 0) throw new Error("Aucun fichier sélectionné.");
  if (files.length > 10) throw new Error("Maximum 10 fichiers par envoi.");

  for (const file of files) {
    if (file.type.startsWith("video/")) {
      const err = validateVideoFile(file);
      if (err) throw new Error(err);
    } else {
      const err = validateImageFile(file);
      if (err) throw new Error(err);
    }
  }

  const formData = new FormData();
  for (const file of files) {
    formData.append("files", file);
  }
  appendFolder(formData, options?.folder);

  const raw = await uploadFormDataWithProgress<unknown>(
    "/upload/multiple",
    formData,
    options?.onProgress,
  );

  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as { items?: unknown[] }).items)
      ? (raw as { items: unknown[] }).items
      : [];

  const items = list
    .map((row) => unwrapUploadResponse(row))
    .filter((v): v is UploadMediaResponse => v !== null);

  const uploaded =
    raw && typeof raw === "object" && typeof (raw as { uploaded?: number }).uploaded === "number"
      ? (raw as { uploaded: number }).uploaded
      : items.length;
  const failed =
    raw && typeof raw === "object" && typeof (raw as { failed?: number }).failed === "number"
      ? (raw as { failed: number }).failed
      : files.length - items.length;

  return { items, uploaded, failed };
}

export async function fetchMediaGallery(folder?: string): Promise<MediaGalleryResponse> {
  const base = getApiBaseUrl();
  if (!base) throw new Error("NEXT_PUBLIC_API_URL manquante.");

  const params = new URLSearchParams();
  if (folder?.trim()) params.set("folder", folder.trim());
  const qs = params.toString() ? `?${params.toString()}` : "";

  const res = await fetch(`${base}/upload/media${qs}`, {
    method: "GET",
    headers: authHeadersJson(),
    credentials: "include",
  });

  if (!res.ok) return parseApiError(res, "GET /upload/media");

  const raw = (await res.json().catch(() => null)) as unknown;
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as { items?: unknown[] }).items)
      ? (raw as { items: unknown[] }).items
      : [];

  const items = list
    .map((row) => unwrapMedia(row))
    .filter((v): v is MediaFile => v !== null);

  const total =
    raw && typeof raw === "object" && typeof (raw as { total?: number }).total === "number"
      ? (raw as { total: number }).total
      : items.length;

  return { items, total };
}

export async function getTransformUrl(params: TransformUrlParams): Promise<string> {
  const base = getApiBaseUrl();
  if (!base) throw new Error("NEXT_PUBLIC_API_URL manquante.");

  const qs = new URLSearchParams();
  qs.set("publicId", params.publicId);
  if (params.width) qs.set("width", String(params.width));
  if (params.height) qs.set("height", String(params.height));
  if (params.crop) qs.set("crop", params.crop);
  if (params.quality) qs.set("quality", params.quality);

  const res = await fetch(`${base}/upload/transform?${qs.toString()}`, {
    method: "GET",
    headers: authHeadersJson(),
    credentials: "include",
  });

  if (!res.ok) return parseApiError(res, "GET /upload/transform");

  const raw = (await res.json().catch(() => null)) as unknown;
  if (typeof raw === "string" && raw.startsWith("http")) return raw;
  if (raw && typeof raw === "object") {
    const url = (raw as { url?: string; optimizedUrl?: string }).url ??
      (raw as { optimizedUrl?: string }).optimizedUrl;
    if (typeof url === "string") return url;
  }
  throw new Error("URL transform invalide.");
}

export async function deleteMedia(publicId: string, folder?: string): Promise<void> {
  const base = getApiBaseUrl();
  if (!base) throw new Error("NEXT_PUBLIC_API_URL manquante.");

  const params = new URLSearchParams();
  params.set("publicId", publicId);
  if (folder?.trim()) params.set("folder", folder.trim());

  const res = await fetch(`${base}/upload?${params.toString()}`, {
    method: "DELETE",
    headers: authHeadersJson(),
    credentials: "include",
  });

  if (res.status === 404) return;
  if (!res.ok) return parseApiError(res, "DELETE /upload");
}

/** URL d'affichage préférée (f_auto, q_auto côté backend). */
export function mediaDisplayUrl(media: Pick<MediaFile, "optimizedUrl" | "secureUrl">): string {
  return media.optimizedUrl || media.secureUrl;
}

export function buildSrcSet(breakpoints?: MediaFile["breakpoints"]): string | undefined {
  if (!breakpoints?.length) return undefined;
  return breakpoints.map((b) => `${b.url} ${b.width}w`).join(", ");
}
