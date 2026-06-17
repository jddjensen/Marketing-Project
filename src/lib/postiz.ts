import type { PlatformKey } from "./utm";

const DEFAULT_POSTIZ_API_BASE_URL = "https://api.postiz.com";

export type PostizIntegration = {
  id: string;
  name: string;
  identifier: string;
  picture?: string | null;
  disabled?: boolean;
  profile?: string | null;
};

export type PostizUploadedMedia = {
  id: string;
  path: string;
  [key: string]: unknown;
};

export type PostizPostPayload = {
  type: "schedule";
  date: string;
  shortLink: false;
  tags: Array<{ value: string; label: string }>;
  posts: Array<{
    integration: { id: string };
    value: Array<{
      content: string;
      image: PostizUploadedMedia[];
    }>;
    settings: Record<string, unknown>;
  }>;
};

export type PostizConfig = {
  configured: boolean;
  baseUrl: string;
};

type PostizConfigWithSecret = PostizConfig & {
  apiKey: string | null;
};

export class PostizError extends Error {
  constructor(
    message: string,
    public status?: number,
    public details?: unknown
  ) {
    super(message);
    this.name = "PostizError";
  }
}

export function postizConfig(): PostizConfig {
  const config = postizConfigWithSecret();
  return { configured: config.configured, baseUrl: config.baseUrl };
}

function postizConfigWithSecret(): PostizConfigWithSecret {
  const apiKey = normalizeOptionalString(process.env.POSTIZ_API_KEY);
  return {
    configured: Boolean(apiKey),
    apiKey,
    baseUrl: normalizePostizBaseUrl(process.env.POSTIZ_API_BASE_URL),
  };
}

export function normalizePostizBaseUrl(value: string | undefined): string {
  const raw = normalizeOptionalString(value) ?? DEFAULT_POSTIZ_API_BASE_URL;
  return raw.replace(/\/+$/, "").replace(/\/public\/v1$/i, "");
}

export function postizIdentifiersForPlatform(platform: string): string[] {
  switch (platform) {
    case "meta":
      return ["facebook", "instagram", "instagram-standalone"];
    case "tiktok":
      return ["tiktok"];
    case "youtube":
      return ["youtube"];
    default:
      return [];
  }
}

export function isPostizPublishingPlatform(
  platform: string
): platform is Extract<PlatformKey, "meta" | "tiktok" | "youtube"> {
  return postizIdentifiersForPlatform(platform).length > 0;
}

export function filterPostizIntegrationsForPlatform(
  integrations: PostizIntegration[],
  platform: string
): PostizIntegration[] {
  const allowed = new Set(postizIdentifiersForPlatform(platform));
  if (allowed.size === 0) return [];
  return integrations.filter(
    (integration) =>
      allowed.has(integration.identifier) && integration.disabled !== true
  );
}

export async function listPostizIntegrations(): Promise<PostizIntegration[]> {
  return postizRequest<PostizIntegration[]>("/integrations", {
    method: "GET",
  });
}

export async function uploadPostizMediaFromUrl(
  url: string
): Promise<PostizUploadedMedia> {
  const uploaded = await postizRequest<PostizUploadedMedia>(
    "/upload-from-url",
    {
      method: "POST",
      body: JSON.stringify({ url }),
    }
  );
  if (!isPostizUploadedMedia(uploaded)) {
    throw new PostizError("Postiz returned an invalid upload response");
  }
  return uploaded;
}

