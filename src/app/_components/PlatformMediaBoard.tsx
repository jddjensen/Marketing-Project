"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { UserMenu } from "./UserMenu";
import {
  UploadProgressOverlay,
  type UploadProgressState,
  type UploadQueueEntry,
} from "./UploadProgressOverlay";
import { CampaignMoodboardReview } from "./CampaignMoodboardReview";
import { AssetThumb } from "./AssetThumb";
import { ConfirmDialog } from "./ConfirmDialog";
import { CreativeCopyPanel } from "./CreativeCopyPanel";
import { HoverScrubVideo } from "./HoverScrubVideo";
import { VersionHistoryModal } from "./VersionHistoryModal";
import { TextCreativeDialog } from "./TextCreativeDialog";
import { ProjectChannelNav } from "./ProjectChannelNav";
import { uploadWithProgress } from "@/lib/uploadWithProgress";
import { uploadVideoDirect } from "@/lib/directUpload";
import { checkSlotFit, slotTargetText } from "@/lib/slotFit";
import { extractVideoPoster, type VideoMeta } from "@/lib/videoThumbnail";
import { platformSupportsTextOnly } from "@/lib/platformCopy";
import {
  platformUtmBase,
  PLATFORM_DEFAULTS,
  type PlatformKey,
} from "@/lib/utm";

type Ratio = string;

type RatioConfig = {
  key: Ratio;
  label: string;
  aspect: string;
  hint: string;
  recommended?: boolean;
  // Numeric width/height ratio for runtime-defined slots (custom channels),
  // where a build-time Tailwind aspect-[...] class can't exist.
  ratio?: number;
  // Recommended export size, shown in the dropzone and checked after upload.
  size?: { width: number; height: number; unit?: string };
};

type MediaItem = {
  width?: number | null;
  height?: number | null;
  id: string;
  creativeId: string;
  versionNum: number;
  url: string | null;
  thumbUrl?: string | null;
  posterUrl: string | null;
  thumbhash?: string | null;
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
  creativeId: string;
  url: string;
  label: string | null;
  utmSource: string | null;
  utmContent: string | null;
  utmSequence: number | null;
  clicks: number;
  createdAt: number;
};

type LandingPage = {
  id: string;
  url: string;
  label: string | null;
  platform: PlatformKey | null;
};

type SocialIntegration = {
  id: string;
  name: string;
  identifier: string;
  picture?: string | null;
  disabled?: boolean;
  profile?: string | null;
};

type SocialPost = {
  id: string;
  creativeId: string;
  versionId: string | null;
  trackingLinkId: string | null;
  platform: string;
  postizPostId: string | null;
  integrationId: string;
  integrationIdentifier: string;
  integrationName: string;
  state: string;
  publishAt: string | null;
  content: string;
  error: string | null;
  createdAt: number;
};

type SocialPublishingState = {
  configured: boolean;
  baseUrl: string;
  integrations: SocialIntegration[];
  posts: SocialPost[];
  postizError: string | null;
};

type ScheduleSocialPostInput = {
  creativeId: string;
  versionId: string;
  integrationId: string;
  publishAt: string;
  trackingLinkId?: string | null;
};

type UploadOptions = {
  replaceCreativeId?: string;
  deletePrevious?: boolean;
  carryCopy?: Record<string, unknown> | null;
};

type QueueItem = {
  id: number;
  ratio: Ratio;
  slotLabel: string;
  file: File;
  options?: UploadOptions;
  status: UploadQueueEntry["status"];
  percent: number;
  bytesLoaded: number;
  bytesTotal: number;
  error?: string;
  // Soft, non-blocking hint surfaced after a successful upload (e.g. the
  // server detected a byte-identical creative already in this project).
  note?: string;
};

// A drop can outpace the user's intent — the queue lets every file land and
// upload sequentially instead of rejecting all but the first.
const TERMINAL: ReadonlySet<QueueItem["status"]> = new Set([
  "done",
  "skipped",
  "error",
]);

type FitPrompt = {
  fileName: string;
  detail: string;
  resolve: (uploadAnyway: boolean) => void;
};

