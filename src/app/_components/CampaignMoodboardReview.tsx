"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { aspectClassForAsset, formatAssetLabel } from "@/lib/channelAssets";
import { CHANNEL_LABELS } from "@/lib/channels";
import type { PlatformKey } from "@/lib/utm";
import { AssetThumb } from "./AssetThumb";

type MoodboardItem = {
  id: string;
  creativeId: string;
  versionNum: number;
  platform: PlatformKey;
  ratio: string;
  url: string | null;
  posterUrl: string | null;
  thumbhash?: string | null;
  name: string | null;
  kind: "image" | "video" | "text";
  copy: Record<string, unknown> | null;
  uploadedAt: number;
};

function firstCopySnippet(copy: Record<string, unknown> | null): string {
  if (!copy) return "Text creative";
  for (const value of Object.values(copy)) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.length > 180 ? `${value.slice(0, 180)}...` : value;
    }
    if (
      Array.isArray(value) &&
      value.length > 0 &&
      typeof value[0] === "string"
    ) {
      return value[0] as string;
    }
  }
  return "Text creative";
}

function displayName(item: MoodboardItem) {
  return item.name || firstCopySnippet(item.copy);
}

function itemMeta(item: MoodboardItem) {
  return `${CHANNEL_LABELS[item.platform]} / ${formatAssetLabel(item.ratio)}`;
}

function getVisualUrl(item: MoodboardItem) {
  return item.kind === "video" ? item.posterUrl || item.url : item.url;
}

