"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import {
  buildUtmUrl,
  PLATFORM_DEFAULTS,
  slugify,
  type PlatformKey,
} from "@/lib/utm";

const PLATFORM_LABEL: Record<PlatformKey, string> = {
  meta: "Meta",
  tiktok: "TikTok",
  youtube: "YouTube",
  "google-search": "Google Search",
  signage: "Signage",
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
  qrEnabled: boolean;
  qrGeneratedAt: number | null;
  createdAt: number;
  updatedAt: number;
};

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
  const [qrFor, setQrFor] = useState<{ id: string; label: string; url: string } | null>(null);

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
              projectId={projectId}
              projectName={projectName}
              pinnedPlatform={platform}
              onChange={(patch) => updateLink(link.id, patch)}
              onDelete={() => deleteLink(link.id)}
              onCopy={(text) => copy(link.id, text)}
              copied={copiedId === link.id}
              onShowQr={(redirectUrl) =>
                setQrFor({
                  id: link.id,
                  label: link.label || link.url || "tracking-link",
                  url: redirectUrl,
                })
              }
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

      {qrFor && (
        <QrDialog
          url={qrFor.url}
          label={qrFor.label}
          onClose={() => setQrFor(null)}
        />
      )}
    </section>
  );
}

function LinkRow({
  link,
  projectId,
  projectName,
  pinnedPlatform,
  onChange,
  onDelete,
  onCopy,
  copied,
  onShowQr,
}: {
  link: TrackingLink;
  projectId: string;
  projectName: string;
  pinnedPlatform?: PlatformKey;
  onChange: (patch: Partial<TrackingLink>) => void;
  onDelete: () => void;
  onCopy: (text: string) => void;
  copied: boolean;
  onShowQr: (redirectUrl: string) => void;
}) {
  const built = buildUtmUrl(link, projectName);
  const defaults = link.platform ? PLATFORM_DEFAULTS[link.platform] : null;
  const isSignage = (pinnedPlatform ?? link.platform) === "signage";
  const qrRedirectUrl =
    typeof window !== "undefined" ? `${window.location.origin}/qr/${link.id}` : `/qr/${link.id}`;

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
        {isSignage && !link.qrEnabled && (
          <button
            type="button"
            disabled={!built}
            onClick={() => onChange({ qrEnabled: true })}
            title="Generate a trackable QR code for this link"
            className="shrink-0 rounded-md border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 text-xs font-medium px-3 py-1.5 disabled:opacity-40 hover:border-zinc-500 dark:hover:border-zinc-500"
          >
            Generate QR
          </button>
        )}
        <button
          type="button"
          disabled={!built}
          onClick={() => onCopy(built)}
          className="shrink-0 rounded-md bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-xs font-medium px-3 py-1.5 disabled:opacity-40 hover:opacity-90"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      {isSignage && link.qrEnabled && (
        <QrBlock
          projectId={projectId}
          linkId={link.id}
          label={link.label || link.url || "tracking-link"}
          redirectUrl={qrRedirectUrl}
          generatedAt={link.qrGeneratedAt}
          onRemove={() => onChange({ qrEnabled: false })}
          onOpenPreview={() => onShowQr(qrRedirectUrl)}
        />
      )}
    </div>
  );
}

type ScanSummary = {
  total: number;
  last24h: number;
  lastAt: number | null;
  recent: Array<{ id: string; scannedAt: number; userAgent: string | null }>;
};

