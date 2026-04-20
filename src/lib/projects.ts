import { notFound } from "next/navigation";
import { serializeCampaignBrief, type CampaignBrief } from "@/lib/campaignBrief";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type TrackingLinksLocation = "project_tab" | "platform_panel" | "both";

export type ProjectSummary = {
  id: string;
  name: string;
  description: string | null;
  archivedAt: number | null;
  trackingLinksLocation: TrackingLinksLocation;
  ga4PropertyId: string | null;
  campaignBrief: CampaignBrief;
};

export async function loadProject(id: string): Promise<ProjectSummary> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("projects")
    .select(
      "id, name, description, archived_at, tracking_links_location, ga4_property_id, brief_objective, brief_audience, brief_offer, brief_cta, brief_kpi_targets, brief_launch_start_date, brief_launch_end_date, brief_owner, brief_budget, brief_success_definition, brief_event, brief_exhibit"
    )
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
    campaignBrief: serializeCampaignBrief(data),
  };
}
