import { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { seasonForDate, type SeasonKey } from "@/lib/campaignBrief";
import type { PlatformKey } from "@/lib/utm";

type ProjectRow = {
  id: string;
  name: string;
  description: string | null;
  archived_at: string | null;
  brief_launch_start_date: string | null;
  brief_launch_end_date: string | null;
  brief_owner: string | null;
  brief_event: string | null;
  brief_exhibit: string | null;
};

type PlatformRow = {
  project_id: string;
  platform: PlatformKey;
};

export type CalendarEntry = {
  id: string;
  name: string;
  description: string | null;
  owner: string | null;
  event: string | null;
  exhibit: string | null;
  launchStartDate: string | null;
  launchEndDate: string | null;
  season: SeasonKey | null;
  channels: PlatformKey[];
};

export async function GET(request: NextRequest) {
  const includeArchived =
    request.nextUrl.searchParams.get("includeArchived") === "1";

  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("projects")
    .select(
      "id, name, description, archived_at, brief_launch_start_date, brief_launch_end_date, brief_owner, brief_event, brief_exhibit"
    )
    .order("brief_launch_start_date", { ascending: true, nullsFirst: false });
  if (!includeArchived) query = query.is("archived_at", null);

  const { data: projects, error } = await query;
  if (error) return Response.json({ error: error.message }, { status: 500 });
  const rows = (projects ?? []) as ProjectRow[];

  const ids = rows.map((r) => r.id);
  let platformMap = new Map<string, PlatformKey[]>();
  if (ids.length > 0) {
    const { data: platforms, error: platformError } = await supabase
      .from("project_platforms")
      .select("project_id, platform")
      .in("project_id", ids);
    if (platformError) {
      return Response.json({ error: platformError.message }, { status: 500 });
    }
    platformMap = ((platforms ?? []) as PlatformRow[]).reduce((acc, row) => {
      const list = acc.get(row.project_id) ?? [];
      list.push(row.platform);
      acc.set(row.project_id, list);
      return acc;
    }, new Map<string, PlatformKey[]>());
  }

  const entries: CalendarEntry[] = rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    owner: row.brief_owner,
    event: row.brief_event,
    exhibit: row.brief_exhibit,
    launchStartDate: row.brief_launch_start_date,
    launchEndDate: row.brief_launch_end_date,
    season: seasonForDate(row.brief_launch_start_date),
    channels: platformMap.get(row.id) ?? [],
  }));

  return Response.json({ entries });
}
