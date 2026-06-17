import { NextRequest } from "next/server";
import { CHANNEL_KEYS, isPlatformSlotKey } from "@/lib/channels";
import { isCustomPlatformKey } from "@/lib/customChannels";
import { isCustomChannelSlot } from "@/lib/customChannels.server";
import { isUuid } from "@/lib/ids";
import type { PlatformKey } from "@/lib/utm";
import { validateCopy } from "@/lib/platformCopy";
import { expectedSignageRatio } from "@/lib/signage";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CREATIVES_BUCKET, signedMediaUrl } from "@/lib/storage";
import { z } from "zod";
import { apiError, parseJsonBody } from "@/lib/apiError";

const VALID_PLATFORMS = new Set<string>(CHANNEL_KEYS);
// Loose shape gate; the per-platform slot check below catches "valid-looking
// but unconfigured" ratios.
const SLOT_PATTERN = /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/;
const MAX_BYTES = 2 * 1024 * 1024 * 1024;

const VIDEO_MIME_KIND = new Map<string, "video">([
  ["video/mp4", "video"],
  ["video/webm", "video"],
]);

// Coarse body shape. Cross-field/runtime rules (uuid, platform/ratio/signage
// resolution, storage-path containment) stay below — they can't be expressed
// statically. width/height stay `unknown` and pass through `toDimension`,
// which is advisory: bad values become null rather than rejecting the upload.
const finalizeBodySchema = z.object({
  projectId: z.string(),
  platform: z.string(),
  ratio: z.string(),
  storagePath: z.string().min(1, "is required"),
  posterStoragePath: z.string().nullable().optional(),
  fileName: z.string().min(1, "is required"),
  fileSize: z
    .number()
    .finite()
    .positive("must be a positive number")
    .max(MAX_BYTES, "file too large (max 2GB)"),
  mimeType: z.string().min(1, "is required"),
  signageFormatId: z.string().nullable().optional(),
  replaceCreativeId: z.string().nullable().optional(),
  deletePrevious: z.union([z.boolean(), z.string()]).nullable().optional(),
  copy: z.unknown().optional(),
  width: z.unknown().optional(),
  height: z.unknown().optional(),
  thumbhash: z.string().max(80).nullable().optional(),
});

