import { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const VALID_PLATFORMS = new Set(["google-search"]);
const MAX_TERM_LEN = 200;
const MAX_TERMS_PER_REQUEST = 100;

function parseScope(request: NextRequest) {
  const platform = request.nextUrl.searchParams.get("platform");
  const projectId = request.nextUrl.searchParams.get("projectId");
  if (!projectId) return { error: "projectId required" as const };
  if (!platform || !VALID_PLATFORMS.has(platform)) {
    return { error: "invalid platform" as const };
  }
  return { platform, projectId };
}

export async function GET(request: NextRequest) {
  const scope = parseScope(request);
  if ("error" in scope) return Response.json({ error: scope.error }, { status: 400 });

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("search_terms")
    .select("id, value, added_at")
    .eq("project_id", scope.projectId)
    .eq("platform", scope.platform)
    .order("added_at", { ascending: false });

  if (error) return Response.json({ error: error.message }, { status: 500 });

  const terms = (data ?? []).map((t) => ({
    id: t.id,
    value: t.value,
    addedAt: new Date(t.added_at).getTime(),
  }));
  return Response.json({ terms });
}

export async function POST(request: NextRequest) {
  const scope = parseScope(request);
  if ("error" in scope) return Response.json({ error: scope.error }, { status: 400 });

  const body = (await request.json().catch(() => null)) as { values?: unknown } | null;
  if (!body || !Array.isArray(body.values)) {
    return Response.json({ error: "values[] required" }, { status: 400 });
  }

  const cleaned = Array.from(
    new Set(
      body.values
        .filter((v): v is string => typeof v === "string")
        .map((v) => v.trim())
        .filter((v) => v.length > 0 && v.length <= MAX_TERM_LEN)
        .map((v) => v.toLowerCase())
    )
  ).slice(0, MAX_TERMS_PER_REQUEST);

  if (cleaned.length === 0) {
    return Response.json({ error: "no valid terms" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const rows = cleaned.map((value) => ({
    project_id: scope.projectId,
    platform: scope.platform,
    value,
    added_by: user?.id ?? null,
  }));

  const { data, error } = await supabase
    .from("search_terms")
    .upsert(rows, { onConflict: "project_id,platform,value", ignoreDuplicates: true })
    .select("id, value, added_at");

  if (error) return Response.json({ error: error.message }, { status: 500 });

  const added = (data ?? []).map((t) => ({
    id: t.id,
    value: t.value,
    addedAt: new Date(t.added_at).getTime(),
  }));

  return Response.json({
    added,
    skipped: cleaned.length - added.length,
  });
}

export async function DELETE(request: NextRequest) {
  const scope = parseScope(request);
  if ("error" in scope) return Response.json({ error: scope.error }, { status: 400 });
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return Response.json({ error: "id required" }, { status: 400 });

  const supabase = await createSupabaseServerClient();
  const { error, count } = await supabase
    .from("search_terms")
    .delete({ count: "exact" })
    .eq("project_id", scope.projectId)
    .eq("platform", scope.platform)
    .eq("id", id);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (count === 0) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json({ ok: true });
}
