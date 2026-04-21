import { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildUtmUrl, type PlatformKey } from "@/lib/utm";

type Row = {
  id: string;
  url: string;
  platform: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  project_name: string | null;
};

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ linkId: string }> }
) {
  const { linkId } = await ctx.params;
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .rpc("resolve_public_tracking_link", { link_uuid: linkId })
    .single<Row>();

  if (!data) {
    return new Response("Not found", { status: 404 });
  }

  const target = buildUtmUrl(
    {
      id: data.id,
      url: data.url,
      platform: data.platform as PlatformKey | null,
      utmSource: data.utm_source,
      utmMedium: data.utm_medium,
      utmCampaign: data.utm_campaign,
      utmTerm: data.utm_term,
      utmContent: data.utm_content,
    },
    data.project_name ?? ""
  );

  if (!target) return new Response("Not found", { status: 404 });

  const ua = (request.headers.get("user-agent") ?? "").slice(0, 500) || null;
  const ref = (request.headers.get("referer") ?? "").slice(0, 500) || null;

  await supabase
    .from("project_tracking_link_clicks")
    .insert({ link_id: linkId, user_agent: ua, referrer: ref });

  return Response.redirect(target, 302);
}
