import { NextRequest } from "next/server";
import { serializeCampaignBrief } from "@/lib/campaignBrief";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ProjectRow = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  tracking_links_location: string | null;
  ga4_property_id: string | null;
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
};

const VALID_LOCATIONS = ["project_tab", "platform_panel", "both"] as const;
type TrackingLinksLocation = (typeof VALID_LOCATIONS)[number];

function serialize(p: ProjectRow) {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    createdAt: new Date(p.created_at).getTime(),
    updatedAt: new Date(p.updated_at).getTime(),
    archivedAt: p.archived_at ? new Date(p.archived_at).getTime() : null,
    trackingLinksLocation: (p.tracking_links_location as TrackingLinksLocation) ?? "both",
    ga4PropertyId: p.ga4_property_id,
    campaignBrief: serializeCampaignBrief(p),
  };
}

const PROJECT_COLS =
  "id, name, description, created_at, updated_at, archived_at, tracking_links_location, ga4_property_id, brief_objective, brief_audience, brief_offer, brief_cta, brief_kpi_targets, brief_launch_start_date, brief_launch_end_date, brief_owner, brief_budget, brief_success_definition";

function normalizeOptionalText(
  value: unknown,
  options: { maxLength?: number; field: string }
): { value: string | null | undefined; error?: string } {
  if (value === undefined) return { value: undefined };
  if (value === null) return { value: null };
  if (typeof value !== "string") {
    return { value: undefined, error: `${options.field} must be text` };
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) return { value: null };
  if (options.maxLength && trimmed.length > options.maxLength) {
    return { value: undefined, error: `${options.field} must be ${options.maxLength} chars or less` };
  }
  return { value: trimmed };
}

