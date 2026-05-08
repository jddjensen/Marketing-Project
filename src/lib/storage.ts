import type { SupabaseClient } from "@supabase/supabase-js";

export const CREATIVES_BUCKET = "creatives";

// 1 hour matches typical session UI patterns; the frontend re-fetches media
// lists on mount and after upload, so URLs stay fresh in normal use.
const SIGNED_URL_TTL_SECONDS = 3600;

export async function signedMediaUrl(
  supabase: SupabaseClient,
  storagePath: string,
  ttlSeconds: number = SIGNED_URL_TTL_SECONDS
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(CREATIVES_BUCKET)
    .createSignedUrl(storagePath, ttlSeconds);
  if (error || !data) return null;
  return data.signedUrl;
}

export async function signedMediaUrls(
  supabase: SupabaseClient,
  storagePaths: string[],
  ttlSeconds: number = SIGNED_URL_TTL_SECONDS
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (storagePaths.length === 0) return out;
  const { data, error } = await supabase.storage
    .from(CREATIVES_BUCKET)
    .createSignedUrls(storagePaths, ttlSeconds);
  if (error || !data) return out;
  for (const row of data) {
    if (row.path && row.signedUrl) out.set(row.path, row.signedUrl);
  }
  return out;
}
