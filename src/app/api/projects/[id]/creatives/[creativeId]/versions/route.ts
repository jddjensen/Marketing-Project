import { NextRequest } from "next/server";
import { isUuid } from "@/lib/ids";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { signedMediaUrls } from "@/lib/storage";

// List the full version history for a creative within a project.
export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string; creativeId: string }> }
) {
  const { id: projectId, creativeId } = await ctx.params;
  if (!isUuid(projectId) || !isUuid(creativeId)) {
    return Response.json({ error: "not found" }, { status: 404 });
  }
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("media")
    .select(
      "id, creative_id, version_num, platform, ratio, kind, storage_path, poster_storage_path, original_name, copy, is_current, uploaded_at"
    )
    .eq("project_id", projectId)
    .eq("creative_id", creativeId)
    .order("version_num", { ascending: false });

  if (error) return Response.json({ error: "failed to load versions" }, { status: 500 });
  if (!data || data.length === 0) {
    return Response.json({ error: "creative not found" }, { status: 404 });
  }

  const allPaths: string[] = [];
  for (const row of data) {
    if (row.storage_path) allPaths.push(row.storage_path);
    if (row.poster_storage_path) allPaths.push(row.poster_storage_path);
  }
  const urlMap = await signedMediaUrls(supabase, allPaths);

  const versions = data.map((row) => ({
    id: row.id,
    creativeId: row.creative_id,
    versionNum: row.version_num,
    platform: row.platform,
    ratio: row.ratio,
    kind: row.kind,
    url: row.storage_path ? urlMap.get(row.storage_path) ?? null : null,
    posterUrl: row.poster_storage_path
      ? urlMap.get(row.poster_storage_path) ?? null
      : null,
    name: row.original_name,
    copy: (row.copy as Record<string, unknown> | null) ?? null,
    isCurrent: row.is_current,
    uploadedAt: new Date(row.uploaded_at).getTime(),
  }));

  return Response.json({ versions });
}
