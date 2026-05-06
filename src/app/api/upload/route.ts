import { NextRequest } from "next/server";
import { fileTypeFromBuffer } from "file-type";
import sharp from "sharp";
import { CHANNEL_KEYS } from "@/lib/channels";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CREATIVES_BUCKET, signedMediaUrl } from "@/lib/storage";
import crypto from "crypto";

const VALID_PLATFORMS = new Set<string>(CHANNEL_KEYS);
const SLOT_PATTERN = /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/;
const MAX_BYTES = 500 * 1024 * 1024;

// Allowlist of MIME types we accept. SVG is intentionally excluded — it can
// embed scripts and would execute when rendered inline. Keep this list small.
const ALLOWED_MIME = new Map<string, { kind: "image" | "video"; ext: string }>([
  ["image/jpeg", { kind: "image", ext: ".jpg" }],
  ["image/png", { kind: "image", ext: ".png" }],
  ["image/webp", { kind: "image", ext: ".webp" }],
  ["image/gif", { kind: "image", ext: ".gif" }],
  ["video/mp4", { kind: "video", ext: ".mp4" }],
  ["video/quicktime", { kind: "video", ext: ".mov" }],
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

  const formData = await request.formData();
  const file = formData.get("file");
  const ratio = formData.get("ratio");
  const platform = formData.get("platform");
  const projectId = formData.get("projectId");
  const signageFormatId = formData.get("signageFormatId");

  if (!(file instanceof File)) {
    return Response.json({ error: "file is required" }, { status: 400 });
  }
  if (typeof projectId !== "string" || projectId.length === 0) {
    return Response.json({ error: "projectId required" }, { status: 400 });
  }
  if (typeof platform !== "string" || !VALID_PLATFORMS.has(platform)) {
    return Response.json({ error: "invalid platform" }, { status: 400 });
  }
  if (typeof ratio !== "string" || !SLOT_PATTERN.test(ratio)) {
    return Response.json({ error: "invalid slot key" }, { status: 400 });
  }
  if (file.size === 0) {
    return Response.json({ error: "file is empty" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "file too large (max 500MB)" }, { status: 400 });
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return Response.json(
      { error: "unsupported file type — use JPEG, PNG, WebP, GIF, MP4, MOV, or WebM" },
      { status: 400 }
    );
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
    if (typeof signageFormatId !== "string" || signageFormatId.length === 0) {
      return Response.json({ error: "signageFormatId required for signage" }, { status: 400 });
    }
    // Verify the format actually belongs to this project to prevent cross-project writes.
    const { data: format, error: formatError } = await supabase
      .from("signage_formats")
      .select("id")
      .eq("id", signageFormatId)
      .eq("project_id", projectId)
      .maybeSingle();
    if (formatError || !format) {
      return Response.json({ error: "signage format not found for project" }, { status: 404 });
    }
    formatId = signageFormatId;
  } else if (typeof signageFormatId === "string" && signageFormatId.length > 0) {
    return Response.json({ error: "signageFormatId only valid for signage platform" }, { status: 400 });
  }

  const claimed = ALLOWED_MIME.get(file.type)!;

  // Read the bytes once. Sniff the magic bytes to confirm the claimed MIME
  // matches the actual file contents — otherwise a renamed binary slips by.
  let bytes: Uint8Array = Buffer.from(await file.arrayBuffer());
  const sniff = await fileTypeFromBuffer(bytes);
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

  let storedMime = file.type;
  let storedExt = claimed.ext;

  // Re-encode supported images to strip EXIF/metadata and normalize orientation.
  // Videos and GIFs pass through unchanged.
  if (REENCODE_MIME.has(file.type)) {
    try {
      const pipeline = sharp(bytes, { failOn: "error" }).rotate();
      if (file.type === "image/jpeg") {
        bytes = await pipeline.jpeg({ quality: 90, mozjpeg: true }).toBuffer();
      } else if (file.type === "image/png") {
        bytes = await pipeline.png({ compressionLevel: 9 }).toBuffer();
      } else if (file.type === "image/webp") {
        bytes = await pipeline.webp({ quality: 90 }).toBuffer();
      }
      storedMime = file.type;
      storedExt = claimed.ext;
    } catch {
      return Response.json({ error: "image could not be processed" }, { status: 400 });
    }
  }

  const safeName = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${storedExt}`;
  const storagePath =
    platform === "signage"
      ? `${projectId}/signage/${formatId}/${safeName}`
      : `${projectId}/${platform}/${ratio}/${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from(CREATIVES_BUCKET)
    .upload(storagePath, bytes, { contentType: storedMime, upsert: false });
  if (uploadError) {
    return Response.json({ error: "upload failed" }, { status: 500 });
  }

  const { data: inserted, error: insertError } = await supabase
    .from("media")
    .insert({
      project_id: projectId,
      platform,
      ratio,
      storage_path: storagePath,
      original_name: file.name,
      mime_type: storedMime,
      size_bytes: bytes.length,
      kind: claimed.kind,
      uploaded_by: user.id,
      signage_format_id: formatId,
    })
    .select("id, platform, ratio, storage_path, original_name, kind, uploaded_at")
    .single();

  if (insertError || !inserted) {
    await supabase.storage.from(CREATIVES_BUCKET).remove([storagePath]);
    return Response.json({ error: "failed to save media record" }, { status: 500 });
  }

  const url = await signedMediaUrl(supabase, storagePath);
  if (!url) {
    return Response.json({ error: "could not sign media url" }, { status: 500 });
  }

  return Response.json({
    id: inserted.id,
    url,
    name: inserted.original_name,
    kind: inserted.kind,
    ratio: inserted.ratio,
    platform: inserted.platform,
  });
}
