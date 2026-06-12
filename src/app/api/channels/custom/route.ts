import { NextRequest } from "next/server";
import {
  CUSTOM_CHANNEL_KINDS,
  CUSTOM_FORMAT_UNITS,
  customPlatformKey,
  type CustomChannel,
  type CustomChannelFormat,
  type CustomChannelKind,
  type CustomFormatUnit,
} from "@/lib/customChannels";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const VALID_KINDS = new Set<string>(CUSTOM_CHANNEL_KINDS.map((k) => k.key));
const VALID_UNITS = new Set<string>(CUSTOM_FORMAT_UNITS);
const MAX_FORMATS = 12;
const MAX_DIMENSION = 1_000_000;

type FormatRow = {
  id: string;
  channel_id: string;
  label: string;
  width: number;
  height: number;
  unit: string;
  position: number;
};

function toChannel(
  row: {
    id: string;
    name: string;
    description: string | null;
    kind: string;
    created_at: string;
  },
  formats: FormatRow[]
): CustomChannel {
  return {
    id: row.id,
    key: customPlatformKey(row.id),
    name: row.name,
    description: row.description,
    kind: row.kind as CustomChannelKind,
    formats: formats
      .filter((f) => f.channel_id === row.id)
      .sort((a, b) => a.position - b.position)
      .map(
        (f): CustomChannelFormat => ({
          id: f.id,
          label: f.label,
          width: Number(f.width),
          height: Number(f.height),
          unit: f.unit as CustomFormatUnit,
        })
      ),
    createdAt: new Date(row.created_at).getTime(),
  };
}

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const [channelsRes, formatsRes] = await Promise.all([
    supabase
      .from("custom_channels")
      .select("id, name, description, kind, created_at")
      .order("created_at", { ascending: true }),
    supabase
      .from("custom_channel_formats")
      .select("id, channel_id, label, width, height, unit, position"),
  ]);
  if (channelsRes.error || formatsRes.error) {
    return Response.json(
      { error: "failed to load custom channels" },
      { status: 500 }
    );
  }
  const formats = (formatsRes.data ?? []) as FormatRow[];
  return Response.json({
    channels: (channelsRes.data ?? []).map((row) => toChannel(row, formats)),
  });
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    name?: unknown;
    description?: unknown;
    kind?: unknown;
    formats?: unknown;
  } | null;
  if (!body) return Response.json({ error: "invalid body" }, { status: 400 });

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (name.length === 0 || name.length > 80) {
    return Response.json(
      { error: "name must be 1-80 characters" },
      { status: 400 }
    );
  }

  let description: string | null = null;
  if (body.description != null) {
    if (typeof body.description !== "string" || body.description.length > 240) {
      return Response.json(
        { error: "description must be at most 240 characters" },
        { status: 400 }
      );
    }
    description = body.description.trim() || null;
  }

  if (typeof body.kind !== "string" || !VALID_KINDS.has(body.kind)) {
    return Response.json({ error: "invalid kind" }, { status: 400 });
  }

  if (
    !Array.isArray(body.formats) ||
    body.formats.length === 0 ||
    body.formats.length > MAX_FORMATS
  ) {
    return Response.json(
      { error: `formats must contain 1-${MAX_FORMATS} entries` },
      { status: 400 }
    );
  }
  const formats: Array<{
    label: string;
    width: number;
    height: number;
    unit: string;
  }> = [];
  for (const raw of body.formats) {
    const f = raw as {
      label?: unknown;
      width?: unknown;
      height?: unknown;
      unit?: unknown;
    };
    const label = typeof f.label === "string" ? f.label.trim() : "";
    if (label.length === 0 || label.length > 120) {
      return Response.json(
        { error: "each format needs a label of 1-120 characters" },
        { status: 400 }
      );
    }
    const width = typeof f.width === "number" ? f.width : NaN;
    const height = typeof f.height === "number" ? f.height : NaN;
    if (
      !Number.isFinite(width) ||
      !Number.isFinite(height) ||
      width <= 0 ||
      height <= 0 ||
      width > MAX_DIMENSION ||
      height > MAX_DIMENSION
    ) {
      return Response.json(
        { error: "format dimensions must be positive numbers" },
        { status: 400 }
      );
    }
    if (typeof f.unit !== "string" || !VALID_UNITS.has(f.unit)) {
      return Response.json({ error: "invalid format unit" }, { status: 400 });
    }
    formats.push({ label, width, height, unit: f.unit });
  }

  const { data: channelRow, error: channelError } = await supabase
    .from("custom_channels")
    .insert({ name, description, kind: body.kind, created_by: user.id })
    .select("id, name, description, kind, created_at")
    .single();
  if (channelError || !channelRow) {
    return Response.json(
      { error: "failed to create custom channel" },
      { status: 500 }
    );
  }

  const { data: formatRows, error: formatsError } = await supabase
    .from("custom_channel_formats")
    .insert(
      formats.map((f, i) => ({
        channel_id: channelRow.id,
        label: f.label,
        width: f.width,
        height: f.height,
        unit: f.unit,
        position: i,
      }))
    )
    .select("id, channel_id, label, width, height, unit, position");
  if (formatsError || !formatRows) {
    await supabase.from("custom_channels").delete().eq("id", channelRow.id);
    return Response.json(
      { error: "failed to create custom channel formats" },
      { status: 500 }
    );
  }

  return Response.json(
    { channel: toChannel(channelRow, formatRows as FormatRow[]) },
    { status: 201 }
  );
}
