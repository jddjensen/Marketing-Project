import { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const BUCKET = "creatives";

export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("media")
    .select("id, platform, ratio, storage_path, original_name, kind, uploaded_at")
    .eq("project_id", id)
    .order("uploaded_at", { ascending: false });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const items = (data ?? []).map((row) => {
    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(row.storage_path);
    return {
      id: row.id,
      platform: row.platform,
      ratio: row.ratio,
      url: pub.publicUrl,
      name: row.original_name,
      kind: row.kind,
      uploadedAt: new Date(row.uploaded_at).getTime(),
    };
  });
  return Response.json({ items });
}
