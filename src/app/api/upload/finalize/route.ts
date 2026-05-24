import { NextRequest } from "next/server";
import { CHANNEL_KEYS, isPlatformSlotKey } from "@/lib/channels";
import { isUuid } from "@/lib/ids";
import type { PlatformKey } from "@/lib/utm";
import { validateCopy } from "@/lib/platformCopy";
import { expectedSignageRatio } from "@/lib/signage";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CREATIVES_BUCKET, signedMediaUrl } from "@/lib/storage";

const VALID_PLATFORMS = new Set<string>(CHANNEL_KEYS);
// Loose shape gate; the per-platform slot check below catches "valid-looking
// but unconfigured" ratios.
const SLOT_PATTERN = /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/;
const MAX_BYTES = 2 * 1024 * 1024 * 1024;

const VIDEO_MIME_KIND = new Map<string, "video">([
  ["video/mp4", "video"],
  ["video/webm", "video"],
]);

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

  const body = (await request.json().catch(() => null)) as {
    projectId?: unknown;
    platform?: unknown;
    ratio?: unknown;
    storagePath?: unknown;
    posterStoragePath?: unknown;
    fileName?: unknown;
    fileSize?: unknown;
    mimeType?: unknown;
    signageFormatId?: unknown;
    replaceCreativeId?: unknown;
    deletePrevious?: unknown;
    copy?: unknown;
  } | null;
  if (!body) return Response.json({ error: "body required" }, { status: 400 });

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
  } = body;

  if (typeof projectId !== "string" || !isUuid(projectId)) {
    return Response.json({ error: "projectId required" }, { status: 400 });
  }
  if (typeof platform !== "string" || !VALID_PLATFORMS.has(platform)) {
    return Response.json({ error: "invalid platform" }, { status: 400 });
  }
  if (typeof ratio !== "string" || !SLOT_PATTERN.test(ratio)) {
    return Response.json({ error: "invalid slot key" }, { status: 400 });
  }
  if (
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
  if (typeof storagePath !== "string" || storagePath.length === 0) {
    return Response.json({ error: "storagePath required" }, { status: 400 });
  }
  if (typeof fileName !== "string" || typeof mimeType !== "string") {
    return Response.json(
      { error: "fileName + mimeType required" },
      { status: 400 }
    );
  }
  if (
    typeof fileSize !== "number" ||
    !Number.isFinite(fileSize) ||
    fileSize <= 0
  ) {
    return Response.json(
      { error: "fileSize must be a positive number" },
      { status: 400 }
    );
  }
  if (fileSize > MAX_BYTES) {
    return Response.json(
      { error: "file too large (max 2GB)" },
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
    posterUrl,
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
