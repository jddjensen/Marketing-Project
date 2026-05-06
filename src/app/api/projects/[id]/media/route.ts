import { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { signedMediaUrls } from "@/lib/storage";

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
  if (error) return Response.json({ error: "failed to load media" }, { status: 500 });

  const rows = data ?? [];
  const urlMap = await signedMediaUrls(
    supabase,
    rows.map((r) => r.storage_path)
  );

  const items = rows
    .map((row) => {
      const url = urlMap.get(row.storage_path);
      if (!url) return null;
      return {
        id: row.id,
        platform: row.platform,
        ratio: row.ratio,
        url,
        name: row.original_name,
        kind: row.kind,
        uploadedAt: new Date(row.uploaded_at).getTime(),
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  return Response.json({ items });
}
