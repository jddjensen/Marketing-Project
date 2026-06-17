// Extracts a single JPEG frame from the front of a video file in the browser
// so we can show it as a poster image on dashboards, along with the video's
// intrinsic dimensions and a ThumbHash placeholder. Poster is null if the
// browser can't decode the file (e.g. unsupported codec).

import { rgbaToThumbHash } from "thumbhash";

const TARGET_TIME_SECONDS = 0.5;
const JPEG_QUALITY = 0.85;
// Cap the long edge of the poster — we don't need full-resolution thumbnails.
const MAX_DIMENSION = 1280;
// ThumbHash only supports up to 100px per side.
const THUMBHASH_MAX_EDGE = 100;

export type VideoMeta = {
  poster: Blob | null;
  // base64 ThumbHash of the poster frame, for an instant blurred placeholder.
  thumbhash: string | null;
  width: number | null;
  height: number | null;
};

const EMPTY_META: VideoMeta = {
  poster: null,
  thumbhash: null,
  width: null,
  height: null,
};

// Draws a downscaled copy of the current video frame and encodes a ThumbHash.
// Best-effort: returns null on any canvas/codec failure.
function thumbhashFromFrame(
  video: HTMLVideoElement,
  sourceWidth: number,
  sourceHeight: number
): string | null {
  try {
    const scale = Math.min(
      1,
      THUMBHASH_MAX_EDGE / Math.max(sourceWidth, sourceHeight)
    );
    const w = Math.max(1, Math.round(sourceWidth * scale));
    const h = Math.max(1, Math.round(sourceHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);
    const hash = rgbaToThumbHash(w, h, new Uint8Array(data.buffer));
    let binary = "";
    for (const byte of hash) binary += String.fromCharCode(byte);
    return btoa(binary);
  } catch {
    return null;
  }
}

export async function extractVideoPoster(file: File): Promise<VideoMeta> {
  if (typeof window === "undefined") return EMPTY_META;
  if (!file.type.startsWith("video/")) return EMPTY_META;

  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.preload = "metadata";
  video.muted = true;
  video.playsInline = true;
  video.crossOrigin = "anonymous";
  video.src = objectUrl;

  try {
    await new Promise<void>((resolve, reject) => {
      const onError = () => reject(new Error("video decode failed"));
      video.addEventListener("loadedmetadata", () => resolve(), { once: true });
      video.addEventListener("error", onError, { once: true });
    });

    const seekTo = Math.min(
      TARGET_TIME_SECONDS,
      Number.isFinite(video.duration)
        ? Math.max(0, video.duration - 0.1)
        : TARGET_TIME_SECONDS
    );

    await new Promise<void>((resolve, reject) => {
      const onError = () => reject(new Error("seek failed"));
      video.addEventListener("seeked", () => resolve(), { once: true });
      video.addEventListener("error", onError, { once: true });
      video.currentTime = seekTo;
    });

    const sourceWidth = video.videoWidth;
    const sourceHeight = video.videoHeight;
    if (!sourceWidth || !sourceHeight) return EMPTY_META;

    const scale = Math.min(
      1,
      MAX_DIMENSION / Math.max(sourceWidth, sourceHeight)
    );
    const width = Math.round(sourceWidth * scale);
    const height = Math.round(sourceHeight * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx)
      return {
        poster: null,
        thumbhash: null,
        width: sourceWidth,
        height: sourceHeight,
      };
    ctx.drawImage(video, 0, 0, width, height);

    const poster = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/jpeg", JPEG_QUALITY);
    });
    const thumbhash = thumbhashFromFrame(video, sourceWidth, sourceHeight);
    return { poster, thumbhash, width: sourceWidth, height: sourceHeight };
  } catch {
    return EMPTY_META;
  } finally {
    URL.revokeObjectURL(objectUrl);
    video.removeAttribute("src");
    video.load();
  }
}
