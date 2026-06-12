"use client";

import { useCallback, useEffect, useState } from "react";
import { apiErrorMessage } from "@/lib/api";
import { EmptyState as SharedEmptyState } from "./EmptyState";
import { ErrorMessage } from "./ErrorMessage";
import { LoadingSkeleton } from "./LoadingSkeleton";

type LandingPage = {
  id: string;
  projectId: string;
  url: string;
  label: string | null;
  platform: string | null;
  createdAt: number;
  updatedAt: number;
};

type AnalyticsSettings = {
  ga4PropertyId: string | null;
  status:
    | "ready"
    | "property_missing"
    | "account_not_connected"
    | "credentials_missing";
  credentialsConfigured: boolean;
  oauthConfigured: boolean;
  connected: boolean;
  accountEmail: string | null;
  authMode: "oauth" | "service_account" | null;
};

type AnalyticsProperty = {
  accountId: string;
  accountName: string;
  propertyId: string;
  propertyName: string;
  propertyResourceName: string;
};

export function LandingPagesPanel({ projectId }: { projectId: string }) {
  const [pages, setPages] = useState<LandingPage[] | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsSettings | null>(null);
  const [properties, setProperties] = useState<AnalyticsProperty[]>([]);
  const [loadingProperties, setLoadingProperties] = useState(false);
  const [propertyError, setPropertyError] = useState<string | null>(null);
  const [ga4PropertyDraft, setGa4PropertyDraft] = useState("");
  const [savingAnalytics, setSavingAnalytics] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPages = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/tracking-links`, {
      cache: "no-store",
    });
    const body = (await res.json().catch(() => null)) as {
      links?: LandingPage[];
      analytics?: AnalyticsSettings;
      error?: unknown;
    } | null;

    if (!res.ok) {
      setError(apiErrorMessage(body, "Failed to load landing pages."));
      setPages([]);
      return;
    }

    setPages((body?.links ?? []).filter((link) => link.platform === null));
    setAnalytics(body?.analytics ?? null);
    setGa4PropertyDraft(body?.analytics?.ga4PropertyId ?? "");
  }, [projectId]);

  useEffect(() => {
    const kickoff = window.setTimeout(() => {
      void loadPages();
    }, 0);
    return () => window.clearTimeout(kickoff);
  }, [loadPages]);

  const loadProperties = useCallback(async () => {
    setLoadingProperties(true);
    setPropertyError(null);
    const res = await fetch("/api/google-analytics/properties", {
      cache: "no-store",
    });
    const body = (await res.json().catch(() => null)) as {
      properties?: AnalyticsProperty[];
      error?: unknown;
    } | null;

    setLoadingProperties(false);
    if (!res.ok) {
      setPropertyError(
        apiErrorMessage(body, "Failed to load Google Analytics properties.")
      );
      setProperties([]);
      return;
    }

    setProperties(body?.properties ?? []);
  }, []);

  useEffect(() => {
    if (analytics?.authMode !== "oauth" || !analytics.connected) return;
    const kickoff = window.setTimeout(() => {
      void loadProperties();
    }, 0);
    return () => window.clearTimeout(kickoff);
  }, [analytics?.authMode, analytics?.connected, loadProperties]);

  const createPage = useCallback(
    async (input: { url: string; label?: string }) => {
      setError(null);
      const res = await fetch(`/api/projects/${projectId}/tracking-links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: input.url,
          label: input.label ?? null,
          platform: null,
        }),
      });
      const body = (await res.json().catch(() => null)) as {
        link?: LandingPage;
        error?: unknown;
      } | null;
      if (!res.ok || !body?.link) {
        setError(apiErrorMessage(body, "Failed to add landing page."));
        return;
      }
      setPages((prev) => [...(prev ?? []), body.link!]);
      setAdding(false);
    },
    [projectId]
  );

  const updatePage = useCallback(
    async (id: string, patch: Partial<Pick<LandingPage, "url" | "label">>) => {
      setPages((prev) =>
        (prev ?? []).map((page) =>
          page.id === id ? { ...page, ...patch } : page
        )
      );
      const res = await fetch(
        `/api/projects/${projectId}/tracking-links/${id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        }
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: unknown;
        } | null;
        setError(apiErrorMessage(body, "Failed to update landing page."));
        await loadPages();
      }
    },
    [loadPages, projectId]
  );

  const deletePage = useCallback(
    async (id: string) => {
      const previous = pages ?? [];
      setPages((prev) => (prev ?? []).filter((page) => page.id !== id));
      const res = await fetch(
        `/api/projects/${projectId}/tracking-links/${id}`,
        {
          method: "DELETE",
        }
      );
      if (!res.ok) {
        setPages(previous);
        const body = (await res.json().catch(() => null)) as {
          error?: unknown;
        } | null;
        setError(apiErrorMessage(body, "Failed to delete landing page."));
      }
    },
    [pages, projectId]
  );

  const saveGa4Property = useCallback(async () => {
    const trimmed = ga4PropertyDraft.trim();
    if (trimmed && !/^[0-9]{5,20}$/.test(trimmed)) {
      setError("GA4 property ID must be numeric.");
      return;
    }

    setSavingAnalytics(true);
    setError(null);
    const res = await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ga4PropertyId: trimmed || null }),
    });
    const body = (await res.json().catch(() => null)) as {
      error?: unknown;
      project?: { ga4PropertyId?: string | null };
    } | null;

    setSavingAnalytics(false);
    if (!res.ok) {
      setError(
        apiErrorMessage(body, "Failed to save Google Analytics settings.")
      );
      return;
    }

    setAnalytics((prev) => {
      const credentialsConfigured = prev?.credentialsConfigured ?? false;
      const ga4PropertyId = body?.project?.ga4PropertyId ?? (trimmed || null);
      return {
        oauthConfigured: prev?.oauthConfigured ?? false,
        connected: prev?.connected ?? false,
        accountEmail: prev?.accountEmail ?? null,
        authMode: prev?.authMode ?? null,
        ga4PropertyId,
        credentialsConfigured,
        status: credentialsConfigured
          ? ga4PropertyId
            ? "ready"
            : "property_missing"
          : "credentials_missing",
      };
    });
  }, [ga4PropertyDraft, projectId]);

  const disconnectGoogleAnalytics = useCallback(async () => {
    setError(null);
    const res = await fetch("/api/google-analytics/disconnect", {
      method: "DELETE",
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as {
        error?: unknown;
      } | null;
      setError(apiErrorMessage(body, "Failed to disconnect Google Analytics."));
      return;
    }
    setProperties([]);
    setAnalytics((prev) =>
      prev
        ? {
            ...prev,
            connected: false,
            accountEmail: null,
            authMode: prev.credentialsConfigured ? "service_account" : null,
            status: prev.credentialsConfigured
              ? prev.ga4PropertyId
                ? "ready"
                : "property_missing"
              : prev.oauthConfigured
                ? "account_not_connected"
                : "credentials_missing",
          }
        : prev
    );
  }, []);

  return (
    <section id="landing-pages" className="scroll-mt-48">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium tracking-wide text-zinc-500 uppercase">
            Landing pages
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            Save plain destinations here. Channel source and creative tags are
            attached later when a creative selects a landing page.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-500 hover:text-zinc-900 dark:border-zinc-800 dark:hover:text-zinc-100"
        >
          + Add landing page
        </button>
      </div>

      {error && (
        <ErrorMessage
          title="Landing pages need attention"
          message={error}
          className="mb-3"
        />
      )}

      <GoogleAnalyticsSettingsCard
        projectId={projectId}
        settings={analytics}
        propertyId={ga4PropertyDraft}
        properties={properties}
        loadingProperties={loadingProperties}
        propertyError={propertyError}
        onPropertyIdChange={setGa4PropertyDraft}
        onSave={saveGa4Property}
        onRefreshProperties={loadProperties}
        onDisconnect={disconnectGoogleAnalytics}
        saving={savingAnalytics}
      />

      {pages === null ? (
        <LoadingSkeleton rows={2} />
      ) : pages.length === 0 ? (
        <EmptyLandingPages onAdd={() => setAdding(true)} />
      ) : (
        <div className="space-y-3">
          {pages.map((page) => (
            <LandingPageRow
              key={page.id}
              page={page}
              onChange={(patch) => updatePage(page.id, patch)}
              onDelete={() => deletePage(page.id)}
            />
          ))}
        </div>
      )}

      {adding && (
        <AddLandingPageDialog
          onClose={() => setAdding(false)}
          onSubmit={createPage}
        />
      )}
    </section>
  );
}

function LandingPageRow({
  page,
  onChange,
  onDelete,
}: {
  page: LandingPage;
  onChange: (patch: Partial<Pick<LandingPage, "url" | "label">>) => void;
  onDelete: () => void;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
        <input
          type="text"
          defaultValue={page.label ?? ""}
          placeholder="Label (e.g. Spring campaign landing page)"
          maxLength={120}
          onBlur={(e) => {
            const value = e.target.value.trim();
            if (value !== (page.label ?? ""))
              onChange({ label: value || null });
          }}
          className="input-tactile"
        />
        <button
          type="button"
          onClick={onDelete}
          className="rounded-md px-3 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
          aria-label="Delete landing page"
        >
          Remove
        </button>
      </div>

      <input
        type="url"
        defaultValue={page.url}
        placeholder="https://example.com/landing"
        maxLength={2048}
        onBlur={(e) => {
          const value = e.target.value.trim();
          if (value && value !== page.url) onChange({ url: value });
        }}
        className="input-tactile w-full"
      />
    </div>
  );
}

function EmptyLandingPages({ onAdd }: { onAdd: () => void }) {
  return (
    <SharedEmptyState
      title="No landing pages yet"
      description="Add the destination pages once. Each creative can choose one later and get the right source."
      action={{ label: "+ Add landing page", onClick: onAdd }}
      className="py-10 shadow-none"
    />
  );
}

function AddLandingPageDialog({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (input: { url: string; label?: string }) => void;
}) {
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="modal-surface w-full max-w-md rounded-xl border border-zinc-200 bg-white p-5 shadow-[var(--shadow-lift)] dark:border-zinc-800 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold">Add landing page</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Add the destination only. Source gets attached when creative is
          assigned.
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
            });
          }}
        >
          <label className="block">
            <span className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
              URL
            </span>
            <input
              autoFocus
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/landing"
              maxLength={2048}
              className="input-tactile mt-1 w-full"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
              Label{" "}
              <span className="text-zinc-400 normal-case">(optional)</span>
            </span>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Spring campaign"
              maxLength={120}
              className="input-tactile mt-1 w-full"
            />
          </label>
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={url.trim().length === 0}
              className="apple-tap rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
            >
              Add
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function GoogleAnalyticsSettingsCard({
  projectId,
  settings,
  propertyId,
  properties,
  loadingProperties,
  propertyError,
  onPropertyIdChange,
  onSave,
  onRefreshProperties,
  onDisconnect,
  saving,
}: {
  projectId: string;
  settings: AnalyticsSettings | null;
  propertyId: string;
  properties: AnalyticsProperty[];
  loadingProperties: boolean;
  propertyError: string | null;
  onPropertyIdChange: (value: string) => void;
  onSave: () => void;
  onRefreshProperties: () => void;
  onDisconnect: () => void;
  saving: boolean;
}) {
  const trimmed = propertyId.trim();
  const savedValue = settings?.ga4PropertyId ?? "";
  const hasChanges = trimmed !== savedValue;
  const valid = trimmed.length === 0 || /^[0-9]{5,20}$/.test(trimmed);

  let toneClass =
    "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300";
  let statusLabel = "Loading Google Analytics settings…";
  let helpText =
    "Connect a Google Analytics account, choose the GA4 property for this campaign, and dashboard reports will filter by each generated mt_link_id.";

  if (settings?.status === "ready") {
    toneClass =
      "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200";
    statusLabel =
      settings.authMode === "oauth"
        ? "GA4 dashboards are connected through your Google account."
        : "GA4 dashboards are active for this project.";
    helpText =
      "Creative links include an mt_link_id, and the performance dashboard queries GA4 for that same value.";
  } else if (settings?.status === "property_missing") {
    toneClass =
      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200";
    statusLabel = settings.connected
      ? "Choose a GA4 property to turn on website dashboards."
      : "Add a GA4 property ID to turn on link dashboards.";
  } else if (settings?.status === "account_not_connected") {
    toneClass =
      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200";
    statusLabel = "Connect your Google Analytics account.";
  } else if (settings?.status === "credentials_missing") {
    toneClass =
      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200";
    statusLabel = "Google OAuth credentials still need to be configured.";
    helpText =
      "Add GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET so users can connect GA4.";
  }

  return (
    <div className="mb-4 space-y-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium tracking-wide text-zinc-500 uppercase">
            Google Analytics 4
          </h3>
          <p className="mt-1 text-xs text-zinc-500">{helpText}</p>
          {settings?.accountEmail && (
            <p className="mt-1 text-xs text-zinc-500">
              Connected as{" "}
              <span className="font-medium text-zinc-700 dark:text-zinc-200">
                {settings.accountEmail}
              </span>
            </p>
          )}
        </div>
        <div
          className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium ${toneClass}`}
        >
          {statusLabel}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {settings?.oauthConfigured && !settings.connected && (
          <a
            href={`/api/google-analytics/oauth/start?projectId=${encodeURIComponent(projectId)}`}
            className="apple-tap rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:opacity-90 dark:bg-zinc-100 dark:text-zinc-900"
          >
            Connect Google Analytics
          </a>
        )}
        {settings?.connected && (
          <>
            <button
              type="button"
              onClick={onRefreshProperties}
              disabled={loadingProperties}
              className="apple-tap rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:border-zinc-500 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200"
            >
              {loadingProperties ? "Loading properties…" : "Refresh properties"}
            </button>
            <button
              type="button"
              onClick={onDisconnect}
              className="px-2 py-2 text-sm text-zinc-500 hover:text-red-600 dark:hover:text-red-400"
            >
              Disconnect
            </button>
          </>
        )}
      </div>

      <form
        className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid || saving || !hasChanges) return;
          void onSave();
        }}
      >
        <label className="block">
          <span className="text-[11px] font-medium tracking-wide text-zinc-500 uppercase">
            GA4 Property
          </span>
          {settings?.connected ? (
            <select
              value={propertyId}
              onChange={(e) => onPropertyIdChange(e.target.value)}
              className="select-tactile mt-1 w-full"
              disabled={loadingProperties}
            >
              <option value="">Select a GA4 property</option>
              {properties.map((property) => (
                <option key={property.propertyId} value={property.propertyId}>
                  {property.propertyName} · {property.accountName} ·{" "}
                  {property.propertyId}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              inputMode="numeric"
              value={propertyId}
              onChange={(e) =>
                onPropertyIdChange(e.target.value.replace(/[^\d]/g, ""))
              }
              placeholder="e.g. 123456789"
              className="input-tactile mt-1 w-full"
            />
          )}
        </label>
        <div className="flex items-end gap-2">
          <button
            type="submit"
            disabled={!valid || saving || !hasChanges}
            className="apple-tap rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {saving ? "Saving…" : trimmed ? "Save property" : "Clear property"}
          </button>
        </div>
      </form>

      {!valid && (
        <div className="text-xs text-red-600 dark:text-red-400">
          GA4 property IDs are numeric only.
        </div>
      )}
      {propertyError && (
        <div className="text-xs text-red-600 dark:text-red-400">
          {propertyError}
        </div>
      )}
      {settings?.connected &&
        !loadingProperties &&
        properties.length === 0 &&
        !propertyError && (
          <div className="text-xs text-zinc-500">
            No GA4 properties were found for this Google account.
          </div>
        )}
    </div>
  );
}
