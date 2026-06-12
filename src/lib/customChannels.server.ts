import { customChannelIdFromKey } from "@/lib/customChannels";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

type ServerSupabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

// A custom channel's upload slots are its dimension formats; the media `ratio`
// column stores the format uuid. Valid only when the format belongs to the
// channel referenced by the `custom-<uuid>` platform key.
export async function isCustomChannelSlot(
  supabase: ServerSupabase,
  platformKey: string,
  formatId: string
): Promise<boolean> {
  const channelId = customChannelIdFromKey(platformKey);
  if (!channelId) return false;
  const { data, error } = await supabase
    .from("custom_channel_formats")
    .select("id")
    .eq("id", formatId)
    .eq("channel_id", channelId)
    .maybeSingle();
  return !error && data != null;
}
