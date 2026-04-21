"use client";

import { useCallback, useEffect, useState } from "react";
import type { PlatformKey } from "@/lib/utm";
type AnalyticsSettings = {
  ga4PropertyId: string | null;
  status: "ready" | "property_missing" | "credentials_missing";
  credentialsConfigured: boolean;
};

type ChannelBucketKey = PlatformKey | "all-channels";

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
  channels: Array<{
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
  }>;
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
  return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function statusTone(settings: AnalyticsSettings | null) {
  if (!settings) {
    return {
      className:
        "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300",
      label: "Loading analytics settings…",
    };
  }

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
      label: "Tracked clicks and QR scans are live. Add a GA4 property to unlock sessions, conversions, and revenue.",
    };
  }

  return {
    className:
      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200",
    label: "Tracked clicks and QR scans are live. Server-side Google Analytics credentials still need to be configured.",
  };
}

export function PerformanceDashboardPanel({ projectId }: { projectId: string }) {
  const [data, setData] = useState<PerformanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (refresh = false) => {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const suffix = refresh ? "?refresh=1" : "";
      const res = await fetch(`/api/projects/${projectId}/performance${suffix}`, {
        cache: "no-store",
      });
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
    let active = true;

    async function initialLoad() {
      const res = await fetch(`/api/projects/${projectId}/performance`, { cache: "no-store" });
      const body = (await res.json().catch(() => null)) as
        | (PerformanceResponse & { error?: string })
        | { error?: string }
        | null;

      if (!active) return;
      if (!res.ok) {
        setError(body?.error ?? "failed to load performance dashboard");
        setLoading(false);
        return;
      }

      setData(body as PerformanceResponse);
      setLoading(false);
    }

    void initialLoad();

    return () => {
      active = false;
    };
  }, [projectId]);

  const tone = statusTone(data?.analytics ?? null);
  const trendMax = Math.max(...(data?.trend.map((point) => point.sessions) ?? [0]), 1);

  return (
    <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">
            Unified Performance
          </h2>
          <p className="text-sm text-zinc-500 mt-1 max-w-3xl">
            One blended view of first-party tracked clicks, QR scans, and GA4 site behavior.
            Use tracked links for digital channels and QR for print/offline placements so the rollup stays complete.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {data?.lastSyncedAt && (
            <div className="text-xs text-zinc-500">Synced {relativeTime(data.lastSyncedAt)}</div>
          )}
          <button
            type="button"
            onClick={() => void load(true)}
            disabled={loading || refreshing}
            className="apple-tap rounded-md border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 px-3 py-2 text-sm font-medium disabled:opacity-40 hover:border-zinc-500"
          >
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      <div className={`rounded-lg border px-3 py-2 text-sm ${tone.className}`}>{tone.label}</div>

      {error ? (
        <div className="rounded-md border border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200 px-3 py-2 text-sm">
          {error}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <SummaryCard label="Clicks" value={loading ? "…" : formatInteger(data?.totals.clicks ?? 0)} />
            <SummaryCard label="Scans" value={loading ? "…" : formatInteger(data?.totals.scans ?? 0)} />
            <SummaryCard label="GA sessions" value={loading ? "…" : formatInteger(data?.totals.sessions ?? 0)} />
            <SummaryCard label="Conversions" value={loading ? "…" : formatInteger(data?.totals.conversions ?? 0)} />
            <SummaryCard label="Revenue" value={loading ? "…" : formatCurrency(data?.totals.revenue ?? 0)} />
            <SummaryCard label="Ticket sales" value={loading ? "…" : formatInteger(data?.totals.ticketSales ?? 0)} />
            <SummaryCard
              label="CPA"
              value={loading ? "…" : formatCurrency(data?.totals.cpa ?? null)}
              caption={
                data?.totals.cpaBasis === "ticket_sales"
                  ? "Based on ticket sales"
                  : data?.totals.cpaBasis === "conversions"
                    ? "Based on conversions"
                    : "Needs budget + outcomes"
              }
            />
            <SummaryCard
              label="ROAS"
              value={loading ? "…" : formatRoas(data?.totals.roas ?? null)}
              caption={
                data?.totals.budget !== null
                  ? `Budget ${formatCurrency(data?.totals.budget ?? null)}`
                  : "Add budget in campaign brief"
              }
            />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[1.25fr_0.9fr] gap-5">
            <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-4">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Channel Contribution
                  </div>
                  <div className="text-[11px] text-zinc-500 mt-1">
                    {loading
                      ? "Loading channel performance…"
                      : `${data?.trackedLinkCount ?? 0} tracked links currently feeding this rollup.`}
                  </div>
                </div>
              </div>

              {loading ? (
                <div className="text-sm text-zinc-500">Loading…</div>
              ) : data?.channels.length ? (
                <div className="space-y-2">
                  {data.channels.map((row) => (
                    <div
                      key={row.channel}
                      className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3"
                    >
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <div className="font-medium">{row.label}</div>
                          <div className="text-[11px] text-zinc-500 mt-1">
                            {row.linkCount} tracked {row.linkCount === 1 ? "link" : "links"} ·{" "}
                            {formatInteger(row.clicks)} clicks · {formatInteger(row.scans)} scans
                          </div>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                          <MetricPair label="Sessions" value={formatInteger(row.sessions)} />
                          <MetricPair label="Revenue" value={formatCurrency(row.revenue)} />
                          <MetricPair label="Session share" value={formatPercent(row.sessionsShare)} />
                          <MetricPair label="Revenue share" value={formatPercent(row.revenueShare)} />
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
                </div>
              ) : (
                <div className="text-sm text-zinc-500">
                  No tracked links yet. Add a landing page below and use the tracked link copy action to start building performance data.
                </div>
              )}
            </div>

            <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                14-Day Sessions Trend
              </div>
              <div className="text-[11px] text-zinc-500 mt-1">
                GA4-attributed activity across every mt_link_id attached to this project.
              </div>

              {loading ? (
                <div className="h-40 grid place-items-center text-sm text-zinc-500">Loading…</div>
              ) : data?.trend.length ? (
                <>
                  <div className="mt-4 h-40 flex items-end gap-2">
                    {data.trend.map((point) => (
                      <div key={point.date} className="flex-1 flex flex-col items-center justify-end gap-2">
                        <div
                          className="w-full rounded-t-md bg-sky-500/80 dark:bg-sky-400/80 min-h-2"
                          style={{
                            height: `${Math.max(
                              10,
                              Math.round((point.sessions / trendMax) * 100)
                            )}%`,
                          }}
                          title={`${formatTrendDate(point.date)} · ${point.sessions} sessions`}
                        />
                        <div className="text-[10px] text-zinc-500 rotate-[-35deg] origin-top-left whitespace-nowrap">
                          {formatTrendDate(point.date)}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-8 grid grid-cols-2 gap-2 text-sm">
                    <MetricPair
                      label="Trend revenue"
                      value={formatCurrency(
                        data.trend.reduce((sum, point) => sum + point.purchaseRevenue, 0)
                      )}
                    />
                    <MetricPair
                      label="Trend ticket sales"
                      value={formatInteger(
                        data.trend.reduce((sum, point) => sum + point.transactions, 0)
                      )}
                    />
                  </div>
                </>
              ) : (
                <div className="h-40 grid place-items-center text-sm text-zinc-500 text-center">
                  No GA4-attributed sessions yet. Tracked clicks and scans can start collecting immediately, and GA4 metrics will populate once linked traffic lands on the tagged site.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 px-3 py-2 text-xs text-zinc-500">
            Clicks count only when someone uses the tracked redirect link from this app. Scans count from QR visits. GA sessions, conversions, ticket sales, and revenue depend on the project&apos;s GA4 property and the destination site being tagged correctly.
          </div>
        </>
      )}
    </section>
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
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-3 py-3">
      <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
      {caption && <div className="mt-1 text-[11px] text-zinc-500">{caption}</div>}
    </div>
  );
}

function MetricPair({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</div>
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
      <div className="mt-1 h-2 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
        <div
          className={`h-full rounded-full ${tone}`}
          style={{ width: `${Math.max(0, Math.min(100, Math.round((value ?? 0) * 100)))}%` }}
        />
      </div>
    </div>
  );
}
