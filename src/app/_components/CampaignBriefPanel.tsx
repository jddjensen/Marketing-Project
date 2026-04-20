"use client";

import { useState } from "react";
import type { CampaignBrief } from "@/lib/campaignBrief";

type CampaignBriefDraft = {
  objective: string;
  audience: string;
  offer: string;
  cta: string;
  kpiTargets: string;
  launchStartDate: string;
  launchEndDate: string;
  owner: string;
  budget: string;
  successDefinition: string;
};

function toDraft(brief: CampaignBrief): CampaignBriefDraft {
  return {
    objective: brief.objective ?? "",
    audience: brief.audience ?? "",
    offer: brief.offer ?? "",
    cta: brief.cta ?? "",
    kpiTargets: brief.kpiTargets ?? "",
    launchStartDate: brief.launchStartDate ?? "",
    launchEndDate: brief.launchEndDate ?? "",
    owner: brief.owner ?? "",
    budget: brief.budget === null ? "" : String(brief.budget),
    successDefinition: brief.successDefinition ?? "",
  };
}

function hasDraftChanges(a: CampaignBriefDraft, b: CampaignBriefDraft) {
  return (
    a.objective !== b.objective ||
    a.audience !== b.audience ||
    a.offer !== b.offer ||
    a.cta !== b.cta ||
    a.kpiTargets !== b.kpiTargets ||
    a.launchStartDate !== b.launchStartDate ||
    a.launchEndDate !== b.launchEndDate ||
    a.owner !== b.owner ||
    a.budget !== b.budget ||
    a.successDefinition !== b.successDefinition
  );
}

function formatBudget(value: string) {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(parsed);
}

export function CampaignBriefPanel({
  projectId,
  initialBrief,
}: {
  projectId: string;
  initialBrief: CampaignBrief;
}) {
  const [savedBrief, setSavedBrief] = useState(initialBrief);
  const [draft, setDraft] = useState(() => toDraft(initialBrief));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const savedDraft = toDraft(savedBrief);
  const dirty = hasDraftChanges(draft, savedDraft);
  const budgetPreview = formatBudget(draft.budget);

  const updateField = <K extends keyof CampaignBriefDraft>(key: K, value: CampaignBriefDraft[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const saveBrief = async () => {
    setSaving(true);
    setError(null);
    setNotice(null);

    const res = await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaignBrief: {
          objective: draft.objective,
          audience: draft.audience,
          offer: draft.offer,
          cta: draft.cta,
          kpiTargets: draft.kpiTargets,
          launchStartDate: draft.launchStartDate,
          launchEndDate: draft.launchEndDate,
          owner: draft.owner,
          budget: draft.budget,
          successDefinition: draft.successDefinition,
        },
      }),
    });

    const body = (await res.json().catch(() => null)) as
      | { error?: string; project?: { campaignBrief?: CampaignBrief } }
      | null;

    setSaving(false);
    if (!res.ok || !body?.project?.campaignBrief) {
      setError(body?.error ?? "failed to save campaign brief");
      return;
    }

    setSavedBrief(body.project.campaignBrief);
    setDraft(toDraft(body.project.campaignBrief));
    setNotice("Campaign brief saved.");
  };

  return (
    <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">
            Campaign Brief
          </h2>
          <p className="text-sm text-zinc-500 mt-1 max-w-3xl">
            Set the strategic spine of the campaign before execution starts: what this campaign is
            trying to do, who it is for, what the offer is, and how success will be measured.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {dirty && (
            <button
              type="button"
              onClick={() => {
                setDraft(savedDraft);
                setError(null);
                setNotice(null);
              }}
              className="text-xs rounded-md border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              Reset
            </button>
          )}
          <button
            type="button"
            onClick={() => void saveBrief()}
            disabled={!dirty || saving}
            className="apple-tap rounded-md bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 px-4 py-2 text-sm font-medium disabled:opacity-50 hover:opacity-90"
          >
            {saving ? "Saving…" : "Save brief"}
          </button>
        </div>
      </div>

      {(error || notice) && (
        <div className="mt-4 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-3 py-2 text-sm">
          {error && <span className="text-red-600 dark:text-red-400">{error}</span>}
          {notice && !error && <span className="text-zinc-600 dark:text-zinc-300">{notice}</span>}
        </div>
      )}

      <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="space-y-4">
          <SectionLabel title="Strategy" subtitle="Why the campaign exists and who it needs to move." />
          <TextAreaField
            label="Objective"
            value={draft.objective}
            onChange={(value) => updateField("objective", value)}
            placeholder="Drive spring break attendance, membership renewals, or awareness for a new exhibit."
            rows={3}
          />
          <TextAreaField
            label="Audience"
            value={draft.audience}
            onChange={(value) => updateField("audience", value)}
            placeholder="Families with children 4–12 in Salt Lake County, teachers, tourists, members, etc."
            rows={3}
          />
          <TextAreaField
            label="Offer"
            value={draft.offer}
            onChange={(value) => updateField("offer", value)}
            placeholder="Limited-time ticket package, member pre-sale, exhibit opening, event RSVP, or seasonal value proposition."
            rows={3}
          />
          <Field
            label="Primary CTA"
            value={draft.cta}
            onChange={(value) => updateField("cta", value)}
            placeholder="Book tickets, Join now, Reserve your spot, Learn more"
          />
        </div>

        <div className="space-y-4">
          <SectionLabel title="Operations" subtitle="How the team will measure and manage the campaign." />
          <TextAreaField
            label="KPI Targets"
            value={draft.kpiTargets}
            onChange={(value) => updateField("kpiTargets", value)}
            placeholder="Sessions, ticket sales, conversion rate, QR scans, email CTR, ROAS, membership starts, etc."
            rows={3}
          />
          <TextAreaField
            label="Success Definition"
            value={draft.successDefinition}
            onChange={(value) => updateField("successDefinition", value)}
            placeholder="What does a win actually look like for this campaign beyond raw traffic?"
            rows={3}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field
              label="Owner"
              value={draft.owner}
              onChange={(value) => updateField("owner", value)}
              placeholder="Campaign owner or lead"
            />
            <Field
              label="Budget"
              type="number"
              inputMode="decimal"
              value={draft.budget}
              onChange={(value) => updateField("budget", value)}
              placeholder="0.00"
              min="0"
              step="0.01"
            />
          </div>
          {budgetPreview && (
            <div className="text-xs text-zinc-500 -mt-2">Budget preview: {budgetPreview}</div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field
              label="Launch Start"
              type="date"
              value={draft.launchStartDate}
              onChange={(value) => updateField("launchStartDate", value)}
            />
            <Field
              label="Launch End"
              type="date"
              value={draft.launchEndDate}
              onChange={(value) => updateField("launchEndDate", value)}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function SectionLabel({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{title}</div>
      <div className="text-xs text-zinc-500 mt-1">{subtitle}</div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  inputMode,
  min,
  step,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  min?: string;
  step?: string;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{label}</span>
      <input
        type={type}
        inputMode={inputMode}
        min={min}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
  rows,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  rows: number;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{label}</span>
      <textarea
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
      />
    </label>
  );
}
