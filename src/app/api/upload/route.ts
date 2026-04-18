import { NextRequest } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";

const VALID_PLATFORMS = new Set(["meta", "tiktok", "youtube", "google-search"]);
const RATIO_PATTERN = /^[0-9]+(\.[0-9]+)?x[0-9]+(\.[0-9]+)?$/;
const VALID_MIME = /^(image|video)\//;
const MAX_BYTES = 500 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file");
  const ratio = formData.get("ratio");
  const platform = formData.get("platform");

  if (!(file instanceof File)) {
    return Response.json({ error: "file is required" }, { status: 400 });
  }
  if (typeof platform !== "string" || !VALID_PLATFORMS.has(platform)) {
    return Response.json({ error: "invalid platform" }, { status: 400 });
  }
  if (typeof ratio !== "string" || !RATIO_PATTERN.test(ratio)) {
    return Response.json({ error: "invalid ratio" }, { status: 400 });
  }
  if (!VALID_MIME.test(file.type)) {
    return Response.json({ error: "only images or videos allowed" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "file too large (max 500MB)" }, { status: 400 });
  }

  const ext = path.extname(file.name) || "";
  const safeName = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`;
  const dir = path.join(process.cwd(), "public", "uploads", platform, ratio);
  await mkdir(dir, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, safeName), buffer);

  return Response.json({
    url: `/uploads/${platform}/${ratio}/${safeName}`,
    name: safeName,
    type: file.type,
    ratio,
    platform,
  });
}
