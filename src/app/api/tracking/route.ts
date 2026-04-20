import { NextRequest } from "next/server";
import { CHANNEL_KEYS } from "@/lib/channels";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import crypto from "crypto";

const VALID_PLATFORMS = new Set<string>(CHANNEL_KEYS);

function parseScope(request: NextRequest) {
  const platform = request.nextUrl.searchParams.get("platform");
  const projectId = request.nextUrl.searchParams.get("projectId");
  if (!projectId) return { error: "projectId required" as const };
  if (!platform || !VALID_PLATFORMS.has(platform)) {
    return { error: "invalid platform" as const };
  }
  return { platform, projectId };
}

function normalizeItem(
  row: {
    id: string;
    media_id: string;
    destination_url: string;
    clicks: number;
    created_at: string;
  },
  platform: string
) {
  return {
    id: row.id,
    platform,
    mediaId: row.media_id,
    url: row.destination_url,
    clicks: Number(row.clicks),
    createdAt: new Date(row.created_at).getTime(),
  };
}

export async function GET(request: NextRequest) {
  const scope = parseScope(request);
  if ("error" in scope) return Response.json({ error: scope.error }, { status: 400 });

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("tracking")
    .select("id, destination_url, clicks, created_at, media_id, media:media_id(platform, project_id)")
    .eq("project_id", scope.projectId)
    .eq("media.platform", scope.platform);

  if (error) return Response.json({ error: error.message }, { status: 500 });

  const items = (data ?? [])
    .filter((r) => r.media)
    .map((r) => normalizeItem(r, scope.platform));

  return Response.json({ items });
}

export async function POST(request: NextRequest) {
  const scope = parseScope(request);
  if ("error" in scope) return Response.json({ error: scope.error }, { status: 400 });

  const body = (await request.json().catch(() => null)) as {
    mediaId?: unknown;
    url?: unknown;
  } | null;

  if (!body || typeof body.mediaId !== "string" || typeof body.url !== "string") {
    return Response.json({ error: "mediaId and url required" }, { status: 400 });
  }

  const mediaId = body.mediaId;
  const url = body.url.trim();
  if (url.length > 2048) return Response.json({ error: "url too long" }, { status: 400 });

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return Response.json({ error: "invalid url" }, { status: 400 });
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return Response.json({ error: "url must be http or https" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: existing, error: fetchErr } = await supabase
    .from("tracking")
    .select("id, destination_url, clicks, created_at, media_id")
    .eq("project_id", scope.projectId)
    .eq("media_id", mediaId)
    .maybeSingle();

  if (fetchErr) return Response.json({ error: fetchErr.message }, { status: 500 });

  if (existing) {
    const { data: updated, error: updErr } = await supabase
      .from("tracking")
      .update({ destination_url: url })
      .eq("id", existing.id)
      .select("id, destination_url, clicks, created_at, media_id")
      .single();
    if (updErr || !updated)
      return Response.json({ error: updErr?.message ?? "update failed" }, { status: 500 });
    return Response.json({ item: normalizeItem(updated, scope.platform) });
  }

  const id = crypto.randomBytes(6).toString("base64url");
  const { data: inserted, error: insErr } = await supabase
    .from("tracking")
    .insert({
      id,
      project_id: scope.projectId,
      media_id: mediaId,
      destination_url: url,
      created_by: user?.id ?? null,
    })
    .select("id, destination_url, clicks, created_at, media_id")
    .single();

  if (insErr || !inserted)
    return Response.json({ error: insErr?.message ?? "insert failed" }, { status: 500 });
  return Response.json({ item: normalizeItem(inserted, scope.platform) });
}

export async function DELETE(request: NextRequest) {
  const scope = parseScope(request);
  if ("error" in scope) return Response.json({ error: scope.error }, { status: 400 });
  const mediaId = request.nextUrl.searchParams.get("mediaId");
  if (!mediaId) return Response.json({ error: "mediaId required" }, { status: 400 });

  const supabase = await createSupabaseServerClient();
  const { error, count } = await supabase
    .from("tracking")
    .delete({ count: "exact" })
    .eq("project_id", scope.projectId)
    .eq("media_id", mediaId);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (count === 0) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json({ ok: true });
}
