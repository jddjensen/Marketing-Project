import { NextRequest } from "next/server";
import { isUuid } from "@/lib/ids";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { signedMediaUrls } from "@/lib/storage";

export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  if (!isUuid(id))
    return Response.json({ error: "not found" }, { status: 404 });
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("media")
    .select(
      "id, creative_id, version_num, platform, ratio, storage_path, thumb_storage_path, poster_storage_path, thumbhash, original_name, kind, copy, uploaded_at, width, height"
    )
    .eq("project_id", id)
    .eq("is_current", true)
    .order("uploaded_at", { ascending: false });
  if (error)
    return Response.json({ error: "failed to load media" }, { status: 500 });

  const rows = data ?? [];
  const allPaths: string[] = [];
  for (const r of rows) {
    if (r.storage_path) allPaths.push(r.storage_path);
    if (r.thumb_storage_path) allPaths.push(r.thumb_storage_path);
    if (r.poster_storage_path) allPaths.push(r.poster_storage_path);
  }
  const urlMap = await signedMediaUrls(supabase, allPaths);

  const items = rows
    .map((row) => {
      const url = row.storage_path
        ? (urlMap.get(row.storage_path) ?? null)
        : null;
      if (row.kind !== "text" && !url) return null;
      const thumbUrl = row.thumb_storage_path
        ? (urlMap.get(row.thumb_storage_path) ?? null)
        : null;
      const posterUrl = row.poster_storage_path
        ? (urlMap.get(row.poster_storage_path) ?? null)
        : null;
      return {
        id: row.id,
        creativeId: row.creative_id,
        versionNum: row.version_num,
        platform: row.platform,
        ratio: row.ratio,
        url,
        thumbUrl,
        posterUrl,
        thumbhash: row.thumbhash ?? null,
        name: row.original_name,
        kind: row.kind,
        copy: (row.copy as Record<string, unknown> | null) ?? null,
        uploadedAt: new Date(row.uploaded_at).getTime(),
        width: row.width ?? null,
        height: row.height ?? null,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  return Response.json({ items });
}
