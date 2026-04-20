import { NextRequest } from "next/server";
import { CHANNEL_KEYS } from "@/lib/channels";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import crypto from "crypto";

const VALID_PLATFORMS = new Set<string>(CHANNEL_KEYS);
const SLOT_PATTERN = /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/;
const VALID_MIME = /^(image|video)\//;
const MAX_BYTES = 500 * 1024 * 1024;
const BUCKET = "creatives";

function extFromName(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i) : "";
}

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
  if (!VALID_MIME.test(file.type)) {
    return Response.json({ error: "only images or videos allowed" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "file too large (max 500MB)" }, { status: 400 });
  }

  let formatId: string | null = null;
  if (platform === "signage") {
    if (typeof signageFormatId !== "string" || signageFormatId.length === 0) {
      return Response.json({ error: "signageFormatId required for signage" }, { status: 400 });
    }
    formatId = signageFormatId;
  } else if (typeof signageFormatId === "string" && signageFormatId.length > 0) {
    return Response.json({ error: "signageFormatId only valid for signage platform" }, { status: 400 });
  }

  const kind = file.type.startsWith("image/") ? "image" : "video";
  const ext = extFromName(file.name);
  const safeName = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`;
  const storagePath =
    platform === "signage"
      ? `${projectId}/signage/${formatId}/${safeName}`
      : `${projectId}/${platform}/${ratio}/${safeName}`;

  const bytes = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, bytes, { contentType: file.type, upsert: false });
  if (uploadError) {
    return Response.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: inserted, error: insertError } = await supabase
    .from("media")
    .insert({
      project_id: projectId,
      platform,
      ratio,
      storage_path: storagePath,
      original_name: file.name,
      mime_type: file.type,
      size_bytes: file.size,
      kind,
      uploaded_by: user.id,
      signage_format_id: formatId,
    })
    .select("id, platform, ratio, storage_path, original_name, kind, uploaded_at")
    .single();

  if (insertError || !inserted) {
    await supabase.storage.from(BUCKET).remove([storagePath]);
    return Response.json(
      { error: insertError?.message ?? "failed to save media record" },
      { status: 500 }
    );
  }

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);

  return Response.json({
    id: inserted.id,
    url: pub.publicUrl,
    name: inserted.original_name,
    kind: inserted.kind,
    ratio: inserted.ratio,
    platform: inserted.platform,
  });
}
