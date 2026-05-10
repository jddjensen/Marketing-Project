import { createSign } from "node:crypto";

export const GOOGLE_ANALYTICS_SCOPE = "https://www.googleapis.com/auth/analytics.readonly";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_ANALYTICS_DATA_API = "https://analyticsdata.googleapis.com/v1beta";
const GOOGLE_ANALYTICS_ADMIN_API = "https://analyticsadmin.googleapis.com/v1beta";
const GOOGLE_OAUTH_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_OAUTH_SCOPES = ["openid", "email", "profile", GOOGLE_ANALYTICS_SCOPE];
const SUMMARY_CACHE_TTL_MS = 15 * 60 * 1000;
const ACCESS_TOKEN_SAFETY_MS = 60 * 1000;

type ServiceAccountCredentials = {
  client_email: string;
  private_key: string;
  token_uri?: string;
};

type RunReportRequest = {
  dateRanges: Array<{ startDate: string; endDate: string }>;
  dimensions?: Array<{ name: string }>;
  metrics: Array<{ name: string }>;
  dimensionFilter?: Record<string, unknown>;
  orderBys?: Array<Record<string, unknown>>;
  limit?: number;
};

type RunReportResponse = {
  rows?: Array<{
    dimensionValues?: Array<{ value?: string }>;
    metricValues?: Array<{ value?: string }>;
  }>;
};

type RunReportRow = NonNullable<RunReportResponse["rows"]>[number];

export type GoogleAnalyticsStatus =
  | "ready"
  | "property_missing"
  | "account_not_connected"
  | "credentials_missing";

export type GoogleAnalyticsAuthMode = "oauth" | "service_account" | null;

export type GoogleAnalyticsProjectSettings = {
  ga4PropertyId: string | null;
  status: GoogleAnalyticsStatus;
  credentialsConfigured: boolean;
  oauthConfigured: boolean;
  connected: boolean;
  accountEmail: string | null;
  authMode: GoogleAnalyticsAuthMode;
};

export type GoogleAnalyticsPropertyOption = {
  accountId: string;
  accountName: string;
  propertyId: string;
  propertyName: string;
  propertyResourceName: string;
};

type GoogleAnalyticsLinkSummary = {
  sessions: number;
  engagedSessions: number;
  views: number;
  keyEvents: number;
  trend: Array<{
    date: string;
    sessions: number;
    views: number;
    keyEvents: number;
  }>;
  lastSyncedAt: number;
};

export type GoogleAnalyticsProjectLinkMetrics = {
  sessions: number;
  engagedSessions: number;
  views: number;
  keyEvents: number;
  transactions: number;
  purchaseRevenue: number;
};

type GoogleAnalyticsProjectPerformanceSummary = {
  totals: GoogleAnalyticsProjectLinkMetrics;
  byLink: Record<string, GoogleAnalyticsProjectLinkMetrics>;
  trend: Array<{
    date: string;
    sessions: number;
    keyEvents: number;
    transactions: number;
    purchaseRevenue: number;
  }>;
  lastSyncedAt: number;
};

type GoogleOAuthConfig = {
  clientId: string;
  clientSecret: string;
};

type GoogleOAuthTokenResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
};

type GoogleAnalyticsConnectionRow = {
  access_token: string;
  refresh_token: string | null;
  token_expires_at: string;
  account_email: string | null;
};

type AccountSummariesResponse = {
  accountSummaries?: Array<{
    account?: string;
    displayName?: string;
    propertySummaries?: Array<{
      property?: string;
      displayName?: string;
    }>;
  }>;
  nextPageToken?: string;
  error?: { message?: string };
};

class GoogleAnalyticsError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "GoogleAnalyticsError";
    this.status = status;
  }
}

let accessTokenCache: { token: string; expiresAt: number } | null = null;
const summaryCache = new Map<
  string,
  { expiresAt: number; value: GoogleAnalyticsLinkSummary }
>();
const projectPerformanceCache = new Map<
  string,
  { expiresAt: number; value: GoogleAnalyticsProjectPerformanceSummary }
>();

