import { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { type Unit } from "@/lib/signage";

const VALID_UNITS = new Set(["in", "ft", "cm", "m", "px"]);

type BlueprintRow = {
  id: string;
  label: string;
  width: number;
  height: number;
  unit: Unit;
  created_at: string;
};

function serialize(row: BlueprintRow) {
  return {
    id: row.id,
    label: row.label,
    width: Number(row.width),
    height: Number(row.height),
    unit: row.unit,
    createdAt: new Date(row.created_at).getTime(),
  };
}

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("signage_blueprints")
    .select("id, label, width, height, unit, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ blueprints: (data ?? []).map(serialize) });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    label?: unknown;
    width?: unknown;
    height?: unknown;
    unit?: unknown;
  } | null;

  if (!body) {
    return Response.json({ error: "body required" }, { status: 400 });
  }

  const label = typeof body.label === "string" ? body.label.trim() : "";
  const width = typeof body.width === "number" ? body.width : Number(body.width);
  const height = typeof body.height === "number" ? body.height : Number(body.height);
  const unit = typeof body.unit === "string" ? body.unit : "";

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

  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("signage_blueprints")
    .insert({
      label,
      width,
      height,
      unit,
      created_by: user.id,
    })
    .select("id, label, width, height, unit, created_at")
    .single();

  if (error || !data) {
    return Response.json({ error: error?.message ?? "insert failed" }, { status: 500 });
  }

  return Response.json({ blueprint: serialize(data) });
}