export function PlatformMediaBoard({
  projectId,
  projectName,
  platform,
  title,
  subtitle,
  ratios,
  trackingEnabled = true,
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
  const [queue, setQueue] = useState<QueueItem[]>([]);
  // Ref mirror so the async pump loop reads current state without re-binding.
  const queueRef = useRef<QueueItem[]>([]);
  const pumpingRef = useRef(false);
  const queueIdRef = useRef(0);
  const uploadAbort = useRef<AbortController | null>(null);
  const [fitPrompt, setFitPrompt] = useState<FitPrompt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tracking, setTracking] = useState<Record<string, TrackingItem>>({});
  const [landingPages, setLandingPages] = useState<LandingPage[] | null>(null);
  const [socialPublishing, setSocialPublishing] =
    useState<SocialPublishingState | null>(null);
  const [moodboardOpen, setMoodboardOpen] = useState(false);
  const [historyFor, setHistoryFor] = useState<string | null>(null);
  const [textDialog, setTextDialog] = useState<{
    ratio: Ratio;
    ratioLabel: string;
  } | null>(null);
  const platformKey = platform as PlatformKey;
  const showTextOption = platformSupportsTextOnly(platformKey);
  const socialPublishingEnabled = isSocialPublishingPlatform(platform);

  const ratiosRef = useRef(ratios);
  useEffect(() => {
    ratiosRef.current = ratios;
  });

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
    for (const item of data.items) map[item.creativeId] = item;
    setTracking(map);
  }, [platform, projectId, trackingEnabled]);

  const fetchLandingPages = useCallback(async () => {
    if (!trackingEnabled) return;
    const res = await fetch(`/api/projects/${projectId}/tracking-links`, {
      cache: "no-store",
    });
    if (!res.ok) {
      setLandingPages([]);
      return;
    }
    const data = (await res.json()) as { links?: LandingPage[] };
    setLandingPages(
      (data.links ?? []).filter((link) => link.platform === null)
    );
  }, [projectId, trackingEnabled]);

  const fetchSocialPublishing = useCallback(async () => {
    if (!isSocialPublishingPlatform(platform)) {
      setSocialPublishing(null);
      return;
    }
    const res = await fetch(
      `/api/projects/${projectId}/social-posts?platform=${encodeURIComponent(platform)}`,
      { cache: "no-store" }
    );
    if (!res.ok) {
      setSocialPublishing({
        configured: false,
        baseUrl: "",
        integrations: [],
        posts: [],
        postizError: "failed to load Postiz publishing",
      });
      return;
    }
    const data = (await res.json()) as SocialPublishingState;
    setSocialPublishing(data);
  }, [platform, projectId]);

  useEffect(() => {
    async function loadBoard() {
      await Promise.all([
        fetchMedia(),
        fetchTracking(),
        fetchLandingPages(),
        fetchSocialPublishing(),
      ]);
    }

    void loadBoard();
  }, [fetchLandingPages, fetchMedia, fetchSocialPublishing, fetchTracking]);

  const scheduleSocialPost = useCallback(
    async (input: ScheduleSocialPostInput) => {
      const res = await fetch(`/api/projects/${projectId}/social-posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const body = (await res.json().catch(() => null)) as {
        item?: SocialPost;
        error?: string;
      } | null;
      if (!res.ok) {
        throw new Error(body?.error ?? "failed to schedule post");
      }
      await fetchSocialPublishing();
      return body?.item ?? null;
    },
    [fetchSocialPublishing, projectId]
  );

  const patchQueueItem = useCallback(
    (id: number, patch: Partial<QueueItem>) => {
      queueRef.current = queueRef.current.map((item) =>
        item.id === id ? { ...item, ...patch } : item
      );
      setQueue(queueRef.current);
    },
    []
  );

  const processItem = useCallback(
    async (item: QueueItem) => {
      const slot = ratiosRef.current.find((r) => r.key === item.ratio);
      patchQueueItem(item.id, { status: "checking" });

      // Read dimensions client-side BEFORE uploading so a wrong-shaped 500 MB
      // video is caught while it's still free to catch. Files we can't decode
      // proceed — "unknown" is not a mismatch.
      const isVideo = item.file.type.startsWith("video/");
      let videoMeta: VideoMeta | null = null;
      let dims: { width: number; height: number } | null = null;
      if (isVideo) {
        videoMeta = await extractVideoPoster(item.file);
        if (videoMeta.width && videoMeta.height) {
          dims = { width: videoMeta.width, height: videoMeta.height };
        }
      } else if (item.file.type.startsWith("image/")) {
        dims = await probeImageDimensions(item.file);
      }

      if (slot && dims) {
        const knownDims = dims;
        const fit = checkSlotFit(slot, knownDims.width, knownDims.height);
        if (fit.state === "ratio-mismatch" || fit.state === "undersized") {
          patchQueueItem(item.id, { status: "confirming" });
          const uploadAnyway = await new Promise<boolean>((resolve) => {
            setFitPrompt({
              fileName: item.file.name,
              detail: fitPromptDetail(slot, knownDims, fit),
              resolve,
            });
          });
          setFitPrompt(null);
          if (!uploadAnyway) {
            patchQueueItem(item.id, { status: "skipped" });
            return;
          }
        }
      }

      patchQueueItem(item.id, { status: "uploading" });
      const controller = new AbortController();
      uploadAbort.current = controller;
      try {
        const onProgress = ({
          loaded,
          total,
          percent,
        }: {
          loaded: number;
          total: number;
          percent: number;
        }) => {
          patchQueueItem(item.id, {
            percent,
            bytesLoaded: loaded,
            bytesTotal: total || item.file.size,
          });
        };

        // A soft "possible duplicate" hint the server may return for images.
        let uploadNote: string | undefined;

        if (isVideo) {
          // Direct-to-storage flow — bypasses the Next.js function so files
          // up to 2 GB go straight from browser to Supabase Storage. Reuses
          // the poster/dimensions extracted during the pre-upload check.
          const meta = videoMeta ?? (await extractVideoPoster(item.file));
          await uploadVideoDirect({
            file: item.file,
            poster: meta.poster,
            thumbhash: meta.thumbhash,
            width: meta.width,
            height: meta.height,
            projectId,
            platform: platform as PlatformKey,
            ratio: item.ratio,
            replaceCreativeId: item.options?.replaceCreativeId,
            deletePrevious: item.options?.deletePrevious,
            copy: item.options?.carryCopy ?? null,
            signal: controller.signal,
            onProgress,
          });
        } else {
          // Images keep the existing API-route flow so we retain magic-byte
          // sniffing and EXIF stripping.
          const fd = new FormData();
          fd.append("file", item.file);
          fd.append("ratio", item.ratio);
          fd.append("platform", platform);
          fd.append("projectId", projectId);
          if (item.options?.replaceCreativeId) {
            fd.append("replaceCreativeId", item.options.replaceCreativeId);
            if (item.options.deletePrevious)
              fd.append("deletePrevious", "true");
          }
          if (
            item.options?.carryCopy &&
            Object.keys(item.options.carryCopy).length > 0
          ) {
            fd.append("copy", JSON.stringify(item.options.carryCopy));
          }
          const res = await uploadWithProgress<{
            error?: string;
            duplicateOf?: { name: string | null } | null;
          }>("/api/upload", fd, {
            signal: controller.signal,
            onProgress,
          });
          if (!res.ok) {
            throw new Error(res.body?.error ?? "upload failed");
          }
          if (res.body?.duplicateOf) {
            const dupName = res.body.duplicateOf.name;
            uploadNote = dupName
              ? `Possible duplicate of "${dupName}"`
              : "Possible duplicate of an existing creative";
          }
        }

        patchQueueItem(item.id, {
          status: "done",
          percent: 100,
          note: uploadNote,
        });
        await fetchMedia();
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") {
          patchQueueItem(item.id, { status: "skipped", error: "Cancelled" });
        } else {
          patchQueueItem(item.id, {
            status: "error",
            error: e instanceof Error ? e.message : "upload failed",
          });
        }
      } finally {
        uploadAbort.current = null;
      }
    },
    [fetchMedia, patchQueueItem, platform, projectId]
  );

  const pump = useCallback(async () => {
    if (pumpingRef.current) return;
    pumpingRef.current = true;
    try {
      while (true) {
        const next = queueRef.current.find((i) => i.status === "queued");
        if (!next) break;
        await processItem(next);
      }
    } finally {
      pumpingRef.current = false;
    }
  }, [processItem]);

  const enqueueFiles = useCallback(
    (
      ratio: Ratio,
      slotLabel: string,
      files: File[],
      options?: UploadOptions
    ) => {
      if (files.length === 0) return;
      setError(null);
      const items = files.map((file) => ({
        id: ++queueIdRef.current,
        ratio,
        slotLabel,
        file,
        options,
        status: "queued" as const,
        percent: 0,
        bytesLoaded: 0,
        bytesTotal: file.size,
      }));
      queueRef.current = [...queueRef.current, ...items];
      setQueue(queueRef.current);
      void pump();
    },
    [pump]
  );

  const cancelCurrent = useCallback(() => {
    uploadAbort.current?.abort();
  }, []);

  const cancelAll = useCallback(() => {
    queueRef.current = queueRef.current.map((item) =>
      item.status === "queued"
        ? { ...item, status: "skipped" as const, error: "Cancelled" }
        : item
    );
    setQueue(queueRef.current);
    uploadAbort.current?.abort();
  }, []);

  const removeQueued = useCallback((id: number) => {
    queueRef.current = queueRef.current.filter(
      (item) => !(item.id === id && item.status === "queued")
    );
    setQueue(queueRef.current);
  }, []);

  const clearQueue = useCallback(() => {
    queueRef.current = [];
    setQueue([]);
  }, []);

  // A fully successful batch dismisses itself; mixed results stay up for
  // review behind the Close button.
  useEffect(() => {
    if (queue.length === 0) return;
    if (!queue.every((i) => TERMINAL.has(i.status))) return;
    if (!queue.every((i) => i.status === "done")) return;
    const t = setTimeout(clearQueue, 1200);
    return () => clearTimeout(t);
  }, [queue, clearQueue]);

  const saveTracking = useCallback(
    async (creativeId: string, landingPageId: string) => {
      const res = await fetch(
        `/api/tracking?platform=${platform}&projectId=${projectId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ creativeId, landingPageId }),
        }
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "failed to save landing page");
      }
      const body = (await res.json()) as { item: TrackingItem };
      setTracking((prev) => ({ ...prev, [creativeId]: body.item }));
    },
    [platform, projectId]
  );

  const removeTracking = useCallback(
    async (creativeId: string) => {
      const res = await fetch(
        `/api/tracking?platform=${platform}&projectId=${projectId}&creativeId=${encodeURIComponent(creativeId)}`,
        { method: "DELETE" }
      );
      if (!res.ok) return;
      setTracking((prev) => {
        const next = { ...prev };
        delete next[creativeId];
        return next;
      });
    },
    [platform, projectId]
  );

  const activeItem =
    queue.find(
      (i) =>
        i.status === "checking" ||
        i.status === "confirming" ||
        i.status === "uploading"
    ) ?? null;
  const overlayState: UploadProgressState | null = activeItem
    ? {
        fileName: activeItem.file.name,
        fileIndex: queue.findIndex((i) => i.id === activeItem.id) + 1,
        fileTotal: queue.length,
        // Pre-upload checks have no byte progress; zeros render the
        // indeterminate "Preparing…" state.
        percent: activeItem.status === "uploading" ? activeItem.percent : 0,
        bytesLoaded:
          activeItem.status === "uploading" ? activeItem.bytesLoaded : 0,
        bytesTotal:
          activeItem.status === "uploading" ? activeItem.bytesTotal : 0,
      }
    : null;
  const queueEntries: UploadQueueEntry[] = queue.map((item) => ({
    id: item.id,
    fileName: item.file.name,
    slotLabel: item.slotLabel,
    status: item.status,
    percent: item.percent,
    error: item.error,
    note: item.note,
  }));

  return (
    <div className="page-shell min-h-screen text-zinc-900 dark:text-zinc-100">
      <header className="apple-header sticky top-0 z-40">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div>
            <Link
              href={`/projects/${projectId}`}
              transitionTypes={["nav-back"]}
              className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              ← {projectName}
            </Link>
            <h1 className="ink-gradient mt-1 text-2xl font-semibold">
              {title}
            </h1>
            <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMoodboardOpen(true)}
              className="apple-tap rounded-md border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-600 hover:border-zinc-400 hover:text-zinc-950 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:text-zinc-100"
            >
              Review moodboard
            </button>
            {trackingEnabled && (
              <button
                type="button"
                onClick={() =>
                  void Promise.all([fetchTracking(), fetchLandingPages()])
                }
                className="apple-tap rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-500 hover:text-zinc-900 dark:border-zinc-800 dark:hover:text-zinc-100"
              >
                Refresh links
              </button>
            )}
            <UserMenu />
          </div>
        </div>
        <ProjectChannelNav projectId={projectId} activePlatform={platformKey} />
      </header>

      {error && (
        <div className="mx-auto max-w-7xl px-6 pt-4">
          <div className="rounded-md border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </div>
        </div>
      )}

      <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
        {socialPublishingEnabled && (
          <SocialPublishingNotice state={socialPublishing} />
        )}
        <div className="stagger grid grid-cols-1 gap-6 lg:grid-cols-3">
          {ratios.map((r) => (
            <RatioColumn
              key={r.key}
              config={r}
              items={media[r.key] ?? []}
              pendingCount={
                queue.filter(
                  (i) => i.ratio === r.key && !TERMINAL.has(i.status)
                ).length
              }
              onUpload={(ratio, files) => enqueueFiles(ratio, r.label, files)}
              onUploadReplace={(
                ratio,
                file,
                replaceCreativeId,
                deletePrevious,
                carryCopy
              ) =>
                enqueueFiles(ratio, r.label, [file], {
                  replaceCreativeId,
                  deletePrevious,
                  carryCopy,
                })
              }
              loading={loading}
              trackingEnabled={trackingEnabled}
              tracking={tracking}
              landingPages={landingPages}
              onSaveTracking={saveTracking}
              onRemoveTracking={removeTracking}
              projectId={projectId}
              platform={platformKey}
              socialPublishing={
                socialPublishingEnabled ? socialPublishing : null
              }
              onScheduleSocialPost={
                socialPublishingEnabled ? scheduleSocialPost : null
              }
              showTextOption={showTextOption}
              onOpenHistory={(creativeId) => setHistoryFor(creativeId)}
              onOpenTextDialog={(ratio, ratioLabel) =>
                setTextDialog({ ratio, ratioLabel })
              }
              onMutated={fetchMedia}
            />
          ))}
        </div>
        {children}
      </main>
      <UploadProgressOverlay
        state={overlayState}
        onCancel={
          activeItem?.status === "uploading" ? cancelCurrent : undefined
        }
        queue={queueEntries}
        onRemoveQueued={removeQueued}
        onCancelAll={cancelAll}
        onClose={clearQueue}
      />
      <FitConfirmDialog prompt={fitPrompt} />
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
      {moodboardOpen && (
        <CampaignMoodboardReview
          projectId={projectId}
          projectName={projectName}
          onClose={() => setMoodboardOpen(false)}
        />
      )}
    </div>
  );
}

