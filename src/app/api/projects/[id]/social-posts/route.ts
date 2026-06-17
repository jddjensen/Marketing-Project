import { NextRequest } from "next/server";
import { isUuid } from "@/lib/ids";
import {
  buildPostizPostPayload,
  createPostizPost,
  filterPostizIntegrationsForPlatform,
  isPostizPublishingPlatform,
  listPostizIntegrations,
  postizConfig,
  PostizError,
  uploadPostizMediaFromUrl,
  type PostizIntegration,
  type PostizUploadedMedia,
} from "@/lib/postiz";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { signedMediaUrl } from "@/lib/storage";

type SocialPostRow = {
  id: string;
  project_id: string;
  creative_id: string;
  media_version_id: string | null;
  tracking_link_id: string | null;
  platform: string;
  postiz_post_id: string | null;
  postiz_integration_id: string;
  postiz_integration_identifier: string;
  postiz_integration_name: string;
  state: string;
  publish_at: string | null;
  content: string;
  settings: Record<string, unknown> | null;
  error: string | null;
  created_at: string;
};

type MediaRow = {
  id: string;
  creative_id: string;
  project_id: string;
  platform: string;
  ratio: string;
  storage_path: string | null;
  original_name: string | null;
  kind: "image" | "video" | "text";
  copy: Record<string, unknown> | null;
};

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  if (!isUuid(id))
    return Response.json({ error: "not found" }, { status: 404 });

  const platform = request.nextUrl.searchParams.get("platform");
  if (platform && !isPostizPublishingPlatform(platform)) {
    return Response.json({ error: "unsupported platform" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("social_posts")
    .select(
      "id, project_id, creative_id, media_version_id, tracking_link_id, platform, postiz_post_id, postiz_integration_id, postiz_integration_identifier, postiz_integration_name, state, publish_at, content, settings, error, created_at"
    )
    .eq("project_id", id)
    .order("created_at", { ascending: false });

  if (platform) query = query.eq("platform", platform);

  const { data, error } = await query;
  if (error) {
    return Response.json(
      { error: "failed to load social posts" },
      { status: 500 }
    );
  }

  const config = postizConfig();
  let integrations: PostizIntegration[] = [];
  let postizError: string | null = null;
  if (config.configured) {
    try {
      const allIntegrations = await listPostizIntegrations();
      integrations = platform
        ? filterPostizIntegrationsForPlatform(allIntegrations, platform)
        : allIntegrations;
    } catch {
      postizError = "failed to load Postiz channels";
    }
  }

  return Response.json({
    configured: config.configured,
    baseUrl: config.baseUrl,
    integrations,
    posts: ((data ?? []) as SocialPostRow[]).map(serializeSocialPost),
    postizError,
  });
}

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  if (!isUuid(id))
    return Response.json({ error: "not found" }, { status: 404 });

  if (!postizConfig().configured) {
    return Response.json(
      { error: "Postiz is not configured" },
      { status: 409 }
    );
  }

  const body = (await request.json().catch(() => null)) as {
    creativeId?: unknown;
    versionId?: unknown;
    integrationId?: unknown;
    publishAt?: unknown;
    trackingLinkId?: unknown;
  } | null;

  const creativeId =
    typeof body?.creativeId === "string" ? body.creativeId : "";
  const versionId = typeof body?.versionId === "string" ? body.versionId : "";
  const integrationId =
    typeof body?.integrationId === "string" ? body.integrationId.trim() : "";
  const publishAt = normalizePublishAt(body?.publishAt);
  const trackingLinkId =
    typeof body?.trackingLinkId === "string" && body.trackingLinkId
      ? body.trackingLinkId
      : null;

  if (!isUuid(creativeId) || !isUuid(versionId)) {
    return Response.json({ error: "invalid creative" }, { status: 400 });
  }
  if (!integrationId) {
    return Response.json({ error: "Postiz channel required" }, { status: 400 });
  }
  if (!publishAt) {
    return Response.json(
      { error: "valid publish date required" },
      { status: 400 }
    );
  }
  if (trackingLinkId && !isUuid(trackingLinkId)) {
    return Response.json({ error: "invalid tracking link" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: media, error: mediaError } = await supabase
    .from("media")
    .select(
      "id, creative_id, project_id, platform, ratio, storage_path, original_name, kind, copy"
    )
    .eq("id", versionId)
    .eq("creative_id", creativeId)
    .eq("project_id", id)
    .maybeSingle();

  if (mediaError) {
    return Response.json({ error: "failed to load creative" }, { status: 500 });
  }
  if (!media) {
    return Response.json({ error: "creative not found" }, { status: 404 });
  }

  const mediaRow = media as MediaRow;
  if (!isPostizPublishingPlatform(mediaRow.platform)) {
    return Response.json({ error: "unsupported platform" }, { status: 400 });
  }

  let trackingUrl: string | null = null;
  if (trackingLinkId) {
    const { data: tracking, error: trackingError } = await supabase
      .from("project_tracking_links")
      .select("id")
      .eq("id", trackingLinkId)
      .eq("project_id", id)
      .maybeSingle();
    if (trackingError) {
      return Response.json(
        { error: "failed to load tracking link" },
        { status: 500 }
      );
    }
    if (!tracking) {
      return Response.json(
        { error: "tracking link not found" },
        { status: 404 }
      );
    }
    trackingUrl = `${request.nextUrl.origin}/go/${trackingLinkId}`;
  }

  let integrations: PostizIntegration[];
  try {
    integrations = filterPostizIntegrationsForPlatform(
      await listPostizIntegrations(),
      mediaRow.platform
    );
  } catch (error) {
    return postizFailure(error);
  }

  const integration = integrations.find((item) => item.id === integrationId);
  if (!integration) {
    return Response.json(
      { error: "Postiz channel not found for this board" },
      { status: 400 }
    );
  }

  let postizMedia: PostizUploadedMedia | null = null;
  if (mediaRow.kind !== "text") {
    if (!mediaRow.storage_path) {
      return Response.json(
        { error: "creative media is missing" },
        { status: 400 }
      );
    }
    const url = await signedMediaUrl(supabase, mediaRow.storage_path, 900);
    if (!url) {
      return Response.json(
        { error: "failed to prepare media" },
        { status: 500 }
      );
    }
    try {
      postizMedia = await uploadPostizMediaFromUrl(url);
    } catch (error) {
      return postizFailure(error);
    }
  }

  let payload;
  try {
    payload = buildPostizPostPayload({
      platform: mediaRow.platform,
      integration,
      copy: mediaRow.copy,
      media: postizMedia,
      publishAt,
      titleFallback: mediaRow.original_name ?? "Untitled creative",
      trackingUrl,
      slotKey: mediaRow.ratio,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "failed to prepare post";
    return Response.json({ error: message }, { status: 400 });
  }

  let response: unknown;
  try {
    response = await createPostizPost(payload);
  } catch (error) {
    return postizFailure(error);
  }

  const content = payload.posts[0]?.value[0]?.content ?? "";
  const settings = payload.posts[0]?.settings ?? {};
  const { data: inserted, error: insertError } = await supabase
    .from("social_posts")
    .insert({
      project_id: id,
      creative_id: creativeId,
      media_version_id: versionId,
      tracking_link_id: trackingLinkId,
      platform: mediaRow.platform,
      postiz_post_id: firstPostizPostId(response),
      postiz_integration_id: integration.id,
      postiz_integration_identifier: integration.identifier,
      postiz_integration_name: integration.name,
      state: "scheduled",
      publish_at: publishAt,
      content,
      settings,
      payload,
      response: response ?? {},
      created_by: user?.id ?? null,
    })
    .select(
      "id, project_id, creative_id, media_version_id, tracking_link_id, platform, postiz_post_id, postiz_integration_id, postiz_integration_identifier, postiz_integration_name, state, publish_at, content, settings, error, created_at"
    )
    .single();

  if (insertError) {
    return Response.json(
      { error: "post submitted, but failed to save receipt" },
      { status: 500 }
    );
  }

  return Response.json({
    item: serializeSocialPost(inserted as SocialPostRow),
  });
}

function serializeSocialPost(row: SocialPostRow) {
  return {
    id: row.id,
    projectId: row.project_id,
    creativeId: row.creative_id,
    versionId: row.media_version_id,
    trackingLinkId: row.tracking_link_id,
    platform: row.platform,
    postizPostId: row.postiz_post_id,
    integrationId: row.postiz_integration_id,
    integrationIdentifier: row.postiz_integration_identifier,
    integrationName: row.postiz_integration_name,
    state: row.state,
    publishAt: row.publish_at,
    content: row.content,
    settings: row.settings ?? {},
    error: row.error,
    createdAt: new Date(row.created_at).getTime(),
  };
}

function normalizePublishAt(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function firstPostizPostId(response: unknown): string | null {
  if (!Array.isArray(response)) return null;
  const first = response[0] as { postId?: unknown } | undefined;
  return typeof first?.postId === "string" ? first.postId : null;
}

function postizFailure(error: unknown) {
  if (error instanceof PostizError) {
    if (error.status === 401) {
      return Response.json(
        { error: "Postiz API key was rejected" },
        { status: 502 }
      );
    }
    if (error.status === 429) {
      return Response.json(
        { error: "Postiz rate limit reached" },
        { status: 429 }
      );
    }
  }
  return Response.json({ error: "Postiz request failed" }, { status: 502 });
}
