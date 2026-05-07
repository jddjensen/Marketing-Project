import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// When a user clicks the confirmation link in their email, Supabase Auth
// redirects them here with a code. We exchange that code for a session
// (which sets the auth cookie via createServerClient's cookie adapter), then
// redirect them into the app — to /login if something failed, or to the
// originally-requested page if `next` was preserved through the round trip.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", origin));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent("confirmation_failed")}`, origin)
    );
  }

  // Same-origin only — block external redirect attempts via the next param.
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  return NextResponse.redirect(new URL(safeNext, origin));
}