// Decode just enough of an image to learn its pixel dimensions.
async function probeImageDimensions(
  file: File
): Promise<{ width: number; height: number } | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const dims = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return dims;
  } catch {
    // Some formats (or older Safari paths) fail createImageBitmap; fall back
    // to a throwaway <img>.
  }
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

function approxRatioText(width: number, height: number): string {
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const g = gcd(width, height);
  const a = width / g;
  const b = height / g;
  // 1919×1080-style near-misses reduce to unreadable fractions; show a
  // decimal instead.
  if (a <= 50 && b <= 50) return `${a}:${b}`;
  return `${(width / height).toFixed(2)}:1`;
}

function fitPromptDetail(
  slot: RatioConfig,
  dims: { width: number; height: number },
  fit: { state: "ratio-mismatch" | "undersized"; expected: string }
): string {
  const actual = `${dims.width} × ${dims.height} px (≈ ${approxRatioText(dims.width, dims.height)})`;
  if (fit.state === "ratio-mismatch") {
    const target = slotTargetText(slot);
    return `This file is ${actual}, but ${slot.label} expects ${fit.expected}${
      target ? ` (${target})` : ""
    }. It may be cropped or letterboxed when published.`;
  }
  return `This file is ${actual}, below the recommended ${fit.expected} for ${slot.label}. It may look soft when published.`;
}

