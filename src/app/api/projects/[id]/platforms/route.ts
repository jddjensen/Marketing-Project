import { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const VALID_PLATFORMS = new Set(["meta", "tiktok", "youtube", "google-search", "signage"]);

export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("project_platforms")
    .select("platform, added_at")
    .eq("project_id", id)
    .order("added_at", { ascending: true });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({
    platforms: (data ?? []).map((r) => ({
      platform: r.platform,
      addedAt: new Date(r.added_at).getTime(),
    })),
  });
}

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const body = (await request.json().catch(() => null)) as { platform?: unknown } | null;
  if (!body || typeof body.platform !== "string" || !VALID_PLATFORMS.has(body.platform)) {
    return Response.json({ error: "invalid platform" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("project_platforms")
    .upsert({ project_id: id, platform: body.platform, added_by: user?.id ?? null });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true, platform: body.platform });
}

export async function DELETE(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const platform = request.nextUrl.searchParams.get("platform");
  if (!platform || !VALID_PLATFORMS.has(platform)) {
    return Response.json({ error: "invalid platform" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { error, count } = await supabase
    .from("project_platforms")
    .delete({ count: "exact" })
    .eq("project_id", id)
    .eq("platform", platform);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (count === 0) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json({ ok: true });
}
