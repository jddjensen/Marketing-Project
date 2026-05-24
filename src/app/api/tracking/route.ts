import { NextRequest } from "next/server";
import { CHANNEL_KEYS } from "@/lib/channels";
import { isUuid } from "@/lib/ids";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  formatCreativeUtmTag,
  PLATFORM_DEFAULTS,
  type PlatformKey,
} from "@/lib/utm";

const VALID_PLATFORMS = new Set<string>(CHANNEL_KEYS);

type Scope = {
  platform: PlatformKey;
  projectId: string;
};

type TrackingLinkRow = {
  id: string;
  platform: string | null;
  url: string;
  label: string | null;
  creative_id: string | null;
  utm_source: string | null;
  utm_content: string | null;
  utm_sequence: number | null;
  created_at: string;
};

type ClickRow = {
  link_id: string;
};

const TRACKING_LINK_COLS =
  "id, platform, url, label, creative_id, utm_source, utm_content, utm_sequence, created_at";

function parseScope(request: NextRequest): Scope | { error: string } {
  const platform = request.nextUrl.searchParams.get("platform");
  const projectId = request.nextUrl.searchParams.get("projectId");
  if (!projectId || !isUuid(projectId)) return { error: "projectId required" };
  if (!platform || !VALID_PLATFORMS.has(platform)) {
    return { error: "invalid platform" };
  }
  return { platform: platform as PlatformKey, projectId };
}

function countByLink(rows: ClickRow[]) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.link_id, (counts.get(row.link_id) ?? 0) + 1);
  }
  return counts;
}

function normalizeItem(row: TrackingLinkRow, clicks: number) {
  return {
    id: row.id,
    platform: row.platform,
    creativeId: row.creative_id ?? "",
    url: row.url,
    label: row.label,
    utmSource: row.utm_source,
    utmContent: row.utm_content,
    utmSequence: row.utm_sequence,
    clicks,
    createdAt: new Date(row.created_at).getTime(),
  };
}

async function claimCreativeSequence(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  scope: Scope
): Promise<number | { error: string }> {
  const { data, error } = await supabase.rpc(
    "claim_project_platform_utm_sequence",
    {
      p_project_id: scope.projectId,
      p_platform: scope.platform,
    }
  );

  const sequence = typeof data === "number" ? data : Number(data);
  if (error || !Number.isFinite(sequence) || sequence < 1) {
    return { error: "failed to assign creative source number" };
  }
  return sequence;
}

export async function GET(request: NextRequest) {
  const scope = parseScope(request);
  if ("error" in scope)
    return Response.json({ error: scope.error }, { status: 400 });

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("project_tracking_links")
    .select(TRACKING_LINK_COLS)
    .eq("project_id", scope.projectId)
    .eq("platform", scope.platform)
    .not("creative_id", "is", null)
    .order("created_at", { ascending: true });

  if (error) return Response.json({ error: "request failed" }, { status: 500 });

  const rows = ((data ?? []) as TrackingLinkRow[]).filter(
    (row) => row.creative_id && row.creative_id.length > 0
  );
  const linkIds = rows.map((row) => row.id);

  let clicks = new Map<string, number>();
  if (linkIds.length > 0) {
    const { data: clickRows, error: clickError } = await supabase
      .from("project_tracking_link_clicks")
      .select("link_id")
      .in("link_id", linkIds);

    if (clickError)
      return Response.json({ error: "request failed" }, { status: 500 });
    clicks = countByLink((clickRows ?? []) as ClickRow[]);
  }

  return Response.json({
    items: rows.map((row) => normalizeItem(row, clicks.get(row.id) ?? 0)),
  });
}

