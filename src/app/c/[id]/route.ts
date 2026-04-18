import { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("increment_click", { tracking_id: id });
  if (error || !data) {
    return new Response("Not found", { status: 404 });
  }
  return Response.redirect(data, 302);
}
