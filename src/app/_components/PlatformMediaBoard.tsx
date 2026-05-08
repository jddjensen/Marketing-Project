"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { UserMenu } from "./UserMenu";
import { UploadProgressOverlay, type UploadProgressState } from "./UploadProgressOverlay";
import { CreativeCopyPanel } from "./CreativeCopyPanel";
import { VersionHistoryModal } from "./VersionHistoryModal";
import { TextCreativeDialog } from "./TextCreativeDialog";
import { uploadWithProgress } from "@/lib/uploadWithProgress";
import { uploadVideoDirect } from "@/lib/directUpload";
import { extractVideoPoster } from "@/lib/videoThumbnail";
import { platformSupportsTextOnly } from "@/lib/platformCopy";
import type { PlatformKey } from "@/lib/utm";

type Ratio = string;

type RatioConfig = {
  key: Ratio;
  label: string;
  aspect: string;
  hint: string;
  recommended?: boolean;
};

type MediaItem = {
  id: string;
  creativeId: string;
  versionNum: number;
  url: string | null;
  posterUrl: string | null;
  name: string | null;
  kind: "image" | "video" | "text";
  ratio: Ratio;
  copy: Record<string, unknown> | null;
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
  const [uploadState, setUploadState] = useState<UploadProgressState | null>(null);
  const uploadAbort = useRef<AbortController | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tracking, setTracking] = useState<Record<string, TrackingItem>>({});
  const [historyFor, setHistoryFor] = useState<string | null>(null);
  const [textDialog, setTextDialog] = useState<{ ratio: Ratio; ratioLabel: string } | null>(null);
  const platformKey = platform as PlatformKey;
  const showTextOption = platformSupportsTextOnly(platformKey);

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
    async function loadBoard() {
      await Promise.all([fetchMedia(), fetchTracking()]);
    }

    void loadBoard();
  }, [fetchMedia, fetchTracking]);

  const handleUpload = useCallback(
    async (
      ratio: Ratio,
      file: File,
      options?: {
        replaceCreativeId?: string;
        deletePrevious?: boolean;
        carryCopy?: Record<string, unknown> | null;
      }
    ) => {
      // Block concurrent uploads: the abort controller is shared across the
      // single in-flight upload, and the progress overlay only renders one.
      // This also prevents the cross-upload abort interference where
      // cancelling B would leave A running with a stale ref.
      if (uploadAbort.current) {
        setError("Wait for the current upload to finish before starting another.");
        return;
      }
      setError(null);
      setUploading(ratio);
      const controller = new AbortController();
      uploadAbort.current = controller;
      setUploadState({
        fileName: file.name,
        fileIndex: 1,
        fileTotal: 1,
        percent: 0,
        bytesLoaded: 0,
        bytesTotal: file.size,
      });
      try {
        const isVideo = file.type.startsWith("video/");
        const onProgress = ({ loaded, total, percent }: { loaded: number; total: number; percent: number }) => {
          setUploadState((prev) =>
            prev
              ? { ...prev, percent, bytesLoaded: loaded, bytesTotal: total || prev.bytesTotal }
              : prev
          );
        };

        if (isVideo) {
          // Direct-to-storage flow — bypasses the Next.js function so files
          // up to 2 GB go straight from browser to Supabase Storage.
          const poster = await extractVideoPoster(file);
          await uploadVideoDirect({
            file,
            poster,
            projectId,
            platform: platform as PlatformKey,
            ratio,
            replaceCreativeId: options?.replaceCreativeId,
            deletePrevious: options?.deletePrevious,
            copy: options?.carryCopy ?? null,
            signal: controller.signal,
            onProgress,
          });
        } else {
          // Images keep the existing API-route flow so we retain magic-byte
          // sniffing and EXIF stripping.
          const fd = new FormData();
          fd.append("file", file);
          fd.append("ratio", ratio);
          fd.append("platform", platform);
          fd.append("projectId", projectId);
          if (options?.replaceCreativeId) {
            fd.append("replaceCreativeId", options.replaceCreativeId);
            if (options.deletePrevious) fd.append("deletePrevious", "true");
          }
          if (options?.carryCopy && Object.keys(options.carryCopy).length > 0) {
            fd.append("copy", JSON.stringify(options.carryCopy));
          }
          const res = await uploadWithProgress<{ error?: string }>("/api/upload", fd, {
            signal: controller.signal,
            onProgress,
          });
          if (!res.ok) {
            throw new Error(res.body?.error ?? "upload failed");
          }
        }

        await fetchMedia();
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") {
          setError("Upload cancelled");
        } else {
          setError(e instanceof Error ? e.message : "upload failed");
        }
      } finally {
        uploadAbort.current = null;
        setUploadState(null);
        setUploading(null);
      }
    },
    [fetchMedia, platform, projectId]
  );

  const cancelUpload = useCallback(() => {
    uploadAbort.current?.abort();
  }, []);

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
      <header className="apple-header sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <Link
              href={`/projects/${projectId}`}
              transitionTypes={["nav-back"]}
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
                className="apple-tap text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-md px-2 py-1"
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
              onUpload={(ratio, file) => handleUpload(ratio, file)}
              onUploadReplace={(ratio, file, replaceCreativeId, deletePrevious, carryCopy) =>
                handleUpload(ratio, file, { replaceCreativeId, deletePrevious, carryCopy })
              }
              loading={loading}
              trackingEnabled={trackingEnabled}
              tracking={tracking}
              onSaveTracking={saveTracking}
              onRemoveTracking={removeTracking}
              projectId={projectId}
              platform={platformKey}
              showTextOption={showTextOption}
              onOpenHistory={(creativeId) => setHistoryFor(creativeId)}
              onOpenTextDialog={(ratio, ratioLabel) => setTextDialog({ ratio, ratioLabel })}
              onMutated={fetchMedia}
            />
          ))}
        </div>
        {children}
      </main>
      <UploadProgressOverlay state={uploadState} onCancel={cancelUpload} />
      {historyFor && (
        <VersionHistoryModal
          projectId={projectId}
          creativeId={historyFor}
          onClose={() => setHistoryFor(null)}
          onChanged={fetchMedia}
        />
      )}
      {textDialog && (
        <TextCreativeDialog
          projectId={projectId}
          platform={platformKey}
          ratio={textDialog.ratio}
          ratioLabel={textDialog.ratioLabel}
          onClose={() => setTextDialog(null)}
          onSaved={fetchMedia}
        />
      )}
    </div>
  );
}

