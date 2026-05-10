import { NextRequest } from "next/server";
import {
  buildGoogleAnalyticsProjectSettings,
  getGoogleAnalyticsLinkSummary,
  getUserGoogleAnalyticsAccessToken,
  isGoogleAnalyticsError,
} from "@/lib/googleAnalytics";
import { isUuid } from "@/lib/ids";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ id: string; linkId: string }> }
) {
  const { id, linkId } = await ctx.params;
  if (!isUuid(id) || !isUuid(linkId)) {
    return Response.json({ error: "not found" }, { status: 404 });
  }
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

  // Don't echo Supabase/Postgres error text — it leaks column types and
  // table-level details.
  if (linkError) return Response.json({ error: "failed to load tracking link" }, { status: 500 });
  if (projectError) {
    return Response.json({ error: "failed to load project settings" }, { status: 500 });
  }
  if (!link) return Response.json({ error: "not found" }, { status: 404 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const analytics = await buildGoogleAnalyticsProjectSettings(
    supabase,
    project?.ga4_property_id ?? null,
    user?.id ?? null
  );
  if (analytics.status !== "ready" || !analytics.ga4PropertyId) {
    return Response.json({ analytics, summary: null });
  }

  try {
    const accessToken =
      analytics.authMode === "oauth" && user?.id
        ? await getUserGoogleAnalyticsAccessToken(supabase, user.id)
        : null;
    const summary = await getGoogleAnalyticsLinkSummary({
      propertyId: analytics.ga4PropertyId,
      linkId,
      createdAt: new Date(link.created_at).getTime(),
      refresh,
      accessToken,
    });

    return Response.json({ analytics, summary });
  } catch (error) {
    if (isGoogleAnalyticsError(error)) {
      return Response.json({ error: error.message, analytics }, { status: error.status });
    }

    return Response.json({ error: "Failed to load Google Analytics data", analytics }, { status: 500 });
  }
}
