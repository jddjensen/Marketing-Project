import { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PlatformKey } from "@/lib/utm";
import { validateCopy } from "@/lib/platformCopy";
import { CREATIVES_BUCKET } from "@/lib/storage";

// Edit copy on a single version without re-uploading the file.
export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ id: string; creativeId: string; versionId: string }> }
) {
  const { id: projectId, creativeId, versionId } = await ctx.params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { copy?: unknown } | null;
  if (!body) return Response.json({ error: "body required" }, { status: 400 });

  // Find the row + verify it belongs to this project + creative.
  const { data: row, error: rowError } = await supabase
    .from("media")
    .select("id, platform")
    .eq("id", versionId)
    .eq("project_id", projectId)
    .eq("creative_id", creativeId)
    .maybeSingle();
  if (rowError) {
    return Response.json({ error: "lookup failed" }, { status: 500 });
  }
  if (!row) return Response.json({ error: "version not found" }, { status: 404 });

  const result = validateCopy(row.platform as PlatformKey, body.copy);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  const { data: updated, error: updateError } = await supabase
    .from("media")
    .update({ copy: result.value })
    .eq("id", versionId)
    .select("id, copy")
    .single();
  if (updateError || !updated) {
    return Response.json({ error: "failed to update copy" }, { status: 500 });
  }

  return Response.json({
    id: updated.id,
    copy: (updated.copy as Record<string, unknown> | null) ?? null,
  });
}

// Delete a single version (only allowed if it's not the current one — to
// remove the current version, replace it instead).
export async function DELETE(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string; creativeId: string; versionId: string }> }
) {
  const { id: projectId, creativeId, versionId } = await ctx.params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { data: row, error: rowError } = await supabase
    .from("media")
    .select("id, is_current, storage_path, poster_storage_path")
    .eq("id", versionId)
    .eq("project_id", projectId)
    .eq("creative_id", creativeId)
    .maybeSingle();
  if (rowError) return Response.json({ error: "lookup failed" }, { status: 500 });
  if (!row) return Response.json({ error: "version not found" }, { status: 404 });
  if (row.is_current) {
    return Response.json(
      { error: "cannot delete the current version — replace it or restore another version first" },
      { status: 400 }
    );
  }

  const paths: string[] = [];
  if (row.storage_path) paths.push(row.storage_path);
  if (row.poster_storage_path) paths.push(row.poster_storage_path);

  const { error: deleteError } = await supabase
    .from("media")
    .delete()
    .eq("id", versionId);
  if (deleteError) return Response.json({ error: "delete failed" }, { status: 500 });

  if (paths.length > 0) {
    await supabase.storage.from(CREATIVES_BUCKET).remove(paths);
  }

  return Response.json({ ok: true });
}
