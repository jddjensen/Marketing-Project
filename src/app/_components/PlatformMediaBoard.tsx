"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { UserMenu } from "./UserMenu";

export type Ratio = string;

export type RatioConfig = {
  key: Ratio;
  label: string;
  aspect: string;
  hint: string;
  recommended?: boolean;
};

type MediaItem = {
  id: string;
  url: string;
  name: string;
  kind: "image" | "video";
  ratio: Ratio;
  uploadedAt: number;
};

type MediaMap = Record<Ratio, MediaItem[]>;

type TrackingItem = {
  id: string;
  platform: string;
  mediaId: string;
  url: string;
  clicks: number;
  createdAt: number;
};

export function PlatformMediaBoard({
  projectId,
  projectName,
  platform,
  title,
  subtitle,
  ratios,
  trackingEnabled = false,
  children,
}: {
  projectId: string;
  projectName: string;
  platform: string;
  title: string;
  subtitle: string;
  ratios: RatioConfig[];
  trackingEnabled?: boolean;
  children?: React.ReactNode;
}) {
  const [media, setMedia] = useState<MediaMap>({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<Ratio | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tracking, setTracking] = useState<Record<string, TrackingItem>>({});

  const fetchMedia = useCallback(async () => {
    const res = await fetch(
      `/api/media?platform=${platform}&projectId=${projectId}`,
      { cache: "no-store" }
    );
    const data = (await res.json()) as MediaMap;
    setMedia(data);
    setLoading(false);
  }, [platform, projectId]);

  const fetchTracking = useCallback(async () => {
    if (!trackingEnabled) return;
    const res = await fetch(
      `/api/tracking?platform=${platform}&projectId=${projectId}`,
      { cache: "no-store" }
    );
    if (!res.ok) return;
    const data = (await res.json()) as { items: TrackingItem[] };
    const map: Record<string, TrackingItem> = {};
    for (const item of data.items) map[item.mediaId] = item;
    setTracking(map);
  }, [platform, projectId, trackingEnabled]);

  useEffect(() => {
    fetchMedia();
    fetchTracking();
  }, [fetchMedia, fetchTracking]);

  const handleUpload = useCallback(
    async (ratio: Ratio, file: File) => {
      setError(null);
      setUploading(ratio);
      try {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("ratio", ratio);
        fd.append("platform", platform);
        fd.append("projectId", projectId);
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? "upload failed");
        }
        await fetchMedia();
      } catch (e) {
        setError(e instanceof Error ? e.message : "upload failed");
      } finally {
        setUploading(null);
      }
    },
    [fetchMedia, platform, projectId]
  );

  const saveTracking = useCallback(
    async (mediaId: string, url: string) => {
      const res = await fetch(`/api/tracking?platform=${platform}&projectId=${projectId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaId, url }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "failed to save url");
      }
      const body = (await res.json()) as { item: TrackingItem };
      setTracking((prev) => ({ ...prev, [mediaId]: body.item }));
    },
    [platform, projectId]
  );

  const removeTracking = useCallback(
    async (mediaId: string) => {
      const res = await fetch(
        `/api/tracking?platform=${platform}&projectId=${projectId}&mediaId=${encodeURIComponent(mediaId)}`,
        { method: "DELETE" }
      );
      if (!res.ok) return;
      setTracking((prev) => {
        const next = { ...prev };
        delete next[mediaId];
        return next;
      });
    },
    [platform, projectId]
  );

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <Link
              href={`/projects/${projectId}`}
              className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              ← {projectName}
            </Link>
            <h1 className="text-2xl font-semibold mt-1">{title}</h1>
            <p className="text-sm text-zinc-500 mt-1">{subtitle}</p>
          </div>
          <div className="flex items-center gap-3">
            {trackingEnabled && (
              <button
                type="button"
                onClick={fetchTracking}
                className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-md px-2 py-1"
              >
                Refresh clicks
              </button>
            )}
            <UserMenu />
          </div>
        </div>
      </header>

      {error && (
        <div className="max-w-7xl mx-auto px-6 pt-4">
          <div className="rounded-md border border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200 px-4 py-2 text-sm">
            {error}
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {ratios.map((r) => (
            <RatioColumn
              key={r.key}
              config={r}
              items={media[r.key] ?? []}
              uploading={uploading === r.key}
              onUpload={handleUpload}
              loading={loading}
              trackingEnabled={trackingEnabled}
              tracking={tracking}
              onSaveTracking={saveTracking}
              onRemoveTracking={removeTracking}
            />
          ))}
        </div>
        {children}
      </main>
    </div>
  );
}

function RatioColumn({
  config,
  items,
  uploading,
  onUpload,
  loading,
  trackingEnabled,
  tracking,
  onSaveTracking,
  onRemoveTracking,
}: {
  config: RatioConfig;
  items: MediaItem[];
  uploading: boolean;
  onUpload: (ratio: Ratio, file: File) => void;
  loading: boolean;
  trackingEnabled: boolean;
  tracking: Record<string, TrackingItem>;
  onSaveTracking: (mediaKey: string, url: string) => Promise<void>;
  onRemoveTracking: (mediaKey: string) => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const onFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((f) => onUpload(config.key, f));
  };

  return (
    <section className="flex flex-col bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-semibold">{config.label}</h2>
            {config.recommended && (
              <span className="text-[10px] uppercase tracking-wide font-medium px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                Recommended
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-500">{config.hint}</p>
        </div>
        <span className="text-xs text-zinc-500">
          {items.length} item{items.length === 1 ? "" : "s"}
        </span>
      </div>

      <div
        className={`m-4 rounded-lg border-2 border-dashed transition-colors ${
          dragOver
            ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
            : "border-zinc-300 dark:border-zinc-700"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          onFiles(e.dataTransfer.files);
        }}
      >
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-full py-5 text-sm text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 disabled:opacity-60"
        >
          {uploading ? "Uploading…" : "Drop file or click to upload"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          onChange={(e) => {
            onFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      <div className="px-4 pb-4 flex-1 flex flex-col gap-4">
        {loading && items.length === 0 ? (
          <div className="text-sm text-zinc-500 py-6 text-center">Loading…</div>
        ) : items.length === 0 ? (
          <div className="text-sm text-zinc-500 py-6 text-center">No media yet.</div>
        ) : (
          items.map((item) => (
            <MediaTile
              key={item.id}
              item={item}
              aspect={config.aspect}
              trackingEnabled={trackingEnabled}
              tracking={tracking[item.id]}
              onSaveTracking={onSaveTracking}
              onRemoveTracking={onRemoveTracking}
            />
          ))
        )}
      </div>
    </section>
  );
}

function MediaTile({
  item,
  aspect,
  trackingEnabled,
  tracking,
  onSaveTracking,
  onRemoveTracking,
}: {
  item: MediaItem;
  aspect: string;
  trackingEnabled: boolean;
  tracking: TrackingItem | undefined;
  onSaveTracking: (mediaId: string, url: string) => Promise<void>;
  onRemoveTracking: (mediaId: string) => Promise<void>;
}) {
  return (
    <figure className="group flex flex-col gap-2">
      <div
        className={`${aspect} w-full rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700`}
      >
        {item.kind === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.url} alt={item.name} className="w-full h-full object-cover" />
        ) : (
          <video src={item.url} controls playsInline className="w-full h-full object-cover" />
        )}
      </div>
      <figcaption className="text-xs text-zinc-500 truncate" title={item.name}>
        {item.name}
      </figcaption>
      {trackingEnabled && (
        <TrackingControls
          mediaId={item.id}
          tracking={tracking}
          onSave={onSaveTracking}
          onRemove={onRemoveTracking}
        />
      )}
    </figure>
  );
}

function TrackingControls({
  mediaId,
  tracking,
  onSave,
  onRemove,
}: {
  mediaId: string;
  tracking: TrackingItem | undefined;
  onSave: (mediaId: string, url: string) => Promise<void>;
  onRemove: (mediaId: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(!tracking);
  const [url, setUrl] = useState(tracking?.url ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const trackingUrl =
    tracking && typeof window !== "undefined"
      ? `${window.location.origin}/c/${tracking.id}`
      : null;

  const submit = async () => {
    setErr(null);
    setBusy(true);
    try {
      await onSave(mediaId, url.trim());
      setEditing(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "failed to save");
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!trackingUrl) return;
    try {
      await navigator.clipboard.writeText(trackingUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* noop */
    }
  };

  if (editing || !tracking) {
    return (
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-2.5 space-y-2">
        <div className="text-[11px] uppercase tracking-wide font-medium text-zinc-500">
          Destination URL
        </div>
        <div className="flex gap-2">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/landing"
            className="flex-1 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={submit}
            disabled={busy || url.trim().length === 0}
            className="rounded-md bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 px-3 py-1.5 text-xs font-medium disabled:opacity-50 hover:opacity-90"
          >
            {busy ? "…" : "Save"}
          </button>
          {tracking && (
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setUrl(tracking.url);
              }}
              className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              Cancel
            </button>
          )}
        </div>
        {err && <div className="text-[11px] text-red-600 dark:text-red-400">{err}</div>}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-2.5 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] uppercase tracking-wide font-medium text-zinc-500">
            Destination
          </div>
          <a
            href={tracking.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline truncate block"
            title={tracking.url}
          >
            {tracking.url}
          </a>
        </div>
        <div className="text-right">
          <div className="text-[11px] uppercase tracking-wide font-medium text-zinc-500">Clicks</div>
          <div className="text-lg font-semibold tabular-nums">{tracking.clicks}</div>
        </div>
      </div>
      <div className="flex items-center gap-2 text-[11px]">
        <span className="text-zinc-500 shrink-0">Tracking link:</span>
        <code
          className="flex-1 truncate bg-zinc-100 dark:bg-zinc-800 rounded px-1.5 py-0.5"
          title={trackingUrl ?? ""}
        >
          {trackingUrl}
        </code>
        <button
          type="button"
          onClick={copy}
          className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <div className="flex items-center justify-end gap-3 text-[11px]">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          Edit URL
        </button>
        <button
          type="button"
          onClick={() => onRemove(mediaId)}
          className="text-zinc-500 hover:text-red-600 dark:hover:text-red-400"
        >
          Remove
        </button>
      </div>
    </div>
  );
}
