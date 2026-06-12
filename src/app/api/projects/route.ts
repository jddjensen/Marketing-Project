import { NextRequest } from "next/server";
import { CHANNEL_KEYS } from "@/lib/channels";
import {
  customChannelIdFromKey,
  isCustomPlatformKey,
} from "@/lib/customChannels";
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

const PROJECT_COLS =
  "id, name, description, created_at, updated_at, archived_at, tracking_links_location";

function serialize(p: ProjectRow) {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    createdAt: new Date(p.created_at).getTime(),
    updatedAt: new Date(p.updated_at).getTime(),
    archivedAt: p.archived_at ? new Date(p.archived_at).getTime() : null,
    trackingLinksLocation:
      (p.tracking_links_location as
        | "project_tab"
        | "platform_panel"
        | "both") ?? "both",
  };
}

export async function GET(request: NextRequest) {
  const includeArchived =
    request.nextUrl.searchParams.get("includeArchived") === "1";
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("projects")
    .select(PROJECT_COLS)
    .order("updated_at", { ascending: false });
  if (!includeArchived) query = query.is("archived_at", null);
  const { data, error } = await query;
  if (error)
    return Response.json({ error: "failed to load projects" }, { status: 500 });
  return Response.json({ projects: (data ?? []).map(serialize) });
}

const VALID_PLATFORMS = CHANNEL_KEYS;

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    name?: unknown;
    description?: unknown;
    platforms?: unknown;
  } | null;

  if (!body || typeof body.name !== "string") {
    return Response.json({ error: "name required" }, { status: 400 });
  }
  const name = body.name.trim();
  if (name.length === 0 || name.length > 120) {
    return Response.json(
      { error: "name must be 1–120 chars" },
      { status: 400 }
    );
  }
  const descriptionRaw =
    typeof body.description === "string"
      ? body.description.trim() || null
      : null;
  // Mirrors the cap on PATCH /api/projects/[id] so calendar tiles, project
  // grid cards, and OG metadata don't have to defend against unbounded text.
  const DESCRIPTION_MAX = 4000;
  if (descriptionRaw !== null && descriptionRaw.length > DESCRIPTION_MAX) {
    return Response.json(
      { error: `description must be ${DESCRIPTION_MAX} characters or fewer` },
      { status: 400 }
    );
  }
  const description = descriptionRaw;

  const validSet = new Set<string>(VALID_PLATFORMS);
  let platforms: string[];
  let customCandidates: string[] = [];
  if (Array.isArray(body.platforms)) {
    const filtered = body.platforms.filter(
      (p): p is string => typeof p === "string" && validSet.has(p)
    );
    platforms = Array.from(new Set(filtered));
    customCandidates = Array.from(
      new Set(
        body.platforms.filter(
          (p): p is string => typeof p === "string" && isCustomPlatformKey(p)
        )
      )
    );
  } else {
    platforms = [...VALID_PLATFORMS];
  }

  const supabase = await createSupabaseServerClient();

  // Custom channel keys are only accepted when the referenced channel exists.
  if (customCandidates.length > 0) {
    const ids = customCandidates.map((key) => customChannelIdFromKey(key)!);
    const { data: existing, error: customError } = await supabase
      .from("custom_channels")
      .select("id")
      .in("id", ids);
    if (customError) {
      return Response.json(
        { error: "failed to validate custom channels" },
        { status: 500 }
      );
    }
    const existingIds = new Set((existing ?? []).map((row) => row.id));
    platforms = platforms.concat(
      customCandidates.filter((key) =>
        existingIds.has(customChannelIdFromKey(key)!)
      )
    );
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("projects")
    .insert({ name, description, created_by: user?.id ?? null })
    .select(PROJECT_COLS)
    .single();

  if (error || !data) {
    return Response.json({ error: "failed to create" }, { status: 500 });
  }

  if (platforms.length > 0) {
    const rows = platforms.map((platform) => ({
      project_id: data.id,
      platform,
      added_by: user?.id ?? null,
    }));
    await supabase.from("project_platforms").insert(rows);
  }

  return Response.json({ project: serialize(data) });
}