export async function createPostizPost(
  payload: PostizPostPayload
): Promise<unknown> {
  return postizRequest<unknown>("/posts", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function buildPostizPostPayload({
  platform,
  integration,
  copy,
  media,
  publishAt,
  titleFallback,
  trackingUrl,
  slotKey,
}: {
  platform: string;
  integration: PostizIntegration;
  copy: Record<string, unknown> | null;
  media: PostizUploadedMedia | null;
  publishAt: string;
  titleFallback: string;
  trackingUrl?: string | null;
  slotKey?: string | null;
}): PostizPostPayload {
  const settings = postizSettingsFor({
    platform,
    integration,
    copy,
    titleFallback,
    slotKey,
  });
  const content = appendTrackingUrl(
    contentForPlatform(platform, copy, titleFallback),
    trackingUrl
  );

  return {
    type: "schedule",
    date: publishAt,
    shortLink: false,
    tags: [],
    posts: [
      {
        integration: { id: integration.id },
        value: [
          {
            content,
            image: media ? [media] : [],
          },
        ],
        settings,
      },
    ],
  };
}

function postizSettingsFor({
  platform,
  integration,
  copy,
  titleFallback,
  slotKey,
}: {
  platform: string;
  integration: PostizIntegration;
  copy: Record<string, unknown> | null;
  titleFallback: string;
  slotKey?: string | null;
}): Record<string, unknown> {
  const allowed = postizIdentifiersForPlatform(platform);
  if (!allowed.includes(integration.identifier)) {
    throw new PostizError("Selected Postiz channel does not match this board");
  }

  if (
    integration.identifier === "facebook" ||
    integration.identifier === "instagram" ||
    integration.identifier === "instagram-standalone"
  ) {
    return {
      __type: integration.identifier,
      post_type: isStorySlot(slotKey) ? "story" : "post",
    };
  }

  if (integration.identifier === "tiktok") {
    const title =
      stringFromCopy(copy, "caption")?.slice(0, 90) ||
      safeTitle(titleFallback).slice(0, 90);
    return {
      __type: "tiktok",
      title,
      privacy_level: "PUBLIC_TO_EVERYONE",
      duet: false,
      stitch: false,
      comment: true,
      autoAddMusic: "no",
      brand_content_toggle: false,
      brand_organic_toggle: false,
      content_posting_method: "DIRECT_POST",
    };
  }

  if (integration.identifier === "youtube") {
    return {
      __type: "youtube",
      title: stringFromCopy(copy, "title") || safeTitle(titleFallback),
      type: "private",
      selfDeclaredMadeForKids: "no",
      tags: stringListFromCopy(copy, "tags").map((tag) => ({
        value: tag,
        label: tag,
      })),
    };
  }

  throw new PostizError("Unsupported Postiz channel");
}

function contentForPlatform(
  platform: string,
  copy: Record<string, unknown> | null,
  titleFallback: string
): string {
  if (platform === "meta") {
    return (
      stringFromCopy(copy, "primaryText") ||
      stringFromCopy(copy, "headline") ||
      safeTitle(titleFallback)
    );
  }
  if (platform === "tiktok") {
    return stringFromCopy(copy, "caption") || safeTitle(titleFallback);
  }
  if (platform === "youtube") {
    return stringFromCopy(copy, "description") || safeTitle(titleFallback);
  }
  return safeTitle(titleFallback);
}

function appendTrackingUrl(
  content: string,
  trackingUrl?: string | null
): string {
  const cleanContent = content.trim();
  const cleanUrl = normalizeOptionalString(trackingUrl);
  if (!cleanUrl) return cleanContent;
  if (cleanContent.includes(cleanUrl)) return cleanContent;
  return cleanContent ? `${cleanContent}\n\n${cleanUrl}` : cleanUrl;
}

function stringFromCopy(
  copy: Record<string, unknown> | null,
  key: string
): string | null {
  const value = copy?.[key];
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function stringListFromCopy(
  copy: Record<string, unknown> | null,
  key: string
): string[] {
  const value = copy?.[key];
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function safeTitle(value: string): string {
  const trimmed = value.trim();
  return trimmed.length >= 2 ? trimmed : "Untitled creative";
}

function isStorySlot(slotKey?: string | null): boolean {
  return Boolean(slotKey && /(story|stories)/i.test(slotKey));
}

async function postizRequest<T>(path: string, init: RequestInit): Promise<T> {
  const config = postizConfigWithSecret();
  if (!config.apiKey) {
    throw new PostizError("Postiz is not configured");
  }

  const response = await fetch(`${config.baseUrl}/public/v1${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
      Authorization: config.apiKey,
    },
  });
  const text = await response.text();
  const body = parseJson(text);
  if (!response.ok) {
    throw new PostizError("Postiz request failed", response.status, body);
  }
  return body as T;
}

function parseJson(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function isPostizUploadedMedia(value: unknown): value is PostizUploadedMedia {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    typeof (value as { id?: unknown }).id === "string" &&
    typeof (value as { path?: unknown }).path === "string"
  );
}

function normalizeOptionalString(
  value: string | undefined | null
): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
