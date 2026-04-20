export type CampaignBrief = {
  objective: string | null;
  audience: string | null;
  offer: string | null;
  cta: string | null;
  kpiTargets: string | null;
  launchStartDate: string | null;
  launchEndDate: string | null;
  owner: string | null;
  budget: number | null;
  successDefinition: string | null;
  event: string | null;
  exhibit: string | null;
};

type CampaignBriefSource = {
  brief_objective: string | null;
  brief_audience: string | null;
  brief_offer: string | null;
  brief_cta: string | null;
  brief_kpi_targets: string | null;
  brief_launch_start_date: string | null;
  brief_launch_end_date: string | null;
  brief_owner: string | null;
  brief_budget: string | number | null;
  brief_success_definition: string | null;
  brief_event: string | null;
  brief_exhibit: string | null;
};

export const EMPTY_CAMPAIGN_BRIEF: CampaignBrief = {
  objective: null,
  audience: null,
  offer: null,
  cta: null,
  kpiTargets: null,
  launchStartDate: null,
  launchEndDate: null,
  owner: null,
  budget: null,
  successDefinition: null,
  event: null,
  exhibit: null,
};

function parseBudget(value: string | number | null) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function serializeCampaignBrief(source: CampaignBriefSource): CampaignBrief {
  return {
    objective: source.brief_objective,
    audience: source.brief_audience,
    offer: source.brief_offer,
    cta: source.brief_cta,
    kpiTargets: source.brief_kpi_targets,
    launchStartDate: source.brief_launch_start_date,
    launchEndDate: source.brief_launch_end_date,
    owner: source.brief_owner,
    budget: parseBudget(source.brief_budget),
    successDefinition: source.brief_success_definition,
    event: source.brief_event,
    exhibit: source.brief_exhibit,
  };
}

export const SEASON_KEYS = ["winter", "spring", "summer", "fall"] as const;
export type SeasonKey = (typeof SEASON_KEYS)[number];

export const SEASON_LABELS: Record<SeasonKey, string> = {
  winter: "Winter",
  spring: "Spring",
  summer: "Summer",
  fall: "Fall",
};

// Meteorological seasons (northern hemisphere): Dec–Feb winter, Mar–May spring,
// Jun–Aug summer, Sep–Nov fall. Input is an ISO yyyy-mm-dd string.
export function seasonForDate(isoDate: string | null): SeasonKey | null {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null;
  const month = Number(isoDate.slice(5, 7));
  if (!Number.isFinite(month) || month < 1 || month > 12) return null;
  if (month === 12 || month <= 2) return "winter";
  if (month <= 5) return "spring";
  if (month <= 8) return "summer";
  return "fall";
}