function RatioColumn({
  config,
  items,
  uploading,
  onUpload,
  onUploadReplace,
  loading,
  trackingEnabled,
  tracking,
  onSaveTracking,
  onRemoveTracking,
  projectId,
  platform,
  showTextOption,
  onOpenHistory,
  onOpenTextDialog,
  onMutated,
}: {
  config: RatioConfig;
  items: MediaItem[];
  uploading: boolean;
  onUpload: (ratio: Ratio, file: File) => void;
  onUploadReplace: (
    ratio: Ratio,
    file: File,
    replaceCreativeId: string,
    deletePrevious: boolean,
    carryCopy: Record<string, unknown> | null
  ) => void;
  loading: boolean;
  trackingEnabled: boolean;
  tracking: Record<string, TrackingItem>;
  onSaveTracking: (mediaKey: string, url: string) => Promise<void>;
  onRemoveTracking: (mediaKey: string) => Promise<void>;
  projectId: string;
  platform: PlatformKey;
  showTextOption: boolean;
  onOpenHistory: (creativeId: string) => void;
  onOpenTextDialog: (ratio: Ratio, ratioLabel: string) => void;
  onMutated: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const onFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((f) => onUpload(config.key, f));
  };

  return (
    <section className="flex flex-col bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-[var(--shadow-soft)]">
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
          accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm"
          multiple
          className="hidden"
          onChange={(e) => {
            onFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {showTextOption && (
        <div className="mx-4 -mt-2 mb-2">
          <button
            type="button"
            onClick={() => onOpenTextDialog(config.key, config.label)}
            className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 underline underline-offset-2 decoration-dotted"
          >
            + New text-only creative
          </button>
        </div>
      )}

      <div className="px-4 pb-4 flex-1 flex flex-col gap-4">
        {loading && items.length === 0 ? (
          <div className="space-y-3" aria-busy="true">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className={`skeleton ${config.aspect} w-full`} />
                <div className="skeleton h-3 w-1/2" />
              </div>
            ))}
          </div>
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
              projectId={projectId}
              platform={platform}
              onReplace={(file, deletePrevious) =>
                onUploadReplace(config.key, file, item.creativeId, deletePrevious, item.copy)
              }
              onOpenHistory={onOpenHistory}
              onMutated={onMutated}
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
  projectId,
  platform,
  onReplace,
  onOpenHistory,
  onMutated,
}: {
  item: MediaItem;
  aspect: string;
  trackingEnabled: boolean;
  tracking: TrackingItem | undefined;
  onSaveTracking: (mediaId: string, url: string) => Promise<void>;
  onRemoveTracking: (mediaId: string) => Promise<void>;
  projectId: string;
  platform: PlatformKey;
  onReplace: (file: File, deletePrevious: boolean) => void;
  onOpenHistory: (creativeId: string) => void;
  onMutated: () => void;
}) {
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [deletePrevious, setDeletePrevious] = useState(false);

  return (
    <figure className="group flex flex-col gap-2">
      <div
        className={`${aspect} w-full rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 relative`}
      >
        {item.kind === "image" && item.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.url} alt={item.name ?? ""} className="w-full h-full object-cover" />
        ) : item.kind === "video" && item.url ? (
          <video
            src={item.url}
            poster={item.posterUrl ?? undefined}
            controls
            playsInline
            preload={item.posterUrl ? "metadata" : "auto"}
            className="w-full h-full object-cover"
          />
        ) : item.kind === "text" ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-zinc-500 px-3 text-center">
            <span className="text-[10px] uppercase tracking-wider">Text creative</span>
            {item.copy && (
              <p className="mt-2 text-xs line-clamp-4 text-zinc-700 dark:text-zinc-300">
                {firstCopySnippet(item.copy)}
              </p>
            )}
          </div>
        ) : null}

        {item.versionNum > 1 && (
          <span
            className="absolute top-1.5 left-1.5 rounded-full bg-zinc-900/80 dark:bg-zinc-100/90 text-white dark:text-zinc-900 text-[10px] font-semibold tracking-wide px-1.5 py-0.5"
            title={`Version ${item.versionNum}`}
          >
            v{item.versionNum}
          </span>
        )}
      </div>

      <figcaption className="text-xs text-zinc-500 truncate" title={item.name ?? ""}>
        {item.name ?? "Text-only creative"}
      </figcaption>

      <div className="flex items-center gap-2 text-[11px]">
        {item.kind !== "text" && (
          <>
            <button
              type="button"
              onClick={() => replaceInputRef.current?.click()}
              className="text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 underline underline-offset-2 decoration-dotted"
            >
              Replace
            </button>
            <label className="flex items-center gap-1 text-zinc-500 cursor-pointer select-none">
              <input
                type="checkbox"
                className="check-tactile"
                checked={deletePrevious}
                onChange={(e) => setDeletePrevious(e.target.checked)}
              />
              delete old
            </label>
            <input
              ref={replaceInputRef}
              type="file"
              aria-label="Replace creative file"
              title="Replace creative file"
              accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onReplace(f, deletePrevious);
                e.target.value = "";
              }}
            />
          </>
        )}
        <button
          type="button"
          onClick={() => onOpenHistory(item.creativeId)}
          className="ml-auto text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 underline underline-offset-2 decoration-dotted"
        >
          History
        </button>
      </div>

      <CreativeCopyPanel
        projectId={projectId}
        creativeId={item.creativeId}
        versionId={item.id}
        platform={platform}
        initialCopy={item.copy}
        onSaved={onMutated}
      />

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

function firstCopySnippet(copy: Record<string, unknown>): string {
  for (const value of Object.values(copy)) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.length > 200 ? `${value.slice(0, 200)}…` : value;
    }
    if (Array.isArray(value) && value.length > 0 && typeof value[0] === "string") {
      return value[0] as string;
    }
  }
  return "(no copy yet)";
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
            className="input-tactile flex-1 text-xs"
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
