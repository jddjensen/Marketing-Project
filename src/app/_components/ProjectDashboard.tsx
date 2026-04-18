"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

type PlatformKey = "meta" | "tiktok" | "youtube" | "google-search" | "signage";

type PlatformMeta = {
  key: PlatformKey;
  name: string;
  desc: string;
};

const ALL_PLATFORMS: PlatformMeta[] = [
  { key: "meta", name: "Meta", desc: "Facebook, Instagram, Reels" },
  { key: "tiktok", name: "TikTok", desc: "In-Feed, TopView, Spark Ads" },
  { key: "youtube", name: "YouTube", desc: "In-Stream, Shorts, Bumper" },
  { key: "google-search", name: "Google Search", desc: "Image assets & search terms" },
  { key: "signage", name: "Physical Signage", desc: "Billboards, posters, A-frames, custom" },
];

const PLATFORM_LABEL: Record<PlatformKey, string> = {
  meta: "Meta",
  tiktok: "TikTok",
  youtube: "YouTube",
  "google-search": "Google Search",
  signage: "Signage",
};

const PLATFORM_ORDER: PlatformKey[] = [
  "meta",
  "tiktok",
  "youtube",
  "google-search",
  "signage",
];

function aspectClass(ratio: string): string {
  if (ratio === "1x1") return "aspect-square";
  if (ratio === "9x16") return "aspect-[9/16]";
  if (ratio === "16x9") return "aspect-video";
  const m = ratio.match(/^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/);
  if (m) return `aspect-[${m[1]}/${m[2]}]`;
  return "aspect-square";
}

type MediaItem = {
  id: string;
  platform: PlatformKey;
  ratio: string;
  url: string;
  name: string;
  kind: "image" | "video";
  uploadedAt: number;
};

