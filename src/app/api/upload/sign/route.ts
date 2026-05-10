import { NextRequest } from "next/server";
import { CHANNEL_KEYS, isPlatformSlotKey } from "@/lib/channels";
import { isUuid } from "@/lib/ids";
import type { PlatformKey } from "@/lib/utm";
import { expectedSignageRatio } from "@/lib/signage";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CREATIVES_BUCKET } from "@/lib/storage";
import crypto from "crypto";

const VALID_PLATFORMS = new Set<string>(CHANNEL_KEYS);
// Loose shape gate; the per-platform slot check below catches "valid-looking
// but unconfigured" ratios.
const SLOT_PATTERN = /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/;
const MAX_VIDEO_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB
const MAX_POSTER_BYTES = 5 * 1024 * 1024; // 5 MB

const VIDEO_MIME = new Map<string, { ext: string }>([
  ["video/mp4", { ext: ".mp4" }],
  ["video/webm", { ext: ".webm" }],
]);

// Issues a one-time signed PUT URL the browser can upload directly to. Used
// for files (especially video) that are too large to flow through a
// serverless function (Vercel caps request bodies at ~4.5 MB regardless of
// tier). The client uploads, then calls /api/upload/finalize with the path.
export async function POST(
  request: NextRequest
) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    projectId?: unknown;
    platform?: unknown;
    ratio?: unknown;
    kind?: unknown;
    mimeType?: unknown;
    fileSize?: unknown;
    fileName?: unknown;
    signageFormatId?: unknown;
  } | null;
  if (!body) return Response.json({ error: "body required" }, { status: 400 });

  const { projectId, platform, ratio, kind, mimeType, fileSize, fileName, signageFormatId } = body;

  if (typeof projectId !== "string" || !isUuid(projectId)) {
    return Response.json({ error: "projectId required" }, { status: 400 });
  }
  if (typeof platform !== "string" || !VALID_PLATFORMS.has(platform)) {
    return Response.json({ error: "invalid platform" }, { status: 400 });
  }
  if (typeof ratio !== "string" || !SLOT_PATTERN.test(ratio)) {
    return Response.json({ error: "invalid slot key" }, { status: 400 });
  }
  if (platform !== "signage" && !isPlatformSlotKey(platform as PlatformKey, ratio)) {
    return Response.json(
      { error: `ratio '${ratio}' is not a valid slot for platform '${platform}'` },
      { status: 400 }
    );
  }
  if (kind !== "video" && kind !== "poster") {
    return Response.json({ error: "kind must be 'video' or 'poster'" }, { status: 400 });
  }
  if (typeof mimeType !== "string" || mimeType.length === 0) {
    return Response.json({ error: "mimeType required" }, { status: 400 });
  }
  if (typeof fileSize !== "number" || !Number.isFinite(fileSize) || fileSize <= 0) {
    return Response.json({ error: "fileSize must be a positive number" }, { status: 400 });
  }
  if (typeof fileName !== "string" || fileName.length === 0) {
    return Response.json({ error: "fileName required" }, { status: 400 });
  }

  if (kind === "video") {
    if (!VIDEO_MIME.has(mimeType)) {
      return Response.json(
        {
          error:
            "unsupported video type — use MP4 or WebM. MOV/QuickTime is not " +
            "accepted because it doesn't play in Chrome or Firefox.",
        },
        { status: 400 }
      );
    }
    if (fileSize > MAX_VIDEO_BYTES) {
      return Response.json({ error: "video too large (max 2GB)" }, { status: 400 });
    }
  } else {
    if (mimeType !== "image/jpeg") {
      return Response.json({ error: "poster must be image/jpeg" }, { status: 400 });
    }
    if (fileSize > MAX_POSTER_BYTES) {
      return Response.json({ error: "poster too large (max 5MB)" }, { status: 400 });
    }
  }

  // Project must exist + not be archived.
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, archived_at")
    .eq("id", projectId)
    .maybeSingle();
  if (projectError) {
    return Response.json({ error: "project lookup failed" }, { status: 500 });
  }
  if (!project) return Response.json({ error: "project not found" }, { status: 404 });
  if (project.archived_at) {
    return Response.json({ error: "cannot upload to an archived project" }, { status: 400 });
  }

  // Signage validation.
  let formatId: string | null = null;
  if (platform === "signage") {
    if (typeof signageFormatId !== "string" || !isUuid(signageFormatId)) {
      return Response.json({ error: "signageFormatId required for signage" }, { status: 400 });
    }
    const { data: format, error: formatError } = await supabase
      .from("signage_formats")
      .select("id, width, height")
      .eq("id", signageFormatId)
      .eq("project_id", projectId)
      .maybeSingle();
    if (formatError || !format) {
      return Response.json({ error: "signage format not found for project" }, { status: 404 });
    }
    const expected = expectedSignageRatio({
      width: Number(format.width),
      height: Number(format.height),
    });
    if (ratio !== expected) {
      return Response.json(
        { error: `ratio '${ratio}' does not match signage format dimensions (expected '${expected}')` },
        { status: 400 }
      );
    }
    formatId = signageFormatId;
  } else if (typeof signageFormatId === "string" && signageFormatId.length > 0) {
    return Response.json(
      { error: "signageFormatId only valid for signage platform" },
      { status: 400 }
    );
  }

  // Build the deterministic storage path. Posters get a sibling name pattern
  // so the existing reader logic that looks for `<videoPath>.poster.jpg` still
  // works (the client passes both paths to /finalize so the relationship is
  // recorded in the DB column too).
  const ext = kind === "video" ? VIDEO_MIME.get(mimeType as string)!.ext : ".poster.jpg";
  const safeName =
    kind === "video"
      ? `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`
      : `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`;
  const baseDir =
    platform === "signage"
      ? `${projectId as string}/signage/${formatId}`
      : `${projectId as string}/${platform}/${ratio}`;
  const storagePath = `${baseDir}/${safeName}`;

  const { data: signed, error: signError } = await supabase.storage
    .from(CREATIVES_BUCKET)
    .createSignedUploadUrl(storagePath);

  if (signError || !signed) {
    return Response.json({ error: "could not create signed upload url" }, { status: 500 });
  }

  return Response.json({
    uploadUrl: signed.signedUrl,
    storagePath,
    token: signed.token,
  });
}
