import { NextRequest } from "next/server";
import { fileTypeFromBuffer } from "file-type";
import sharp from "sharp";
import { CHANNEL_KEYS, isPlatformSlotKey } from "@/lib/channels";
import { isUuid } from "@/lib/ids";
import type { PlatformKey } from "@/lib/utm";
import { validateCopy } from "@/lib/platformCopy";
import { expectedSignageRatio } from "@/lib/signage";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CREATIVES_BUCKET, signedMediaUrl } from "@/lib/storage";
import crypto from "crypto";

const VALID_PLATFORMS = new Set<string>(CHANNEL_KEYS);
// Loose shape gate — kept so we can reject obviously bad strings (path
// separators, control chars) before doing the per-platform slot check below.
const SLOT_PATTERN = /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/;
// 2 GB cap. The API route enforces this for direct multipart uploads; the
// browser-direct flow (/api/upload/sign + /api/upload/finalize) enforces the
// same cap and is what most uploads above ~100 MB should use because
// serverless platforms (Vercel) reject request bodies larger than ~4.5 MB.
const MAX_BYTES = 2 * 1024 * 1024 * 1024;

// Allowlist of MIME types we accept. SVG is intentionally excluded (script
// injection vector). MOV (video/quicktime) is intentionally excluded because
// Chrome and Firefox cannot play it — iPhone uploads need to be converted to
// MP4 first.
const ALLOWED_MIME = new Map<string, { kind: "image" | "video"; ext: string }>([
  ["image/jpeg", { kind: "image", ext: ".jpg" }],
  ["image/png", { kind: "image", ext: ".png" }],
  ["image/webp", { kind: "image", ext: ".webp" }],
  ["image/gif", { kind: "image", ext: ".gif" }],
  ["video/mp4", { kind: "video", ext: ".mp4" }],
  ["video/webm", { kind: "video", ext: ".webm" }],
]);

