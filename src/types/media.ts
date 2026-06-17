// Shared contract for a media item as returned by the media-list endpoints
// (/api/media, /api/projects/[id]/media, signage-formats, creative versions).
// Kept here as a single source of truth so client components and route
// handlers agree on field names — especially the perceived-performance fields
// `thumbUrl` (small WebP rendition for grids) and `thumbhash` (base64 blurred
// placeholder rendered before the image paints).
export type ApiMediaItem = {
  id: string;
  creativeId: string | null;
  versionNum: number;
  ratio: string;
  url: string | null;
  /** Small rendition for grid tiles; falls back to `url` when null. */
  thumbUrl: string | null;
  /** Video poster frame; used as the tile image for videos. */
  posterUrl: string | null;
  /** base64 ThumbHash for an instant blurred placeholder; null = none. */
  thumbhash: string | null;
  name: string | null;
  kind: "image" | "video" | "text";
  copy: Record<string, unknown> | null;
  uploadedAt: number;
  width?: number | null;
  height?: number | null;
};

// The subset of ApiMediaItem fields a tile needs to render a placeholder +
// lazy-loaded image. Components can pick this off their own richer types.
export type ThumbnailFields = Pick<
  ApiMediaItem,
  "url" | "thumbUrl" | "posterUrl" | "thumbhash" | "width" | "height"
>;