function base64Url(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

function readServiceAccountCredentials(): ServiceAccountCredentials | null {
  const inlineJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (inlineJson) {
    try {
      const parsed = JSON.parse(inlineJson) as Partial<ServiceAccountCredentials>;
      if (parsed.client_email && parsed.private_key) {
        return {
          client_email: parsed.client_email,
          private_key: parsed.private_key.replace(/\\n/g, "\n"),
          token_uri: parsed.token_uri || GOOGLE_TOKEN_URL,
        };
      }
    } catch {
      return null;
    }
  }

  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.trim();
  if (!clientEmail || !privateKey) return null;

  return {
    client_email: clientEmail,
    private_key: privateKey.replace(/\\n/g, "\n"),
    token_uri: GOOGLE_TOKEN_URL,
  };
}

function getGoogleAnalyticsCredentialsConfigured() {
  return readServiceAccountCredentials() !== null;
}

function readGoogleOAuthConfig(): GoogleOAuthConfig | null {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function getGoogleAnalyticsOAuthConfigured() {
  return readGoogleOAuthConfig() !== null;
}

export function buildGoogleAnalyticsRedirectUri(origin: string) {
  return `${origin.replace(/\/$/, "")}/api/google-analytics/oauth/callback`;
}

export function buildGoogleAnalyticsAuthorizationUrl(args: {
  origin: string;
  state: string;
}) {
  const config = readGoogleOAuthConfig();
  if (!config) {
    throw new GoogleAnalyticsError("Google OAuth is not configured", 503);
  }

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: buildGoogleAnalyticsRedirectUri(args.origin),
    response_type: "code",
    scope: GOOGLE_OAUTH_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state: args.state,
  });

  return `${GOOGLE_OAUTH_AUTH_URL}?${params.toString()}`;
}

export async function exchangeGoogleAnalyticsOAuthCode(args: {
  origin: string;
  code: string;
}) {
  const config = readGoogleOAuthConfig();
  if (!config) {
    throw new GoogleAnalyticsError("Google OAuth is not configured", 503);
  }

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code: args.code,
      grant_type: "authorization_code",
      redirect_uri: buildGoogleAnalyticsRedirectUri(args.origin),
    }),
    cache: "no-store",
  });

  const body = (await res.json().catch(() => null)) as GoogleOAuthTokenResponse | null;
  if (!res.ok || !body?.access_token || !body.expires_in) {
    throw new GoogleAnalyticsError(
      body?.error_description || body?.error || "Failed to connect Google Analytics",
      res.status || 502
    );
  }

  return body;
}

export function decodeGoogleAccountEmail(idToken: string | undefined) {
  if (!idToken) return null;
  const payload = idToken.split(".")[1];
  if (!payload) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      email?: unknown;
    };
    return typeof parsed.email === "string" ? parsed.email : null;
  } catch {
    return null;
  }
}

async function loadGoogleAnalyticsConnection(
  supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createSupabaseServerClient>>,
  userId: string
) {
  const { data, error } = await supabase
    .from("user_google_analytics_connections")
    .select("access_token, refresh_token, token_expires_at, account_email")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new GoogleAnalyticsError("Failed to load Google Analytics connection", 500);
  }

  return (data ?? null) as GoogleAnalyticsConnectionRow | null;
}

export async function buildGoogleAnalyticsProjectSettings(
  supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createSupabaseServerClient>>,
  ga4PropertyId: string | null,
  userId: string | null
): Promise<GoogleAnalyticsProjectSettings> {
  const serviceCredentialsConfigured = getGoogleAnalyticsCredentialsConfigured();
  const oauthConfigured = getGoogleAnalyticsOAuthConfigured();
  const connection = userId ? await loadGoogleAnalyticsConnection(supabase, userId) : null;
  const connected = Boolean(connection);
  const authMode: GoogleAnalyticsAuthMode = connected
    ? "oauth"
    : serviceCredentialsConfigured
      ? "service_account"
      : null;
  const credentialsConfigured = authMode !== null;

  const status: GoogleAnalyticsStatus = !credentialsConfigured
    ? oauthConfigured
      ? "account_not_connected"
      : "credentials_missing"
    : ga4PropertyId
      ? "ready"
      : "property_missing";

  return {
    ga4PropertyId,
    credentialsConfigured,
    oauthConfigured,
    connected,
    accountEmail: connection?.account_email ?? null,
    authMode,
    status,
  };
}

