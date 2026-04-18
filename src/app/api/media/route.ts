import { NextRequest } from "next/server";
import { readdir, stat } from "fs/promises";
import path from "path";

const VALID_PLATFORMS = new Set(["meta", "tiktok", "youtube", "google-search"]);
const RATIO_PATTERN = /^[0-9]+(\.[0-9]+)?x[0-9]+(\.[0-9]+)?$/;
const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif"]);
const VIDEO_EXT = new Set([".mp4", ".mov", ".webm", ".m4v", ".mpeg", ".3gp", ".avi"]);

type MediaItem = {
  url: string;
  name: string;
  kind: "image" | "video";
  ratio: string;
  uploadedAt: number;
};

export async function GET(request: NextRequest) {
  const platform = request.nextUrl.searchParams.get("platform");
  if (!platform || !VALID_PLATFORMS.has(platform)) {
    return Response.json({ error: "invalid platform" }, { status: 400 });
  }

  const base = path.join(process.cwd(), "public", "uploads", platform);
  const result: Record<string, MediaItem[]> = {};

  let ratioDirs: string[] = [];
  try {
    ratioDirs = await readdir(base);
  } catch {
    return Response.json(result);
  }

  for (const ratio of ratioDirs) {
    if (!RATIO_PATTERN.test(ratio)) continue;
    const dir = path.join(base, ratio);
    let files: string[] = [];
    try {
      files = await readdir(dir);
    } catch {
      continue;
    }
    const items: MediaItem[] = [];
    for (const name of files) {
      if (name.startsWith(".")) continue;
      const ext = path.extname(name).toLowerCase();
      const kind = IMAGE_EXT.has(ext) ? "image" : VIDEO_EXT.has(ext) ? "video" : null;
      if (!kind) continue;
      const s = await stat(path.join(dir, name));
      items.push({
        url: `/uploads/${platform}/${ratio}/${name}`,
        name,
        kind,
        ratio,
        uploadedAt: s.mtimeMs,
      });
    }
    items.sort((a, b) => b.uploadedAt - a.uploadedAt);
    result[ratio] = items;
  }

  return Response.json(result);
}
