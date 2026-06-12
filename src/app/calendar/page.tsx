import Link from "next/link";
import { UserMenu } from "../_components/UserMenu";
import { MarketingCalendar } from "../_components/MarketingCalendar";
import { seasonForDate, type SeasonKey } from "@/lib/campaignBrief";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PlatformKey } from "@/lib/utm";

export const dynamic = "force-dynamic";

type CalendarEntry = {
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

type ProjectRow = {
  id: string;
  name: string;
  description: string | null;
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

async function loadInitialEntries(): Promise<CalendarEntry[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("projects")
    .select(
      "id, name, description, brief_launch_start_date, brief_launch_end_date, brief_owner, brief_event, brief_exhibit"
    )
    .is("archived_at", null);
  if (error || !data) return [];
  const rows = data as ProjectRow[];

  const ids = rows.map((r) => r.id);
  let platformMap = new Map<string, PlatformKey[]>();
  if (ids.length > 0) {
    const { data: platforms } = await supabase
      .from("project_platforms")
      .select("project_id, platform")
      .in("project_id", ids);
    platformMap = ((platforms ?? []) as PlatformRow[]).reduce((acc, row) => {
      const list = acc.get(row.project_id) ?? [];
      list.push(row.platform);
      acc.set(row.project_id, list);
      return acc;
    }, new Map<string, PlatformKey[]>());
  }

  return rows.map((row) => ({
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
}

export default async function CalendarPage() {
  const entries = await loadInitialEntries();

  return (
    <div className="page-shell min-h-screen text-zinc-900 dark:text-zinc-100">
      <header className="apple-header sticky top-0 z-40">
        <div className="mx-auto flex max-w-7xl items-start justify-between gap-4 px-6 py-6">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              transitionTypes={["nav-back"]}
              className="text-xs font-medium tracking-wide text-zinc-500 uppercase hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              ← Projects
            </Link>
            <div>
              <h1 className="ink-gradient text-2xl font-semibold">Calendar</h1>
              <p className="mt-1 text-sm text-zinc-500">
                Master marketing calendar across launches, seasons, events,
                exhibits, and channels.
              </p>
            </div>
          </div>
          <UserMenu />
        </div>
      </header>
      <MarketingCalendar initialEntries={entries} />
    </div>
  );
}