function QrBlock({
  projectId,
  linkId,
  label,
  redirectUrl,
  generatedAt,
  onRemove,
  onOpenPreview,
}: {
  projectId: string;
  linkId: string;
  label: string;
  redirectUrl: string;
  generatedAt: number | null;
  onRemove: () => void;
  onOpenPreview: () => void;
}) {
  const [svg, setSvg] = useState<string | null>(null);
  const [summary, setSummary] = useState<ScanSummary | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    QRCode.toString(redirectUrl, {
      type: "svg",
      errorCorrectionLevel: "M",
      margin: 1,
      width: 160,
      color: { dark: "#000000", light: "#ffffff" },
    })
      .then((out) => {
        if (!cancelled) setSvg(out);
      })
      .catch(() => {
        /* ignore */
      });
    return () => {
      cancelled = true;
    };
  }, [redirectUrl]);

  const fetchSummary = useCallback(async () => {
    const res = await fetch(
      `/api/projects/${projectId}/tracking-links/${linkId}/scans`,
      { cache: "no-store" }
    );
    if (!res.ok) return;
    const body = (await res.json()) as ScanSummary;
    setSummary(body);
  }, [projectId, linkId]);

  useEffect(() => {
    fetchSummary();
    const iv = window.setInterval(fetchSummary, 5000);
    const onVis = () => {
      if (document.visibilityState === "visible") fetchSummary();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(iv);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [fetchSummary]);

  const copyRedirect = async () => {
    try {
      await navigator.clipboard.writeText(redirectUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3">
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={onOpenPreview}
          aria-label="Open QR preview"
          className="shrink-0 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white p-2 hover:border-zinc-400"
          dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
        >
          {!svg && <span className="block w-[160px] h-[160px] text-[11px] text-zinc-400 grid place-items-center">Rendering…</span>}
        </button>
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              QR code · {label}
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onOpenPreview}
                className="text-xs rounded-md border border-zinc-200 dark:border-zinc-800 px-2 py-1 hover:border-zinc-400"
              >
                Preview &amp; download
              </button>
              <button
                type="button"
                onClick={onRemove}
                className="text-xs rounded-md text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 px-2 py-1"
              >
                Remove QR
              </button>
            </div>
          </div>
          <div className="rounded-md bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 px-2.5 py-1.5 flex items-center gap-2">
            <div
              className="flex-1 min-w-0 text-[11px] font-mono text-zinc-600 dark:text-zinc-400 truncate"
              title={redirectUrl}
            >
              {redirectUrl}
            </div>
            <button
              type="button"
              onClick={copyRedirect}
              className="shrink-0 rounded border border-zinc-300 dark:border-zinc-700 text-[11px] font-medium px-2 py-0.5 hover:border-zinc-500"
            >
              {copied ? "Copied" : "Copy link"}
            </button>
          </div>
          <ScanStats summary={summary} generatedAt={generatedAt} />
        </div>
      </div>
    </div>
  );
}

function ScanStats({
  summary,
  generatedAt,
}: {
  summary: ScanSummary | null;
  generatedAt: number | null;
}) {
  const lastLabel = summary?.lastAt ? relativeTime(summary.lastAt) : "never";
  return (
    <div className="grid grid-cols-3 gap-2 text-center">
      <Stat
        label="Total scans"
        value={summary ? String(summary.total) : "…"}
      />
      <Stat
        label="Last 24h"
        value={summary ? String(summary.last24h) : "…"}
      />
      <Stat label="Last scan" value={summary ? lastLabel : "…"} />
      {generatedAt && (
        <div className="col-span-3 text-[11px] text-zinc-500 text-center">
          Live · polling every 5s · QR generated {relativeTime(generatedAt)}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-zinc-200 dark:border-zinc-800 py-1.5">
      <div className="text-sm font-semibold">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</div>
    </div>
  );
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 15_000) return "just now";
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(ts).toLocaleDateString();
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

function QrDialog({
  url,
  label,
  onClose,
}: {
  url: string;
  label: string;
  onClose: () => void;
}) {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toString(url, {
      type: "svg",
      errorCorrectionLevel: "M",
      margin: 2,
      width: 320,
      color: { dark: "#000000", light: "#ffffff" },
    })
      .then((out) => {
        if (!cancelled) setSvg(out);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "failed to render QR");
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  const safeName = useMemo(() => {
    const base = label
      .toLowerCase()
      .replace(/https?:\/\//g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);
    return (base || "qr-code") + "-qr";
  }, [label]);

  const downloadSvg = () => {
    if (!svg) return;
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = `${safeName}.svg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(href);
  };

  const downloadPng = async () => {
    try {
      const dataUrl = await QRCode.toDataURL(url, {
        errorCorrectionLevel: "M",
        margin: 2,
        width: 1024,
        color: { dark: "#000000", light: "#ffffff" },
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${safeName}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed to export PNG");
    }
  };

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
        <h2 className="font-semibold text-lg">QR code</h2>
        <p className="text-sm text-zinc-500 mt-1">
          Scans are tracked and counted in real time. The code encodes a short redirect URL
          that forwards to your landing page with the full UTM attribution attached.
        </p>

        {error ? (
          <div className="mt-4 rounded-md border border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200 px-3 py-2 text-sm">
            {error}
          </div>
        ) : (
          <div
            ref={mountRef}
            className="mt-4 flex items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white p-4"
            aria-label="QR code preview"
            dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
          >
            {!svg && <span className="text-xs text-zinc-500">Rendering…</span>}
          </div>
        )}

        <div className="mt-3 rounded-md bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 px-3 py-2 text-[11px] font-mono text-zinc-600 dark:text-zinc-400 break-all">
          {url}
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 px-3 py-2"
          >
            Close
          </button>
          <button
            type="button"
            disabled={!svg}
            onClick={downloadSvg}
            className="apple-tap rounded-md border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 px-3 py-2 text-sm font-medium disabled:opacity-40 hover:border-zinc-500"
          >
            Download SVG
          </button>
          <button
            type="button"
            disabled={!svg}
            onClick={downloadPng}
            className="apple-tap rounded-md bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 px-3 py-2 text-sm font-medium disabled:opacity-40 hover:opacity-90"
          >
            Download PNG
          </button>
        </div>
      </div>
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
