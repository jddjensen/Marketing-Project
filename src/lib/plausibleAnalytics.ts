const PLAUSIBLE_DEFAULT_BASE_URL = "https://plausible.io";
const SUMMARY_CACHE_TTL_MS = 15 * 60 * 1000;

type PlausibleServerConfig = {
  apiKey: string;
  apiBaseUrl: string;
};

export type PlausibleAnalyticsStatus =
  | "ready"
  | "site_missing"
  | "api_key_missing";

export type PlausibleAnalyticsProjectSettings = {
  siteId: string | null;
  status: PlausibleAnalyticsStatus;
  apiConfigured: boolean;
  apiBaseUrl: string;
};

export type PlausibleLinkUtmValues = {
  id: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
  utmTerm: string;
};

export type PlausibleProjectLinkMetrics = {
  sessions: number;
  engagedSessions: number;
  views: number;
  keyEvents: number;
  transactions: number;
  purchaseRevenue: number;
};

export type PlausibleProjectPerformanceSummary = {
  totals: PlausibleProjectLinkMetrics;
  byLink: Record<string, PlausibleProjectLinkMetrics>;
  trend: Array<{
    date: string;
    sessions: number;
    keyEvents: number;
    transactions: number;
    purchaseRevenue: number;
  }>;
  lastSyncedAt: number;
};

type PlausibleMetricValue =
  | number
  | string
  | null
  | {
      value?: number | string | null;
    };

type PlausibleStatsResponse = {
  results?: Array<{
    dimensions?: string[];
    metrics?: PlausibleMetricValue[];
  }>;
  error?: string | { message?: string };
};

type PlausibleQuery = {
  site_id: string;
  metrics: string[];
  date_range: [string, string];
  dimensions?: string[];
  filters?: unknown[];
  order_by?: Array<[string, "asc" | "desc"]>;
  pagination?: { limit: number; offset?: number };
};

const projectPerformanceCache = new Map<
  string,
  { value: PlausibleProjectPerformanceSummary; expiresAt: number }
>();

export class PlausibleAnalyticsError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
  }
}

function normalizeBaseUrl(raw: string | undefined) {
  const value = raw?.trim() || PLAUSIBLE_DEFAULT_BASE_URL;
  return value.replace(/\/+$/, "");
}

function readPlausibleServerConfig(): PlausibleServerConfig | null {
  const apiKey = process.env.PLAUSIBLE_API_KEY?.trim();
  if (!apiKey) return null;
  return {
    apiKey,
    apiBaseUrl: normalizeBaseUrl(process.env.PLAUSIBLE_API_BASE_URL),
  };
}

export function buildPlausibleProjectSettings(
  siteId: string | null
): PlausibleAnalyticsProjectSettings {
  const config = readPlausibleServerConfig();
  const normalizedSiteId = siteId?.trim() || null;
  return {
    siteId: normalizedSiteId,
    status: !config
      ? "api_key_missing"
      : normalizedSiteId
        ? "ready"
        : "site_missing",
    apiConfigured: Boolean(config),
    apiBaseUrl: config?.apiBaseUrl ?? normalizeBaseUrl(undefined),
  };
}

function emptyMetrics(): PlausibleProjectLinkMetrics {
  return {
    sessions: 0,
    engagedSessions: 0,
    views: 0,
    keyEvents: 0,
    transactions: 0,
    purchaseRevenue: 0,
  };
}

function toDateInput(timestamp: number) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeDimension(value: string | undefined) {
  if (!value || value === "(not set)") return "";
  return value;
}

function utmKey(values: {
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
  utmTerm: string;
}) {
  return [
    values.utmSource,
    values.utmMedium,
    values.utmCampaign,
    values.utmContent,
    values.utmTerm,
  ].join("\u0000");
}

function parseMetric(value: PlausibleMetricValue | undefined): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value) || 0;
  if (value && typeof value === "object") return Number(value.value) || 0;
  return 0;
}

function uniqueNonEmpty(values: string[]) {
  return Array.from(new Set(values.filter((value) => value.length > 0)));
}

function buildUtmFilters(linkValues: PlausibleLinkUtmValues[]) {
  const campaigns = uniqueNonEmpty(
    linkValues.map((value) => value.utmCampaign)
  );
  if (campaigns.length > 0) {
    return [["is", "visit:utm_campaign", campaigns]];
  }

  const sources = uniqueNonEmpty(linkValues.map((value) => value.utmSource));
  if (sources.length > 0) return [["is", "visit:utm_source", sources]];

  return [];
}

