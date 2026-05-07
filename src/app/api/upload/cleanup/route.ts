import { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CREATIVES_BUCKET } from "@/lib/storage";

const MAX_PATHS = 5;

// Best-effort cleanup endpoint for the direct-upload flow. If a client
// uploads bytes via /api/upload/sign + PUT but then fails to call finalize
// (network drop, tab close, etc.), the storage objects orphan. The browser
// hits this endpoint from its catch path to remove them.
//
// Path validation: every path must start with the supplied projectId so a
// rogue client can't nuke other projects' files. Quantity-capped to keep
// this from being abused as a bulk-delete primitive.
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    projectId?: unknown;
    paths?: unknown;
  } | null;
  if (!body) return Response.json({ error: "body required" }, { status: 400 });

  const { projectId, paths } = body;
  if (typeof projectId !== "string" || projectId.length === 0) {
    return Response.json({ error: "projectId required" }, { status: 400 });
  }
  if (!Array.isArray(paths) || paths.length === 0) {
    return Response.json({ error: "paths required" }, { status: 400 });
  }
  if (paths.length > MAX_PATHS) {
    return Response.json({ error: `too many paths (max ${MAX_PATHS})` }, { status: 400 });
  }

  const safe: string[] = [];
  for (const p of paths) {
    if (typeof p !== "string" || p.length === 0) continue;
    if (!p.startsWith(`${projectId}/`)) continue;
    safe.push(p);
  }
  if (safe.length === 0) {
    return Response.json({ error: "no valid paths" }, { status: 400 });
  }

  const { error } = await supabase.storage.from(CREATIVES_BUCKET).remove(safe);
  if (error) {
    console.warn("upload/cleanup: storage remove failed", safe, error.message);
    return Response.json({ error: "cleanup failed" }, { status: 500 });
  }

  return Response.json({ ok: true, removed: safe.length });
}
