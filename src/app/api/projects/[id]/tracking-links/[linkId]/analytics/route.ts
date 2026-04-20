import { NextRequest } from "next/server";
import {
  buildGoogleAnalyticsProjectSettings,
  getGoogleAnalyticsLinkSummary,
  isGoogleAnalyticsError,
} from "@/lib/googleAnalytics";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ id: string; linkId: string }> }
) {
  const { id, linkId } = await ctx.params;
  const refresh = request.nextUrl.searchParams.get("refresh") === "1";
  const supabase = await createSupabaseServerClient();

  const [{ data: link, error: linkError }, { data: project, error: projectError }] =
    await Promise.all([
      supabase
        .from("project_tracking_links")
        .select("id, created_at")
        .eq("id", linkId)
        .eq("project_id", id)
        .maybeSingle(),
      supabase.from("projects").select("ga4_property_id").eq("id", id).maybeSingle(),
    ]);

  if (linkError) return Response.json({ error: linkError.message }, { status: 500 });
  if (projectError) return Response.json({ error: projectError.message }, { status: 500 });
  if (!link) return Response.json({ error: "not found" }, { status: 404 });

  const analytics = buildGoogleAnalyticsProjectSettings(project?.ga4_property_id ?? null);
  if (analytics.status !== "ready" || !analytics.ga4PropertyId) {
    return Response.json({ analytics, summary: null });
  }

  try {
    const summary = await getGoogleAnalyticsLinkSummary({
      propertyId: analytics.ga4PropertyId,
      linkId,
      createdAt: new Date(link.created_at).getTime(),
      refresh,
    });

    return Response.json({ analytics, summary });
  } catch (error) {
    if (isGoogleAnalyticsError(error)) {
      return Response.json({ error: error.message, analytics }, { status: error.status });
    }

    return Response.json({ error: "Failed to load Google Analytics data", analytics }, { status: 500 });
  }
}