async function runPlausibleQuery(query: PlausibleQuery) {
  const config = readPlausibleServerConfig();
  if (!config) {
    throw new PlausibleAnalyticsError(
      "Plausible Stats API key is not configured",
      503
    );
  }

  const res = await fetch(`${config.apiBaseUrl}/api/v2/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(query),
    cache: "no-store",
  });

  const payload = (await res
    .json()
    .catch(() => null)) as PlausibleStatsResponse | null;

  if (!res.ok) {
    const message =
      typeof payload?.error === "string"
        ? payload.error
        : payload?.error?.message || "Plausible Stats API query failed";
    throw new PlausibleAnalyticsError(message, res.status || 502);
  }

  return payload ?? {};
}

export async function getPlausibleProjectPerformance(args: {
  siteId: string;
  linkValues: PlausibleLinkUtmValues[];
  createdAt: number;
  refresh?: boolean;
}) {
  const uniqueLinkValues = Array.from(
    new Map(args.linkValues.map((value) => [value.id, value])).values()
  ).sort((a, b) => a.id.localeCompare(b.id));
  const startDate = toDateInput(args.createdAt);
  const endDate = todayInput();
  const trendStartDate = toDateInput(
    Math.max(args.createdAt, Date.now() - 13 * 24 * 60 * 60 * 1000)
  );
  const cacheKey = `${args.siteId}:${startDate}:${uniqueLinkValues
    .map((value) => `${value.id}:${utmKey(value)}`)
    .join(",")}`;

  if (!args.refresh) {
    const cached = projectPerformanceCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }
  }

  if (uniqueLinkValues.length === 0) {
    const empty: PlausibleProjectPerformanceSummary = {
      totals: emptyMetrics(),
      byLink: {},
      trend: [],
      lastSyncedAt: Date.now(),
    };
    projectPerformanceCache.set(cacheKey, {
      value: empty,
      expiresAt: Date.now() + SUMMARY_CACHE_TTL_MS,
    });
    return empty;
  }

  const filters = buildUtmFilters(uniqueLinkValues);
  const linkIdsByUtm = new Map<string, string[]>();
  for (const value of uniqueLinkValues) {
    const key = utmKey(value);
    linkIdsByUtm.set(key, [...(linkIdsByUtm.get(key) ?? []), value.id]);
  }

  const [byUtmReport, trendReport] = await Promise.all([
    runPlausibleQuery({
      site_id: args.siteId,
      date_range: [startDate, endDate],
      metrics: ["visits", "pageviews"],
      dimensions: [
        "visit:utm_source",
        "visit:utm_medium",
        "visit:utm_campaign",
        "visit:utm_content",
        "visit:utm_term",
      ],
      filters,
      pagination: { limit: Math.max(100, uniqueLinkValues.length * 10) },
    }),
    runPlausibleQuery({
      site_id: args.siteId,
      date_range: [trendStartDate, endDate],
      metrics: ["visits"],
      dimensions: ["time:day"],
      filters,
      order_by: [["time:day", "asc"]],
      pagination: { limit: 14 },
    }),
  ]);

  const byLink: Record<string, PlausibleProjectLinkMetrics> = {};
  for (const row of byUtmReport.results ?? []) {
    const dimensions = row.dimensions ?? [];
    const key = utmKey({
      utmSource: normalizeDimension(dimensions[0]),
      utmMedium: normalizeDimension(dimensions[1]),
      utmCampaign: normalizeDimension(dimensions[2]),
      utmContent: normalizeDimension(dimensions[3]),
      utmTerm: normalizeDimension(dimensions[4]),
    });
    const linkIds = linkIdsByUtm.get(key);
    if (!linkIds?.length) continue;

    // Plausible groups by UTM values, not by this app's mt_link_id. If several
    // project links share the exact same UTM tuple, split the aggregate so
    // channel totals remain stable instead of double-counting the same visits.
    const divisor = linkIds.length;
    const sessions = parseMetric(row.metrics?.[0]) / divisor;
    const views = parseMetric(row.metrics?.[1]) / divisor;

    for (const linkId of linkIds) {
      const current = byLink[linkId] ?? emptyMetrics();
      current.sessions += sessions;
      current.views += views;
      byLink[linkId] = current;
    }
  }

  const totals = Object.values(byLink).reduce<PlausibleProjectLinkMetrics>(
    (acc, row) => ({
      sessions: acc.sessions + row.sessions,
      engagedSessions: acc.engagedSessions + row.engagedSessions,
      views: acc.views + row.views,
      keyEvents: acc.keyEvents + row.keyEvents,
      transactions: acc.transactions + row.transactions,
      purchaseRevenue: acc.purchaseRevenue + row.purchaseRevenue,
    }),
    emptyMetrics()
  );

  const value: PlausibleProjectPerformanceSummary = {
    totals,
    byLink,
    trend: (trendReport.results ?? []).map((row) => ({
      date: row.dimensions?.[0] ?? "",
      sessions: parseMetric(row.metrics?.[0]),
      keyEvents: 0,
      transactions: 0,
      purchaseRevenue: 0,
    })),
    lastSyncedAt: Date.now(),
  };

  projectPerformanceCache.set(cacheKey, {
    value,
    expiresAt: Date.now() + SUMMARY_CACHE_TTL_MS,
  });

  return value;
}

export function isPlausibleAnalyticsError(
  error: unknown
): error is PlausibleAnalyticsError {
  return error instanceof PlausibleAnalyticsError;
}