// Wraps ConfirmDialog so the exit animation has content to show after the
// prompt state is cleared.
function FitConfirmDialog({ prompt }: { prompt: FitPrompt | null }) {
  const [latest, setLatest] = useState(prompt);
  if (prompt && prompt !== latest) {
    setLatest(prompt);
  }
  const content = prompt ?? latest;
  if (!content) return null;
  return (
    <ConfirmDialog
      open={prompt !== null}
      title="Doesn't fit this slot"
      message={
        <>
          <span className="block truncate font-medium text-zinc-700 dark:text-zinc-200">
            {content.fileName}
          </span>
          <span className="mt-1 block">{content.detail}</span>
        </>
      }
      confirmLabel="Upload anyway"
      cancelLabel="Skip this file"
      onConfirm={() => content.resolve(true)}
      onCancel={() => content.resolve(false)}
    />
  );
}

function RatioColumn({
  config,
  items,
  pendingCount,
  onUpload,
  onUploadReplace,
  loading,
  trackingEnabled,
  tracking,
  landingPages,
  onSaveTracking,
  onRemoveTracking,
  projectId,
  platform,
  socialPublishing,
  onScheduleSocialPost,
  showTextOption,
  onOpenHistory,
  onOpenTextDialog,
  onMutated,
}: {
  config: RatioConfig;
  items: MediaItem[];
  pendingCount: number;
  onUpload: (ratio: Ratio, files: File[]) => void;
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
  landingPages: LandingPage[] | null;
  onSaveTracking: (mediaKey: string, landingPageId: string) => Promise<void>;
  onRemoveTracking: (mediaKey: string) => Promise<void>;
  projectId: string;
  platform: PlatformKey;
  socialPublishing: SocialPublishingState | null;
  onScheduleSocialPost:
    | ((input: ScheduleSocialPostInput) => Promise<SocialPost | null>)
    | null;
  showTextOption: boolean;
  onOpenHistory: (creativeId: string) => void;
  onOpenTextDialog: (ratio: Ratio, ratioLabel: string) => void;
  onMutated: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const onFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    onUpload(config.key, Array.from(files));
  };

  // Roll per-tile fit verdicts up to the header so a long column's problems
  // are visible without scrolling.
  const measured = items.filter(
    (item) => item.kind !== "text" && item.width && item.height
  );
  const fitCount = measured.filter(
    (item) =>
      checkSlotFit(config, item.width ?? null, item.height ?? null).state ===
      "match"
  ).length;

  return (
    <section className="flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-[var(--shadow-soft)] dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-semibold">{config.label}</h2>
            {config.recommended && (
              <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-emerald-700 uppercase dark:bg-emerald-900/40 dark:text-emerald-300">
                Recommended
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-500">{config.hint}</p>
        </div>
        <div className="text-right text-xs text-zinc-500">
          <div>
            {items.length} item{items.length === 1 ? "" : "s"}
          </div>
          {measured.length > 0 &&
            (fitCount < measured.length ? (
              <div className="font-medium text-amber-600 dark:text-amber-400">
                ⚠ {fitCount} of {measured.length} fit
              </div>
            ) : (
              <div className="tabular-nums">
                {fitCount} of {measured.length} fit
              </div>
            ))}
        </div>
      </div>

      <div
        data-drag={dragOver ? "true" : "false"}
        className="dropzone m-4 rounded-lg border-2 border-dashed border-zinc-300 dark:border-zinc-700"
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
          className="w-full py-4 text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
        >
          <span className="block">
            {pendingCount > 0
              ? `${pendingCount} upload${pendingCount === 1 ? "" : "s"} in queue — drop more anytime`
              : "Drop file or click to upload"}
          </span>
          {slotTargetText(config) && (
            <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-500 tabular-nums dark:bg-zinc-800 dark:text-zinc-400">
              Target {slotTargetText(config)}
            </span>
          )}
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
            className="text-xs text-zinc-500 underline decoration-dotted underline-offset-2 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            + New text-only creative
          </button>
        </div>
      )}

      <div className="flex flex-1 flex-col gap-4 px-4 pb-4">
        {loading && items.length === 0 ? (
          <div className="space-y-3" aria-busy="true">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div
                  className={`skeleton ${config.aspect} w-full`}
                  style={
                    config.ratio ? { aspectRatio: config.ratio } : undefined
                  }
                />
                <div className="skeleton h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="py-6 text-center text-sm text-zinc-500">
            No media yet.
          </div>
        ) : (
          items.map((item) => (
            <MediaTile
              key={item.id}
              item={item}
              slot={config}
              aspect={config.aspect}
              aspectRatio={config.ratio}
              trackingEnabled={trackingEnabled}
              tracking={tracking[item.creativeId]}
              landingPages={landingPages}
              onSaveTracking={onSaveTracking}
              onRemoveTracking={onRemoveTracking}
              projectId={projectId}
              platform={platform}
              socialPublishing={socialPublishing}
              onScheduleSocialPost={onScheduleSocialPost}
              onReplace={(file, deletePrevious) =>
                onUploadReplace(
                  config.key,
                  file,
                  item.creativeId,
                  deletePrevious,
                  item.copy
                )
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
  slot,
  aspect,
  aspectRatio,
  trackingEnabled,
  tracking,
  landingPages,
  onSaveTracking,
  onRemoveTracking,
  projectId,
  platform,
  socialPublishing,
  onScheduleSocialPost,
  onReplace,
  onOpenHistory,
  onMutated,
}: {
  item: MediaItem;
  slot: RatioConfig;
  aspect: string;
  aspectRatio?: number;
  trackingEnabled: boolean;
  tracking: TrackingItem | undefined;
  landingPages: LandingPage[] | null;
  onSaveTracking: (creativeId: string, landingPageId: string) => Promise<void>;
  onRemoveTracking: (creativeId: string) => Promise<void>;
  projectId: string;
  platform: PlatformKey;
  socialPublishing: SocialPublishingState | null;
  onScheduleSocialPost:
    | ((input: ScheduleSocialPostInput) => Promise<SocialPost | null>)
    | null;
  onReplace: (file: File, deletePrevious: boolean) => void;
  onOpenHistory: (creativeId: string) => void;
  onMutated: () => void;
}) {
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [deletePrevious, setDeletePrevious] = useState(false);

  return (
    <figure className="group flex flex-col gap-2">
      <div
        className={`${aspect} relative w-full overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800`}
        style={aspectRatio ? { aspectRatio } : undefined}
      >
        {item.kind === "image" && item.url ? (
          <AssetThumb
            src={item.thumbUrl ?? item.url}
            thumbhash={item.thumbhash}
            width={item.width}
            height={item.height}
            alt={item.name ?? ""}
          />
        ) : item.kind === "video" && item.url ? (
          <HoverScrubVideo
            src={item.url}
            poster={item.posterUrl ?? undefined}
            className="h-full w-full object-cover"
          />
        ) : item.kind === "text" ? (
          <div className="flex h-full w-full flex-col items-center justify-center px-3 text-center text-zinc-500">
            <span className="text-[10px] tracking-wider uppercase">
              Text creative
            </span>
            {item.copy && (
              <p className="mt-2 line-clamp-4 text-xs text-zinc-700 dark:text-zinc-300">
                {firstCopySnippet(item.copy)}
              </p>
            )}
          </div>
        ) : null}

        {item.versionNum > 1 && (
          <span
            className="absolute top-1.5 left-1.5 rounded-full bg-zinc-900/80 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-white dark:bg-zinc-100/90 dark:text-zinc-900"
            title={`Version ${item.versionNum}`}
          >
            v{item.versionNum}
          </span>
        )}
      </div>

      <figcaption
        className="truncate text-xs text-zinc-500"
        title={item.name ?? ""}
      >
        {item.name ?? "Text-only creative"}
      </figcaption>

      {item.kind !== "text" && <FitBadge slot={slot} item={item} />}

      <div className="flex items-center gap-2 text-[11px]">
        {item.kind !== "text" && (
          <>
            <button
              type="button"
              onClick={() => replaceInputRef.current?.click()}
              className="text-zinc-600 underline decoration-dotted underline-offset-2 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
            >
              Replace
            </button>
            <label className="flex cursor-pointer items-center gap-1 text-zinc-500 select-none">
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
          className="ml-auto text-zinc-500 underline decoration-dotted underline-offset-2 hover:text-zinc-900 dark:hover:text-zinc-100"
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
          creativeId={item.creativeId}
          projectId={projectId}
          tracking={tracking}
          landingPages={landingPages}
          onSave={onSaveTracking}
          onRemove={onRemoveTracking}
          platform={platform}
        />
      )}
      {onScheduleSocialPost && (
        <SocialPublishingControls
          item={item}
          state={socialPublishing}
          trackingLinkId={tracking?.id ?? null}
          onSchedule={onScheduleSocialPost}
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
    if (
      Array.isArray(value) &&
      value.length > 0 &&
      typeof value[0] === "string"
    ) {
      return value[0] as string;
    }
  }
  return "(no copy yet)";
}

function isSocialPublishingPlatform(platform: string): boolean {
  return platform === "meta" || platform === "tiktok" || platform === "youtube";
}

function SocialPublishingNotice({
  state,
}: {
  state: SocialPublishingState | null;
}) {
  if (state === null) {
    return (
      <div className="rounded-md border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
        Checking Postiz publishing…
      </div>
    );
  }

  if (!state.configured) {
    return (
      <div className="rounded-md border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
        Postiz scheduling is inactive. Add{" "}
        <code className="rounded bg-zinc-100 px-1 py-0.5 dark:bg-zinc-800">
          POSTIZ_API_KEY
        </code>{" "}
        to enable direct scheduling from this board.
      </div>
    );
  }

  if (state.postizError) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
        {state.postizError}
      </div>
    );
  }

  if (state.integrations.length === 0) {
    return (
      <div className="rounded-md border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
        No matching Postiz channels are connected for this board.
      </div>
    );
  }

  return null;
}

function SocialPublishingControls({
  item,
  state,
  trackingLinkId,
  onSchedule,
}: {
  item: MediaItem;
  state: SocialPublishingState | null;
  trackingLinkId: string | null;
  onSchedule: (input: ScheduleSocialPostInput) => Promise<SocialPost | null>;
}) {
  const firstIntegrationId = state?.integrations[0]?.id ?? "";
  const [integrationId, setIntegrationId] = useState(firstIntegrationId);
  const [trackedFirstIntegrationId, setTrackedFirstIntegrationId] =
    useState(firstIntegrationId);
  const [publishAt, setPublishAt] = useState(() => defaultPublishAt());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<SocialPost | null>(null);

  if (trackedFirstIntegrationId !== firstIntegrationId) {
    setTrackedFirstIntegrationId(firstIntegrationId);
    setIntegrationId((current) => current || firstIntegrationId);
  }

  if (
    !state ||
    !state.configured ||
    state.postizError ||
    state.integrations.length === 0
  ) {
    return null;
  }

  const posts = state.posts.filter(
    (post) => post.creativeId === item.creativeId
  );
  const latest = submitted ?? posts[0] ?? null;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await onSchedule({
        creativeId: item.creativeId,
        versionId: item.id,
        integrationId,
        publishAt: new Date(publishAt).toISOString(),
        trackingLinkId,
      });
      if (result) setSubmitted(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to schedule post");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2 rounded-lg border border-zinc-200 p-2.5 text-xs dark:border-zinc-800">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] font-medium tracking-wide text-zinc-500 uppercase">
          Postiz
        </div>
        {latest && (
          <div className="truncate text-[11px] text-zinc-500">
            {latest.state} · {latest.integrationName}
          </div>
        )}
      </div>
      {latest?.publishAt && (
        <div className="text-[11px] text-zinc-500">
          {formatLocalDateTime(latest.publishAt)}
        </div>
      )}
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <select
          value={integrationId}
          onChange={(event) => setIntegrationId(event.target.value)}
          className="select-tactile text-xs"
          aria-label="Postiz channel"
        >
          {state.integrations.map((integration) => (
            <option key={integration.id} value={integration.id}>
              {integration.name}
              {integration.profile ? ` (${integration.profile})` : ""}
            </option>
          ))}
        </select>
        <input
          type="datetime-local"
          value={publishAt}
          onChange={(event) => setPublishAt(event.target.value)}
          className="input-tactile min-w-44 text-xs"
          aria-label="Publish date"
        />
      </div>
      <div className="flex items-center justify-end gap-2">
        {trackingLinkId && (
          <span className="mr-auto text-[11px] text-zinc-500">
            Tracking link included
          </span>
        )}
        <button
          type="button"
          onClick={submit}
          disabled={busy || !integrationId || !publishAt}
          className="apple-tap rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {busy ? "Scheduling…" : "Schedule"}
        </button>
      </div>
      {error && (
        <div className="text-[11px] text-red-600 dark:text-red-400">
          {error}
        </div>
      )}
    </div>
  );
}

function defaultPublishAt(): string {
  return toDateTimeLocal(new Date(Date.now() + 60 * 60 * 1000));
}

function toDateTimeLocal(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function formatLocalDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

// Channels whose creatives end up on paper or pixels-in-the-world, where the
// tracked link is scanned rather than clicked.
const PRINT_QR_PLATFORMS = new Set<PlatformKey>([
  "signage",
  "flyers",
  "digital-signage",
]);

function TrackingControls({
  creativeId,
  projectId,
  tracking,
  landingPages,
  onSave,
  onRemove,
  platform,
}: {
  creativeId: string;
  projectId: string;
  tracking: TrackingItem | undefined;
  landingPages: LandingPage[] | null;
  onSave: (creativeId: string, landingPageId: string) => Promise<void>;
  onRemove: (creativeId: string) => Promise<void>;
  platform: PlatformKey;
}) {
  const [editing, setEditing] = useState(!tracking);
  const [landingPageId, setLandingPageId] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const defaults = PLATFORM_DEFAULTS[platform];
  const sourcePreview = platformUtmBase(platform);
  const sourceLabel = tracking?.utmSource ?? defaults.source;
  const creativeTag = tracking?.utmContent ?? null;
  const currentLandingPage =
    landingPages?.find((page) => page.url === tracking?.url) ?? null;

  const trackingUrl =
    tracking && typeof window !== "undefined"
      ? `${window.location.origin}/go/${tracking.id}`
      : tracking
        ? `/go/${tracking.id}`
        : null;

  const submit = async () => {
    setErr(null);
    setBusy(true);
    try {
      await onSave(creativeId, landingPageId);
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
      <div className="space-y-2 rounded-lg border border-zinc-200 p-2.5 dark:border-zinc-800">
        <div className="text-[11px] font-medium tracking-wide text-zinc-500 uppercase">
          Landing page
        </div>
        {landingPages === null ? (
          <div className="text-xs text-zinc-500">Loading landing pages…</div>
        ) : landingPages.length === 0 ? (
          <div className="text-xs text-zinc-500">
            Add landing pages from the{" "}
            <Link
              href={`/projects/${projectId}`}
              transitionTypes={["nav-back"]}
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              project dashboard
            </Link>{" "}
            before attaching one to this creative.
          </div>
        ) : (
          <div className="flex gap-2">
            <select
              value={landingPageId}
              onChange={(e) => setLandingPageId(e.target.value)}
              className="select-tactile flex-1 text-xs"
              aria-label="Landing page"
            >
              <option value="">Select landing page</option>
              {landingPages.map((page) => (
                <option key={page.id} value={page.id}>
                  {page.label || page.url}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={submit}
              disabled={busy || landingPageId.length === 0}
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
            >
              {busy ? "…" : "Save"}
            </button>
            {tracking && (
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setLandingPageId(currentLandingPage?.id ?? "");
                }}
                className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
              >
                Cancel
              </button>
            )}
          </div>
        )}
        <div className="text-[11px] text-zinc-500">
          Source will attach as{" "}
          <span className="font-mono">{sourcePreview}</span>
          {", "}
          <span className="font-mono">{sourcePreview}2</span>
          {", and so on when saved."}
        </div>
        {err && (
          <div className="text-[11px] text-red-600 dark:text-red-400">
            {err}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-zinc-200 p-2.5 dark:border-zinc-800">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-medium tracking-wide text-zinc-500 uppercase">
            Landing page
          </div>
          <a
            href={tracking.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block truncate text-xs text-blue-600 hover:underline dark:text-blue-400"
            title={tracking.url}
          >
            {tracking.label || tracking.url}
          </a>
          <div className="mt-0.5 text-[11px] text-zinc-500">
            Source: <span className="font-mono">{sourceLabel}</span>
            {creativeTag && (
              <>
                {" "}
                <span className="text-zinc-400">/</span> Creative:{" "}
                <span className="font-mono">{creativeTag}</span>
              </>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[11px] font-medium tracking-wide text-zinc-500 uppercase">
            Clicks
          </div>
          <div className="text-lg font-semibold tabular-nums">
            {tracking.clicks}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 text-[11px]">
        <span className="shrink-0 text-zinc-500">Tracking link:</span>
        <code
          className="flex-1 truncate rounded bg-zinc-100 px-1.5 py-0.5 dark:bg-zinc-800"
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
      {PRINT_QR_PLATFORMS.has(platform) && trackingUrl && (
        <QrActions
          url={trackingUrl}
          name={tracking.label || tracking.utmContent || "tracking-link"}
        />
      )}
      <div className="flex items-center justify-end gap-3 text-[11px]">
        <button
          type="button"
          onClick={() => {
            setLandingPageId(currentLandingPage?.id ?? "");
            setEditing(true);
          }}
          className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          Change landing page
        </button>
        <button
          type="button"
          onClick={() => onRemove(creativeId)}
          className="text-zinc-500 hover:text-red-600 dark:hover:text-red-400"
        >
          Remove
        </button>
      </div>
    </div>
  );
}

// Inline QR preview + downloads for creatives that ship to print: the code
// encodes the same tracked redirect the Copy button copies, so scans count
// alongside clicks.
function QrActions({ url, name }: { url: string; name: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toString(url, {
      type: "svg",
      errorCorrectionLevel: "M",
      margin: 1,
      width: 64,
      color: { dark: "#000000", light: "#ffffff" },
    })
      .then((out) => {
        if (!cancelled) setSvg(out);
      })
      .catch(() => {
        if (!cancelled) setExportError("Couldn't render the QR code.");
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  const safeName =
    name
      .toLowerCase()
      .replace(/https?:\/\//g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "tracking-link";

  const downloadSvg = async () => {
    try {
      // Re-render at print margin rather than reusing the tiny preview SVG.
      const out = await QRCode.toString(url, {
        type: "svg",
        errorCorrectionLevel: "M",
        margin: 2,
        color: { dark: "#000000", light: "#ffffff" },
      });
      const blob = new Blob([out], { type: "image/svg+xml" });
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = `${safeName}-qr.svg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
    } catch {
      setExportError("Couldn't export the SVG.");
    }
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
      a.download = `${safeName}-qr.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      setExportError("Couldn't export the PNG.");
    }
  };

  return (
    <div className="flex items-center gap-2.5 rounded-md border border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-800 dark:bg-zinc-950">
      {svg ? (
        <div
          aria-label="QR code for this tracked link"
          // White padding stays even in dark mode so the printed code scans.
          className="h-16 w-16 shrink-0 overflow-hidden rounded border border-zinc-200 bg-white p-1 dark:border-zinc-700"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : (
        <div className="grid h-16 w-16 shrink-0 place-items-center rounded border border-zinc-200 bg-white text-[10px] text-zinc-400 dark:border-zinc-700">
          …
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-medium tracking-wide text-zinc-500 uppercase">
          Print QR
        </div>
        <div className="mt-1 flex items-center gap-2 text-[11px]">
          <button
            type="button"
            onClick={() => void downloadSvg()}
            disabled={!svg}
            className="rounded border border-zinc-300 px-2 py-0.5 font-medium text-zinc-700 hover:border-zinc-500 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-200 dark:hover:border-zinc-500"
          >
            Download SVG
          </button>
          <button
            type="button"
            onClick={() => void downloadPng()}
            disabled={!svg}
            className="rounded border border-zinc-300 px-2 py-0.5 font-medium text-zinc-700 hover:border-zinc-500 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-200 dark:hover:border-zinc-500"
          >
            Download PNG
          </button>
        </div>
        {exportError && (
          <div className="mt-1 text-[11px] text-red-600 dark:text-red-400">
            {exportError}
          </div>
        )}
      </div>
    </div>
  );
}

function FitBadge({ slot, item }: { slot: RatioConfig; item: MediaItem }) {
  const width = item.width ?? null;
  const height = item.height ?? null;
  if (!width || !height) return null;
  const fit = checkSlotFit(slot, width, height);
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
      <span className="text-zinc-400 tabular-nums dark:text-zinc-500">
        {width} × {height}
      </span>
      {fit.state === "match" && (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
          ✓ Fits {slot.label}
        </span>
      )}
      {fit.state === "ratio-mismatch" && (
        <span
          className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-1.5 py-0.5 font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
          title={`This file's shape doesn't match the ${fit.expected} slot — it may be cropped or letterboxed when published.`}
        >
          ⚠ Doesn&apos;t match {fit.expected}
        </span>
      )}
      {fit.state === "undersized" && (
        <span
          className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-1.5 py-0.5 font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
          title={`Below the recommended export size of ${fit.expected} — it may look soft when published.`}
        >
          ⚠ Below {fit.expected}
        </span>
      )}
    </div>
  );
}
