"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import type { PlatformKey } from "@/lib/utm";

type AnalyticsSettings = {
  ga4PropertyId: string | null;
  status:
    | "ready"
    | "property_missing"
    | "account_not_connected"
    | "credentials_missing";
  credentialsConfigured: boolean;
  oauthConfigured: boolean;
  connected: boolean;
  accountEmail: string | null;
  authMode: "oauth" | "service_account" | null;
};

type ChannelBucketKey = PlatformKey | "all-channels";

type ChannelRow = {
  channel: ChannelBucketKey;
  label: string;
  linkCount: number;
  clicks: number;
  scans: number;
  sessions: number;
  conversions: number;
  ticketSales: number;
  revenue: number;
  sessionsShare: number | null;
  revenueShare: number | null;
};

type PerformanceResponse = {
  analytics: AnalyticsSettings;
  trackedLinkCount: number;
  totals: {
    clicks: number;
    scans: number;
    sessions: number;
    conversions: number;
    revenue: number;
    ticketSales: number;
    budget: number | null;
    cpa: number | null;
    cpaBasis: "ticket_sales" | "conversions" | null;
    roas: number | null;
  };
  channels: ChannelRow[];
  trend: Array<{
    date: string;
    sessions: number;
    keyEvents: number;
    transactions: number;
    purchaseRevenue: number;
  }>;
  lastSyncedAt: number;
};

function formatInteger(value: number | null) {
  if (value === null) return "n/a";
  return new Intl.NumberFormat().format(Math.round(value));
}

function formatCurrency(value: number | null) {
  if (value === null) return "n/a";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number | null) {
  if (value === null) return "n/a";
  return `${Math.round(value * 100)}%`;
}

function formatRoas(value: number | null) {
  if (value === null) return "n/a";
  return `${value.toFixed(value >= 10 ? 1 : 2)}x`;
}

