// Extracts a single JPEG frame from the front of a video file in the browser
// so we can show it as a poster image on dashboards. Returns null if the
// browser can't decode the file (e.g. unsupported codec).

const TARGET_TIME_SECONDS = 0.5;
const JPEG_QUALITY = 0.85;
// Cap the long edge of the poster — we don't need full-resolution thumbnails.
const MAX_DIMENSION = 1280;

export async function extractVideoPoster(file: File): Promise<Blob | null> {
  if (typeof window === "undefined") return null;
  if (!file.type.startsWith("video/")) return null;

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
      Number.isFinite(video.duration) ? Math.max(0, video.duration - 0.1) : TARGET_TIME_SECONDS
    );

    await new Promise<void>((resolve, reject) => {
      const onError = () => reject(new Error("seek failed"));
      video.addEventListener("seeked", () => resolve(), { once: true });
      video.addEventListener("error", onError, { once: true });
      video.currentTime = seekTo;
    });

    const sourceWidth = video.videoWidth;
    const sourceHeight = video.videoHeight;
    if (!sourceWidth || !sourceHeight) return null;

    const scale = Math.min(1, MAX_DIMENSION / Math.max(sourceWidth, sourceHeight));
    const width = Math.round(sourceWidth * scale);
    const height = Math.round(sourceHeight * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, width, height);

    return await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/jpeg", JPEG_QUALITY);
    });
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(objectUrl);
    video.removeAttribute("src");
    video.load();
  }
}
