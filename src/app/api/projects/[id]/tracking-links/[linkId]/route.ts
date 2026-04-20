import { NextRequest } from "next/server";
import { CHANNEL_KEYS } from "@/lib/channels";
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

function normalizeOptionalString(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t.length === 0 ? null : t;
}

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ id: string; linkId: string }> }
) {
  const { id, linkId } = await ctx.params;
  const body = (await request.json().catch(() => null)) as {
    url?: unknown;
    label?: unknown;
    platform?: unknown;
    utmSource?: unknown;
    utmMedium?: unknown;
    utmCampaign?: unknown;
    utmTerm?: unknown;
    utmContent?: unknown;
    qrEnabled?: unknown;
  } | null;
  if (!body) return Response.json({ error: "body required" }, { status: 400 });

  const patch: Record<string, unknown> = {};

  if (typeof body.url === "string") {
    const url = body.url.trim();
    if (url.length === 0 || url.length > 2048) {
      return Response.json({ error: "url must be 1–2048 chars" }, { status: 400 });
    }
    patch.url = url;
  }

  const label = normalizeOptionalString(body.label);
  if (label !== undefined) patch.label = label;

  if (body.platform === null || body.platform === "") {
    patch.platform = null;
  } else if (typeof body.platform === "string") {
    if (!VALID_PLATFORMS.includes(body.platform as ValidPlatform)) {
      return Response.json({ error: "invalid platform" }, { status: 400 });
    }
    patch.platform = body.platform;
  }

  const fields: Array<[keyof typeof body, string]> = [
    ["utmSource", "utm_source"],
    ["utmMedium", "utm_medium"],
    ["utmCampaign", "utm_campaign"],
    ["utmTerm", "utm_term"],
    ["utmContent", "utm_content"],
  ];
  for (const [apiKey, dbKey] of fields) {
    const v = normalizeOptionalString(body[apiKey]);
    if (v !== undefined) patch[dbKey] = v;
  }

  if (typeof body.qrEnabled === "boolean") {
    patch.qr_enabled = body.qrEnabled;
    patch.qr_generated_at = body.qrEnabled ? new Date().toISOString() : null;
  }

  if (Object.keys(patch).length === 0) {
    return Response.json({ error: "nothing to update" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("project_tracking_links")
    .update(patch)
    .eq("id", linkId)
    .eq("project_id", id)
    .select(LINK_COLS)
    .single();

  if (error || !data) {
    return Response.json({ error: error?.message ?? "update failed" }, { status: 500 });
  }
  return Response.json({ link: serialize(data as LinkRow) });
}

export async function DELETE(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string; linkId: string }> }
) {
  const { id, linkId } = await ctx.params;
  const supabase = await createSupabaseServerClient();
  const { error, count } = await supabase
    .from("project_tracking_links")
    .delete({ count: "exact" })
    .eq("id", linkId)
    .eq("project_id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (count === 0) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json({ ok: true });
}
