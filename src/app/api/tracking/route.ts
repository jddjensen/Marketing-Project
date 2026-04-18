import { NextRequest } from "next/server";
import { readStore, writeStore, validatePlatform, VALID_PLATFORMS } from "@/lib/tracking";
import crypto from "crypto";

export async function GET(request: NextRequest) {
  const platform = request.nextUrl.searchParams.get("platform");
  if (!platform || !VALID_PLATFORMS.has(platform)) {
    return Response.json({ error: "invalid platform" }, { status: 400 });
  }
  const store = await readStore();
  const items = store.items.filter((i) => i.platform === platform);
  return Response.json({ items });
}

export async function POST(request: NextRequest) {
  const platform = request.nextUrl.searchParams.get("platform");
  const err = validatePlatform(platform);
  if (err) return err;

  const body = (await request.json().catch(() => null)) as {
    mediaKey?: unknown;
    url?: unknown;
  } | null;

  if (!body || typeof body.mediaKey !== "string" || typeof body.url !== "string") {
    return Response.json({ error: "mediaKey and url required" }, { status: 400 });
  }

  const mediaKey = body.mediaKey.trim();
  const url = body.url.trim();
  if (!mediaKey) return Response.json({ error: "mediaKey required" }, { status: 400 });
  if (url.length > 2048) return Response.json({ error: "url too long" }, { status: 400 });

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return Response.json({ error: "invalid url" }, { status: 400 });
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return Response.json({ error: "url must be http or https" }, { status: 400 });
  }

  const store = await readStore();
  const existing = store.items.find(
    (i) => i.platform === platform && i.mediaKey === mediaKey
  );

  if (existing) {
    existing.url = url;
    await writeStore(store);
    return Response.json({ item: existing });
  }

  const item = {
    id: crypto.randomBytes(6).toString("base64url"),
    platform: platform as string,
    mediaKey,
    url,
    clicks: 0,
    createdAt: Date.now(),
  };
  store.items.push(item);
  await writeStore(store);
  return Response.json({ item });
}

export async function DELETE(request: NextRequest) {
  const platform = request.nextUrl.searchParams.get("platform");
  const err = validatePlatform(platform);
  if (err) return err;

  const mediaKey = request.nextUrl.searchParams.get("mediaKey");
  if (!mediaKey) return Response.json({ error: "mediaKey required" }, { status: 400 });

  const store = await readStore();
  const next = store.items.filter(
    (i) => !(i.platform === platform && i.mediaKey === mediaKey)
  );
  if (next.length === store.items.length) {
    return Response.json({ error: "not found" }, { status: 404 });
  }
  store.items = next;
  await writeStore(store);
  return Response.json({ ok: true });
}
