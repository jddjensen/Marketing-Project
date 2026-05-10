import { NextRequest } from "next/server";
import { isUuid } from "@/lib/ids";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Restore an archived version: atomically set is_current=true on the chosen
// version, false on every other row of the same creative. The flip happens
// in a single SQL UPDATE inside the restore_creative_version RPC, so two
// concurrent restores can't leave the creative in a state with zero or two
// current rows.
export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string; creativeId: string }> }
) {
  const { id: projectId, creativeId } = await ctx.params;
  if (!isUuid(projectId) || !isUuid(creativeId)) {
    return Response.json({ error: "not found" }, { status: 404 });
  }
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { versionId?: unknown } | null;
  if (!body || typeof body.versionId !== "string" || body.versionId.length === 0) {
    return Response.json({ error: "versionId required" }, { status: 400 });
  }
  if (!isUuid(body.versionId)) {
    return Response.json({ error: "invalid versionId" }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("restore_creative_version", {
    p_project_id: projectId,
    p_creative_id: creativeId,
    p_version_id: body.versionId,
  });

  if (error) {
    return Response.json({ error: "restore failed" }, { status: 500 });
  }
  if (!data) {
    return Response.json({ error: "version not found" }, { status: 404 });
  }
  return Response.json({ ok: true });
}
