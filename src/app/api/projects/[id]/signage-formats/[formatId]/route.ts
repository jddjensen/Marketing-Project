import { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CREATIVES_BUCKET } from "@/lib/storage";

export async function DELETE(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string; formatId: string }> }
) {
  const { id, formatId } = await ctx.params;
  const supabase = await createSupabaseServerClient();

  // Collect storage paths for media under this format so we can clean the bucket.
  const { data: mediaRows } = await supabase
    .from("media")
    .select("storage_path, poster_storage_path")
    .eq("project_id", id)
    .eq("signage_format_id", formatId);

  const { error, count } = await supabase
    .from("signage_formats")
    .delete({ count: "exact" })
    .eq("id", formatId)
    .eq("project_id", id);

  if (error) return Response.json({ error: "failed to delete signage format" }, { status: 500 });
  if (count === 0) return Response.json({ error: "not found" }, { status: 404 });

  if (mediaRows && mediaRows.length > 0) {
    const paths = mediaRows.flatMap((r) =>
      [r.storage_path, r.poster_storage_path].filter(
        (path): path is string => typeof path === "string" && path.length > 0
      )
    );
    if (paths.length > 0) {
      await supabase.storage.from(CREATIVES_BUCKET).remove(paths);
    }
  }
  return Response.json({ ok: true });
}