function buildJwtAssertion(credentials: ServiceAccountCredentials) {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const tokenUrl = credentials.token_uri || GOOGLE_TOKEN_URL;
  const header = { alg: "RS256", typ: "JWT" };
  const claimSet = {
    iss: credentials.client_email,
    scope: GOOGLE_ANALYTICS_SCOPE,
    aud: tokenUrl,
    exp: nowSeconds + 3600,
    iat: nowSeconds,
  };

  const encodedHeader = base64Url(JSON.stringify(header));
  const encodedClaimSet = base64Url(JSON.stringify(claimSet));
  const signer = createSign("RSA-SHA256");
  signer.update(`${encodedHeader}.${encodedClaimSet}`);
  signer.end();
  const signature = signer.sign(credentials.private_key);

  return `${encodedHeader}.${encodedClaimSet}.${base64Url(signature)}`;
}

async function getGoogleAccessToken() {
  if (accessTokenCache && accessTokenCache.expiresAt > Date.now() + ACCESS_TOKEN_SAFETY_MS) {
    return accessTokenCache.token;
  }

  const credentials = readServiceAccountCredentials();
  if (!credentials) {
    throw new GoogleAnalyticsError("Google Analytics credentials are not configured", 503);
  }

  const res = await fetch(credentials.token_uri || GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: buildJwtAssertion(credentials),
    }),
    cache: "no-store",
  });

  const body = (await res.json().catch(() => null)) as
    | { access_token?: string; expires_in?: number; error_description?: string; error?: string }
    | null;

  if (!res.ok || !body?.access_token || !body.expires_in) {
    throw new GoogleAnalyticsError(
      body?.error_description || body?.error || "Failed to authenticate with Google Analytics",
      res.status || 502
    );
  }

  accessTokenCache = {
    token: body.access_token,
    expiresAt: Date.now() + body.expires_in * 1000,
  };

  return body.access_token;
}

export async function getUserGoogleAnalyticsAccessToken(
  supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createSupabaseServerClient>>,
  userId: string
) {
  const connection = await loadGoogleAnalyticsConnection(supabase, userId);
  if (!connection) {
    throw new GoogleAnalyticsError("Connect Google Analytics before loading GA4 data", 401);
  }

  if (new Date(connection.token_expires_at).getTime() > Date.now() + ACCESS_TOKEN_SAFETY_MS) {
    return connection.access_token;
  }

  if (!connection.refresh_token) {
    throw new GoogleAnalyticsError("Reconnect Google Analytics to refresh access", 401);
  }

  const config = readGoogleOAuthConfig();
  if (!config) {
    throw new GoogleAnalyticsError("Google OAuth is not configured", 503);
  }

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: connection.refresh_token,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });

  const body = (await res.json().catch(() => null)) as GoogleOAuthTokenResponse | null;
  if (!res.ok || !body?.access_token || !body.expires_in) {
    throw new GoogleAnalyticsError(
      body?.error_description || body?.error || "Failed to refresh Google Analytics access",
      res.status || 502
    );
  }

  const expiresAt = new Date(Date.now() + body.expires_in * 1000).toISOString();
  await supabase
    .from("user_google_analytics_connections")
    .update({
      access_token: body.access_token,
      token_expires_at: expiresAt,
      scope: body.scope ?? null,
    })
    .eq("user_id", userId);

  return body.access_token;
}

