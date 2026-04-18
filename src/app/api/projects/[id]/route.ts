import { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ProjectRow = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  tracking_links_location: string | null;
};

const VALID_LOCATIONS = ["project_tab", "platform_panel", "both"] as const;
type TrackingLinksLocation = (typeof VALID_LOCATIONS)[number];

function serialize(p: ProjectRow) {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    createdAt: new Date(p.created_at).getTime(),
    updatedAt: new Date(p.updated_at).getTime(),
    archivedAt: p.archived_at ? new Date(p.archived_at).getTime() : null,
    trackingLinksLocation: (p.tracking_links_location as TrackingLinksLocation) ?? "both",
  };
}

const PROJECT_COLS =
  "id, name, description, created_at, updated_at, archived_at, tracking_links_location";

export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("projects")
    .select(PROJECT_COLS)
    .eq("id", id)
    .maybeSingle();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!data) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json({ project: serialize(data) });
}

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const body = (await request.json().catch(() => null)) as {
    name?: unknown;
    description?: unknown;
    archive?: unknown;
    trackingLinksLocation?: unknown;
  } | null;
  if (!body) return Response.json({ error: "body required" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (name.length === 0 || name.length > 120) {
      return Response.json({ error: "name must be 1–120 chars" }, { status: 400 });
    }
    patch.name = name;
  }
  if (typeof body.description === "string") {
    patch.description = body.description.trim() || null;
  }
  if (typeof body.archive === "boolean") {
    patch.archived_at = body.archive ? new Date().toISOString() : null;
  }
  if (typeof body.trackingLinksLocation === "string") {
    if (!VALID_LOCATIONS.includes(body.trackingLinksLocation as TrackingLinksLocation)) {
      return Response.json({ error: "invalid trackingLinksLocation" }, { status: 400 });
    }
    patch.tracking_links_location = body.trackingLinksLocation;
  }
  if (Object.keys(patch).length === 0) {
    return Response.json({ error: "nothing to update" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("projects")
    .update(patch)
    .eq("id", id)
    .select(PROJECT_COLS)
    .single();

  if (error || !data) {
    return Response.json({ error: error?.message ?? "update failed" }, { status: 500 });
  }
  return Response.json({ project: serialize(data) });
}

export async function DELETE(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const supabase = await createSupabaseServerClient();

  // Collect storage paths for this project's media so we can clean the bucket.
  const { data: mediaRows } = await supabase
    .from("media")
    .select("storage_path")
    .eq("project_id", id);

  const { error, count } = await supabase
    .from("projects")
    .delete({ count: "exact" })
    .eq("id", id);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (count === 0) return Response.json({ error: "not found" }, { status: 404 });

  if (mediaRows && mediaRows.length > 0) {
    const paths = mediaRows.map((r) => r.storage_path);
    await supabase.storage.from("creatives").remove(paths);
  }

  return Response.json({ ok: true });
}
