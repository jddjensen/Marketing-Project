import { NextRequest, NextResponse } from "next/server";

function redirectToIndex(request: NextRequest) {
  return NextResponse.redirect(new URL("/test-assets/index.html", request.url));
}

export function GET(request: NextRequest) {
  return redirectToIndex(request);
}

export function HEAD(request: NextRequest) {
  return redirectToIndex(request);
}
