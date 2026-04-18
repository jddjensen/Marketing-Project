"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type PlatformKey = "meta" | "tiktok" | "youtube" | "google-search" | "signage";

const PLATFORM_LABEL: Record<PlatformKey, string> = {
  meta: "Meta",
  tiktok: "TikTok",
  youtube: "YouTube",
  "google-search": "Google Search",
  signage: "Signage",
};

const PLATFORM_DEFAULTS: Record<PlatformKey, { source: string; medium: string }> = {
  meta: { source: "facebook", medium: "paid_social" },
  tiktok: { source: "tiktok", medium: "paid_social" },
  youtube: { source: "youtube", medium: "video" },
  "google-search": { source: "google", medium: "cpc" },
  signage: { source: "signage", medium: "offline" },
};

type TrackingLink = {
  id: string;
  projectId: string;
  url: string;
  label: string | null;
  platform: PlatformKey | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmTerm: string | null;
  utmContent: string | null;
  createdAt: number;
  updatedAt: number;
};

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function buildUtmUrl(link: TrackingLink, defaultCampaign: string): string {
  const raw = link.url?.trim();
  if (!raw) return "";
  let base: URL;
  try {
    base = new URL(raw);
  } catch {
    try {
      base = new URL(`https://${raw}`);
    } catch {
      return raw;
    }
  }
  const params = base.searchParams;
  const defaults = link.platform ? PLATFORM_DEFAULTS[link.platform] : null;
  const pairs: Array<[string, string | null]> = [
    ["utm_source", link.utmSource ?? defaults?.source ?? null],
    ["utm_medium", link.utmMedium ?? defaults?.medium ?? null],
    ["utm_campaign", link.utmCampaign ?? (defaultCampaign ? slugify(defaultCampaign) : null)],
    ["utm_term", link.utmTerm],
    ["utm_content", link.utmContent],
  ];
  for (const [k, v] of pairs) {
    if (v && v.trim().length > 0) params.set(k, v.trim());
  }
  base.search = params.toString();
  return base.toString();
}

