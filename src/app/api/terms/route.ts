import { NextRequest } from "next/server";
import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";

const VALID_PLATFORMS = new Set(["google-search"]);
const MAX_TERM_LEN = 200;
const MAX_TERMS = 1000;

type Term = { id: string; value: string; addedAt: number };
type Store = { terms: Term[] };

function filePath(platform: string) {
  return path.join(process.cwd(), "data", platform, "terms.json");
}

async function readStore(platform: string): Promise<Store> {
  try {
    const raw = await readFile(filePath(platform), "utf8");
    const parsed = JSON.parse(raw) as Store;
    return { terms: Array.isArray(parsed.terms) ? parsed.terms : [] };
  } catch {
    return { terms: [] };
  }
}

async function writeStore(platform: string, store: Store) {
  const p = filePath(platform);
  await mkdir(path.dirname(p), { recursive: true });
  await writeFile(p, JSON.stringify(store, null, 2));
}

function platformFromRequest(request: NextRequest): string | null {
  const p = request.nextUrl.searchParams.get("platform");
  return p && VALID_PLATFORMS.has(p) ? p : null;
}

export async function GET(request: NextRequest) {
  const platform = platformFromRequest(request);
  if (!platform) return Response.json({ error: "invalid platform" }, { status: 400 });
  const store = await readStore(platform);
  store.terms.sort((a, b) => b.addedAt - a.addedAt);
  return Response.json(store);
}

export async function POST(request: NextRequest) {
  const platform = platformFromRequest(request);
  if (!platform) return Response.json({ error: "invalid platform" }, { status: 400 });

  const body = (await request.json().catch(() => null)) as { values?: unknown } | null;
  if (!body || !Array.isArray(body.values)) {
    return Response.json({ error: "values[] required" }, { status: 400 });
  }

  const cleaned = body.values
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim())
    .filter((v) => v.length > 0 && v.length <= MAX_TERM_LEN);

  if (cleaned.length === 0) {
    return Response.json({ error: "no valid terms" }, { status: 400 });
  }

  const store = await readStore(platform);
  const existing = new Set(store.terms.map((t) => t.value.toLowerCase()));
  const now = Date.now();
  const added: Term[] = [];

  for (const value of cleaned) {
    if (store.terms.length + added.length >= MAX_TERMS) break;
    if (existing.has(value.toLowerCase())) continue;
    existing.add(value.toLowerCase());
    added.push({ id: crypto.randomUUID(), value, addedAt: now });
  }

  if (added.length === 0) {
    return Response.json({ added: [], skipped: cleaned.length });
  }

  store.terms = [...added, ...store.terms];
  await writeStore(platform, store);
  return Response.json({ added, skipped: cleaned.length - added.length });
}

export async function DELETE(request: NextRequest) {
  const platform = platformFromRequest(request);
  if (!platform) return Response.json({ error: "invalid platform" }, { status: 400 });
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return Response.json({ error: "id required" }, { status: 400 });

  const store = await readStore(platform);
  const next = store.terms.filter((t) => t.id !== id);
  if (next.length === store.terms.length) {
    return Response.json({ error: "not found" }, { status: 404 });
  }
  await writeStore(platform, { terms: next });
  return Response.json({ ok: true });
}
