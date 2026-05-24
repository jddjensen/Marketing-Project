import { NextRequest } from "next/server";
import { isUuid } from "@/lib/ids";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// The destination URL comes from the database (set by an authenticated user),
// but we still validate the protocol here so a malformed or javascript:/data:
// URL can never round-trip into a real redirect.
export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  if (!isUuid(id)) {
    return new Response("Not found", { status: 404 });
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("increment_click", {
    tracking_id: id,
  });
  if (error || typeof data !== "string" || data.length === 0) {
    return new Response("Not found", { status: 404 });
  }
  try {
    const parsed = new URL(data);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return new Response("Not found", { status: 404 });
    }
    return Response.redirect(parsed.toString(), 302);
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
