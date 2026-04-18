import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ProjectSummary = {
  id: string;
  name: string;
  description: string | null;
  archivedAt: number | null;
};

export async function loadProject(id: string): Promise<ProjectSummary> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("projects")
    .select("id, name, description, archived_at")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) notFound();
  return {
    id: data.id,
    name: data.name,
    description: data.description,
    archivedAt: data.archived_at ? new Date(data.archived_at).getTime() : null,
  };
}
