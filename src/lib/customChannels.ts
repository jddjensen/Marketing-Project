// Account-level custom channels. Users define a channel (kind + dimension
// formats) once; it then appears alongside the built-in CHANNELS list in the
// project create/add flows. Custom channels are addressed by a synthetic
// platform key `custom-<uuid>` so they can flow through the same
// project_platforms / media plumbing as built-in channels.

export const CUSTOM_CHANNEL_KINDS = [
  { key: "digital-ad", label: "Digital ad" },
  { key: "digital-static", label: "Digital static" },
  { key: "print", label: "Print" },
  { key: "video", label: "Video" },
  { key: "audio", label: "Audio" },
  { key: "other", label: "Other" },
] as const;

export type CustomChannelKind = (typeof CUSTOM_CHANNEL_KINDS)[number]["key"];

export const CUSTOM_CHANNEL_KIND_LABELS: Record<CustomChannelKind, string> =
  Object.fromEntries(
    CUSTOM_CHANNEL_KINDS.map((k) => [k.key, k.label])
  ) as Record<CustomChannelKind, string>;

export const CUSTOM_FORMAT_UNITS = ["px", "in", "ft", "cm", "m"] as const;
export type CustomFormatUnit = (typeof CUSTOM_FORMAT_UNITS)[number];

export type CustomChannelFormat = {
  id: string;
  label: string;
  width: number;
  height: number;
  unit: CustomFormatUnit;
};

export type CustomChannel = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  kind: CustomChannelKind;
  formats: CustomChannelFormat[];
  createdAt: number;
};

const CUSTOM_PLATFORM_PATTERN =
  /^custom-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function customPlatformKey(channelId: string): string {
  return `custom-${channelId}`;
}

export function isCustomPlatformKey(key: string): boolean {
  return CUSTOM_PLATFORM_PATTERN.test(key);
}

export function customChannelIdFromKey(key: string): string | null {
  return isCustomPlatformKey(key) ? key.slice("custom-".length) : null;
}

export function formatDimensionLabel(format: {
  width: number;
  height: number;
  unit: string;
}): string {
  const trim = (n: number) =>
    Number.isInteger(n) ? String(n) : String(Number(n.toFixed(3)));
  return `${trim(format.width)} × ${trim(format.height)} ${format.unit}`;
}
