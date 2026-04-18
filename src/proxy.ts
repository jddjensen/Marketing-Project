import { NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const PUBLIC_PATHS = new Set(["/login", "/register", "/auth/callback"]);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isAuthApi = pathname.startsWith("/api/auth/");
  const isClickRedirect = pathname.startsWith("/c/");
  if (isAuthApi || isClickRedirect || PUBLIC_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  const { response, user } = await updateSession(request);

  if (!user) {
    if (pathname.startsWith("/api/")) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
