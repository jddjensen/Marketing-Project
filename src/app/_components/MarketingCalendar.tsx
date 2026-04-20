"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CHANNELS,
  CHANNEL_BY_KEY,
  CHANNEL_CATEGORY_LABELS,
  CHANNEL_CATEGORY_ORDER,
} from "@/lib/channels";
import { SEASON_KEYS, SEASON_LABELS, type SeasonKey } from "@/lib/campaignBrief";
import type { PlatformKey } from "@/lib/utm";

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

type GroupBy = "month" | "season" | "event" | "exhibit" | "channel";

const GROUP_LABEL: Record<GroupBy, string> = {
  month: "Month",
  season: "Season",
  event: "Event",
  exhibit: "Exhibit",
  channel: "Channel",
};

const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const GRADIENTS = [
  "from-orange-400 via-pink-400 to-rose-500",
  "from-sky-400 via-indigo-500 to-violet-600",
  "from-emerald-400 via-teal-500 to-cyan-600",
  "from-amber-400 via-orange-500 to-red-500",
  "from-fuchsia-400 via-purple-500 to-indigo-600",
  "from-lime-400 via-emerald-500 to-teal-600",
];

function hashGradient(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return GRADIENTS[Math.abs(h) % GRADIENTS.length];
}

function parseIsoDate(value: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function startOfMonthUtc(year: number, month: number): Date {
  return new Date(Date.UTC(year, month, 1));
}

function addMonths(year: number, month: number, delta: number): { year: number; month: number } {
  const total = year * 12 + month + delta;
  return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
}

function daysInMonthUtc(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function formatDateRange(start: string | null, end: string | null): string | null {
  if (!start && !end) return null;
  const fmt = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  const s = start ? parseIsoDate(start) : null;
  const e = end ? parseIsoDate(end) : null;
  if (s && e) {
    if (start === end) return fmt.format(s);
    return `${fmt.format(s)} – ${fmt.format(e)}`;
  }
  if (s) return `${fmt.format(s)} →`;
  if (e) return `→ ${fmt.format(e!)}`;
  return null;
}

function uniqSorted(values: Array<string | null>): string[] {
  const set = new Set<string>();
  for (const v of values) if (v && v.trim().length > 0) set.add(v.trim());
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

const MONTHS_IN_VIEW = 12;

function useTimelineRange(entries: CalendarEntry[]) {
  return useMemo(() => {
    const today = new Date();
    let anchorYear = today.getUTCFullYear();
    let anchorMonth = today.getUTCMonth();

    // Anchor the 12-month window on the earliest start date we have,
    // stepping back to the first of that month. Falls back to today.
    let earliest: Date | null = null;
    for (const entry of entries) {
      const start = parseIsoDate(entry.launchStartDate);
      if (start && (!earliest || start < earliest)) earliest = start;
    }
    if (earliest) {
      anchorYear = earliest.getUTCFullYear();
      anchorMonth = earliest.getUTCMonth();
    }

    const months: { year: number; month: number; start: Date; end: Date }[] = [];
    for (let i = 0; i < MONTHS_IN_VIEW; i++) {
      const { year, month } = addMonths(anchorYear, anchorMonth, i);
      const start = startOfMonthUtc(year, month);
      const end = new Date(Date.UTC(year, month, daysInMonthUtc(year, month), 23, 59, 59));
      months.push({ year, month, start, end });
    }

    const rangeStart = months[0].start;
    const rangeEnd = months[months.length - 1].end;
    const totalMs = rangeEnd.getTime() - rangeStart.getTime();

    return { months, rangeStart, rangeEnd, totalMs };
  }, [entries]);
}

export function MarketingCalendar({
  initialEntries,
}: {
  initialEntries: CalendarEntry[];
}) {
  const [entries, setEntries] = useState<CalendarEntry[]>(initialEntries);
  const [loading, setLoading] = useState(false);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [groupBy, setGroupBy] = useState<GroupBy>("month");
  const [seasonFilter, setSeasonFilter] = useState<Set<SeasonKey>>(new Set());
  const [eventFilter, setEventFilter] = useState<Set<string>>(new Set());
  const [exhibitFilter, setExhibitFilter] = useState<Set<string>>(new Set());
  const [channelFilter, setChannelFilter] = useState<Set<PlatformKey>>(new Set());
  const [search, setSearch] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      const qs = includeArchived ? "?includeArchived=1" : "";
      const res = await fetch(`/api/calendar${qs}`, { cache: "no-store" });
      const body = (await res.json()) as { entries?: CalendarEntry[] };
      if (!active) return;
      setEntries(body.entries ?? []);
      setLoading(false);
    }
    void load();
    return () => {
      active = false;
    };
  }, [includeArchived]);

  const allEvents = useMemo(() => uniqSorted(entries.map((e) => e.event)), [entries]);
  const allExhibits = useMemo(() => uniqSorted(entries.map((e) => e.exhibit)), [entries]);
  const allChannels = useMemo(() => {
    const set = new Set<PlatformKey>();
    for (const e of entries) for (const c of e.channels) set.add(c);
    return CHANNELS.filter((c) => set.has(c.key)).map((c) => c.key);
  }, [entries]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((entry) => {
      if (seasonFilter.size > 0) {
        if (!entry.season || !seasonFilter.has(entry.season)) return false;
      }
      if (eventFilter.size > 0) {
        if (!entry.event || !eventFilter.has(entry.event.trim())) return false;
      }
      if (exhibitFilter.size > 0) {
        if (!entry.exhibit || !exhibitFilter.has(entry.exhibit.trim())) return false;
      }
      if (channelFilter.size > 0) {
        if (!entry.channels.some((c) => channelFilter.has(c))) return false;
      }
      if (q) {
        const haystack = [
          entry.name,
          entry.description ?? "",
          entry.event ?? "",
          entry.exhibit ?? "",
          entry.owner ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [entries, seasonFilter, eventFilter, exhibitFilter, channelFilter, search]);

  const scheduled = useMemo(
    () =>
      filtered.filter((e) => e.launchStartDate || e.launchEndDate).sort((a, b) => {
        const aStart = a.launchStartDate ?? a.launchEndDate ?? "";
        const bStart = b.launchStartDate ?? b.launchEndDate ?? "";
        return aStart.localeCompare(bStart);
      }),
    [filtered]
  );
  const unscheduled = useMemo(
    () => filtered.filter((e) => !e.launchStartDate && !e.launchEndDate),
    [filtered]
  );

  const { months, rangeStart, rangeEnd, totalMs } = useTimelineRange(scheduled);

  const groups = useMemo(
    () => groupEntries(scheduled, groupBy),
    [scheduled, groupBy]
  );

  const activeFilterCount =
    seasonFilter.size +
    eventFilter.size +
    exhibitFilter.size +
    channelFilter.size +
    (search.trim() ? 1 : 0);

  const clearFilters = () => {
    setSeasonFilter(new Set());
    setEventFilter(new Set());
    setExhibitFilter(new Set());
    setChannelFilter(new Set());
    setSearch("");
  };

  return (
    <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Master Marketing Calendar
          </div>
          <h1 className="text-2xl font-semibold mt-1">Every project, every launch</h1>
          <p className="text-sm text-zinc-500 mt-1 max-w-2xl">
            Cross-project view of launches, seasons, events, exhibits, and channels. Filter to the
            slice you need, or group by how you want to plan.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <label className="flex items-center gap-1.5 text-xs text-zinc-500">
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(e) => setIncludeArchived(e.target.checked)}
              className="accent-zinc-900 dark:accent-zinc-100"
            />
            Include archived
          </label>
          <span className="text-xs text-zinc-400">
            {loading ? "Loading…" : `${filtered.length} of ${entries.length} projects`}
          </span>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 mr-1">
              Group by
            </span>
            {(Object.keys(GROUP_LABEL) as GroupBy[]).map((key) => {
              const active = groupBy === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setGroupBy(key)}
                  className={`text-xs rounded-full border px-3 py-1 transition-colors ${
                    active
                      ? "bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100"
                      : "border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:border-zinc-400 dark:hover:border-zinc-500"
                  }`}
                >
                  {GROUP_LABEL[key]}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search project, event, exhibit"
              className="w-56 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-xs rounded-md border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <FilterPills
            title="Season"
            items={SEASON_KEYS.map((k) => ({ key: k, label: SEASON_LABELS[k] }))}
            selected={seasonFilter}
            onToggle={(k) => setSeasonFilter((prev) => togglePill(prev, k))}
          />
          <FilterPills
            title={`Event${allEvents.length === 0 ? " (none yet)" : ""}`}
            items={allEvents.map((e) => ({ key: e, label: e }))}
            selected={eventFilter}
            onToggle={(k) => setEventFilter((prev) => togglePill(prev, k))}
          />
          <FilterPills
            title={`Exhibit${allExhibits.length === 0 ? " (none yet)" : ""}`}
            items={allExhibits.map((x) => ({ key: x, label: x }))}
            selected={exhibitFilter}
            onToggle={(k) => setExhibitFilter((prev) => togglePill(prev, k))}
          />
          <FilterPills
            title={`Channel${allChannels.length === 0 ? " (none yet)" : ""}`}
            items={allChannels.map((c) => ({
              key: c,
              label: CHANNEL_BY_KEY[c]?.name ?? c,
            }))}
            selected={channelFilter}
            onToggle={(k) => setChannelFilter((prev) => togglePill(prev, k))}
          />
        </div>
      </div>

      {scheduled.length === 0 && unscheduled.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-6">
          {scheduled.length > 0 && (
            <TimelineHeader months={months} />
          )}
          {groups.map((group) => (
            <section
              key={group.key}
              className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden"
            >
              <header className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold">{group.label}</h2>
                  <span className="text-[11px] text-zinc-500">
                    {group.entries.length} {group.entries.length === 1 ? "project" : "projects"}
                  </span>
                </div>
                {group.sub && (
                  <span className="text-[11px] text-zinc-500">{group.sub}</span>
                )}
              </header>
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {group.entries.map((entry) => (
                  <TimelineRow
                    key={`${group.key}-${entry.id}`}
                    entry={entry}
                    rangeStart={rangeStart}
                    rangeEnd={rangeEnd}
                    totalMs={totalMs}
                    months={months}
                  />
                ))}
              </ul>
            </section>
          ))}

          {unscheduled.length > 0 && (
            <section className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-white/60 dark:bg-zinc-900/60 overflow-hidden">
              <header className="flex items-center justify-between px-4 py-2.5 border-b border-dashed border-zinc-300 dark:border-zinc-700">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold">Unscheduled</h2>
                  <span className="text-[11px] text-zinc-500">
                    {unscheduled.length}{" "}
                    {unscheduled.length === 1 ? "project" : "projects"} missing launch dates
                  </span>
                </div>
              </header>
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {unscheduled.map((entry) => (
                  <ProjectRowBasic key={`un-${entry.id}`} entry={entry} />
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </main>
  );
}

function togglePill<T>(prev: Set<T>, key: T): Set<T> {
  const next = new Set(prev);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}

function FilterPills<T extends string>({
  title,
  items,
  selected,
  onToggle,
}: {
  title: string;
  items: Array<{ key: T; label: string }>;
  selected: Set<T>;
  onToggle: (key: T) => void;
}) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 mb-1.5">
        {title}
      </div>
      {items.length === 0 ? (
        <div className="text-[11px] text-zinc-400">—</div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {items.map((item) => {
            const active = selected.has(item.key);
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onToggle(item.key)}
                className={`text-[11px] rounded-full border px-2.5 py-1 transition-colors ${
                  active
                    ? "bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100"
                    : "border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:border-zinc-400 dark:hover:border-zinc-500"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

type Group = {
  key: string;
  label: string;
  sub?: string;
  entries: CalendarEntry[];
};

function groupEntries(entries: CalendarEntry[], groupBy: GroupBy): Group[] {
  if (groupBy === "month") {
    const map = new Map<string, CalendarEntry[]>();
    for (const entry of entries) {
      const ref = entry.launchStartDate ?? entry.launchEndDate;
      if (!ref) continue;
      const key = ref.slice(0, 7);
      const list = map.get(key) ?? [];
      list.push(entry);
      map.set(key, list);
    }
    const keys = Array.from(map.keys()).sort();
    const fmt = new Intl.DateTimeFormat(undefined, {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
    return keys.map((key) => {
      const [year, month] = key.split("-").map((n) => Number(n));
      const label = fmt.format(new Date(Date.UTC(year, month - 1, 1)));
      return { key, label, entries: map.get(key)! };
    });
  }

  if (groupBy === "season") {
    const map = new Map<SeasonKey | "_none", CalendarEntry[]>();
    for (const entry of entries) {
      const key = entry.season ?? "_none";
      const list = map.get(key) ?? [];
      list.push(entry);
      map.set(key, list);
    }
    const order: Array<SeasonKey | "_none"> = [...SEASON_KEYS, "_none"];
    return order
      .filter((k) => map.has(k))
      .map((k) => ({
        key: k,
        label: k === "_none" ? "No season" : SEASON_LABELS[k as SeasonKey],
        entries: map.get(k)!,
      }));
  }

  if (groupBy === "event" || groupBy === "exhibit") {
    const getter = (e: CalendarEntry) => (groupBy === "event" ? e.event : e.exhibit);
    const map = new Map<string, CalendarEntry[]>();
    for (const entry of entries) {
      const raw = getter(entry);
      const key = raw && raw.trim() ? raw.trim() : "_none";
      const list = map.get(key) ?? [];
      list.push(entry);
      map.set(key, list);
    }
    const keys = Array.from(map.keys()).sort((a, b) => {
      if (a === "_none") return 1;
      if (b === "_none") return -1;
      return a.localeCompare(b);
    });
    return keys.map((k) => ({
      key: k,
      label: k === "_none" ? `No ${groupBy}` : k,
      entries: map.get(k)!,
    }));
  }

  // channel grouping — a project can appear in multiple channel groups.
  const categoryOrder = new Map<string, number>();
  CHANNEL_ORDER_LIST.forEach((k, i) => categoryOrder.set(k, i));
  const map = new Map<string, CalendarEntry[]>();
  for (const entry of entries) {
    const channels: string[] = entry.channels.length > 0 ? entry.channels : ["_none"];
    for (const channel of channels) {
      const list = map.get(channel) ?? [];
      list.push(entry);
      map.set(channel, list);
    }
  }
  const keys = Array.from(map.keys()).sort((a, b) => {
    if (a === "_none") return 1;
    if (b === "_none") return -1;
    return (categoryOrder.get(a) ?? 999) - (categoryOrder.get(b) ?? 999);
  });
  return keys.map((k) => {
    if (k === "_none") {
      return { key: k, label: "No channels assigned", entries: map.get(k)! };
    }
    const meta = CHANNEL_BY_KEY[k as PlatformKey];
    const label = meta?.name ?? k;
    const sub = meta ? CHANNEL_CATEGORY_LABELS[meta.category] : undefined;
    return { key: k, label, sub, entries: map.get(k)! };
  });
}

const CHANNEL_ORDER_LIST = [...CHANNELS]
  .sort(
    (a, b) =>
      CHANNEL_CATEGORY_ORDER.indexOf(a.category) -
      CHANNEL_CATEGORY_ORDER.indexOf(b.category)
  )
  .map((c) => c.key as string);

function TimelineHeader({
  months,
}: {
  months: { year: number; month: number }[];
}) {
  return (
    <div className="hidden md:grid grid-cols-[260px_1fr] rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden text-xs">
      <div className="px-4 py-2 border-r border-zinc-200 dark:border-zinc-800 text-zinc-500 font-medium uppercase tracking-wide">
        Project
      </div>
      <div className="grid" style={{ gridTemplateColumns: `repeat(${months.length}, minmax(0, 1fr))` }}>
        {months.map((m) => (
          <div
            key={`${m.year}-${m.month}`}
            className="px-2 py-2 border-r last:border-r-0 border-zinc-100 dark:border-zinc-800 text-center"
          >
            <div className="font-medium text-zinc-700 dark:text-zinc-200">
              {MONTH_SHORT[m.month]}
            </div>
            <div className="text-[10px] text-zinc-400">{m.year}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TimelineRow({
  entry,
  rangeStart,
  rangeEnd,
  totalMs,
  months,
}: {
  entry: CalendarEntry;
  rangeStart: Date;
  rangeEnd: Date;
  totalMs: number;
  months: { year: number; month: number }[];
}) {
  const start = parseIsoDate(entry.launchStartDate) ?? parseIsoDate(entry.launchEndDate);
  const end = parseIsoDate(entry.launchEndDate) ?? parseIsoDate(entry.launchStartDate);

  let barStyle: { left: string; width: string } | null = null;
  let inRange = false;
  if (start && end) {
    const clampedStart = Math.max(start.getTime(), rangeStart.getTime());
    const clampedEnd = Math.min(Math.max(end.getTime(), start.getTime()), rangeEnd.getTime());
    if (clampedEnd >= rangeStart.getTime() && clampedStart <= rangeEnd.getTime()) {
      inRange = true;
      const leftPct = ((clampedStart - rangeStart.getTime()) / totalMs) * 100;
      const widthPct = Math.max(
        1.5,
        ((clampedEnd - clampedStart) / totalMs) * 100
      );
      barStyle = { left: `${leftPct}%`, width: `${widthPct}%` };
    }
  }

  const gradient = hashGradient(entry.id);
  const dateRange = formatDateRange(entry.launchStartDate, entry.launchEndDate);

  return (
    <li className="grid grid-cols-1 md:grid-cols-[260px_1fr] items-stretch">
      <Link
        href={`/projects/${entry.id}`}
        className="block px-4 py-3 border-b md:border-b-0 md:border-r border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors"
      >
        <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
          {entry.name}
        </div>
        <div className="mt-0.5 text-[11px] text-zinc-500 truncate">
          {[entry.event, entry.exhibit, entry.owner].filter(Boolean).join(" · ") ||
            entry.description ||
            "—"}
        </div>
        <div className="mt-1 flex flex-wrap gap-1">
          {entry.channels.slice(0, 4).map((key) => (
            <span
              key={key}
              className="text-[10px] rounded-full border border-zinc-200 dark:border-zinc-700 px-1.5 py-0.5 text-zinc-500"
            >
              {CHANNEL_BY_KEY[key]?.name ?? key}
            </span>
          ))}
          {entry.channels.length > 4 && (
            <span className="text-[10px] text-zinc-400">
              +{entry.channels.length - 4}
            </span>
          )}
        </div>
      </Link>
      <div className="relative min-h-[56px] p-2">
        <div
          className="absolute inset-y-0 left-0 right-0 grid pointer-events-none"
          style={{ gridTemplateColumns: `repeat(${months.length}, minmax(0, 1fr))` }}
          aria-hidden
        >
          {months.map((m, idx) => (
            <div
              key={`${m.year}-${m.month}-grid`}
              className={`border-r last:border-r-0 border-zinc-100 dark:border-zinc-800 ${
                idx % 2 === 1 ? "bg-zinc-50/50 dark:bg-zinc-900/40" : ""
              }`}
            />
          ))}
        </div>
        {barStyle && inRange ? (
          <div
            className="absolute top-1/2 -translate-y-1/2 h-6"
            style={barStyle}
            title={dateRange ?? undefined}
          >
            <div
              className={`h-full rounded-md bg-gradient-to-r ${gradient} shadow-sm flex items-center px-2`}
            >
              <span className="text-[10px] font-medium text-white drop-shadow truncate">
                {entry.name}
              </span>
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-[11px] text-zinc-400">
            {dateRange ?? "Outside visible range"}
          </div>
        )}
      </div>
    </li>
  );
}

function ProjectRowBasic({ entry }: { entry: CalendarEntry }) {
  const gradient = hashGradient(entry.id);
  return (
    <li>
      <Link
        href={`/projects/${entry.id}`}
        className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors"
      >
        <span
          aria-hidden
          className={`h-8 w-8 rounded-md bg-gradient-to-br ${gradient} flex-shrink-0`}
        />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium truncate">{entry.name}</div>
          <div className="text-[11px] text-zinc-500 truncate">
            {[entry.event, entry.exhibit, entry.owner].filter(Boolean).join(" · ") ||
              entry.description ||
              "Add launch dates to put this on the calendar."}
          </div>
        </div>
        <div className="flex flex-wrap gap-1 justify-end max-w-[40%]">
          {entry.channels.slice(0, 4).map((key) => (
            <span
              key={key}
              className="text-[10px] rounded-full border border-zinc-200 dark:border-zinc-700 px-1.5 py-0.5 text-zinc-500"
            >
              {CHANNEL_BY_KEY[key]?.name ?? key}
            </span>
          ))}
          {entry.channels.length > 4 && (
            <span className="text-[10px] text-zinc-400 self-center">
              +{entry.channels.length - 4}
            </span>
          )}
        </div>
      </Link>
    </li>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-white/40 dark:bg-zinc-900/40 py-16 flex flex-col items-center text-center">
      <div className="text-lg font-semibold">Nothing on the calendar yet</div>
      <p className="text-sm text-zinc-500 mt-1 max-w-md">
        Add launch dates, events, or exhibits to project briefs and they&apos;ll show up here.
      </p>
      <Link
        href="/"
        className="apple-tap mt-4 rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 px-4 py-2 text-sm font-medium hover:opacity-90"
      >
        Back to projects
      </Link>
    </div>
  );
}