function relativeTime(ts: number) {
  const diff = Date.now() - ts;
  if (diff < 15_000) return "just now";
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

function formatTrendDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function statusTone(settings: AnalyticsSettings) {
  if (settings.status === "ready") {
    return {
      className:
        "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200",
      label: "GA4, tracked clicks, and QR scans are all feeding this view.",
    };
  }

  if (settings.status === "property_missing") {
    return {
      className:
        "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200",
      label: settings.connected
        ? "Tracked clicks and QR scans are live. Choose a GA4 property below to unlock sessions, conversions, and revenue."
        : "Tracked clicks and QR scans are live. Add a GA4 property to unlock sessions, conversions, and revenue.",
    };
  }

  if (settings.status === "account_not_connected") {
    return {
      className:
        "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200",
      label:
        "Tracked clicks and QR scans are live. Connect Google Analytics below to pull website sessions, conversions, and revenue.",
    };
  }

  return {
    className:
      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200",
    label:
      "Tracked clicks and QR scans are live. Google OAuth credentials still need to be configured.",
  };
}

function channelHasSignal(row: ChannelRow) {
  return (
    row.linkCount > 0 ||
    row.clicks > 0 ||
    row.scans > 0 ||
    row.sessions > 0 ||
    row.conversions > 0 ||
    row.ticketSales > 0 ||
    row.revenue > 0
  );
}

function ga4StepDescription(settings: AnalyticsSettings) {
  if (settings.status === "ready") {
    return "GA4 sessions, conversions, and revenue will flow into this dashboard.";
  }
  if (settings.status === "property_missing") {
    return settings.connected
      ? "Your Google account is connected — choose a GA4 property in the Google Analytics card under Landing pages."
      : "Enter the GA4 property ID in the Google Analytics card under Landing pages.";
  }
  if (settings.status === "account_not_connected") {
    return "Connect your Google Analytics account from the Google Analytics card under Landing pages.";
  }
  return "Google OAuth credentials must be configured by an admin before GA4 can connect. The Google Analytics card under Landing pages has details.";
}

const ACTION_LINK_CLASS =
  "apple-tap focus-ring inline-flex items-center gap-1 rounded-md border border-zinc-300 px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:border-zinc-500 dark:border-zinc-700 dark:text-zinc-200";

export function PerformanceDashboardPanel({
  projectId,
}: {
  projectId: string;
}) {
  const [data, setData] = useState<PerformanceResponse | null>(null);
  const [landingPageCount, setLandingPageCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAllChannels, setShowAllChannels] = useState(false);

  const load = useCallback(
    async (refresh = false) => {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const suffix = refresh ? "?refresh=1" : "";
      // Landing pages are platform-null tracking links; the performance API
      // excludes them, so the setup checklist needs this second fetch.
      const [res, linksRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/performance${suffix}`, {
          cache: "no-store",
        }),
        fetch(`/api/projects/${projectId}/tracking-links`, {
          cache: "no-store",
        }),
      ]);

      if (linksRes.ok) {
        const linksBody = (await linksRes.json().catch(() => null)) as {
          links?: Array<{ platform: string | null }>;
        } | null;
        setLandingPageCount(
          (linksBody?.links ?? []).filter((link) => link.platform === null)
            .length
        );
      }

      const body = (await res.json().catch(() => null)) as
        | (PerformanceResponse & { error?: string })
        | { error?: string }
        | null;

      if (!res.ok) {
        setError(body?.error ?? "failed to load performance dashboard");
        setLoading(false);
        setRefreshing(false);
        return;
      }

      setData(body as PerformanceResponse);
      setLoading(false);
      setRefreshing(false);
    },
    [projectId]
  );

  useEffect(() => {
    // Deferred a tick so load()'s synchronous setLoading stays out of the
    // effect body proper (same kickoff idiom as LandingPagesPanel).
    const kickoff = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(kickoff);
  }, [load]);

  const scrollToLandingPages = useCallback(
    (event: ReactMouseEvent<HTMLAnchorElement>) => {
      const target = document.getElementById("landing-pages");
      if (!target) return; // fall back to default hash navigation
      event.preventDefault();
      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;
      target.scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "start",
      });
      if (!target.hasAttribute("tabindex"))
        target.setAttribute("tabindex", "-1");
      target.focus({ preventScroll: true });
    },
    []
  );

  const totals = data?.totals ?? null;
  const hasAnyActivity = totals
    ? totals.clicks > 0 ||
      totals.scans > 0 ||
      totals.sessions > 0 ||
      totals.conversions > 0 ||
      totals.ticketSales > 0 ||
      totals.revenue > 0
    : false;
  // No tracked links means clicks/scans/GA metrics are structurally zero —
  // there is no performance signal to show, only setup work left to do.
  const needsSetup =
    data !== null && data.trackedLinkCount === 0 && !hasAnyActivity;

  const channels = data?.channels ?? [];
  const activeChannels = channels.filter(channelHasSignal);
  const inactiveCount = channels.length - activeChannels.length;
  const channelsToShow =
    showAllChannels || activeChannels.length === 0 ? channels : activeChannels;
  const channelListId = `performance-channel-list-${projectId}`;

  const firstChannel =
    channels.find((row) => row.channel !== "all-channels") ?? null;
  const landingPagesDone = (landingPageCount ?? 0) > 0;
  const ga4Done = data?.analytics.status === "ready";

  const tone = data && !needsSetup ? statusTone(data.analytics) : null;
  const trendMax = Math.max(
    ...(data?.trend.map((point) => point.sessions) ?? [0]),
    1
  );

  return (
    <section className="space-y-5 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-sm font-medium tracking-wide text-zinc-500 uppercase">
            Unified Performance
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-zinc-500">
            One blended view of first-party tracked clicks, QR scans, and GA4
            site behavior. Use tracked links for digital channels and QR for
            print/offline placements so the rollup stays complete.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {data?.lastSyncedAt && !needsSetup && (
            <div className="text-xs text-zinc-500">
              Synced {relativeTime(data.lastSyncedAt)}
            </div>
          )}
          <button
            type="button"
            onClick={() => void load(true)}
            disabled={loading || refreshing}
            className="apple-tap rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:border-zinc-500 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-200"
          >
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      ) : loading || !data ? (
        <div className="grid h-40 place-items-center rounded-lg border border-zinc-200 bg-zinc-50 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950">
          Loading performance…
        </div>
      ) : needsSetup ? (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 sm:p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <h3 className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
            Set up performance tracking
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-zinc-500">
            Nothing has been measured for this campaign yet. Three steps connect
            the pipes — clicks and scans start counting immediately, and GA4
            fills in sessions, conversions, and revenue.
          </p>
          <ol className="mt-4 space-y-2">
            <SetupStep
              index={1}
              done={landingPagesDone}
              title="Add a landing page"
              description={
                landingPagesDone
                  ? `${formatInteger(landingPageCount)} landing ${
                      landingPageCount === 1 ? "page" : "pages"
                    } saved — creatives can link to them from any channel board.`
                  : "Save the destination URLs this campaign drives traffic to. They live in the Landing pages section further down this page."
              }
              action={
                <a
                  href="#landing-pages"
                  onClick={scrollToLandingPages}
                  className={ACTION_LINK_CLASS}
                >
                  Go to Landing pages <span aria-hidden="true">↓</span>
                </a>
              }
            />
            <SetupStep
              index={2}
              done={ga4Done}
              title="Connect GA4"
              description={ga4StepDescription(data.analytics)}
              action={
                <a
                  href="#landing-pages"
                  onClick={scrollToLandingPages}
                  className={ACTION_LINK_CLASS}
                >
                  Open GA4 settings <span aria-hidden="true">↓</span>
                </a>
              }
            />
            <SetupStep
              index={3}
              done={false}
              title="Create tracking links"
              description={
                firstChannel
                  ? "Assign a landing page to a creative on a channel board. Each assignment generates a tracked link (with QR for print) that reports back here."
                  : "Enable a channel first, then assign a landing page to a creative there — each assignment generates a tracked link that reports back here."
              }
              action={
                firstChannel ? (
                  <Link
                    href={`/projects/${projectId}/${firstChannel.channel}`}
                    className={ACTION_LINK_CLASS}
                  >
                    Open the {firstChannel.label} board{" "}
                    <span aria-hidden="true">→</span>
                  </Link>
                ) : (
                  <Link
                    href={`/projects/${projectId}?addChannel=1`}
                    className={ACTION_LINK_CLASS}
                  >
                    Add a channel <span aria-hidden="true">→</span>
                  </Link>
                )
              }
            />
          </ol>
        </div>
      ) : (
        <>
          {tone && (
            <div
              className={`rounded-lg border px-3 py-2 text-sm ${tone.className}`}
            >
              {tone.label}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <SummaryCard
              label="Clicks"
              value={formatInteger(data.totals.clicks)}
            />
            <SummaryCard
              label="Scans"
              value={formatInteger(data.totals.scans)}
            />
            <SummaryCard
              label="GA sessions"
              value={formatInteger(data.totals.sessions)}
            />
            <SummaryCard
              label="Conversions"
              value={formatInteger(data.totals.conversions)}
            />
            <SummaryCard
              label="Revenue"
              value={formatCurrency(data.totals.revenue)}
            />
            <SummaryCard
              label="Ticket sales"
              value={formatInteger(data.totals.ticketSales)}
            />
            <SummaryCard
              label="CPA"
              value={formatCurrency(data.totals.cpa)}
              caption={
                data.totals.cpaBasis === "ticket_sales"
                  ? "Based on ticket sales"
                  : data.totals.cpaBasis === "conversions"
                    ? "Based on conversions"
                    : "Needs budget + outcomes"
              }
            />
            <SummaryCard
              label="ROAS"
              value={formatRoas(data.totals.roas)}
              caption={
                data.totals.budget !== null
                  ? `Budget ${formatCurrency(data.totals.budget)}`
                  : "Add budget in campaign brief"
              }
            />
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.25fr_0.9fr]">
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
                    Channel Contribution
                  </div>
                  <div className="mt-1 text-[11px] text-zinc-500">
                    {data.trackedLinkCount} tracked links currently feeding this
                    rollup.
                  </div>
                </div>
              </div>

              {channels.length ? (
                <div id={channelListId} className="space-y-2">
                  {channelsToShow.map((row) => (
                    <div
                      key={row.channel}
                      className="rounded-md border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
                    >
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <div className="font-medium">{row.label}</div>
                          <div className="mt-1 text-[11px] text-zinc-500">
                            {row.linkCount} tracked{" "}
                            {row.linkCount === 1 ? "link" : "links"} ·{" "}
                            {formatInteger(row.clicks)} clicks ·{" "}
                            {formatInteger(row.scans)} scans
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                          <MetricPair
                            label="Sessions"
                            value={formatInteger(row.sessions)}
                          />
                          <MetricPair
                            label="Revenue"
                            value={formatCurrency(row.revenue)}
                          />
                          <MetricPair
                            label="Session share"
                            value={formatPercent(row.sessionsShare)}
                          />
                          <MetricPair
                            label="Revenue share"
                            value={formatPercent(row.revenueShare)}
                          />
                        </div>
                      </div>

                      <div className="mt-3 space-y-2">
                        <ShareBar
                          label="Session contribution"
                          value={row.sessionsShare}
                          tone="bg-sky-500/80 dark:bg-sky-400/80"
                        />
                        <ShareBar
                          label="Revenue contribution"
                          value={row.revenueShare}
                          tone="bg-emerald-500/80 dark:bg-emerald-400/80"
                        />
                      </div>
                    </div>
                  ))}
                  {activeChannels.length > 0 && inactiveCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowAllChannels((value) => !value)}
                      aria-expanded={showAllChannels}
                      aria-controls={channelListId}
                      className="apple-tap focus-ring w-full rounded-md border border-dashed border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-500 hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-700 dark:hover:border-zinc-600 dark:hover:text-zinc-100"
                    >
                      {showAllChannels
                        ? `Show channels with activity only (${activeChannels.length})`
                        : `Show all channels (${channels.length})`}
                    </button>
                  )}
                </div>
              ) : (
                <div className="text-sm text-zinc-500">
                  No tracked links yet. Add a landing page below, then assign it
                  to a creative to start building performance data.
                </div>
              )}
            </div>

            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
                14-Day Sessions Trend
              </div>
              <div className="mt-1 text-[11px] text-zinc-500">
                GA4-attributed activity across every mt_link_id attached to this
                project.
              </div>

              {data.trend.length ? (
                <>
                  <div className="mt-4 flex h-40 items-end gap-2">
                    {data.trend.map((point) => (
                      <div
                        key={point.date}
                        className="flex flex-1 flex-col items-center justify-end gap-2"
                      >
                        <div
                          className="min-h-2 w-full rounded-t-md bg-sky-500/80 dark:bg-sky-400/80"
                          style={{
                            height: `${Math.max(
                              10,
                              Math.round((point.sessions / trendMax) * 100)
                            )}%`,
                          }}
                          title={`${formatTrendDate(point.date)} · ${point.sessions} sessions`}
                        />
                        <div className="origin-top-left rotate-[-35deg] text-[10px] whitespace-nowrap text-zinc-500">
                          {formatTrendDate(point.date)}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-8 grid grid-cols-2 gap-2 text-sm">
                    <MetricPair
                      label="Trend revenue"
                      value={formatCurrency(
                        data.trend.reduce(
                          (sum, point) => sum + point.purchaseRevenue,
                          0
                        )
                      )}
                    />
                    <MetricPair
                      label="Trend ticket sales"
                      value={formatInteger(
                        data.trend.reduce(
                          (sum, point) => sum + point.transactions,
                          0
                        )
                      )}
                    />
                  </div>
                </>
              ) : (
                <div className="grid h-40 place-items-center text-center text-sm text-zinc-500">
                  No GA4-attributed sessions yet. Tracked clicks and scans can
                  start collecting immediately, and GA4 metrics will populate
                  once linked traffic lands on the tagged site.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-dashed border-zinc-300 px-3 py-2 text-xs text-zinc-500 dark:border-zinc-700">
            Clicks count only when someone uses the tracked redirect link from
            this app. Scans count from QR visits. GA sessions, conversions,
            ticket sales, and revenue depend on the project&apos;s GA4 property
            and the destination site being tagged correctly.
          </div>
        </>
      )}
    </section>
  );
}

function SetupStep({
  index,
  done,
  title,
  description,
  action,
}: {
  index: number;
  done: boolean;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <li className="flex items-start gap-3 rounded-md border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <span
        aria-hidden="true"
        className={
          done
            ? "grid size-6 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
            : "grid size-6 shrink-0 place-items-center rounded-full border border-zinc-300 text-xs font-medium text-zinc-500 dark:border-zinc-700"
        }
      >
        {done ? <CheckIcon /> : index}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{title}</span>
          {done && (
            <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-emerald-700 uppercase dark:bg-emerald-900/40 dark:text-emerald-300">
              Done
            </span>
          )}
        </div>
        <p className="mt-0.5 text-[13px] text-zinc-500">{description}</p>
        {!done && action ? <div className="mt-2">{action}</div> : null}
      </div>
    </li>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className="size-3.5"
    >
      <path
        d="M3.5 8.5l3 3 6-7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SummaryCard({
  label,
  value,
  caption,
}: {
  label: string;
  value: string;
  caption?: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-3 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="text-[11px] font-medium tracking-wide text-zinc-500 uppercase">
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
      {caption && (
        <div className="mt-1 text-[11px] text-zinc-500">{caption}</div>
      )}
    </div>
  );
}

function MetricPair({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] tracking-wide text-zinc-500 uppercase">
        {label}
      </div>
      <div className="mt-0.5 font-medium">{value}</div>
    </div>
  );
}

function ShareBar({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | null;
  tone: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2 text-[11px] text-zinc-500">
        <span>{label}</span>
        <span>{formatPercent(value)}</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
        <div
          className={`h-full rounded-full ${tone}`}
          style={{
            width: `${Math.max(0, Math.min(100, Math.round((value ?? 0) * 100)))}%`,
          }}
        />
      </div>
    </div>
  );
}