function normalizeOptionalDate(
  value: unknown,
  field: string
): { value: string | null | undefined; error?: string } {
  if (value === undefined) return { value: undefined };
  if (value === null) return { value: null };
  if (typeof value !== "string") return { value: undefined, error: `${field} must be a date` };
  const trimmed = value.trim();
  if (trimmed.length === 0) return { value: null };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return { value: undefined, error: `${field} must be in YYYY-MM-DD format` };
  }
  const parsed = new Date(`${trimmed}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== trimmed) {
    return { value: undefined, error: `${field} must be a real date` };
  }
  return { value: trimmed };
}

function normalizeOptionalBudget(
  value: unknown
): { value: number | null | undefined; error?: string } {
  if (value === undefined) return { value: undefined };
  if (value === null || value === "") return { value: null };

  let parsed: number | null = null;
  if (typeof value === "number") parsed = value;
  else if (typeof value === "string") {
    const trimmed = value.trim().replace(/,/g, "");
    if (trimmed.length === 0) return { value: null };
    if (!/^\d+(?:\.\d{1,2})?$/.test(trimmed)) {
      return { value: undefined, error: "budget must be a non-negative amount with up to 2 decimals" };
    }
    parsed = Number(trimmed);
  }

  if (parsed === null || !Number.isFinite(parsed) || parsed < 0) {
    return { value: undefined, error: "budget must be a non-negative amount" };
  }

  return { value: Number(parsed.toFixed(2)) };
}

export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("projects")
    .select(PROJECT_COLS)
    .eq("id", id)
    .maybeSingle();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!data) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json({ project: serialize(data) });
}

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const body = (await request.json().catch(() => null)) as {
    name?: unknown;
    description?: unknown;
    archive?: unknown;
    trackingLinksLocation?: unknown;
    ga4PropertyId?: unknown;
    campaignBrief?: {
      objective?: unknown;
      audience?: unknown;
      offer?: unknown;
      cta?: unknown;
      kpiTargets?: unknown;
      launchStartDate?: unknown;
      launchEndDate?: unknown;
      owner?: unknown;
      budget?: unknown;
      successDefinition?: unknown;
    } | null;
  } | null;
  if (!body) return Response.json({ error: "body required" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (name.length === 0 || name.length > 120) {
      return Response.json({ error: "name must be 1–120 chars" }, { status: 400 });
    }
    patch.name = name;
  }
  if (typeof body.description === "string") {
    patch.description = body.description.trim() || null;
  }
  if (typeof body.archive === "boolean") {
    patch.archived_at = body.archive ? new Date().toISOString() : null;
  }
  if (typeof body.trackingLinksLocation === "string") {
    if (!VALID_LOCATIONS.includes(body.trackingLinksLocation as TrackingLinksLocation)) {
      return Response.json({ error: "invalid trackingLinksLocation" }, { status: 400 });
    }
    patch.tracking_links_location = body.trackingLinksLocation;
  }
  if (body.ga4PropertyId === null || body.ga4PropertyId === "") {
    patch.ga4_property_id = null;
  } else if (typeof body.ga4PropertyId === "string") {
    const ga4PropertyId = body.ga4PropertyId.trim();
    if (!/^[0-9]{5,20}$/.test(ga4PropertyId)) {
      return Response.json({ error: "ga4PropertyId must be numeric" }, { status: 400 });
    }
    patch.ga4_property_id = ga4PropertyId;
  }
  if (body.campaignBrief !== undefined) {
    if (body.campaignBrief === null || typeof body.campaignBrief !== "object") {
      return Response.json({ error: "campaignBrief must be an object" }, { status: 400 });
    }

    const brief = body.campaignBrief;
    const objective = normalizeOptionalText(brief.objective, {
      field: "objective",
      maxLength: 4000,
    });
    if (objective.error) return Response.json({ error: objective.error }, { status: 400 });
    if (objective.value !== undefined) patch.brief_objective = objective.value;

    const audience = normalizeOptionalText(brief.audience, {
      field: "audience",
      maxLength: 4000,
    });
    if (audience.error) return Response.json({ error: audience.error }, { status: 400 });
    if (audience.value !== undefined) patch.brief_audience = audience.value;

    const offer = normalizeOptionalText(brief.offer, {
      field: "offer",
      maxLength: 4000,
    });
    if (offer.error) return Response.json({ error: offer.error }, { status: 400 });
    if (offer.value !== undefined) patch.brief_offer = offer.value;

    const cta = normalizeOptionalText(brief.cta, {
      field: "CTA",
      maxLength: 240,
    });
    if (cta.error) return Response.json({ error: cta.error }, { status: 400 });
    if (cta.value !== undefined) patch.brief_cta = cta.value;

    const kpiTargets = normalizeOptionalText(brief.kpiTargets, {
      field: "KPI targets",
      maxLength: 4000,
    });
    if (kpiTargets.error) return Response.json({ error: kpiTargets.error }, { status: 400 });
    if (kpiTargets.value !== undefined) patch.brief_kpi_targets = kpiTargets.value;

    const launchStartDate = normalizeOptionalDate(brief.launchStartDate, "launchStartDate");
    if (launchStartDate.error) {
      return Response.json({ error: launchStartDate.error }, { status: 400 });
    }
    if (launchStartDate.value !== undefined) {
      patch.brief_launch_start_date = launchStartDate.value;
    }

    const launchEndDate = normalizeOptionalDate(brief.launchEndDate, "launchEndDate");
    if (launchEndDate.error) {
      return Response.json({ error: launchEndDate.error }, { status: 400 });
    }
    if (launchEndDate.value !== undefined) {
      patch.brief_launch_end_date = launchEndDate.value;
    }

    const owner = normalizeOptionalText(brief.owner, {
      field: "owner",
      maxLength: 120,
    });
    if (owner.error) return Response.json({ error: owner.error }, { status: 400 });
    if (owner.value !== undefined) patch.brief_owner = owner.value;

    const budget = normalizeOptionalBudget(brief.budget);
    if (budget.error) return Response.json({ error: budget.error }, { status: 400 });
    if (budget.value !== undefined) patch.brief_budget = budget.value;

    const successDefinition = normalizeOptionalText(brief.successDefinition, {
      field: "successDefinition",
      maxLength: 4000,
    });
    if (successDefinition.error) {
      return Response.json({ error: successDefinition.error }, { status: 400 });
    }
    if (successDefinition.value !== undefined) {
      patch.brief_success_definition = successDefinition.value;
    }

    const nextStart =
      launchStartDate.value !== undefined
        ? launchStartDate.value
        : undefined;
    const nextEnd =
      launchEndDate.value !== undefined
        ? launchEndDate.value
        : undefined;
    if (nextStart && nextEnd && nextEnd < nextStart) {
      return Response.json(
        { error: "launchEndDate must be on or after launchStartDate" },
        { status: 400 }
      );
    }
  }
  if (Object.keys(patch).length === 0) {
    return Response.json({ error: "nothing to update" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("projects")
    .update(patch)
    .eq("id", id)
    .select(PROJECT_COLS)
    .single();

  if (error || !data) {
    return Response.json({ error: error?.message ?? "update failed" }, { status: 500 });
  }
  return Response.json({ project: serialize(data) });
}

export async function DELETE(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const supabase = await createSupabaseServerClient();

  // Collect storage paths for this project's media so we can clean the bucket.
  const { data: mediaRows } = await supabase
    .from("media")
    .select("storage_path")
    .eq("project_id", id);

  const { error, count } = await supabase
    .from("projects")
    .delete({ count: "exact" })
    .eq("id", id);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (count === 0) return Response.json({ error: "not found" }, { status: 404 });

  if (mediaRows && mediaRows.length > 0) {
    const paths = mediaRows.map((r) => r.storage_path);
    await supabase.storage.from("creatives").remove(paths);
  }

  return Response.json({ ok: true });
}
