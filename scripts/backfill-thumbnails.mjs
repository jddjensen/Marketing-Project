// One-off backfill: generate the grid thumbnail + ThumbHash placeholder for
// image media uploaded before migration 0025 added those columns. Idempotent —
// skips rows that already have a thumbhash, and re-running is safe.
//
// Requires admin access (service role) to read storage + update rows
// regardless of RLS. Set these in .env.local or the environment:
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//
// Usage: npm run backfill:thumbnails
//
// Videos are intentionally skipped: their ThumbHash is computed client-side
// from the poster frame at upload time and can't be regenerated server-side
// here without re-decoding the video.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { rgbaToThumbHash } from "thumbhash";
import crypto from "node:crypto";

const CREATIVES_BUCKET = "creatives";
const THUMB_MAX_EDGE = 320;
const THUMBHASH_MAX_EDGE = 100;
const PAGE_SIZE = 100;

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

// Minimal .env.local loader so the script works without extra deps. Existing
// process.env values win over the file.
function loadEnv() {
  const env = { ...process.env };
  try {
    const raw = readFileSync(path.join(rootDir, ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const key = m[1];
      let val = m[2].trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (env[key] === undefined) env[key] = val;
    }
  } catch {
    // No .env.local — rely on process.env.
  }
  return env;
}

async function deriveFromBuffer(input) {
  const thumb = await sharp(input, { failOn: "none", animated: false })
    .rotate()
    .resize(THUMB_MAX_EDGE, THUMB_MAX_EDGE, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 72 })
    .toBuffer();

  const { data, info } = await sharp(input, { failOn: "none", animated: false })
    .rotate()
    .resize(THUMBHASH_MAX_EDGE, THUMBHASH_MAX_EDGE, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  if (!info.width || !info.height) return null;
  const hash = rgbaToThumbHash(info.width, info.height, data);
  return { thumb, thumbhash: Buffer.from(hash).toString("base64") };
}

async function main() {
  const env = loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required " +
        "(set them in .env.local or the environment)."
    );
    process.exit(1);
  }
  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });

  let processed = 0;
  let updated = 0;
  let failed = 0;

  // Page through current image rows missing a ThumbHash.
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data: rows, error } = await supabase
      .from("media")
      .select("id, storage_path, kind, thumbhash")
      .eq("kind", "image")
      .is("thumbhash", null)
      .order("uploaded_at", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) {
      console.error("query failed:", error.message);
      process.exit(1);
    }
    if (!rows || rows.length === 0) break;

    for (const row of rows) {
      processed++;
      if (!row.storage_path) continue;
      try {
        const { data: blob, error: dErr } = await supabase.storage
          .from(CREATIVES_BUCKET)
          .download(row.storage_path);
        if (dErr || !blob) throw new Error(dErr?.message ?? "download failed");

        const buffer = Buffer.from(await blob.arrayBuffer());
        const contentHash = crypto
          .createHash("sha256")
          .update(buffer)
          .digest("hex");
        const derived = await deriveFromBuffer(buffer);
        if (!derived) throw new Error("could not derive thumbnail");

        const thumbPath = `${row.storage_path}.thumb.webp`;
        const { error: uErr } = await supabase.storage
          .from(CREATIVES_BUCKET)
          .upload(thumbPath, derived.thumb, {
            contentType: "image/webp",
            upsert: true,
          });
        if (uErr) throw new Error(`thumb upload failed: ${uErr.message}`);

        const { error: updErr } = await supabase
          .from("media")
          .update({
            thumb_storage_path: thumbPath,
            thumbhash: derived.thumbhash,
            content_hash: contentHash,
          })
          .eq("id", row.id);
        if (updErr) throw new Error(`row update failed: ${updErr.message}`);

        updated++;
        if (updated % 25 === 0) console.log(`  …${updated} updated`);
      } catch (e) {
        failed++;
        console.warn(`  ✗ ${row.id}: ${e instanceof Error ? e.message : e}`);
      }
    }
  }

  console.log(
    `Done. processed=${processed} updated=${updated} failed=${failed}`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
