import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  buildGoogleAnalyticsAuthorizationUrl,
  isGoogleAnalyticsError,
} from "@/lib/googleAnalytics";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const STATE_COOKIE = "ga_oauth_state";
const COOKIE_PATH = "/api/google-analytics/oauth";

type StateCookie = {
  nonce: string;
  projectId: string | null;
};

function encodeStateCookie(value: StateCookie) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const projectId = request.nextUrl.searchParams.get("projectId");
  const nonce = crypto.randomBytes(24).toString("base64url");

  try {
    const url = buildGoogleAnalyticsAuthorizationUrl({
      origin: request.nextUrl.origin,
      state: nonce,
    });
    const response = NextResponse.redirect(url);
    response.cookies.set(STATE_COOKIE, encodeStateCookie({ nonce, projectId }), {
      httpOnly: true,
      maxAge: 10 * 60,
      path: COOKIE_PATH,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    return response;
  } catch (error) {
    if (isGoogleAnalyticsError(error)) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return Response.json({ error: "failed to start Google Analytics connection" }, { status: 500 });
  }
}
