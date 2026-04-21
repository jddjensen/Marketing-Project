import { NextRequest } from "next/server";
import { CHANNEL_LABELS, CHANNEL_ORDER } from "@/lib/channels";
import {
  buildGoogleAnalyticsProjectSettings,
  getGoogleAnalyticsProjectPerformance,
  isGoogleAnalyticsError,
  type GoogleAnalyticsProjectLinkMetrics,
} from "@/lib/googleAnalytics";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PlatformKey } from "@/lib/utm";

type LinkRow = {
  id: string;
  platform: PlatformKey | null;
  created_at: string;
};

type ProjectRow = {
  ga4_property_id: string | null;
  brief_budget: string | number | null;
};

type PlatformRow = {
  platform: PlatformKey;
};

type CountRow = {
  link_id: string;
};

type ChannelBucketKey = PlatformKey | "all-channels";

function parseBudget(value: string | number | null) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function emptyGaMetrics(): GoogleAnalyticsProjectLinkMetrics {
  return {
    sessions: 0,
    engagedSessions: 0,
    views: 0,
    keyEvents: 0,
    transactions: 0,
    purchaseRevenue: 0,
  };
}

function countByLink(rows: CountRow[]) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.link_id, (counts.get(row.link_id) ?? 0) + 1);
  }
  return counts;
}

function channelLabel(key: ChannelBucketKey) {
  return key === "all-channels" ? "All channels" : CHANNEL_LABELS[key];
}

function orderedChannelKeys(keys: Iterable<ChannelBucketKey>) {
  const set = new Set(keys);
  const ordered: ChannelBucketKey[] = [];
  for (const channel of CHANNEL_ORDER) {
    if (set.has(channel)) ordered.push(channel);
  }
  if (set.has("all-channels")) ordered.push("all-channels");
  return ordered;
}

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const refresh = request.nextUrl.searchParams.get("refresh") === "1";
  const supabase = await createSupabaseServerClient();

  const [
    { data: links, error: linksError },
    { data: project, error: projectError },
    { data: enabledPlatforms, error: platformsError },
  ] = await Promise.all([
    supabase
      .from("project_tracking_links")
      .select("id, platform, created_at")
      .eq("project_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("projects")
      .select("ga4_property_id, brief_budget")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("project_platforms")
      .select("platform")
      .eq("project_id", id),
  ]);

  if (linksError) return Response.json({ error: linksError.message }, { status: 500 });
  if (projectError) return Response.json({ error: projectError.message }, { status: 500 });
  if (platformsError) return Response.json({ error: platformsError.message }, { status: 500 });

  const linkRows = (links ?? []) as LinkRow[];
  const linkIds = linkRows.map((link) => link.id);
  const budget = parseBudget((project as ProjectRow | null)?.brief_budget ?? null);
  const analytics = buildGoogleAnalyticsProjectSettings(
    (project as ProjectRow | null)?.ga4_property_id ?? null
  );

  let clickCounts = new Map<string, number>();
  let scanCounts = new Map<string, number>();
  if (linkIds.length > 0) {
    const [{ data: clickRows, error: clickError }, { data: scanRows, error: scanError }] =
      await Promise.all([
        supabase
          .from("project_tracking_link_clicks")
          .select("link_id")
          .in("link_id", linkIds),
        supabase
          .from("project_tracking_link_scans")
          .select("link_id")
          .in("link_id", linkIds),
      ]);

    if (clickError) return Response.json({ error: clickError.message }, { status: 500 });
    if (scanError) return Response.json({ error: scanError.message }, { status: 500 });

    clickCounts = countByLink((clickRows ?? []) as CountRow[]);
    scanCounts = countByLink((scanRows ?? []) as CountRow[]);
  }

  let gaSummary:
    | Awaited<ReturnType<typeof getGoogleAnalyticsProjectPerformance>>
    | null = null;

  if (analytics.status === "ready" && analytics.ga4PropertyId && linkRows.length > 0) {
    try {
      gaSummary = await getGoogleAnalyticsProjectPerformance({
        propertyId: analytics.ga4PropertyId,
        linkIds,
        createdAt: new Date(linkRows[0].created_at).getTime(),
        refresh,
      });
    } catch (error) {
      if (isGoogleAnalyticsError(error)) {
        return Response.json({ error: error.message, analytics }, { status: error.status });
      }
      return Response.json(
        { error: "Failed to load Google Analytics data", analytics },
        { status: 500 }
      );
    }
  }

  const bucketKeys = new Set<ChannelBucketKey>(
    ((enabledPlatforms ?? []) as PlatformRow[]).map((row) => row.platform)
  );
  for (const link of linkRows) {
    bucketKeys.add(link.platform ?? "all-channels");
  }

  const channelMap = new Map(
    orderedChannelKeys(bucketKeys).map((key) => [
      key,
      {
        channel: key,
        label: channelLabel(key),
        linkCount: 0,
        clicks: 0,
        scans: 0,
        sessions: 0,
        conversions: 0,
        ticketSales: 0,
        revenue: 0,
        sessionsShare: null as number | null,
        revenueShare: null as number | null,
      },
    ])
  );

  let totalClicks = 0;
  let totalScans = 0;

  for (const link of linkRows) {
    const bucketKey = link.platform ?? "all-channels";
    const bucket = channelMap.get(bucketKey);
    if (!bucket) continue;

    const clicks = clickCounts.get(link.id) ?? 0;
    const scans = scanCounts.get(link.id) ?? 0;
    const ga = gaSummary?.byLink[link.id] ?? emptyGaMetrics();

    bucket.linkCount += 1;
    bucket.clicks += clicks;
    bucket.scans += scans;
    bucket.sessions += ga.sessions;
    bucket.conversions += ga.keyEvents;
    bucket.ticketSales += ga.transactions;
    bucket.revenue += ga.purchaseRevenue;

    totalClicks += clicks;
    totalScans += scans;
  }

  const totals = {
    clicks: totalClicks,
    scans: totalScans,
    sessions: gaSummary?.totals.sessions ?? 0,
    conversions: gaSummary?.totals.keyEvents ?? 0,
    revenue: gaSummary?.totals.purchaseRevenue ?? 0,
    ticketSales: gaSummary?.totals.transactions ?? 0,
    budget,
  };

  const cpaDenominator =
    totals.ticketSales > 0 ? totals.ticketSales : totals.conversions > 0 ? totals.conversions : null;
  const cpaBasis =
    totals.ticketSales > 0
      ? "ticket_sales"
      : totals.conversions > 0
        ? "conversions"
        : null;

  const channelRows = Array.from(channelMap.values()).map((row) => ({
    ...row,
    sessionsShare: totals.sessions > 0 ? row.sessions / totals.sessions : null,
    revenueShare: totals.revenue > 0 ? row.revenue / totals.revenue : null,
  }));

  return Response.json({
    analytics,
    trackedLinkCount: linkRows.length,
    totals: {
      ...totals,
      cpa: budget !== null && budget > 0 && cpaDenominator ? budget / cpaDenominator : null,
      cpaBasis,
      roas: budget !== null && budget > 0 ? totals.revenue / budget : null,
    },
    channels: channelRows,
    trend: gaSummary?.trend ?? [],
    lastSyncedAt: gaSummary?.lastSyncedAt ?? Date.now(),
  });
}
