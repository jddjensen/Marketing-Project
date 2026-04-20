import { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const VALID_PLATFORMS = new Set([
  "meta",
  "tiktok",
  "youtube",
  "google-search",
  "website",
  "email",
  "sms",
  "internal-messaging",
  "digital-signage",
  "ott",
  "pr",
  "signage",
  "flyers",
]);
const BUCKET = "creatives";

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

  if (error) return Response.json({ error: error.message }, { status: 500 });

  const result: Record<string, Array<Record<string, unknown>>> = {};
  for (const row of data ?? []) {
    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(row.storage_path);
    const bucket = result[row.ratio] ?? (result[row.ratio] = []);
    bucket.push({
      id: row.id,
      url: pub.publicUrl,
      storagePath: row.storage_path,
      name: row.original_name,
      kind: row.kind,
      ratio: row.ratio,
      uploadedAt: new Date(row.uploaded_at).getTime(),
    });
  }

  return Response.json(result);
}
