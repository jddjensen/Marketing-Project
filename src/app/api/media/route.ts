import { NextRequest } from "next/server";
import { CHANNEL_KEYS } from "@/lib/channels";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { signedMediaUrls } from "@/lib/storage";

const VALID_PLATFORMS = new Set<string>(CHANNEL_KEYS);

export async function GET(request: NextRequest) {
  const platform = request.nextUrl.searchParams.get("platform");
  const projectId = request.nextUrl.searchParams.get("projectId");
  if (!projectId) {
    return Response.json({ error: "projectId required" }, { status: 400 });
  }
  if (!platform || !VALID_PLATFORMS.has(platform)) {
    return Response.json({ error: "invalid platform" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("media")
    .select(
      "id, creative_id, version_num, ratio, storage_path, poster_storage_path, original_name, kind, copy, uploaded_at"
    )
    .eq("project_id", projectId)
    .eq("platform", platform)
    .eq("is_current", true)
    .order("uploaded_at", { ascending: false });

  if (error)
    return Response.json({ error: "failed to load media" }, { status: 500 });

  const rows = data ?? [];
  const allPaths: string[] = [];
  for (const r of rows) {
    if (r.storage_path) allPaths.push(r.storage_path);
    if (r.poster_storage_path) allPaths.push(r.poster_storage_path);
  }
  const urlMap = await signedMediaUrls(supabase, allPaths);

  const result: Record<string, Array<Record<string, unknown>>> = {};
  for (const row of rows) {
    // Text creatives have no storage_path and therefore no signed URL.
    const url = row.storage_path
      ? (urlMap.get(row.storage_path) ?? null)
      : null;
    if (row.kind !== "text" && !url) continue;
    const posterUrl = row.poster_storage_path
      ? (urlMap.get(row.poster_storage_path) ?? null)
      : null;
    const bucket = result[row.ratio] ?? (result[row.ratio] = []);
    bucket.push({
      id: row.id,
      creativeId: row.creative_id,
      versionNum: row.version_num,
      url,
      posterUrl,
      storagePath: row.storage_path,
      name: row.original_name,
      kind: row.kind,
      ratio: row.ratio,
      copy: (row.copy as Record<string, unknown> | null) ?? null,
      uploadedAt: new Date(row.uploaded_at).getTime(),
    });
  }

  return Response.json(result);
}
