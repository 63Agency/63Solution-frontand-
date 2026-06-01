export type MediaResourceType = "image" | "video" | "raw";

export type MediaBreakpoint = {
  width: number;
  url: string;
};

export type MediaFile = {
  id: string;
  publicId: string;
  resourceType: MediaResourceType;
  format?: string;
  folder?: string;
  bytes?: number;
  width?: number;
  height?: number;
  duration?: number;
  optimizedUrl: string;
  secureUrl: string;
  thumbnailUrl?: string;
  breakpoints?: MediaBreakpoint[];
  createdAt?: string;
};

export type UploadMediaResponse = {
  media: MediaFile;
  optimizedUrl: string;
  secureUrl: string;
  thumbnailUrl?: string;
  breakpoints?: MediaBreakpoint[];
};

export type UploadMultipleResponse = {
  items: UploadMediaResponse[];
  uploaded: number;
  failed: number;
};

export type MediaGalleryResponse = {
  items: MediaFile[];
  total?: number;
};

export type TransformUrlParams = {
  publicId: string;
  width?: number;
  height?: number;
  crop?: string;
  quality?: string;
};
