export type PlatformKey = "meta" | "tiktok" | "youtube" | "google-search" | "signage";

export const PLATFORM_DEFAULTS: Record<PlatformKey, { source: string; medium: string }> = {
  meta: { source: "facebook", medium: "paid_social" },
  tiktok: { source: "tiktok", medium: "paid_social" },
  youtube: { source: "youtube", medium: "video" },
  "google-search": { source: "google", medium: "cpc" },
  signage: { source: "signage", medium: "offline" },
};

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export type UtmLinkShape = {
  url: string;
  platform: PlatformKey | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmTerm: string | null;
  utmContent: string | null;
};

export function buildUtmUrl(link: UtmLinkShape, campaignFallback: string): string {
  const raw = link.url?.trim();
  if (!raw) return "";
  let base: URL;
  try {
    base = new URL(raw);
  } catch {
    try {
      base = new URL(`https://${raw}`);
    } catch {
      return raw;
    }
  }
  const params = base.searchParams;
  const defaults = link.platform ? PLATFORM_DEFAULTS[link.platform] : null;
  const pairs: Array<[string, string | null]> = [
    ["utm_source", link.utmSource ?? defaults?.source ?? null],
    ["utm_medium", link.utmMedium ?? defaults?.medium ?? null],
    ["utm_campaign", link.utmCampaign ?? (campaignFallback ? slugify(campaignFallback) : null)],
    ["utm_term", link.utmTerm],
    ["utm_content", link.utmContent],
  ];
  for (const [k, v] of pairs) {
    if (v && v.trim().length > 0) params.set(k, v.trim());
  }
  base.search = params.toString();
  return base.toString();
}
