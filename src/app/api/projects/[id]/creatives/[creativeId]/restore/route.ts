import { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Restore an archived version: flip is_current=true on the chosen version,
// is_current=false on every other version of the same creative.
export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string; creativeId: string }> }
) {
  const { id: projectId, creativeId } = await ctx.params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { versionId?: unknown } | null;
  if (!body || typeof body.versionId !== "string" || body.versionId.length === 0) {
    return Response.json({ error: "versionId required" }, { status: 400 });
  }

  // Confirm the target version exists in this creative + project.
  const { data: target, error: targetError } = await supabase
    .from("media")
    .select("id, is_current")
    .eq("id", body.versionId)
    .eq("project_id", projectId)
    .eq("creative_id", creativeId)
    .maybeSingle();
  if (targetError) {
    return Response.json({ error: "lookup failed" }, { status: 500 });
  }
  if (!target) return Response.json({ error: "version not found" }, { status: 404 });

  if (target.is_current) {
    return Response.json({ ok: true, alreadyCurrent: true });
  }

  // Two-step flip: archive everything on this creative, then restore the target.
  const { error: archiveError } = await supabase
    .from("media")
    .update({ is_current: false })
    .eq("creative_id", creativeId)
    .eq("project_id", projectId);
  if (archiveError) {
    return Response.json({ error: "restore failed" }, { status: 500 });
  }

  const { error: restoreError } = await supabase
    .from("media")
    .update({ is_current: true })
    .eq("id", body.versionId);
  if (restoreError) {
    return Response.json({ error: "restore failed" }, { status: 500 });
  }

  return Response.json({ ok: true });
}
