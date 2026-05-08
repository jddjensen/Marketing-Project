import type { PlatformKey } from "./utm";

// Per-platform copy field definitions. Drives both the UI form and the
// server-side validator. Field constraints reflect what each ad platform
// actually requires or recommends as of 2026.

type CopyFieldType = "text" | "textarea" | "list" | "select";

type CopyFieldOption = { value: string; label: string };

export type CopyField = {
  key: string;
  label: string;
  type: CopyFieldType;
  required?: boolean;
  hint?: string;
  // text / textarea
  maxLength?: number;
  recommendedLength?: number;
  // list
  minItems?: number;
  maxItems?: number;
  itemMaxLength?: number;
  // select
  options?: CopyFieldOption[];
};

const META_CTA_OPTIONS: CopyFieldOption[] = [
  { value: "learn_more", label: "Learn more" },
  { value: "shop_now", label: "Shop now" },
  { value: "sign_up", label: "Sign up" },
  { value: "subscribe", label: "Subscribe" },
  { value: "book_now", label: "Book now" },
  { value: "contact_us", label: "Contact us" },
  { value: "download", label: "Download" },
  { value: "get_offer", label: "Get offer" },
  { value: "watch_more", label: "Watch more" },
];

const GENERIC_CTA_OPTIONS: CopyFieldOption[] = [
  { value: "learn_more", label: "Learn more" },
  { value: "shop_now", label: "Shop now" },
  { value: "sign_up", label: "Sign up" },
  { value: "book_now", label: "Book now" },
  { value: "download", label: "Download" },
  { value: "contact_us", label: "Contact us" },
  { value: "get_started", label: "Get started" },
];

const PLATFORM_COPY_FIELDS: Record<PlatformKey, CopyField[]> = {
  meta: [
    {
      key: "primaryText",
      label: "Primary text",
      type: "textarea",
      maxLength: 500,
      recommendedLength: 125,
      hint: "Shown above the creative. ~125 chars before truncation on most placements.",
    },
    {
      key: "headline",
      label: "Headline",
      type: "text",
      maxLength: 40,
      hint: "40 chars max. Bold copy directly under the creative.",
    },
    {
      key: "description",
      label: "Description",
      type: "text",
      maxLength: 30,
      hint: "30 chars max. Shown on link ads beneath the headline.",
    },
    {
      key: "cta",
      label: "CTA button",
      type: "select",
      options: META_CTA_OPTIONS,
    },
  ],
  tiktok: [
    {
      key: "caption",
      label: "Caption",
      type: "textarea",
      maxLength: 2200,
      recommendedLength: 150,
      hint: "Up to 2,200 chars on organic; 100 on paid. Hashtags count toward the limit.",
    },
    {
      key: "displayName",
      label: "Display name",
      type: "text",
      maxLength: 40,
      hint: "Shown next to the @handle on the ad card.",
    },
    {
      key: "cta",
      label: "CTA button",
      type: "select",
      options: GENERIC_CTA_OPTIONS,
    },
  ],
  youtube: [
    {
      key: "title",
      label: "Title",
      type: "text",
      maxLength: 100,
      required: true,
      hint: "Up to 100 chars. The first ~60 are what most viewers see.",
    },
    {
      key: "description",
      label: "Description",
      type: "textarea",
      maxLength: 5000,
      hint: "Up to 5,000 chars. First ~200 chars show above the fold.",
    },
    {
      key: "tags",
      label: "Tags",
      type: "list",
      maxItems: 30,
      itemMaxLength: 30,
      hint: "Help YouTube categorize the video. 500 chars total across all tags.",
    },
  ],
  "google-search": [
    {
      key: "headlines",
      label: "Headlines",
      type: "list",
      minItems: 3,
      maxItems: 15,
      itemMaxLength: 30,
      required: true,
      hint: "Google requires at least 3 headlines, up to 15. 30 chars each.",
    },
    {
      key: "descriptions",
      label: "Descriptions",
      type: "list",
      minItems: 2,
      maxItems: 4,
      itemMaxLength: 90,
      required: true,
      hint: "Required: 2–4 descriptions, 90 chars each.",
    },
    {
      key: "displayPaths",
      label: "Display URL paths",
      type: "list",
      maxItems: 2,
      itemMaxLength: 15,
      hint: "Optional. Shown after your domain in the visible URL.",
    },
  ],
  email: [
    {
      key: "subject",
      label: "Subject line",
      type: "text",
      maxLength: 150,
      recommendedLength: 50,
      required: true,
      hint: "First impression in the inbox. ~50 chars before truncation on mobile.",
    },
    {
      key: "preheader",
      label: "Preheader / preview text",
      type: "text",
      maxLength: 150,
      recommendedLength: 90,
      hint: "Shown next to the subject in the inbox preview.",
    },
    {
      key: "headline",
      label: "Hero headline",
      type: "text",
      maxLength: 120,
    },
    {
      key: "body",
      label: "Body copy",
      type: "textarea",
      hint: "Plain text or markdown for the email body.",
    },
    {
      key: "cta",
      label: "CTA button text",
      type: "text",
      maxLength: 30,
    },
  ],
  sms: [
    {
      key: "message",
      label: "Message",
      type: "textarea",
      maxLength: 1600,
      recommendedLength: 160,
      required: true,
      hint: "160 chars per SMS segment. Longer messages split across segments.",
    },
    {
      key: "shortLink",
      label: "Short link override",
      type: "text",
      maxLength: 60,
      hint: "Optional. Use a tracking link's short URL here.",
    },
  ],
  "internal-messaging": [
    {
      key: "subject",
      label: "Subject / channel",
      type: "text",
      maxLength: 100,
    },
    {
      key: "body",
      label: "Message body",
      type: "textarea",
      required: true,
    },
  ],
  pr: [
    {
      key: "headline",
      label: "Headline",
      type: "text",
      maxLength: 120,
      required: true,
    },
    {
      key: "subhead",
      label: "Subhead",
      type: "text",
      maxLength: 200,
    },
    {
      key: "body",
      label: "Body",
      type: "textarea",
      required: true,
    },
    {
      key: "contact",
      label: "Press contact",
      type: "textarea",
      maxLength: 500,
    },
  ],
  website: [
    {
      key: "headline",
      label: "Headline",
      type: "text",
      maxLength: 120,
    },
    {
      key: "subhead",
      label: "Subhead",
      type: "text",
      maxLength: 240,
    },
    {
      key: "body",
      label: "Body",
      type: "textarea",
    },
    {
      key: "cta",
      label: "CTA button text",
      type: "text",
      maxLength: 30,
    },
    {
      key: "altText",
      label: "Image alt text",
      type: "text",
      maxLength: 200,
      hint: "For accessibility. Describes the image for screen readers.",
    },
  ],
  flyers: [
    {
      key: "headline",
      label: "Headline",
      type: "text",
      maxLength: 120,
    },
    {
      key: "body",
      label: "Body",
      type: "textarea",
    },
    {
      key: "cta",
      label: "CTA",
      type: "text",
      maxLength: 60,
    },
  ],
  signage: [
    {
      key: "headline",
      label: "Headline",
      type: "text",
      maxLength: 120,
    },
    {
      key: "cta",
      label: "CTA",
      type: "text",
      maxLength: 60,
    },
  ],
  "digital-signage": [
    {
      key: "headline",
      label: "Headline",
      type: "text",
      maxLength: 120,
    },
    {
      key: "cta",
      label: "CTA",
      type: "text",
      maxLength: 60,
    },
  ],
  ott: [
    {
      key: "headline",
      label: "Headline",
      type: "text",
      maxLength: 120,
    },
    {
      key: "cta",
      label: "CTA",
      type: "text",
      maxLength: 60,
    },
  ],
};

