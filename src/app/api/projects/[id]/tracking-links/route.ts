import { NextRequest } from "next/server";
import { CHANNEL_KEYS } from "@/lib/channels";
import { buildGoogleAnalyticsProjectSettings } from "@/lib/googleAnalytics";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const VALID_PLATFORMS = CHANNEL_KEYS;
type ValidPlatform = (typeof VALID_PLATFORMS)[number];

type LinkRow = {
  id: string;
  project_id: string;
  url: string;
  label: string | null;
  platform: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  qr_enabled: boolean;
  qr_generated_at: string | null;
  created_at: string;
  updated_at: string;
};

const LINK_COLS =
  "id, project_id, url, label, platform, utm_source, utm_medium, utm_campaign, utm_term, utm_content, qr_enabled, qr_generated_at, created_at, updated_at";

function serialize(r: LinkRow) {
  return {
    id: r.id,
    projectId: r.project_id,
    url: r.url,
    label: r.label,
    platform: r.platform as ValidPlatform | null,
    utmSource: r.utm_source,
    utmMedium: r.utm_medium,
    utmCampaign: r.utm_campaign,
    utmTerm: r.utm_term,
    utmContent: r.utm_content,
    qrEnabled: r.qr_enabled,
    qrGeneratedAt: r.qr_generated_at ? new Date(r.qr_generated_at).getTime() : null,
    createdAt: new Date(r.created_at).getTime(),
    updatedAt: new Date(r.updated_at).getTime(),
  };
}

export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const supabase = await createSupabaseServerClient();
  const [{ data, error }, { data: project, error: projectError }] = await Promise.all([
    supabase
      .from("project_tracking_links")
      .select(LINK_COLS)
      .eq("project_id", id)
      .order("created_at", { ascending: true }),
    supabase.from("projects").select("ga4_property_id").eq("id", id).maybeSingle(),
  ]);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (projectError) return Response.json({ error: projectError.message }, { status: 500 });

  return Response.json({
    links: (data ?? []).map((r) => serialize(r as LinkRow)),
    analytics: buildGoogleAnalyticsProjectSettings(project?.ga4_property_id ?? null),
  });
}

function normalizeOptionalString(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t.length === 0 ? null : t;
}

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const body = (await request.json().catch(() => null)) as {
    url?: unknown;
    label?: unknown;
    platform?: unknown;
    utmSource?: unknown;
    utmMedium?: unknown;
    utmCampaign?: unknown;
    utmTerm?: unknown;
    utmContent?: unknown;
  } | null;

  if (!body || typeof body.url !== "string") {
    return Response.json({ error: "url required" }, { status: 400 });
  }
  const url = body.url.trim();
  if (url.length === 0 || url.length > 2048) {
    return Response.json({ error: "url must be 1–2048 chars" }, { status: 400 });
  }

  let platform: ValidPlatform | null = null;
  if (typeof body.platform === "string" && body.platform.length > 0) {
    if (!VALID_PLATFORMS.includes(body.platform as ValidPlatform)) {
      return Response.json({ error: "invalid platform" }, { status: 400 });
    }
    platform = body.platform as ValidPlatform;
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const insert: Record<string, unknown> = {
    project_id: id,
    url,
    label: normalizeOptionalString(body.label) ?? null,
    platform,
    utm_source: normalizeOptionalString(body.utmSource) ?? null,
    utm_medium: normalizeOptionalString(body.utmMedium) ?? null,
    utm_campaign: normalizeOptionalString(body.utmCampaign) ?? null,
    utm_term: normalizeOptionalString(body.utmTerm) ?? null,
    utm_content: normalizeOptionalString(body.utmContent) ?? null,
    created_by: user?.id ?? null,
  };

  const { data, error } = await supabase
    .from("project_tracking_links")
    .insert(insert)
    .select(LINK_COLS)
    .single();

  if (error || !data) {
    return Response.json({ error: error?.message ?? "failed to create" }, { status: 500 });
  }
  return Response.json({ link: serialize(data as LinkRow) });
}