export function TrackingLinksPanel({
  projectId,
  projectName,
  platform,
  heading,
}: {
  projectId: string;
  projectName: string;
  platform?: PlatformKey;
  heading?: string;
}) {
  const [links, setLinks] = useState<TrackingLink[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchLinks = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/tracking-links`, { cache: "no-store" });
    const body = (await res.json()) as { links?: TrackingLink[]; error?: string };
    if (!res.ok) {
      setError(body.error ?? "failed to load");
      setLinks([]);
      return;
    }
    setLinks(body.links ?? []);
  }, [projectId]);

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  const visible = useMemo(() => {
    if (!links) return [];
    if (!platform) return links;
    return links.filter((l) => l.platform === null || l.platform === platform);
  }, [links, platform]);

  const createLink = useCallback(
    async (input: { url: string; label?: string; platform?: PlatformKey | null }) => {
      setError(null);
      const res = await fetch(`/api/projects/${projectId}/tracking-links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: input.url,
          label: input.label ?? null,
          platform: input.platform ?? platform ?? null,
          utmCampaign: slugify(projectName),
        }),
      });
      const body = (await res.json()) as { link?: TrackingLink; error?: string };
      if (!res.ok || !body.link) {
        setError(body.error ?? "failed to create");
        return;
      }
      setLinks((prev) => [...(prev ?? []), body.link!]);
      setAdding(false);
    },
    [projectId, projectName, platform]
  );

  const updateLink = useCallback(
    async (id: string, patch: Partial<TrackingLink>) => {
      setLinks((prev) =>
        (prev ?? []).map((l) => (l.id === id ? { ...l, ...patch } : l))
      );
      const apiPatch: Record<string, unknown> = {};
      if (patch.url !== undefined) apiPatch.url = patch.url;
      if (patch.label !== undefined) apiPatch.label = patch.label;
      if (patch.platform !== undefined) apiPatch.platform = patch.platform;
      if (patch.utmSource !== undefined) apiPatch.utmSource = patch.utmSource;
      if (patch.utmMedium !== undefined) apiPatch.utmMedium = patch.utmMedium;
      if (patch.utmCampaign !== undefined) apiPatch.utmCampaign = patch.utmCampaign;
      if (patch.utmTerm !== undefined) apiPatch.utmTerm = patch.utmTerm;
      if (patch.utmContent !== undefined) apiPatch.utmContent = patch.utmContent;
      const res = await fetch(`/api/projects/${projectId}/tracking-links/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(apiPatch),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "update failed");
      }
    },
    [projectId]
  );

  const deleteLink = useCallback(
    async (id: string) => {
      setLinks((prev) => (prev ?? []).filter((l) => l.id !== id));
      await fetch(`/api/projects/${projectId}/tracking-links/${id}`, { method: "DELETE" });
    },
    [projectId]
  );

  const copy = useCallback(async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => {
        setCopiedId((cur) => (cur === id ? null : cur));
      }, 1400);
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">
            {heading ?? (platform ? `${PLATFORM_LABEL[platform]} tracking links` : "Tracking links")}
          </h2>
          <p className="text-xs text-zinc-500 mt-1">
            {platform
              ? `UTM-tagged URLs for ${PLATFORM_LABEL[platform]}. Copy and paste into the platform.`
              : "Build UTM-tagged destination URLs for every platform. Copy each row to paste into the ad platform."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-md px-2 py-1"
        >
          + Add landing page
        </button>
      </div>

      {error && (
        <div className="mb-3 rounded-md border border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200 px-3 py-2 text-sm">
          {error}
        </div>
      )}

      {links === null ? (
        <div className="text-sm text-zinc-500">Loading…</div>
      ) : visible.length === 0 && !adding ? (
        <EmptyState onAdd={() => setAdding(true)} platform={platform} />
      ) : (
        <div className="space-y-3">
          {visible.map((link) => (
            <LinkRow
              key={link.id}
              link={link}
              projectName={projectName}
              pinnedPlatform={platform}
              onChange={(patch) => updateLink(link.id, patch)}
              onDelete={() => deleteLink(link.id)}
              onCopy={(text) => copy(link.id, text)}
              copied={copiedId === link.id}
            />
          ))}
        </div>
      )}

      {adding && (
        <AddLinkDialog
          onClose={() => setAdding(false)}
          onSubmit={createLink}
          pinnedPlatform={platform}
        />
      )}
    </section>
  );
}

function LinkRow({
  link,
  projectName,
  pinnedPlatform,
  onChange,
  onDelete,
  onCopy,
  copied,
}: {
  link: TrackingLink;
  projectName: string;
  pinnedPlatform?: PlatformKey;
  onChange: (patch: Partial<TrackingLink>) => void;
  onDelete: () => void;
  onCopy: (text: string) => void;
  copied: boolean;
}) {
  const built = buildUtmUrl(link, projectName);
  const defaults = link.platform ? PLATFORM_DEFAULTS[link.platform] : null;

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2">
        <input
          type="text"
          defaultValue={link.label ?? ""}
          placeholder="Label (e.g. Homepage, Pricing)"
          maxLength={120}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v !== (link.label ?? "")) onChange({ label: v || null });
          }}
          className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {!pinnedPlatform && (
          <select
            value={link.platform ?? ""}
            onChange={(e) =>
              onChange({ platform: e.target.value === "" ? null : (e.target.value as PlatformKey) })
            }
            className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 py-2 text-sm"
          >
            <option value="">All platforms</option>
            <option value="meta">Meta</option>
            <option value="tiktok">TikTok</option>
            <option value="youtube">YouTube</option>
            <option value="google-search">Google Search</option>
            <option value="signage">Signage</option>
          </select>
        )}
        <button
          type="button"
          onClick={onDelete}
          className="rounded-md text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 px-3"
          aria-label="Delete tracking link"
        >
          Remove
        </button>
      </div>

      <input
        type="url"
        defaultValue={link.url}
        placeholder="https://example.com/landing"
        maxLength={2048}
        onBlur={(e) => {
          const v = e.target.value.trim();
          if (v && v !== link.url) onChange({ url: v });
        }}
        className="w-full rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <UtmField
          label="Source"
          defaultValue={link.utmSource ?? ""}
          placeholder={defaults?.source ?? "e.g. facebook"}
          onCommit={(v) => onChange({ utmSource: v || null })}
        />
        <UtmField
          label="Medium"
          defaultValue={link.utmMedium ?? ""}
          placeholder={defaults?.medium ?? "e.g. paid_social"}
          onCommit={(v) => onChange({ utmMedium: v || null })}
        />
        <UtmField
          label="Campaign"
          defaultValue={link.utmCampaign ?? ""}
          placeholder={slugify(projectName) || "campaign_name"}
          onCommit={(v) => onChange({ utmCampaign: v || null })}
        />
        <UtmField
          label="Term"
          defaultValue={link.utmTerm ?? ""}
          placeholder="optional"
          onCommit={(v) => onChange({ utmTerm: v || null })}
        />
        <UtmField
          label="Content"
          defaultValue={link.utmContent ?? ""}
          placeholder="creative_id, A-frame, etc."
          onCommit={(v) => onChange({ utmContent: v || null })}
        />
      </div>

      <div className="rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-2.5 flex items-center gap-2">
        <div className="flex-1 min-w-0 text-xs font-mono text-zinc-700 dark:text-zinc-300 truncate" title={built}>
          {built || <span className="italic text-zinc-400">Enter a URL to build your tracking link</span>}
        </div>
        <button
          type="button"
          disabled={!built}
          onClick={() => onCopy(built)}
          className="shrink-0 rounded-md bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-xs font-medium px-3 py-1.5 disabled:opacity-40 hover:opacity-90"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

function UtmField({
  label,
  defaultValue,
  placeholder,
  onCommit,
}: {
  label: string;
  defaultValue: string;
  placeholder: string;
  onCommit: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </span>
      <input
        type="text"
        defaultValue={defaultValue}
        placeholder={placeholder}
        onBlur={(e) => {
          const v = e.target.value.trim();
          if (v !== defaultValue) onCommit(v);
        }}
        className="mt-0.5 w-full rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </label>
  );
}

function EmptyState({
  onAdd,
  platform,
}: {
  onAdd: () => void;
  platform?: PlatformKey;
}) {
  return (
    <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-white/40 dark:bg-zinc-900/40 py-10 flex flex-col items-center text-center">
      <div className="font-semibold">No tracking links yet</div>
      <p className="text-sm text-zinc-500 mt-1 max-w-sm">
        {platform
          ? `Add a landing page to generate a UTM-tagged link for ${PLATFORM_LABEL[platform]}.`
          : "Add a landing page and we’ll build a UTM-tagged URL you can copy into each platform."}
      </p>
      <button
        type="button"
        onClick={onAdd}
        className="apple-tap mt-4 rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 px-4 py-2 text-sm font-medium hover:opacity-90"
      >
        + Add landing page
      </button>
    </div>
  );
}

function AddLinkDialog({
  onClose,
  onSubmit,
  pinnedPlatform,
}: {
  onClose: () => void;
  onSubmit: (input: { url: string; label?: string; platform?: PlatformKey | null }) => void;
  pinnedPlatform?: PlatformKey;
}) {
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [platform, setPlatform] = useState<PlatformKey | "">(pinnedPlatform ?? "");

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <div
        className="modal-surface w-full max-w-md rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 shadow-[var(--shadow-lift)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-semibold text-lg">Add landing page</h2>
        <p className="text-sm text-zinc-500 mt-1">
          Drop a destination URL. You can fine-tune UTMs on the row afterward.
        </p>
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const trimmed = url.trim();
            if (!trimmed) return;
            onSubmit({
              url: trimmed,
              label: label.trim() || undefined,
              platform: pinnedPlatform ?? (platform === "" ? null : platform),
            });
          }}
        >
          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">URL</label>
            <input
              autoFocus
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/landing"
              maxLength={2048}
              className="mt-1 w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Label <span className="text-zinc-400 normal-case">(optional)</span>
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Homepage"
              maxLength={120}
              className="mt-1 w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {!pinnedPlatform && (
            <div>
              <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Platform
              </label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value as PlatformKey | "")}
                className="mt-1 w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm"
              >
                <option value="">All platforms</option>
                <option value="meta">Meta</option>
                <option value="tiktok">TikTok</option>
                <option value="youtube">YouTube</option>
                <option value="google-search">Google Search</option>
                <option value="signage">Signage</option>
              </select>
            </div>
          )}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 px-3 py-2"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={url.trim().length === 0}
              className="apple-tap rounded-md bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 px-4 py-2 text-sm font-medium disabled:opacity-50 hover:opacity-90"
            >
              Add
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