export function getCopyFields(platform: PlatformKey): CopyField[] {
  return PLATFORM_COPY_FIELDS[platform] ?? [];
}

export function platformSupportsTextOnly(platform: PlatformKey): boolean {
  // Text-only creatives make sense for channels where copy IS the creative.
  return ["email", "sms", "internal-messaging", "pr"].includes(platform);
}

type CopyValidationResult =
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; error: string };

export function validateCopy(
  platform: PlatformKey,
  raw: unknown
): CopyValidationResult {
  if (raw == null) return { ok: true, value: {} };
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "copy must be an object" };
  }
  const fields = getCopyFields(platform);
  const known = new Set(fields.map((f) => f.key));
  const input = raw as Record<string, unknown>;
  const value: Record<string, unknown> = {};

  // Reject unknown keys to keep the JSONB tidy.
  for (const key of Object.keys(input)) {
    if (!known.has(key)) {
      return { ok: false, error: `unknown copy field: ${key}` };
    }
  }

  for (const field of fields) {
    const v = input[field.key];

    if (field.type === "text" || field.type === "textarea" || field.type === "select") {
      if (v == null || v === "") {
        if (field.required) {
          return { ok: false, error: `${field.label} is required` };
        }
        continue;
      }
      if (typeof v !== "string") {
        return { ok: false, error: `${field.label} must be a string` };
      }
      const trimmed = v.trim();
      if (field.required && trimmed.length === 0) {
        return { ok: false, error: `${field.label} is required` };
      }
      if (field.maxLength != null && trimmed.length > field.maxLength) {
        return {
          ok: false,
          error: `${field.label} exceeds ${field.maxLength} chars (${trimmed.length})`,
        };
      }
      if (field.type === "select" && field.options) {
        const allowed = new Set(field.options.map((o) => o.value));
        if (!allowed.has(trimmed)) {
          return { ok: false, error: `${field.label}: invalid option` };
        }
      }
      value[field.key] = trimmed;
      continue;
    }

    if (field.type === "list") {
      if (v == null) {
        if (field.required) {
          return { ok: false, error: `${field.label} is required` };
        }
        continue;
      }
      if (!Array.isArray(v)) {
        return { ok: false, error: `${field.label} must be an array` };
      }
      const items: string[] = [];
      for (const item of v) {
        if (typeof item !== "string") {
          return { ok: false, error: `${field.label} items must be strings` };
        }
        const t = item.trim();
        if (t.length === 0) continue;
        if (field.itemMaxLength != null && t.length > field.itemMaxLength) {
          return {
            ok: false,
            error: `${field.label} item exceeds ${field.itemMaxLength} chars`,
          };
        }
        items.push(t);
      }
      if (field.required && items.length === 0) {
        return { ok: false, error: `${field.label} is required` };
      }
      if (field.minItems != null && items.length > 0 && items.length < field.minItems) {
        return {
          ok: false,
          error: `${field.label} needs at least ${field.minItems} items`,
        };
      }
      if (field.maxItems != null && items.length > field.maxItems) {
        return {
          ok: false,
          error: `${field.label} allows at most ${field.maxItems} items`,
        };
      }
      if (items.length > 0) value[field.key] = items;
      continue;
    }
  }

  return { ok: true, value };
}
