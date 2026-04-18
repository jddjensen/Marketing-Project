import { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ProjectRow = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

function serialize(p: ProjectRow) {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    createdAt: new Date(p.created_at).getTime(),
    updatedAt: new Date(p.updated_at).getTime(),
    archivedAt: p.archived_at ? new Date(p.archived_at).getTime() : null,
  };
}

export async function GET(request: NextRequest) {
  const includeArchived = request.nextUrl.searchParams.get("includeArchived") === "1";
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("projects")
    .select("id, name, description, created_at, updated_at, archived_at")
    .order("updated_at", { ascending: false });
  if (!includeArchived) query = query.is("archived_at", null);
  const { data, error } = await query;
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ projects: (data ?? []).map(serialize) });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    name?: unknown;
    description?: unknown;
  } | null;

  if (!body || typeof body.name !== "string") {
    return Response.json({ error: "name required" }, { status: 400 });
  }
  const name = body.name.trim();
  if (name.length === 0 || name.length > 120) {
    return Response.json({ error: "name must be 1–120 chars" }, { status: 400 });
  }
  const description =
    typeof body.description === "string" ? body.description.trim() || null : null;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("projects")
    .insert({ name, description, created_by: user?.id ?? null })
    .select("id, name, description, created_at, updated_at, archived_at")
    .single();

  if (error || !data) {
    return Response.json({ error: error?.message ?? "failed to create" }, { status: 500 });
  }
  return Response.json({ project: serialize(data) });
}
