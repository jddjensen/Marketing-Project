import { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string; linkId: string }> }
) {
  const { id, linkId } = await ctx.params;
  const supabase = await createSupabaseServerClient();

  // Confirm the link belongs to this project (cheap guard).
  const { data: owner } = await supabase
    .from("project_tracking_links")
    .select("id")
    .eq("id", linkId)
    .eq("project_id", id)
    .maybeSingle();
  if (!owner) return Response.json({ error: "not found" }, { status: 404 });

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [totalRes, last24Res, recentRes] = await Promise.all([
    supabase
      .from("project_tracking_link_scans")
      .select("id", { count: "exact", head: true })
      .eq("link_id", linkId),
    supabase
      .from("project_tracking_link_scans")
      .select("id", { count: "exact", head: true })
      .eq("link_id", linkId)
      .gte("scanned_at", since24h),
    supabase
      .from("project_tracking_link_scans")
      .select("id, scanned_at, user_agent")
      .eq("link_id", linkId)
      .order("scanned_at", { ascending: false })
      .limit(5),
  ]);

  if (totalRes.error || last24Res.error || recentRes.error) {
    return Response.json(
      { error: totalRes.error?.message ?? last24Res.error?.message ?? recentRes.error?.message ?? "failed" },
      { status: 500 }
    );
  }

  const recent = (recentRes.data ?? []).map((r) => ({
    id: r.id,
    scannedAt: new Date(r.scanned_at).getTime(),
    userAgent: r.user_agent,
  }));

  return Response.json({
    total: totalRes.count ?? 0,
    last24h: last24Res.count ?? 0,
    lastAt: recent[0]?.scannedAt ?? null,
    recent,
  });
}
