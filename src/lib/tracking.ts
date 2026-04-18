import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";

export const VALID_PLATFORMS = new Set(["meta", "tiktok", "youtube", "google-search"]);

export type TrackingItem = {
  id: string;
  platform: string;
  mediaKey: string;
  url: string;
  clicks: number;
  createdAt: number;
};

export type TrackingStore = { items: TrackingItem[] };

const STORE_PATH = path.join(process.cwd(), "data", "tracking.json");

export async function readStore(): Promise<TrackingStore> {
  try {
    const raw = await readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as TrackingStore;
    return { items: Array.isArray(parsed.items) ? parsed.items : [] };
  } catch {
    return { items: [] };
  }
}

export async function writeStore(store: TrackingStore) {
  await mkdir(path.dirname(STORE_PATH), { recursive: true });
  await writeFile(STORE_PATH, JSON.stringify(store, null, 2));
}

export function validatePlatform(platform: string | null) {
  if (!platform || !VALID_PLATFORMS.has(platform)) {
    return Response.json({ error: "invalid platform" }, { status: 400 });
  }
  return null;
}
