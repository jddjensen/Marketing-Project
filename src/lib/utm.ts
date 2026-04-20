export type PlatformKey =
  | "meta"
  | "tiktok"
  | "youtube"
  | "google-search"
  | "website"
  | "email"
  | "sms"
  | "internal-messaging"
  | "digital-signage"
  | "ott"
  | "pr"
  | "signage"
  | "flyers";

export const PLATFORM_DEFAULTS: Record<PlatformKey, { source: string; medium: string }> = {
  meta: { source: "facebook", medium: "paid_social" },
  tiktok: { source: "tiktok", medium: "paid_social" },
  youtube: { source: "youtube", medium: "video" },
  "google-search": { source: "google", medium: "cpc" },
  website: { source: "website", medium: "owned" },
  email: { source: "email", medium: "email" },
  sms: { source: "sms", medium: "sms" },
  "internal-messaging": { source: "internal", medium: "message" },
  "digital-signage": { source: "digital_signage", medium: "offline" },
  ott: { source: "ott", medium: "video" },
  pr: { source: "pr", medium: "earned" },
  signage: { source: "signage", medium: "offline" },
  flyers: { source: "flyer", medium: "print" },
};

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export type UtmLinkShape = {
  id?: string | null;
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
  if (link.id) params.set("mt_link_id", link.id);
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
