const CUSTOM_ASPECTS: Record<string, string> = {
  "hero-slider": "aspect-[16/9]",
  "pop-up": "aspect-[4/5]",
  "landing-page": "aspect-[16/9]",
  blog: "aspect-[4/3]",
  "habitat-slider": "aspect-[16/9]",
  campaign: "aspect-[4/5]",
  flow: "aspect-[4/5]",
  "team-talk": "aspect-[4/3]",
  "front-desk-faq": "aspect-[4/3]",
  admission: "aspect-video",
  "info-desk": "aspect-video",
  "on-campus": "aspect-video",
  office: "aspect-video",
  "streaming-network-1": "aspect-video",
  "streaming-network-2": "aspect-video",
  youtube: "aspect-video",
  influencers: "aspect-[9/16]",
  "regional-utah": "aspect-[4/5]",
  national: "aspect-[4/5]",
};

export function aspectClassForAsset(key: string): string {
  if (key === "1x1") return "aspect-square";
  if (key === "9x16") return "aspect-[9/16]";
  if (key === "16x9") return "aspect-video";
  if (CUSTOM_ASPECTS[key]) return CUSTOM_ASPECTS[key];

  const ratio = key.match(/^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/);
  if (ratio) return `aspect-[${ratio[1]}/${ratio[2]}]`;

  return "aspect-square";
}

export function formatAssetLabel(key: string): string {
  const ratio = key.match(/^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/);
  if (ratio) return `${ratio[1]}:${ratio[2]}`;

  return key
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