// Image MIMEs we re-encode through sharp to strip EXIF and apply orientation.
// GIFs are skipped to preserve animation; videos are not re-encoded.
const REENCODE_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  // formData() throws when Content-Type isn't multipart/form-data or
  // application/x-www-form-urlencoded — surface that as a clean 400 instead
  // of letting it bubble into a 500 with no body.
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json(
      { error: "request must be multipart/form-data" },
      { status: 400 }
    );
  }
  const file = formData.get("file");
  const ratio = formData.get("ratio");
  const platform = formData.get("platform");
  const projectId = formData.get("projectId");
  const signageFormatId = formData.get("signageFormatId");
  const poster = formData.get("poster");
  const replaceCreativeId = formData.get("replaceCreativeId");
  const deletePrevious = formData.get("deletePrevious");
  const copyRaw = formData.get("copy");

  if (!(file instanceof File)) {
    return Response.json({ error: "file is required" }, { status: 400 });
  }
  if (typeof projectId !== "string" || !isUuid(projectId)) {
    return Response.json({ error: "projectId required" }, { status: 400 });
  }
  if (typeof platform !== "string" || !VALID_PLATFORMS.has(platform)) {
    return Response.json({ error: "invalid platform" }, { status: 400 });
  }
  if (typeof ratio !== "string" || !SLOT_PATTERN.test(ratio)) {
    return Response.json({ error: "invalid slot key" }, { status: 400 });
  }
  // Signage ratios are validated below against the resolved format dimensions;
  // every other channel must hit one of its declared slots so we can't end up
  // with media filed under a ratio no UI renders.
  if (platform !== "signage" && !isPlatformSlotKey(platform as PlatformKey, ratio)) {
    return Response.json(
      { error: `ratio '${ratio}' is not a valid slot for platform '${platform}'` },
      { status: 400 }
    );
  }
  if (file.size === 0) {
    return Response.json({ error: "file is empty" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "file too large (max 2GB)" }, { status: 400 });
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return Response.json(
      {
        error:
          "unsupported file type — use JPEG, PNG, WebP, GIF, MP4, or WebM. " +
          "MOV/QuickTime is not accepted because it doesn't play in Chrome or Firefox; " +
          "convert to MP4 first.",
      },
      { status: 400 }
    );
  }

  // Parse + validate the optional copy blob against the platform schema.
  let copy: Record<string, unknown> | null = null;
  if (typeof copyRaw === "string" && copyRaw.length > 0) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(copyRaw);
    } catch {
      return Response.json({ error: "copy must be valid JSON" }, { status: 400 });
    }
    const result = validateCopy(platform as PlatformKey, parsed);
    if (!result.ok) {
      return Response.json({ error: result.error }, { status: 400 });
    }
    copy = result.value;
  }

  // Verify the project exists. (Shared-workspace model: any authenticated
  // user can upload to any project, but the project must be real and live.)
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, archived_at")
    .eq("id", projectId)
    .maybeSingle();
  if (projectError) {
    return Response.json({ error: "project lookup failed" }, { status: 500 });
  }
  if (!project) {
    return Response.json({ error: "project not found" }, { status: 404 });
  }
  if (project.archived_at) {
    return Response.json({ error: "cannot upload to an archived project" }, { status: 400 });
  }

  let formatId: string | null = null;
  if (platform === "signage") {
    if (typeof signageFormatId !== "string" || !isUuid(signageFormatId)) {
      return Response.json({ error: "signageFormatId required for signage" }, { status: 400 });
    }
    const { data: format, error: formatError } = await supabase
      .from("signage_formats")
      .select("id, width, height")
      .eq("id", signageFormatId)
      .eq("project_id", projectId)
      .maybeSingle();
    if (formatError || !format) {
      return Response.json({ error: "signage format not found for project" }, { status: 404 });
    }
    const expected = expectedSignageRatio({
      width: Number(format.width),
      height: Number(format.height),
    });
    if (ratio !== expected) {
      return Response.json(
        { error: `ratio '${ratio}' does not match signage format dimensions (expected '${expected}')` },
        { status: 400 }
      );
    }
    formatId = signageFormatId;
  } else if (typeof signageFormatId === "string" && signageFormatId.length > 0) {
    return Response.json({ error: "signageFormatId only valid for signage platform" }, { status: 400 });
  }

  // Replace flow: confirm the creative exists in this project and figure out
  // the next version number.
  let creativeId: string | undefined;
  let versionNum = 1;
  let archivedRows: Array<{ id: string; storage_path: string | null }> = [];
  if (typeof replaceCreativeId === "string" && replaceCreativeId.length > 0) {
    if (!isUuid(replaceCreativeId)) {
      return Response.json({ error: "invalid replaceCreativeId" }, { status: 400 });
    }
    const { data: existing, error: existingError } = await supabase
      .from("media")
      .select("id, version_num, storage_path, is_current")
      .eq("creative_id", replaceCreativeId)
      .eq("project_id", projectId)
      .order("version_num", { ascending: false });
    if (existingError) {
      return Response.json({ error: "creative lookup failed" }, { status: 500 });
    }
    if (!existing || existing.length === 0) {
      return Response.json({ error: "creative not found" }, { status: 404 });
    }
    creativeId = replaceCreativeId;
    versionNum = (existing[0].version_num ?? 0) + 1;
    archivedRows = existing
      .filter((r) => r.is_current)
      .map((r) => ({ id: r.id, storage_path: r.storage_path }));
  }

  const claimed = ALLOWED_MIME.get(file.type)!;
  const isImage = claimed.kind === "image";

  // Magic-byte sniff: full buffer for images (we need it for sharp anyway),
  // first 4KB for videos (so we don't drag a 500MB file through Node memory).
  let processedBytes: Uint8Array | null = null;
  let sniffBytes: Uint8Array;
  if (isImage) {
    processedBytes = Buffer.from(await file.arrayBuffer());
    sniffBytes = processedBytes;
  } else {
    sniffBytes = new Uint8Array(await file.slice(0, 4096).arrayBuffer());
  }
  const sniff = await fileTypeFromBuffer(sniffBytes);
  if (!sniff || sniff.mime !== file.type) {
    return Response.json(
      {
        error: `file contents do not match declared type (${file.type}${
          sniff ? `, looks like ${sniff.mime}` : ", unknown"
        })`,
      },
      { status: 400 }
    );
  }

  // Re-encode supported images to strip EXIF/metadata and normalize orientation.
  if (processedBytes && REENCODE_MIME.has(file.type)) {
    try {
      const pipeline = sharp(processedBytes, { failOn: "error" }).rotate();
      if (file.type === "image/jpeg") {
        processedBytes = await pipeline.jpeg({ quality: 90, mozjpeg: true }).toBuffer();
      } else if (file.type === "image/png") {
        processedBytes = await pipeline.png({ compressionLevel: 9 }).toBuffer();
      } else if (file.type === "image/webp") {
        processedBytes = await pipeline.webp({ quality: 90 }).toBuffer();
      }
    } catch {
      return Response.json({ error: "image could not be processed" }, { status: 400 });
    }
  }

  const storedMime = file.type;
  const storedExt = claimed.ext;
  const safeName = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${storedExt}`;
  const storagePath =
    platform === "signage"
      ? `${projectId}/signage/${formatId}/${safeName}`
      : `${projectId}/${platform}/${ratio}/${safeName}`;

  const uploadBody: Uint8Array | File = processedBytes ?? file;
  const sizeForRecord = processedBytes ? processedBytes.length : file.size;

  const { error: uploadError } = await supabase.storage
    .from(CREATIVES_BUCKET)
    .upload(storagePath, uploadBody, { contentType: storedMime, upsert: false });
  if (uploadError) {
    return Response.json({ error: "upload failed" }, { status: 500 });
  }

  // Optional poster for videos.
  let posterStoragePath: string | null = null;
  if (claimed.kind === "video" && poster instanceof File && poster.size > 0) {
    const posterMaxBytes = 5 * 1024 * 1024;
    if (poster.type === "image/jpeg" && poster.size <= posterMaxBytes) {
      const candidatePath = `${storagePath}.poster.jpg`;
      const { error: posterError } = await supabase.storage
        .from(CREATIVES_BUCKET)
        .upload(candidatePath, poster, {
          contentType: "image/jpeg",
          upsert: false,
        });
      if (!posterError) posterStoragePath = candidatePath;
    }
  }

  const insertRow: Record<string, unknown> = {
    project_id: projectId,
    platform,
    ratio,
    storage_path: storagePath,
    poster_storage_path: posterStoragePath,
    original_name: file.name,
    mime_type: storedMime,
    size_bytes: sizeForRecord,
    kind: claimed.kind,
    uploaded_by: user.id,
    signage_format_id: formatId,
    copy,
    version_num: versionNum,
    is_current: true,
  };
  if (creativeId) insertRow.creative_id = creativeId;

  const { data: inserted, error: insertError } = await supabase
    .from("media")
    .insert(insertRow)
    .select(
      "id, creative_id, version_num, platform, ratio, storage_path, poster_storage_path, original_name, kind, copy, uploaded_at"
    )
    .single();

  if (insertError || !inserted) {
    const cleanup = [storagePath];
    if (posterStoragePath) cleanup.push(posterStoragePath);
    await supabase.storage.from(CREATIVES_BUCKET).remove(cleanup);
    return Response.json({ error: "failed to save media record" }, { status: 500 });
  }

  // Archive previous versions: flip is_current=false on every row of this
  // creative except the row we just inserted. If deletePrevious=true, also
  // remove the archived rows entirely + their storage objects.
  if (creativeId && archivedRows.length > 0) {
    if (deletePrevious === "true" || deletePrevious === "1") {
      const oldIds = archivedRows.map((r) => r.id);
      const oldPaths = archivedRows.flatMap((r) =>
        r.storage_path ? [r.storage_path] : []
      );
      // Also delete poster files for the archived rows.
      const { data: oldPosterRows } = await supabase
        .from("media")
        .select("poster_storage_path")
        .in("id", oldIds);
      for (const row of oldPosterRows ?? []) {
        if (row.poster_storage_path) oldPaths.push(row.poster_storage_path);
      }
      await supabase.from("media").delete().in("id", oldIds);
      if (oldPaths.length > 0) {
        await supabase.storage.from(CREATIVES_BUCKET).remove(oldPaths);
      }
    } else {
      await supabase
        .from("media")
        .update({ is_current: false })
        .eq("creative_id", creativeId)
        .neq("id", inserted.id);
    }
  }

  const url = await signedMediaUrl(supabase, storagePath);
  if (!url) {
    return Response.json({ error: "could not sign media url" }, { status: 500 });
  }
  const posterUrl = posterStoragePath
    ? await signedMediaUrl(supabase, posterStoragePath)
    : null;

  return Response.json({
    id: inserted.id,
    creativeId: inserted.creative_id,
    versionNum: inserted.version_num,
    url,
    posterUrl,
    name: inserted.original_name,
    kind: inserted.kind,
    ratio: inserted.ratio,
    platform: inserted.platform,
    copy: (inserted.copy as Record<string, unknown> | null) ?? null,
  });
}
