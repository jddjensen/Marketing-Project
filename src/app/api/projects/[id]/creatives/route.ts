import { NextRequest } from "next/server";
import { CHANNEL_KEYS, isPlatformSlotKey } from "@/lib/channels";
import { isUuid } from "@/lib/ids";
import type { PlatformKey } from "@/lib/utm";
import { platformSupportsTextOnly, validateCopy } from "@/lib/platformCopy";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const VALID_PLATFORMS = new Set<string>(CHANNEL_KEYS);
// Loose shape gate; the per-platform slot check below catches "valid-looking
// but unconfigured" ratios.
const SLOT_PATTERN = /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/;

// Create a text-only creative: copy with no associated file. Used for Email,
// SMS, internal-messaging, and PR channels where the copy IS the creative.
export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await ctx.params;
  if (!isUuid(projectId)) return Response.json({ error: "not found" }, { status: 404 });
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    platform?: unknown;
    ratio?: unknown;
    copy?: unknown;
    replaceCreativeId?: unknown;
    deletePrevious?: unknown;
  } | null;
  if (!body) return Response.json({ error: "body required" }, { status: 400 });

  const { platform, ratio, copy, replaceCreativeId, deletePrevious } = body;
  if (typeof platform !== "string" || !VALID_PLATFORMS.has(platform)) {
    return Response.json({ error: "invalid platform" }, { status: 400 });
  }
  if (!platformSupportsTextOnly(platform as PlatformKey)) {
    return Response.json(
      { error: `text-only creatives are not supported for ${platform}` },
      { status: 400 }
    );
  }
  if (typeof ratio !== "string" || !SLOT_PATTERN.test(ratio)) {
    return Response.json({ error: "invalid slot key" }, { status: 400 });
  }
  // Text creatives are only created for non-signage channels (text-only flag),
  // so a configured-slot check is enough — no signage branch needed here.
  if (!isPlatformSlotKey(platform as PlatformKey, ratio)) {
    return Response.json(
      { error: `ratio '${ratio}' is not a valid slot for platform '${platform}'` },
      { status: 400 }
    );
  }

  const copyResult = validateCopy(platform as PlatformKey, copy);
  if (!copyResult.ok) {
    return Response.json({ error: copyResult.error }, { status: 400 });
  }
  // Text creatives must actually have copy.
  if (Object.keys(copyResult.value).length === 0) {
    return Response.json({ error: "copy is required for text creatives" }, { status: 400 });
  }

  // Project must exist and not be archived.
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, archived_at")
    .eq("id", projectId)
    .maybeSingle();
  if (projectError) {
    return Response.json({ error: "project lookup failed" }, { status: 500 });
  }
  if (!project) return Response.json({ error: "project not found" }, { status: 404 });
  if (project.archived_at) {
    return Response.json({ error: "cannot create in an archived project" }, { status: 400 });
  }

  // Replace flow.
  let creativeId: string | undefined;
  let versionNum = 1;
  let archivedIds: string[] = [];
  if (typeof replaceCreativeId === "string" && replaceCreativeId.length > 0) {
    if (!isUuid(replaceCreativeId)) {
      return Response.json({ error: "invalid replaceCreativeId" }, { status: 400 });
    }
    const { data: existing, error: existingError } = await supabase
      .from("media")
      .select("id, version_num, is_current, storage_path, poster_storage_path")
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
    archivedIds = existing.filter((r) => r.is_current).map((r) => r.id);

    if (deletePrevious === true || deletePrevious === "true") {
      // Capture storage paths to remove after we insert the new version.
      // (Done below after the insert succeeds so we don't lose data on failure.)
    }
  }

  const insertRow: Record<string, unknown> = {
    project_id: projectId,
    platform,
    ratio,
    kind: "text",
    copy: copyResult.value,
    uploaded_by: user.id,
    version_num: versionNum,
    is_current: true,
  };
  if (creativeId) insertRow.creative_id = creativeId;

  const { data: inserted, error: insertError } = await supabase
    .from("media")
    .insert(insertRow)
    .select("id, creative_id, version_num, platform, ratio, kind, copy, uploaded_at")
    .single();
  if (insertError || !inserted) {
    // 23505 = unique violation on the partial index that ensures only one
    // is_current=true row per creative_id. A concurrent replace beat us.
    if (insertError && (insertError as { code?: string }).code === "23505") {
      return Response.json(
        { error: "another version of this creative was just published — refresh and retry" },
        { status: 409 }
      );
    }
    return Response.json({ error: "failed to save creative" }, { status: 500 });
  }

  // Archive or delete previous versions.
  if (creativeId && archivedIds.length > 0) {
    if (deletePrevious === true || deletePrevious === "true") {
      const { data: oldRows } = await supabase
        .from("media")
        .select("storage_path, poster_storage_path")
        .in("id", archivedIds);
      const paths: string[] = [];
      for (const row of oldRows ?? []) {
        if (row.storage_path) paths.push(row.storage_path);
        if (row.poster_storage_path) paths.push(row.poster_storage_path);
      }
      const { error: deleteErr } = await supabase
        .from("media")
        .delete()
        .in("id", archivedIds);
      if (deleteErr) {
        console.warn("text-creative: archive-delete failed; keeping storage", deleteErr.message);
      } else if (paths.length > 0) {
        const { error: removeErr } = await supabase.storage
          .from("creatives")
          .remove(paths);
        if (removeErr) {
          console.warn("text-creative: storage cleanup failed", paths, removeErr.message);
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

  return Response.json({
    id: inserted.id,
    creativeId: inserted.creative_id,
    versionNum: inserted.version_num,
    platform: inserted.platform,
    ratio: inserted.ratio,
    kind: inserted.kind,
    url: null,
    posterUrl: null,
    copy: (inserted.copy as Record<string, unknown> | null) ?? null,
    name: null,
    uploadedAt: new Date(inserted.uploaded_at).getTime(),
  });
}