export async function POST(request: NextRequest) {
  const scope = parseScope(request);
  if ("error" in scope)
    return Response.json({ error: scope.error }, { status: 400 });

  const body = (await request.json().catch(() => null)) as {
    creativeId?: unknown;
    landingPageId?: unknown;
  } | null;

  if (
    !body ||
    typeof body.creativeId !== "string" ||
    typeof body.landingPageId !== "string" ||
    !isUuid(body.creativeId) ||
    !isUuid(body.landingPageId)
  ) {
    return Response.json(
      { error: "creativeId and landingPageId required" },
      { status: 400 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: media, error: mediaError } = await supabase
    .from("media")
    .select("creative_id")
    .eq("project_id", scope.projectId)
    .eq("platform", scope.platform)
    .eq("creative_id", body.creativeId)
    .eq("is_current", true)
    .maybeSingle();

  if (mediaError)
    return Response.json({ error: "creative lookup failed" }, { status: 500 });
  if (!media)
    return Response.json({ error: "creative not found" }, { status: 404 });

  const { data: landingPage, error: landingError } = await supabase
    .from("project_tracking_links")
    .select("id, url, label")
    .eq("id", body.landingPageId)
    .eq("project_id", scope.projectId)
    .is("platform", null)
    .maybeSingle();

  if (landingError)
    return Response.json(
      { error: "landing page lookup failed" },
      { status: 500 }
    );
  if (!landingPage)
    return Response.json({ error: "landing page not found" }, { status: 404 });

  const defaults = PLATFORM_DEFAULTS[scope.platform];
  const { data: existing, error: existingError } = await supabase
    .from("project_tracking_links")
    .select("id, utm_sequence")
    .eq("project_id", scope.projectId)
    .eq("platform", scope.platform)
    .eq("creative_id", body.creativeId)
    .limit(1)
    .maybeSingle();

  if (existingError)
    return Response.json({ error: "tracking lookup failed" }, { status: 500 });

  const sequence =
    typeof existing?.utm_sequence === "number"
      ? existing.utm_sequence
      : await claimCreativeSequence(supabase, scope);
  if (typeof sequence !== "number") {
    return Response.json({ error: sequence.error }, { status: 500 });
  }
  const creativeUtmTag = formatCreativeUtmTag(scope.platform, sequence);

  const trackingPatch = {
    project_id: scope.projectId,
    url: landingPage.url,
    label: landingPage.label,
    platform: scope.platform,
    creative_id: body.creativeId,
    utm_sequence: sequence,
    utm_source: creativeUtmTag,
    utm_medium: defaults.medium,
    utm_campaign: null,
    utm_term: null,
    utm_content: creativeUtmTag,
    created_by: user?.id ?? null,
  };

  const query = existing
    ? supabase
        .from("project_tracking_links")
        .update(trackingPatch)
        .eq("id", existing.id)
    : supabase.from("project_tracking_links").insert(trackingPatch);

  const { data: saved, error: saveError } = await query
    .select(TRACKING_LINK_COLS)
    .single();

  if (saveError || !saved) {
    return Response.json(
      { error: "failed to save landing page" },
      { status: 500 }
    );
  }

  const { count } = await supabase
    .from("project_tracking_link_clicks")
    .select("id", { count: "exact", head: true })
    .eq("link_id", saved.id);

  return Response.json({
    item: normalizeItem(saved as TrackingLinkRow, count ?? 0),
  });
}

export async function DELETE(request: NextRequest) {
  const scope = parseScope(request);
  if ("error" in scope)
    return Response.json({ error: scope.error }, { status: 400 });
  const creativeId = request.nextUrl.searchParams.get("creativeId");
  if (!creativeId || !isUuid(creativeId)) {
    return Response.json({ error: "creativeId required" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { error, count } = await supabase
    .from("project_tracking_links")
    .delete({ count: "exact" })
    .eq("project_id", scope.projectId)
    .eq("platform", scope.platform)
    .eq("creative_id", creativeId);

  if (error) return Response.json({ error: "request failed" }, { status: 500 });
  if (count === 0)
    return Response.json({ error: "not found" }, { status: 404 });
  return Response.json({ ok: true });
}
