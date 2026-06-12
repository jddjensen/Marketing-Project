import { NextRequest } from "next/server";
import { customPlatformKey } from "@/lib/customChannels";
import { isUuid } from "@/lib/ids";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function DELETE(
  _request: NextRequest,
  ctx: { params: Promise<{ channelId: string }> }
) {
  const { channelId } = await ctx.params;
  if (!isUuid(channelId))
    return Response.json({ error: "not found" }, { status: 404 });
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const key = customPlatformKey(channelId);
  const [platformUse, mediaUse] = await Promise.all([
    supabase
      .from("project_platforms")
      .select("project_id", { count: "exact", head: true })
      .eq("platform", key),
    supabase
      .from("media")
      .select("id", { count: "exact", head: true })
      .eq("platform", key),
  ]);
  if (platformUse.error || mediaUse.error) {
    return Response.json(
      { error: "failed to check channel usage" },
      { status: 500 }
    );
  }
  if ((platformUse.count ?? 0) > 0 || (mediaUse.count ?? 0) > 0) {
    return Response.json(
      {
        error:
          "channel is in use by a project or has media; remove it there first",
      },
      { status: 409 }
    );
  }

  const { error, count } = await supabase
    .from("custom_channels")
    .delete({ count: "exact" })
    .eq("id", channelId);
  if (error)
    return Response.json(
      { error: "failed to delete custom channel" },
      { status: 500 }
    );
  if (count === 0)
    return Response.json({ error: "not found" }, { status: 404 });
  return Response.json({ ok: true });
}