export function ProjectDashboard({ projectId }: { projectId: string }) {
  const [enabled, setEnabled] = useState<PlatformKey[] | null>(null);
  const [media, setMedia] = useState<MediaItem[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [menuKey, setMenuKey] = useState<PlatformKey | null>(null);
  const [groupBy, setGroupBy] = useState<"platform" | "ratio">("platform");

  const fetchPlatforms = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/platforms`, { cache: "no-store" });
    const body = (await res.json()) as {
      platforms?: Array<{ platform: PlatformKey; addedAt: number }>;
    };
    setEnabled((body.platforms ?? []).map((p) => p.platform));
  }, [projectId]);

  const fetchMedia = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/media`, { cache: "no-store" });
    const body = (await res.json()) as { items?: MediaItem[] };
    setMedia(body.items ?? []);
  }, [projectId]);

  useEffect(() => {
    fetchPlatforms();
    fetchMedia();
  }, [fetchPlatforms, fetchMedia]);

  const addPlatform = useCallback(
    async (key: PlatformKey) => {
      await fetch(`/api/projects/${projectId}/platforms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: key }),
      });
      await fetchPlatforms();
      setAdding(false);
    },
    [projectId, fetchPlatforms]
  );

  const removePlatform = useCallback(
    async (key: PlatformKey) => {
      await fetch(
        `/api/projects/${projectId}/platforms?platform=${encodeURIComponent(key)}`,
        { method: "DELETE" }
      );
      await fetchPlatforms();
    },
    [projectId, fetchPlatforms]
  );

  const enabledMeta = useMemo(() => {
    if (!enabled) return [];
    const set = new Set(enabled);
    return ALL_PLATFORMS.filter((p) => set.has(p.key));
  }, [enabled]);

  const availableToAdd = useMemo(() => {
    if (!enabled) return [];
    const set = new Set(enabled);
    return ALL_PLATFORMS.filter((p) => !set.has(p.key));
  }, [enabled]);

  return (
    <main className="max-w-7xl mx-auto px-6 py-10 space-y-10">
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">Platforms</h2>
          {availableToAdd.length > 0 && enabledMeta.length > 0 && (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-md px-2 py-1"
            >
              + Add platform
            </button>
          )}
        </div>

        {enabled === null ? (
          <div className="text-sm text-zinc-500">Loading…</div>
        ) : enabledMeta.length === 0 ? (
          <EmptyPlatforms onAdd={() => setAdding(true)} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {enabledMeta.map((p) => (
              <PlatformCard
                key={p.key}
                platform={p}
                projectId={projectId}
                menuOpen={menuKey === p.key}
                onOpenMenu={() => setMenuKey(menuKey === p.key ? null : p.key)}
                onCloseMenu={() => setMenuKey(null)}
                onRemove={() => removePlatform(p.key)}
              />
            ))}
            {availableToAdd.length > 0 && (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="apple-tap rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-white/40 dark:bg-zinc-900/40 hover:border-zinc-400 dark:hover:border-zinc-600 flex flex-col items-center justify-center p-5 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
              >
                <span className="text-2xl mb-1">+</span>
                <span className="text-sm font-medium">Add platform</span>
              </button>
            )}
          </div>
        )}
      </section>

      <CampaignMedia
        projectId={projectId}
        media={media}
        enabled={enabled ?? []}
        groupBy={groupBy}
        onGroupByChange={setGroupBy}
      />

      {adding && (
        <AddPlatformDialog
          options={availableToAdd}
          onClose={() => setAdding(false)}
          onAdd={addPlatform}
        />
      )}
    </main>
  );
}

function PlatformCard({
  platform,
  projectId,
  menuOpen,
  onOpenMenu,
  onCloseMenu,
  onRemove,
}: {
  platform: PlatformMeta;
  projectId: string;
  menuOpen: boolean;
  onOpenMenu: () => void;
  onCloseMenu: () => void;
  onRemove: () => void;
}) {
  useEffect(() => {
    if (!menuOpen) return;
    const onClick = () => onCloseMenu();
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen, onCloseMenu]);

  return (
    <div className="relative group">
      <Link
        href={`/projects/${projectId}/${platform.key}`}
        className="apple-lift block rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 hover:border-zinc-400 dark:hover:border-zinc-600 shadow-[var(--shadow-soft)]"
      >
        <div className="font-semibold">{platform.name}</div>
        <div className="text-sm text-zinc-500 mt-1">{platform.desc}</div>
      </Link>
      <button
        type="button"
        aria-label="Platform menu"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onOpenMenu();
        }}
        className="absolute top-2 right-2 w-7 h-7 rounded-md text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
      >
        ⋯
      </button>
      {menuOpen && (
        <div
          className="absolute top-10 right-2 z-10 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg py-1 min-w-[140px] text-sm"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => {
              onCloseMenu();
              onRemove();
            }}
            className="block w-full text-left px-3 py-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
          >
            Remove from project
          </button>
          <div className="px-3 pt-1 pb-1.5 text-[11px] text-zinc-500 border-t border-zinc-100 dark:border-zinc-800">
            Removing hides this platform. Uploaded media is kept.
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyPlatforms({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-white/40 dark:bg-zinc-900/40 py-12 flex flex-col items-center text-center">
      <div className="font-semibold">No platforms yet</div>
      <p className="text-sm text-zinc-500 mt-1 max-w-sm">
        Add the ad platforms you&apos;re running for this campaign to start uploading creatives.
      </p>
      <button
        type="button"
        onClick={onAdd}
        className="apple-tap mt-4 apple-tap rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 px-4 py-2 text-sm font-medium hover:opacity-90"
      >
        + Add a platform
      </button>
    </div>
  );
}

function AddPlatformDialog({
  options,
  onClose,
  onAdd,
}: {
  options: PlatformMeta[];
  onClose: () => void;
  onAdd: (key: PlatformKey) => void;
}) {
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
        <h2 className="font-semibold text-lg">Add platform</h2>
        <p className="text-sm text-zinc-500 mt-1">Pick a platform to enable for this project.</p>
        <div className="mt-4 space-y-2">
          {options.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => onAdd(p.key)}
              className="w-full flex items-start gap-3 rounded-lg border border-zinc-200 dark:border-zinc-800 p-3 text-left hover:border-zinc-400 dark:hover:border-zinc-600"
            >
              <div className="flex-1">
                <div className="font-medium text-sm">{p.name}</div>
                <div className="text-xs text-zinc-500 mt-0.5">{p.desc}</div>
              </div>
              <span className="text-xs text-zinc-400">Add</span>
            </button>
          ))}
        </div>
        <div className="flex items-center justify-end pt-4">
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 px-3 py-2"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function CampaignMedia({
  projectId,
  media,
  enabled,
  groupBy,
  onGroupByChange,
}: {
  projectId: string;
  media: MediaItem[] | null;
  enabled: PlatformKey[];
  groupBy: "platform" | "ratio";
  onGroupByChange: (v: "platform" | "ratio") => void;
}) {
  const groups = useMemo(() => {
    if (!media) return [];
    const enabledSet = new Set(enabled);
    const visible = media.filter((m) => enabledSet.has(m.platform));
    const map = new Map<string, MediaItem[]>();
    for (const item of visible) {
      const key = groupBy === "platform" ? item.platform : item.ratio;
      const arr = map.get(key) ?? [];
      arr.push(item);
      map.set(key, arr);
    }
    if (groupBy === "platform") {
      return PLATFORM_ORDER
        .filter((k) => map.has(k))
        .map((k) => ({ key: k, label: PLATFORM_LABEL[k], items: map.get(k)! }));
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, items]) => ({ key: k, label: `${k.replace("x", ":")}`, items }));
  }, [media, enabled, groupBy]);

  const totalVisible = groups.reduce((sum, g) => sum + g.items.length, 0);

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">
            Campaign creative
          </h2>
          <p className="text-xs text-zinc-500 mt-1">
            Everything uploaded across platforms for this project — at a glance.
          </p>
        </div>
        <div className="flex items-center gap-1 text-xs rounded-md border border-zinc-200 dark:border-zinc-800 p-0.5 bg-white dark:bg-zinc-900">
          {(["platform", "ratio"] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => onGroupByChange(opt)}
              className={`px-2.5 py-1 rounded ${
                groupBy === opt
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
              }`}
            >
              {opt === "platform" ? "By platform" : "By ratio"}
            </button>
          ))}
        </div>
      </div>

      {media === null ? (
        <div className="text-sm text-zinc-500">Loading…</div>
      ) : totalVisible === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-white/40 dark:bg-zinc-900/40 py-10 text-sm text-zinc-500 text-center">
          No creatives yet. Upload media from a platform board to see it here.
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <div key={g.key}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  {g.label}
                </h3>
                <span className="text-[11px] text-zinc-400">
                  {g.items.length} item{g.items.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {g.items.map((item) => (
                  <CreativeTile key={item.id} item={item} projectId={projectId} groupBy={groupBy} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function CreativeTile({
  item,
  projectId,
  groupBy,
}: {
  item: MediaItem;
  projectId: string;
  groupBy: "platform" | "ratio";
}) {
  const aspect = aspectClass(item.ratio);
  const secondary = groupBy === "platform" ? item.ratio.replace("x", ":") : PLATFORM_LABEL[item.platform];
  return (
    <Link
      href={`/projects/${projectId}/${item.platform}`}
      className="block group"
      title={`${PLATFORM_LABEL[item.platform]} · ${item.ratio.replace("x", ":")} · ${item.name}`}
    >
      <div
        className={`${aspect} w-full rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 group-hover:border-zinc-400 dark:group-hover:border-zinc-600`}
      >
        {item.kind === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.url} alt={item.name} className="w-full h-full object-cover" />
        ) : (
          <video src={item.url} muted playsInline className="w-full h-full object-cover" />
        )}
      </div>
      <div className="mt-1 flex items-center justify-between text-[11px] text-zinc-500">
        <span className="truncate">{PLATFORM_LABEL[item.platform]}</span>
        <span className="shrink-0 ml-2">{secondary}</span>
      </div>
    </Link>
  );
}