async function runGoogleAnalyticsReport(
  propertyId: string,
  body: RunReportRequest,
  accessToken?: string | null
) {
  const token = accessToken ?? (await getGoogleAccessToken());
  const res = await fetch(`${GOOGLE_ANALYTICS_DATA_API}/properties/${propertyId}:runReport`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const payload = (await res.json().catch(() => null)) as
    | (RunReportResponse & { error?: { message?: string } })
    | null;

  if (!res.ok) {
    throw new GoogleAnalyticsError(
      payload?.error?.message || "Google Analytics report failed",
      res.status || 502
    );
  }

  return payload ?? {};
}

function toDateInput(timestamp: number) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function parseMetric(row: RunReportRow | undefined, index: number) {
  return Number(row?.metricValues?.[index]?.value ?? 0);
}

function parseGoogleDate(value: string | undefined) {
  if (!value || value.length !== 8) return value ?? "";
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

function emptyProjectMetrics(): GoogleAnalyticsProjectLinkMetrics {
  return {
    sessions: 0,
    engagedSessions: 0,
    views: 0,
    keyEvents: 0,
    transactions: 0,
    purchaseRevenue: 0,
  };
}

function buildLandingPageFilter(linkId: string) {
  return {
    filter: {
      fieldName: "landingPagePlusQueryString",
      stringFilter: {
        matchType: "CONTAINS",
        value: `mt_link_id=${linkId}`,
      },
    },
  };
}

function buildTrackingLinksFilter(linkIds: string[]) {
  if (linkIds.length === 1) {
    return buildLandingPageFilter(linkIds[0]);
  }

  return {
    orGroup: {
      expressions: linkIds.map((linkId) => buildLandingPageFilter(linkId)),
    },
  };
}

function extractLinkIdFromLandingPage(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value, "https://tracking.local");
    return url.searchParams.get("mt_link_id");
  } catch {
    const match = value.match(/[?&]mt_link_id=([^&#]+)/);
    return match?.[1] ? decodeURIComponent(match[1]) : null;
  }
}

export async function getGoogleAnalyticsLinkSummary(args: {
  propertyId: string;
  linkId: string;
  createdAt: number;
  refresh?: boolean;
  accessToken?: string | null;
}) {
  const totalStartDate = toDateInput(args.createdAt);
  const trendStartDate = toDateInput(Math.max(args.createdAt, Date.now() - 13 * 24 * 60 * 60 * 1000));
  const cacheKey = `${args.propertyId}:${args.linkId}:${totalStartDate}`;

  if (!args.refresh) {
    const cached = summaryCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }
  }

  const metrics = [
    { name: "sessions" },
    { name: "engagedSessions" },
    { name: "screenPageViews" },
    { name: "keyEvents" },
  ];

  const filter = buildLandingPageFilter(args.linkId);
  const [totalsReport, trendReport] = await Promise.all([
    runGoogleAnalyticsReport(args.propertyId, {
      dateRanges: [{ startDate: totalStartDate, endDate: "today" }],
      metrics,
      dimensionFilter: filter,
    }, args.accessToken),
    runGoogleAnalyticsReport(args.propertyId, {
      dateRanges: [{ startDate: trendStartDate, endDate: "today" }],
      dimensions: [{ name: "date" }],
      metrics,
      dimensionFilter: filter,
      orderBys: [{ dimension: { dimensionName: "date" } }],
      limit: 14,
    }, args.accessToken),
  ]);

  const totalRow = totalsReport.rows?.[0];
  const value: GoogleAnalyticsLinkSummary = {
    sessions: parseMetric(totalRow, 0),
    engagedSessions: parseMetric(totalRow, 1),
    views: parseMetric(totalRow, 2),
    keyEvents: parseMetric(totalRow, 3),
    trend: (trendReport.rows ?? []).map((row) => ({
      date: parseGoogleDate(row.dimensionValues?.[0]?.value),
      sessions: parseMetric(row, 0),
      views: parseMetric(row, 2),
      keyEvents: parseMetric(row, 3),
    })),
    lastSyncedAt: Date.now(),
  };

  summaryCache.set(cacheKey, {
    value,
    expiresAt: Date.now() + SUMMARY_CACHE_TTL_MS,
  });

  return value;
}

export async function getGoogleAnalyticsProjectPerformance(args: {
  propertyId: string;
  linkIds: string[];
  createdAt: number;
  refresh?: boolean;
  accessToken?: string | null;
}) {
  const uniqueLinkIds = Array.from(new Set(args.linkIds)).sort();
  const startDate = toDateInput(args.createdAt);
  const trendStartDate = toDateInput(
    Math.max(args.createdAt, Date.now() - 13 * 24 * 60 * 60 * 1000)
  );
  const cacheKey = `${args.propertyId}:${startDate}:${uniqueLinkIds.join(",")}`;

  if (!args.refresh) {
    const cached = projectPerformanceCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }
  }

  if (uniqueLinkIds.length === 0) {
    const empty: GoogleAnalyticsProjectPerformanceSummary = {
      totals: emptyProjectMetrics(),
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

  const metrics = [
    { name: "sessions" },
    { name: "engagedSessions" },
    { name: "screenPageViews" },
    { name: "keyEvents" },
    { name: "transactions" },
    { name: "purchaseRevenue" },
  ];

  const filter = buildTrackingLinksFilter(uniqueLinkIds);
  const [byLinkReport, trendReport] = await Promise.all([
    runGoogleAnalyticsReport(args.propertyId, {
      dateRanges: [{ startDate, endDate: "today" }],
      dimensions: [{ name: "landingPagePlusQueryString" }],
      metrics,
      dimensionFilter: filter,
      limit: Math.max(100, uniqueLinkIds.length * 10),
    }, args.accessToken),
    runGoogleAnalyticsReport(args.propertyId, {
      dateRanges: [{ startDate: trendStartDate, endDate: "today" }],
      dimensions: [{ name: "date" }],
      metrics,
      dimensionFilter: filter,
      orderBys: [{ dimension: { dimensionName: "date" } }],
      limit: 14,
    }, args.accessToken),
  ]);

  const allowed = new Set(uniqueLinkIds);
  const byLink: Record<string, GoogleAnalyticsProjectLinkMetrics> = {};

  for (const row of byLinkReport.rows ?? []) {
    const linkId = extractLinkIdFromLandingPage(row.dimensionValues?.[0]?.value);
    if (!linkId || !allowed.has(linkId)) continue;
    const current = byLink[linkId] ?? emptyProjectMetrics();
    current.sessions += parseMetric(row, 0);
    current.engagedSessions += parseMetric(row, 1);
    current.views += parseMetric(row, 2);
    current.keyEvents += parseMetric(row, 3);
    current.transactions += parseMetric(row, 4);
    current.purchaseRevenue += parseMetric(row, 5);
    byLink[linkId] = current;
  }

  const totals = Object.values(byLink).reduce<GoogleAnalyticsProjectLinkMetrics>(
    (acc, row) => ({
      sessions: acc.sessions + row.sessions,
      engagedSessions: acc.engagedSessions + row.engagedSessions,
      views: acc.views + row.views,
      keyEvents: acc.keyEvents + row.keyEvents,
      transactions: acc.transactions + row.transactions,
      purchaseRevenue: acc.purchaseRevenue + row.purchaseRevenue,
    }),
    emptyProjectMetrics()
  );

  const value: GoogleAnalyticsProjectPerformanceSummary = {
    totals,
    byLink,
    trend: (trendReport.rows ?? []).map((row) => ({
      date: parseGoogleDate(row.dimensionValues?.[0]?.value),
      sessions: parseMetric(row, 0),
      keyEvents: parseMetric(row, 3),
      transactions: parseMetric(row, 4),
      purchaseRevenue: parseMetric(row, 5),
    })),
    lastSyncedAt: Date.now(),
  };

  projectPerformanceCache.set(cacheKey, {
    value,
    expiresAt: Date.now() + SUMMARY_CACHE_TTL_MS,
  });

  return value;
}

export function isGoogleAnalyticsError(error: unknown): error is GoogleAnalyticsError {
  return error instanceof GoogleAnalyticsError;
}

export async function listGoogleAnalyticsProperties(accessToken: string) {
  const properties: GoogleAnalyticsPropertyOption[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(`${GOOGLE_ANALYTICS_ADMIN_API}/accountSummaries`);
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    const body = (await res.json().catch(() => null)) as AccountSummariesResponse | null;

    if (!res.ok) {
      throw new GoogleAnalyticsError(
        body?.error?.message || "Failed to list Google Analytics properties",
        res.status || 502
      );
    }

    for (const account of body?.accountSummaries ?? []) {
      const accountId = account.account?.replace(/^accounts\//, "") ?? "";
      for (const property of account.propertySummaries ?? []) {
        const propertyId = property.property?.replace(/^properties\//, "") ?? "";
        if (!propertyId) continue;
        properties.push({
          accountId,
          accountName: account.displayName ?? accountId,
          propertyId,
          propertyName: property.displayName ?? propertyId,
          propertyResourceName: property.property ?? `properties/${propertyId}`,
        });
      }
    }

    pageToken = body?.nextPageToken;
  } while (pageToken);

  return properties.sort((a, b) =>
    `${a.accountName} ${a.propertyName}`.localeCompare(`${b.accountName} ${b.propertyName}`)
  );
}
