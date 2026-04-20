import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type TrackingLinksLocation = "project_tab" | "platform_panel" | "both";

export type ProjectSummary = {
  id: string;
  name: string;
  description: string | null;
  archivedAt: number | null;
  trackingLinksLocation: TrackingLinksLocation;
  ga4PropertyId: string | null;
};

export async function loadProject(id: string): Promise<ProjectSummary> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("projects")
    .select("id, name, description, archived_at, tracking_links_location, ga4_property_id")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) notFound();
  return {
    id: data.id,
    name: data.name,
    description: data.description,
    archivedAt: data.archived_at ? new Date(data.archived_at).getTime() : null,
    trackingLinksLocation:
      (data.tracking_links_location as TrackingLinksLocation) ?? "both",
    ga4PropertyId: data.ga4_property_id,
  };
}
