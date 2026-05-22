import { NextRequest, NextResponse } from "next/server";
import {
  decodeGoogleAccountEmail,
  exchangeGoogleAnalyticsOAuthCode,
  isGoogleAnalyticsError,
} from "@/lib/googleAnalytics";
import { isUuid } from "@/lib/ids";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const STATE_COOKIE = "ga_oauth_state";
const COOKIE_PATH = "/api/google-analytics/oauth";

type StateCookie = {
  nonce: string;
  projectId: string | null;
};

function decodeStateCookie(value: string | undefined) {
  if (!value) return null;
  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as StateCookie;
  } catch {
    return null;
  }
}

function redirectPath(projectId: string | null, status: "connected" | "error", reason?: string) {
  // Only build a /projects/<id> path when the id is a real UUID — the cookie
  // is httpOnly, but defense in depth keeps tampered values from being
  // interpolated into a redirect target.
  const safeProjectId = projectId && isUuid(projectId) ? projectId : null;
  const path = safeProjectId ? `/projects/${safeProjectId}` : "/";
  const params = new URLSearchParams({ ga: status });
  if (reason) params.set("reason", reason);
  return `${path}?${params.toString()}`;
}

function redirectWithClearedCookie(request: NextRequest, path: string) {
  const response = NextResponse.redirect(new URL(path, request.url));
  response.cookies.set(STATE_COOKIE, "", {
    httpOnly: true,
    maxAge: 0,
    path: COOKIE_PATH,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}

export async function GET(request: NextRequest) {
  const storedState = decodeStateCookie(request.cookies.get(STATE_COOKIE)?.value);
  const returnedState = request.nextUrl.searchParams.get("state");
  const projectId = storedState?.projectId ?? null;

  if (!storedState || storedState.nonce !== returnedState) {
    return redirectWithClearedCookie(request, redirectPath(projectId, "error", "state"));
  }

  const providerError = request.nextUrl.searchParams.get("error");
  if (providerError) {
    // Constrain to the standard OAuth2 error tokens so the reason in the
    // resulting URL can't be arbitrarily reflected by a malicious flow.
    const safe = /^[a-zA-Z0-9_-]{1,64}$/.test(providerError) ? providerError : "provider";
    return redirectWithClearedCookie(request, redirectPath(projectId, "error", safe));
  }

  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    return redirectWithClearedCookie(request, redirectPath(projectId, "error", "missing_code"));
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return redirectWithClearedCookie(request, redirectPath(projectId, "error", "login"));
  }

  try {
    const tokens = await exchangeGoogleAnalyticsOAuthCode({
      origin: request.nextUrl.origin,
      code,
    });
    const { data: existing } = await supabase
      .from("user_google_analytics_connections")
      .select("refresh_token")
      .eq("user_id", user.id)
      .maybeSingle();

    const refreshToken = tokens.refresh_token ?? existing?.refresh_token ?? null;
    if (!refreshToken) {
      return redirectWithClearedCookie(request, redirectPath(projectId, "error", "refresh"));
    }

    const { error } = await supabase.from("user_google_analytics_connections").upsert({
      user_id: user.id,
      account_email: decodeGoogleAccountEmail(tokens.id_token),
      access_token: tokens.access_token,
      refresh_token: refreshToken,
      token_expires_at: new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString(),
      scope: tokens.scope ?? null,
      connected_at: new Date().toISOString(),
    });

    if (error) {
      return redirectWithClearedCookie(request, redirectPath(projectId, "error", "save"));
    }

    return redirectWithClearedCookie(request, redirectPath(projectId, "connected"));
  } catch (error) {
    if (isGoogleAnalyticsError(error)) {
      return redirectWithClearedCookie(request, redirectPath(projectId, "error", "google"));
    }
    return redirectWithClearedCookie(request, redirectPath(projectId, "error", "unknown"));
  }
}
