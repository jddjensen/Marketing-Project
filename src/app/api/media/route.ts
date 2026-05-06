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
    .select("id, ratio, storage_path, original_name, kind, uploaded_at")
    .eq("project_id", projectId)
    .eq("platform", platform)
    .order("uploaded_at", { ascending: false });

  if (error) return Response.json({ error: "failed to load media" }, { status: 500 });

  const rows = data ?? [];
  const urlMap = await signedMediaUrls(
    supabase,
    rows.map((r) => r.storage_path)
  );

  const result: Record<string, Array<Record<string, unknown>>> = {};
  for (const row of rows) {
    const url = urlMap.get(row.storage_path);
    if (!url) continue;
    const bucket = result[row.ratio] ?? (result[row.ratio] = []);
    bucket.push({
      id: row.id,
      url,
      storagePath: row.storage_path,
      name: row.original_name,
      kind: row.kind,
      ratio: row.ratio,
      uploadedAt: new Date(row.uploaded_at).getTime(),
    });
  }

  return Response.json(result);
}