// After the client has uploaded the video (and optional poster) directly to
// Supabase Storage via signed URLs from /api/upload/sign, this endpoint
// records the metadata in the `media` table. The server confirms the storage
// objects actually exist before inserting, so a rogue client can't insert a
// row pointing at /etc/passwd.
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const parsed = await parseJsonBody(request, finalizeBodySchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const {
    projectId,
    platform,
    ratio,
    storagePath,
    posterStoragePath,
    fileName,
    fileSize,
    mimeType,
    signageFormatId,
    replaceCreativeId,
    deletePrevious,
    copy,
    thumbhash,
  } = body;

  // Client-reported intrinsic dimensions (the browser decoded the video to
  // make its poster). Advisory only — used for the slot-fit UI, not security.
  const toDimension = (v: unknown): number | null =>
    typeof v === "number" && Number.isInteger(v) && v > 0 && v <= 100000
      ? v
      : null;
  const mediaWidth = toDimension(body.width);
  const mediaHeight = toDimension(body.height);

  if (!isUuid(projectId)) {
    return apiError("projectId required", 400);
  }
  const isCustomPlatform = isCustomPlatformKey(platform);
  if (!VALID_PLATFORMS.has(platform) && !isCustomPlatform) {
    return apiError("invalid platform", 400);
  }
  if (!SLOT_PATTERN.test(ratio)) {
    return apiError("invalid slot key", 400);
  }
  if (isCustomPlatform) {
    if (!(await isCustomChannelSlot(supabase, platform, ratio))) {
      return Response.json(
        { error: `ratio '${ratio}' is not a format of this custom channel` },
        { status: 400 }
      );
    }
  } else if (
    platform !== "signage" &&
    !isPlatformSlotKey(platform as PlatformKey, ratio)
  ) {
    return Response.json(
      {
        error: `ratio '${ratio}' is not a valid slot for platform '${platform}'`,
      },
      { status: 400 }
    );
  }
  const kind = VIDEO_MIME_KIND.get(mimeType);
  if (!kind) {
    return Response.json(
      { error: "unsupported mime type for direct upload" },
      { status: 400 }
    );
  }

  // Project + signage validation, identical to the sign endpoint.
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, archived_at")
    .eq("id", projectId)
    .maybeSingle();
  if (projectError)
    return Response.json({ error: "project lookup failed" }, { status: 500 });
  if (!project)
    return Response.json({ error: "project not found" }, { status: 404 });
  if (project.archived_at) {
    return Response.json(
      { error: "cannot upload to an archived project" },
      { status: 400 }
    );
  }

  let formatId: string | null = null;
  if (platform === "signage") {
    if (typeof signageFormatId !== "string" || !isUuid(signageFormatId)) {
      return Response.json(
        { error: "signageFormatId required for signage" },
        { status: 400 }
      );
    }
    const { data: format, error: formatError } = await supabase
      .from("signage_formats")
      .select("id, width, height")
      .eq("id", signageFormatId)
      .eq("project_id", projectId)
      .maybeSingle();
    if (formatError || !format) {
      return Response.json(
        { error: "signage format not found for project" },
        { status: 404 }
      );
    }
    const expected = expectedSignageRatio({
      width: Number(format.width),
      height: Number(format.height),
    });
    if (ratio !== expected) {
      return Response.json(
        {
          error: `ratio '${ratio}' does not match signage format dimensions (expected '${expected}')`,
        },
        { status: 400 }
      );
    }
    formatId = signageFormatId;
  } else if (
    typeof signageFormatId === "string" &&
    signageFormatId.length > 0
  ) {
    return Response.json(
      { error: "signageFormatId only valid for signage platform" },
      { status: 400 }
    );
  }

  // Confirm the storage paths fall inside the expected directory for this
  // project/platform/ratio. Defense against a client that PUTs to one path
  // then tries to register a different path here.
  const expectedPrefix =
    platform === "signage"
      ? `${projectId}/signage/${formatId}/`
      : `${projectId}/${platform}/${ratio}/`;
  if (!storagePath.startsWith(expectedPrefix)) {
    return Response.json(
      { error: "storagePath outside allowed directory" },
      { status: 400 }
    );
  }
  if (
    typeof posterStoragePath === "string" &&
    posterStoragePath.length > 0 &&
    !posterStoragePath.startsWith(expectedPrefix)
  ) {
    return Response.json(
      { error: "posterStoragePath outside allowed directory" },
      { status: 400 }
    );
  }

  // Verify the main object actually exists in storage.
  if (!(await storageObjectExists(supabase, storagePath))) {
    return Response.json(
      { error: "uploaded file not found in storage" },
      { status: 400 }
    );
  }
  let posterFinalPath: string | null = null;
  if (typeof posterStoragePath === "string" && posterStoragePath.length > 0) {
    if (await storageObjectExists(supabase, posterStoragePath)) {
      posterFinalPath = posterStoragePath;
    }
  }

  // Validate copy against the platform schema.
  let copyValue: Record<string, unknown> | null = null;
  if (copy !== undefined && copy !== null) {
    const result = validateCopy(platform as PlatformKey, copy);
    if (!result.ok)
      return Response.json({ error: result.error }, { status: 400 });
    copyValue = result.value;
  }

  // Replace flow.
  let creativeId: string | undefined;
  let versionNum = 1;
  let archivedRows: Array<{ id: string; storage_path: string | null }> = [];
  if (typeof replaceCreativeId === "string" && replaceCreativeId.length > 0) {
    if (!isUuid(replaceCreativeId)) {
      return Response.json(
        { error: "invalid replaceCreativeId" },
        { status: 400 }
      );
    }
    const { data: existing, error: existingError } = await supabase
      .from("media")
      .select("id, version_num, storage_path, is_current")
      .eq("creative_id", replaceCreativeId)
      .eq("project_id", projectId)
      .order("version_num", { ascending: false });
    if (existingError) {
      return Response.json(
        { error: "creative lookup failed" },
        { status: 500 }
      );
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

  const insertRow: Record<string, unknown> = {
    project_id: projectId,
    platform,
    ratio,
    storage_path: storagePath,
    poster_storage_path: posterFinalPath,
    original_name: fileName,
    mime_type: mimeType,
    size_bytes: fileSize,
    kind,
    uploaded_by: user.id,
    signage_format_id: formatId,
    copy: copyValue,
    version_num: versionNum,
    is_current: true,
    width: mediaWidth,
    height: mediaHeight,
    // Videos have no server-generated thumbnail; the poster is the tile. We
    // still store a ThumbHash (computed client-side from the poster frame) for
    // the blurred placeholder.
    thumbhash: thumbhash ?? null,
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
    // The client uploaded the bytes but we couldn't record them — clean up
    // the orphaned storage objects so we don't leak storage.
    const cleanup = [storagePath];
    if (posterFinalPath) cleanup.push(posterFinalPath);
    const { error: cleanupErr } = await supabase.storage
      .from(CREATIVES_BUCKET)
      .remove(cleanup);
    if (cleanupErr) {
      console.warn(
        "finalize: orphan cleanup failed",
        cleanup,
        cleanupErr.message
      );
    }
    // Postgres unique violation = 23505. The partial unique index on
    // (creative_id) where is_current=true catches concurrent replaces.
    if (insertError && (insertError as { code?: string }).code === "23505") {
      return Response.json(
        {
          error:
            "another version of this creative was just published — refresh and retry",
        },
        { status: 409 }
      );
    }
    return Response.json(
      { error: "failed to save media record" },
      { status: 500 }
    );
  }

  // Archive or delete previous versions.
  if (creativeId && archivedRows.length > 0) {
    if (deletePrevious === true || deletePrevious === "true") {
      const oldIds = archivedRows.map((r) => r.id);
      const { data: oldRows } = await supabase
        .from("media")
        .select("storage_path, poster_storage_path")
        .in("id", oldIds);
      const paths: string[] = [];
      for (const row of oldRows ?? []) {
        if (row.storage_path) paths.push(row.storage_path);
        if (row.poster_storage_path) paths.push(row.poster_storage_path);
      }
      const { error: deleteErr } = await supabase
        .from("media")
        .delete()
        .in("id", oldIds);
      if (deleteErr) {
        // DB delete failed — DO NOT remove storage objects, or live rows
        // will be left pointing at missing files.
        console.warn(
          "finalize: archive-delete failed; keeping storage",
          deleteErr.message
        );
      } else if (paths.length > 0) {
        const { error: removeErr } = await supabase.storage
          .from(CREATIVES_BUCKET)
          .remove(paths);
        if (removeErr) {
          console.warn(
            "finalize: storage cleanup failed",
            paths,
            removeErr.message
          );
        }
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
    return Response.json(
      { error: "could not sign media url" },
      { status: 500 }
    );
  }
  const posterUrl = posterFinalPath
    ? await signedMediaUrl(supabase, posterFinalPath)
    : null;

  return Response.json({
    id: inserted.id,
    creativeId: inserted.creative_id,
    versionNum: inserted.version_num,
    url,
    thumbUrl: null,
    posterUrl,
    thumbhash: thumbhash ?? null,
    name: inserted.original_name,
    kind: inserted.kind,
    ratio: inserted.ratio,
    platform: inserted.platform,
    copy: (inserted.copy as Record<string, unknown> | null) ?? null,
  });
}

// Confirms a storage object exists by listing the parent directory and
// checking for the basename. Cheaper than a HEAD because storage-js doesn't
// expose HEAD directly.
async function storageObjectExists(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  path: string
): Promise<boolean> {
  const lastSlash = path.lastIndexOf("/");
  if (lastSlash <= 0) return false;
  const dir = path.slice(0, lastSlash);
  const name = path.slice(lastSlash + 1);
  const { data, error } = await supabase.storage
    .from(CREATIVES_BUCKET)
    .list(dir, { search: name, limit: 1 });
  if (error || !data) return false;
  return data.some((entry) => entry.name === name);
}
