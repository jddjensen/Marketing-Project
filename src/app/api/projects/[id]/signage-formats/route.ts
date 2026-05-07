import { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { signedMediaUrls } from "@/lib/storage";

const VALID_UNITS = new Set(["in", "ft", "cm", "m", "px"]);

type FormatRow = {
  id: string;
  label: string;
  preset_key: string | null;
  width: number;
  height: number;
  unit: string;
  created_at: string;
};

function serialize(row: FormatRow) {
  return {
    id: row.id,
    label: row.label,
    presetKey: row.preset_key,
    width: Number(row.width),
    height: Number(row.height),
    unit: row.unit,
    createdAt: new Date(row.created_at).getTime(),
  };
}

export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const supabase = await createSupabaseServerClient();

  const { data: formats, error: fErr } = await supabase
    .from("signage_formats")
    .select("id, label, preset_key, width, height, unit, created_at")
    .eq("project_id", id)
    .order("created_at", { ascending: true });
  if (fErr) return Response.json({ error: fErr.message }, { status: 500 });

  const { data: media, error: mErr } = await supabase
    .from("media")
    .select(
      "id, creative_id, version_num, ratio, storage_path, poster_storage_path, original_name, kind, copy, uploaded_at, signage_format_id"
    )
    .eq("project_id", id)
    .eq("platform", "signage")
    .eq("is_current", true)
    .order("uploaded_at", { ascending: false });
  if (mErr) return Response.json({ error: "failed to load media" }, { status: 500 });

  const mediaRows = (media ?? []).filter((row) => row.signage_format_id);
  const allPaths: string[] = [];
  for (const r of mediaRows) {
    if (r.storage_path) allPaths.push(r.storage_path);
    if (r.poster_storage_path) allPaths.push(r.poster_storage_path);
  }
  const urlMap = await signedMediaUrls(supabase, allPaths);

  const mediaByFormat: Record<string, Array<Record<string, unknown>>> = {};
  for (const row of mediaRows) {
    const url = row.storage_path ? urlMap.get(row.storage_path) ?? null : null;
    if (row.kind !== "text" && !url) continue;
    const posterUrl = row.poster_storage_path
      ? urlMap.get(row.poster_storage_path) ?? null
      : null;
    const formatKey = row.signage_format_id as string;
    const bucket = mediaByFormat[formatKey] ?? (mediaByFormat[formatKey] = []);
    bucket.push({
      id: row.id,
      creativeId: row.creative_id,
      versionNum: row.version_num,
      url,
      posterUrl,
      storagePath: row.storage_path,
      name: row.original_name,
      kind: row.kind,
      ratio: row.ratio,
      copy: (row.copy as Record<string, unknown> | null) ?? null,
      uploadedAt: new Date(row.uploaded_at).getTime(),
    });
  }

  return Response.json({
    formats: (formats ?? []).map(serialize),
    mediaByFormat,
  });
}

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const body = (await request.json().catch(() => null)) as {
    label?: unknown;
    presetKey?: unknown;
    width?: unknown;
    height?: unknown;
    unit?: unknown;
  } | null;

  if (!body) return Response.json({ error: "body required" }, { status: 400 });

  const label = typeof body.label === "string" ? body.label.trim() : "";
  const width = typeof body.width === "number" ? body.width : Number(body.width);
  const height = typeof body.height === "number" ? body.height : Number(body.height);
  const unit = typeof body.unit === "string" ? body.unit : "";
  const presetKey = typeof body.presetKey === "string" && body.presetKey.length > 0 ? body.presetKey : null;

  if (label.length === 0 || label.length > 120) {
    return Response.json({ error: "label is required (1-120 chars)" }, { status: 400 });
  }
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
    return Response.json({ error: "width and height must be positive numbers" }, { status: 400 });
  }
  if (!VALID_UNITS.has(unit)) {
    return Response.json({ error: "invalid unit" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("signage_formats")
    .insert({
      project_id: id,
      label,
      preset_key: presetKey,
      width,
      height,
      unit,
      created_by: user?.id ?? null,
    })
    .select("id, label, preset_key, width, height, unit, created_at")
    .single();

  if (error || !data) {
    return Response.json({ error: error?.message ?? "insert failed" }, { status: 500 });
  }
  return Response.json({ format: serialize(data) });
}