export function CampaignMoodboardReview({
  projectId,
  projectName,
  onClose,
}: {
  projectId: string;
  projectName: string;
  onClose: () => void;
}) {
  const [items, setItems] = useState<MoodboardItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadMedia() {
      setError(null);
      const res = await fetch(`/api/projects/${projectId}/media`, {
        cache: "no-store",
      });
      const body = (await res.json().catch(() => null)) as {
        items?: MoodboardItem[];
        error?: string;
      } | null;
      if (!active) return;
      if (!res.ok) {
        setError(body?.error ?? "failed to load project media");
        setItems([]);
        return;
      }
      setItems(body?.items ?? []);
    }

    void loadMedia();
    return () => {
      active = false;
    };
  }, [projectId]);

  const orderedItems = useMemo(() => {
    const source = items ?? [];
    return [...source].sort((a, b) => b.uploadedAt - a.uploadedAt);
  }, [items]);

  const advance = useCallback(() => {
    setActiveIndex((current) => {
      if (orderedItems.length <= 1) return 0;
      return (current + 1) % orderedItems.length;
    });
    setCycle((current) => current + 1);
  }, [orderedItems.length]);

  useEffect(() => {
    if (paused || orderedItems.length <= 1) return;
    const interval = window.setInterval(advance, 3200);
    return () => window.clearInterval(interval);
  }, [advance, orderedItems.length, paused]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight" || event.key === " ") {
        event.preventDefault();
        advance();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [advance, onClose]);

  const activeItem = orderedItems[activeIndex] ?? null;
  const collageItems = orderedItems;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Campaign moodboard review"
      className="modal-backdrop fixed inset-0 z-50 bg-zinc-950/80 px-4 py-4 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="modal-surface mx-auto flex h-full max-h-[calc(100vh-2rem)] w-full max-w-7xl flex-col overflow-hidden rounded-xl border border-white/10 bg-zinc-950 text-white shadow-[var(--shadow-lift)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-white/10 px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold tracking-wide text-zinc-300 uppercase">
              Campaign Moodboard
            </h2>
            <p className="mt-1 truncate text-xs text-zinc-500">{projectName}</p>
          </div>
          <div className="flex items-center gap-2">
            {orderedItems.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => setPaused((value) => !value)}
                  className="apple-tap rounded-md border border-white/15 px-3 py-2 text-xs font-medium text-zinc-200 hover:border-white/30"
                >
                  {paused ? "Play" : "Pause"}
                </button>
                <button
                  type="button"
                  onClick={advance}
                  className="apple-tap rounded-md bg-white px-3 py-2 text-xs font-medium text-zinc-950 hover:opacity-90"
                >
                  Next
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              className="apple-tap rounded-md border border-white/15 px-3 py-2 text-xs font-medium text-zinc-300 hover:border-white/30"
            >
              Close
            </button>
          </div>
        </div>

        {error ? (
          <div className="m-5 rounded-lg border border-red-400/40 bg-red-950/50 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        ) : orderedItems.length === 0 ? (
          <div className="grid flex-1 place-items-center px-5 text-center">
            <div>
              <div className="text-lg font-semibold">No campaign media yet</div>
              <p className="mt-1 max-w-sm text-sm text-zinc-500">
                Upload creative to any channel and it will appear here for
                review.
              </p>
            </div>
          </div>
        ) : !activeItem ? null : (
          <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
            <button
              type="button"
              onClick={advance}
              className="relative min-h-[360px] overflow-hidden bg-black text-left focus:outline-none"
              aria-label="Show next creative"
            >
              <div
                key={`${activeItem.id}-${cycle}`}
                className="moodboard-feature absolute inset-0 flex items-center justify-center p-5"
              >
                <MoodboardVisual item={activeItem} priority />
              </div>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent p-5">
                <div className="text-xs font-medium tracking-wide text-zinc-400 uppercase">
                  {itemMeta(activeItem)}
                </div>
                <div className="mt-1 line-clamp-2 text-2xl font-semibold">
                  {displayName(activeItem)}
                </div>
                <div className="mt-2 text-xs text-zinc-400">
                  Auto-advancing every few seconds. Click the creative to move
                  faster.
                </div>
              </div>
            </button>

            <div className="min-h-0 overflow-y-auto border-t border-white/10 bg-zinc-950 p-4 lg:border-t-0 lg:border-l">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold tracking-wide text-zinc-400 uppercase">
                    Project Collateral
                  </div>
                  <div className="mt-0.5 text-[11px] text-zinc-500">
                    {orderedItems.length} current item
                    {orderedItems.length === 1 ? "" : "s"}
                  </div>
                </div>
                <div className="text-[11px] text-zinc-500">
                  {activeIndex + 1} / {orderedItems.length}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
                {collageItems.map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveIndex(index);
                      setCycle((current) => current + 1);
                    }}
                    className={`group rounded-lg border bg-zinc-900/80 p-1.5 text-left transition ${
                      item.id === activeItem.id
                        ? "border-white/60"
                        : "border-white/10 hover:border-white/30"
                    }`}
                  >
                    <div
                      className={`${aspectClassForAsset(item.ratio)} overflow-hidden rounded-md bg-zinc-900`}
                    >
                      <MoodboardVisual item={item} compact />
                    </div>
                    <div className="mt-1.5 truncate text-[11px] font-medium text-zinc-300">
                      {displayName(item)}
                    </div>
                    <div className="truncate text-[10px] text-zinc-500">
                      {itemMeta(item)}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MoodboardVisual({
  item,
  compact = false,
  priority = false,
}: {
  item: MoodboardItem;
  compact?: boolean;
  priority?: boolean;
}) {
  const visualUrl = getVisualUrl(item);

  if (item.kind === "text" || !visualUrl) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-md bg-zinc-900 px-4 text-center">
        <div>
          <div className="text-[10px] font-medium tracking-wide text-zinc-500 uppercase">
            Text creative
          </div>
          <div
            className={
              compact
                ? "mt-1 line-clamp-4 text-xs text-zinc-300"
                : "mt-3 max-w-xl text-2xl font-semibold text-zinc-100"
            }
          >
            {firstCopySnippet(item.copy)}
          </div>
        </div>
      </div>
    );
  }

  if (item.kind === "video" && !item.posterUrl) {
    return (
      <video
        src={visualUrl}
        muted
        playsInline
        autoPlay={!compact}
        loop
        preload={priority ? "auto" : "metadata"}
        className="h-full w-full object-contain"
      />
    );
  }

  return (
    <AssetThumb
      src={visualUrl}
      thumbhash={item.thumbhash}
      alt={item.name ?? ""}
      fit="contain"
      eager={priority}
    />
  );
}
