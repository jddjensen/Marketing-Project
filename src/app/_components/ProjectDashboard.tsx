"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CampaignBriefPanel } from "./CampaignBriefPanel";
import { LandingPagesPanel } from "./LandingPagesPanel";
import { PerformanceDashboardPanel } from "./PerformanceDashboardPanel";
import { useDialogChrome } from "./useDialogChrome";
import { useExitAnimation } from "./useExitAnimation";
import { aspectClassForAsset, formatAssetLabel } from "@/lib/channelAssets";
import {
  CHANNELS,
  CHANNEL_BY_KEY,
  CHANNEL_CATEGORY_LABELS,
  CHANNEL_CATEGORY_ORDER,
  CHANNEL_LABELS,
  CHANNEL_ORDER,
  type ChannelMeta,
} from "@/lib/channels";
import type { CampaignBrief } from "@/lib/campaignBrief";
import {
  CUSTOM_CHANNEL_KIND_LABELS,
  isCustomPlatformKey,
  type CustomChannel,
} from "@/lib/customChannels";
import { checkSlotFit, type SlotSpec } from "@/lib/slotFit";

function aspectClass(ratio: string): string {
  return aspectClassForAsset(ratio);
}

type MediaItem = {
  id: string;
  creativeId: string;
  versionNum: number;
  platform: string;
  ratio: string;
  url: string | null;
  posterUrl: string | null;
  name: string | null;
  kind: "image" | "video" | "text";
  copy: Record<string, unknown> | null;
  uploadedAt: number;
  width: number | null;
  height: number | null;
};

type ChannelStatus = { assets: number; warnings: number };

// Resolve the slot spec a media item was uploaded against. Built-in channels
// keep slot metadata on CHANNEL_BY_KEY (item.ratio is the slot key); custom
// channels derive it from the channel's formats (item.ratio is the format id).
// Signage ratios are runtime-derived with no slot metadata here, so signage
// items return null and are simply not fit-checked.
function slotSpecFor(
  platform: string,
  ratio: string,
  customByKey: Map<string, CustomChannel>
): SlotSpec | null {
  const custom = customByKey.get(platform);
  if (custom) {
    const format = custom.formats.find((f) => f.id === ratio);
    if (!format) return null;
    return {
      label: format.label,
      aspect: "",
      ratio: format.width / format.height,
      size: { width: format.width, height: format.height, unit: format.unit },
    };
  }
  const channel = (CHANNEL_BY_KEY as Partial<Record<string, ChannelMeta>>)[
    platform
  ];
  return channel?.slots?.find((slot) => slot.key === ratio) ?? null;
}

// Mirrors the per-item FitBadge verdict on the channel boards: only sized
// image/video files are checked; text creatives and items without stored
// dimensions never count as warnings.
function hasFitWarning(
  item: MediaItem,
  customByKey: Map<string, CustomChannel>
): boolean {
  if (item.kind === "text" || !item.width || !item.height) return false;
  const spec = slotSpecFor(item.platform, item.ratio, customByKey);
  if (!spec) return false;
  const fit = checkSlotFit(spec, item.width, item.height);
  return fit.state === "ratio-mismatch" || fit.state === "undersized";
}

export function ProjectDashboard({
  projectId,
  initialCampaignBrief,
}: {
  projectId: string;
  initialCampaignBrief: CampaignBrief;
}) {
  const [enabled, setEnabled] = useState<string[] | null>(null);
  const [customChannels, setCustomChannels] = useState<CustomChannel[]>([]);
  const [media, setMedia] = useState<MediaItem[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [menuKey, setMenuKey] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<"platform" | "ratio">("platform");

  const fetchPlatforms = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/platforms`, {
      cache: "no-store",
    });
    const body = (await res.json()) as {
      platforms?: Array<{ platform: string; addedAt: number }>;
    };
    setEnabled((body.platforms ?? []).map((p) => p.platform));
  }, [projectId]);

  useEffect(() => {
    let active = true;

    async function loadPlatforms() {
      const res = await fetch(`/api/projects/${projectId}/platforms`, {
        cache: "no-store",
      });
      const body = (await res.json()) as {
        platforms?: Array<{ platform: string; addedAt: number }>;
      };
      if (!active) return;
      setEnabled((body.platforms ?? []).map((p) => p.platform));
    }

    async function loadCustomChannels() {
      const res = await fetch("/api/channels/custom", { cache: "no-store" });
      const body = (await res.json().catch(() => null)) as {
        channels?: CustomChannel[];
      } | null;
      if (!active) return;
      setCustomChannels(body?.channels ?? []);
    }

    async function loadMedia() {
      const res = await fetch(`/api/projects/${projectId}/media`, {
        cache: "no-store",
      });
      const body = (await res.json()) as { items?: MediaItem[] };
      if (!active) return;
      setMedia(body.items ?? []);
    }

    void loadPlatforms();
    void loadMedia();
    void loadCustomChannels();

    return () => {
      active = false;
    };
  }, [projectId]);

  const addPlatform = useCallback(
    async (key: string) => {
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
    async (key: string) => {
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
    return CHANNELS.filter((p) => set.has(p.key));
  }, [enabled]);

  const enabledCustom = useMemo(() => {
    if (!enabled) return [];
    const set = new Set(enabled);
    return customChannels.filter((c) => set.has(c.key));
  }, [enabled, customChannels]);

  const availableToAdd = useMemo(() => {
    if (!enabled) return [];
    const set = new Set(enabled);
    return CHANNELS.filter((p) => !set.has(p.key));
  }, [enabled]);

  const availableCustom = useMemo(() => {
    if (!enabled) return [];
    const set = new Set(enabled);
    return customChannels.filter((c) => !set.has(c.key));
  }, [enabled, customChannels]);

  const customLabels = useMemo(
    () => new Map(customChannels.map((c) => [c.key, c.name])),
    [customChannels]
  );

  const statusByPlatform = useMemo(() => {
    const map = new Map<string, ChannelStatus>();
    if (!media) return map;
    const customByKey = new Map(customChannels.map((c) => [c.key, c]));
    for (const item of media) {
      const entry = map.get(item.platform) ?? { assets: 0, warnings: 0 };
      entry.assets += 1;
      if (hasFitWarning(item, customByKey)) entry.warnings += 1;
      map.set(item.platform, entry);
    }
    return map;
  }, [media, customChannels]);

  const statusFor = useCallback(
    (key: string): ChannelStatus | null =>
      media === null
        ? null
        : (statusByPlatform.get(key) ?? { assets: 0, warnings: 0 }),
    [media, statusByPlatform]
  );

  const openAddDialog = useCallback(() => setAdding(true), []);

  return (
    <main className="stagger mx-auto max-w-7xl space-y-10 px-6 py-10">
      <CampaignBriefPanel
        projectId={projectId}
        initialBrief={initialCampaignBrief}
      />
      <PerformanceDashboardPanel projectId={projectId} />

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-medium tracking-wide text-zinc-500 uppercase">
            Channels
          </h2>
          {(availableToAdd.length > 0 || availableCustom.length > 0) &&
            (enabledMeta.length > 0 || enabledCustom.length > 0) && (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-500 hover:text-zinc-900 dark:border-zinc-800 dark:hover:text-zinc-100"
              >
                + Add channel
              </button>
            )}
        </div>

        {enabled === null ? (
          <div className="text-sm text-zinc-500">Loading…</div>
        ) : enabledMeta.length === 0 && enabledCustom.length === 0 ? (
          <EmptyPlatforms onAdd={() => setAdding(true)} />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {enabledMeta.map((p) => (
              <PlatformCard
                key={p.key}
                name={p.name}
                desc={p.desc}
                status={statusFor(p.key)}
                href={`/projects/${projectId}/${p.key}`}
                menuOpen={menuKey === p.key}
                onOpenMenu={() => setMenuKey(menuKey === p.key ? null : p.key)}
                onCloseMenu={() => setMenuKey(null)}
                onRemove={() => removePlatform(p.key)}
              />
            ))}
            {enabledCustom.map((c) => (
              <PlatformCard
                key={c.key}
                name={c.name}
                desc={
                  c.description ??
                  `Custom ${CUSTOM_CHANNEL_KIND_LABELS[c.kind].toLowerCase()} channel`
                }
                badge={CUSTOM_CHANNEL_KIND_LABELS[c.kind]}
                status={statusFor(c.key)}
                href={`/projects/${projectId}/channels/${c.id}`}
                menuOpen={menuKey === c.key}
                onOpenMenu={() => setMenuKey(menuKey === c.key ? null : c.key)}
                onCloseMenu={() => setMenuKey(null)}
                onRemove={() => removePlatform(c.key)}
              />
            ))}
            {(availableToAdd.length > 0 || availableCustom.length > 0) && (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="apple-tap flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-white/40 p-5 text-zinc-500 hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900/40 dark:hover:border-zinc-600 dark:hover:text-zinc-100"
              >
                <span className="mb-1 text-2xl">+</span>
                <span className="text-sm font-medium">Add channel</span>
              </button>
            )}
          </div>
        )}
      </section>

      <CampaignMedia
        projectId={projectId}
        media={media}
        enabled={enabled ?? []}
        customLabels={customLabels}
        groupBy={groupBy}
        onGroupByChange={setGroupBy}
      />

      <LandingPagesPanel projectId={projectId} />

      <AddPlatformDialog
        open={adding}
        loading={enabled === null}
        options={availableToAdd}
        customOptions={availableCustom}
        onClose={() => setAdding(false)}
        onAdd={addPlatform}
      />

      {/* useSearchParams opts the subtree into client-side rendering during
          prerender, so it lives in its own Suspense boundary rather than at
          the top of the dashboard. */}
      <Suspense fallback={null}>
        <AddChannelParamOpener onOpen={openAddDialog} />
      </Suspense>
    </main>
  );
}

// Contract C1: /projects/<id>?addChannel=1 auto-opens the Add-channel dialog,
// then strips the param so refresh/back doesn't re-trigger it.
function AddChannelParamOpener({ onOpen }: { onOpen: () => void }) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  // One-shot per param appearance: guards strict-mode double effects and the
  // window before router.replace lands, but re-arms if the user deep-links
  // again without this component unmounting.
  const handled = useRef(false);

  useEffect(() => {
    if (searchParams.get("addChannel") !== "1") {
      handled.current = false;
      return;
    }
    if (handled.current) return;
    handled.current = true;
    onOpen();
    router.replace(pathname, { scroll: false });
  }, [searchParams, pathname, router, onOpen]);

  return null;
}

function PlatformCard({
  name,
  desc,
  badge,
  status,
  href,
  menuOpen,
  onOpenMenu,
  onCloseMenu,
  onRemove,
}: {
  name: string;
  desc: string;
  badge?: string;
  status: ChannelStatus | null;
  href: string;
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
    <div className="group relative">
      <Link
        href={href}
        transitionTypes={["nav-forward"]}
        className="apple-lift block rounded-xl border border-zinc-200 bg-white p-5 shadow-[var(--shadow-soft)] hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600"
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold">{name}</span>
          {badge && (
            <span className="rounded-full border border-zinc-200 px-1.5 py-0.5 text-[10px] text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
              {badge}
            </span>
          )}
        </div>
        <div className="mt-1 text-sm text-zinc-500">{desc}</div>
        {status && (
          <div className="mt-2 text-xs">
            {status.assets === 0 ? (
              <span className="text-zinc-400 dark:text-zinc-600">
                No creative yet
              </span>
            ) : (
              <>
                <span className="text-zinc-500">
                  {status.assets} asset{status.assets === 1 ? "" : "s"}
                </span>
                {status.warnings > 0 && (
                  <span className="text-amber-600 dark:text-amber-400">
                    {" · "}
                    {status.warnings} warning{status.warnings === 1 ? "" : "s"}
                  </span>
                )}
              </>
            )}
          </div>
        )}
      </Link>
      <button
        type="button"
        aria-label="Channel menu"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onOpenMenu();
        }}
        className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
      >
        ⋯
      </button>
      {menuOpen && (
        <div
          className="absolute top-10 right-2 z-10 min-w-[140px] rounded-md border border-zinc-200 bg-white py-1 text-sm shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => {
              onCloseMenu();
              onRemove();
            }}
            className="block w-full px-3 py-1.5 text-left text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
          >
            Remove from project
          </button>
          <div className="border-t border-zinc-100 px-3 pt-1 pb-1.5 text-[11px] text-zinc-500 dark:border-zinc-800">
            Removing hides this channel. Uploaded media is kept.
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyPlatforms({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-zinc-300 bg-white/40 py-12 text-center dark:border-zinc-700 dark:bg-zinc-900/40">
      <div className="font-semibold">No channels yet</div>
      <p className="mt-1 max-w-sm text-sm text-zinc-500">
        Add the communication channels you&apos;re using for this campaign to
        start uploading creatives.
      </p>
      <button
        type="button"
        onClick={onAdd}
        className="apple-tap apple-tap mt-4 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:opacity-90 dark:bg-zinc-100 dark:text-zinc-900"
      >
        + Add a channel
      </button>
    </div>
  );
}

function AddPlatformDialog({
  open,
  loading,
  options,
  customOptions,
  onClose,
  onAdd,
}: {
  open: boolean;
  loading: boolean;
  options: ChannelMeta[];
  customOptions: CustomChannel[];
  onClose: () => void;
  onAdd: (key: string) => void;
}) {
  const { mounted, state } = useExitAnimation(open, 200);
  const { dialogRef } = useDialogChrome<HTMLDivElement>({ open, onClose });
  if (!mounted) return null;
  return (
    <div
      className="modal-backdrop fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 px-4 py-6 backdrop-blur-sm sm:items-center"
      data-state={state}
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-channel-title"
        className="modal-surface flex max-h-[calc(100vh-3rem)] w-full max-w-md flex-col rounded-xl border border-zinc-200 bg-white shadow-[var(--shadow-lift)] dark:border-zinc-800 dark:bg-zinc-900"
        data-state={state}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 px-5 pt-5">
          <h2 id="add-channel-title" className="text-lg font-semibold">
            Add channel
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Pick a top-level channel to enable for this project. Placements and
            size slots stay nested inside the channel.
          </p>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {/* The ?addChannel=1 deep link can open this before the platform
              list resolves, so cover the loading and all-added cases. */}
          {loading ? (
            <div className="py-4 text-sm text-zinc-500">Loading channels…</div>
          ) : (
            options.length === 0 &&
            customOptions.length === 0 && (
              <div className="py-4 text-sm text-zinc-500">
                Every channel is already enabled for this project.
              </div>
            )
          )}
          {CHANNEL_CATEGORY_ORDER.map((group) => {
            const items = options.filter((option) => option.category === group);
            if (items.length === 0) return null;
            return (
              <div key={group}>
                <div className="mb-1.5 text-[11px] font-semibold tracking-wide text-zinc-400 uppercase">
                  {CHANNEL_CATEGORY_LABELS[group]}
                </div>
                <div className="space-y-2">
                  {items.map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => onAdd(p.key)}
                      className="flex w-full items-start gap-3 rounded-lg border border-zinc-200 p-3 text-left hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
                    >
                      <div className="flex-1">
                        <div className="text-sm font-medium">{p.name}</div>
                        <div className="mt-0.5 text-xs text-zinc-500">
                          {p.desc}
                        </div>
                      </div>
                      <span className="text-xs text-zinc-400">Add</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
          {customOptions.length > 0 && (
            <div>
              <div className="mb-1.5 text-[11px] font-semibold tracking-wide text-zinc-400 uppercase">
                Your Custom Channels
              </div>
              <div className="space-y-2">
                {customOptions.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => onAdd(c.key)}
                    className="flex w-full items-start gap-3 rounded-lg border border-zinc-200 p-3 text-left hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{c.name}</span>
                        <span className="rounded-full border border-zinc-200 px-1.5 py-0.5 text-[10px] text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                          {CUSTOM_CHANNEL_KIND_LABELS[c.kind]}
                        </span>
                      </div>
                      {c.description && (
                        <div className="mt-0.5 text-xs text-zinc-500">
                          {c.description}
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-zinc-400">Add</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center justify-end border-t border-zinc-200 px-5 py-3 dark:border-zinc-800">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
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
  customLabels,
  groupBy,
  onGroupByChange,
}: {
  projectId: string;
  media: MediaItem[] | null;
  enabled: string[];
  customLabels: Map<string, string>;
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
      const builtIn = CHANNEL_ORDER.filter((k) => map.has(k)).map((k) => ({
        key: k as string,
        label: CHANNEL_LABELS[k],
        items: map.get(k)!,
      }));
      const builtInSet = new Set<string>(CHANNEL_ORDER);
      const custom = Array.from(map.keys())
        .filter((k) => !builtInSet.has(k))
        .sort()
        .map((k) => ({
          key: k,
          label: customLabels.get(k) ?? "Custom channel",
          items: map.get(k)!,
        }));
      return [...builtIn, ...custom];
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, items]) => ({ key: k, label: formatAssetLabel(k), items }));
  }, [media, enabled, customLabels, groupBy]);

  const totalVisible = groups.reduce((sum, g) => sum + g.items.length, 0);

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium tracking-wide text-zinc-500 uppercase">
            Campaign creative
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            Everything uploaded across channels for this project — at a glance.
          </p>
        </div>
        <div className="segmented" role="group" aria-label="Group creatives by">
          {(["platform", "ratio"] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => onGroupByChange(opt)}
              className="segmented-option"
              data-active={groupBy === opt ? "true" : "false"}
              aria-pressed={groupBy === opt ? "true" : "false"}
            >
              {opt === "platform" ? "By channel" : "By slot"}
            </button>
          ))}
        </div>
      </div>

      {media === null ? (
        <div
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6"
          aria-busy="true"
        >
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <div className="skeleton aspect-square w-full" />
              <div className="skeleton h-2.5 w-3/4" />
            </div>
          ))}
        </div>
      ) : totalVisible === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-white/40 py-10 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/40">
          No creatives yet. Upload media from a channel board to see it here.
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <div key={g.key}>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                  {g.label}
                </h3>
                <span className="text-[11px] text-zinc-400">
                  {g.items.length} item{g.items.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {g.items.map((item) => (
                  <CreativeTile
                    key={item.id}
                    item={item}
                    projectId={projectId}
                    groupBy={groupBy}
                  />
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
  const channelLabel =
    (CHANNEL_LABELS as Partial<Record<string, string>>)[item.platform] ??
    (isCustomPlatformKey(item.platform) ? "Custom channel" : item.platform);
  const secondary =
    groupBy === "platform" ? formatAssetLabel(item.ratio) : channelLabel;
  return (
    <Link
      href={`/projects/${projectId}/${item.platform}`}
      transitionTypes={["nav-forward"]}
      className="tile-hover group block rounded-lg"
      title={`${channelLabel} · ${formatAssetLabel(item.ratio)} · ${item.name ?? "Text creative"}`}
    >
      <div
        className={`${aspect} w-full overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 group-hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:group-hover:border-zinc-600`}
      >
        {item.kind === "image" && item.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.url}
            alt={item.name ?? ""}
            className="h-full w-full object-cover"
          />
        ) : item.kind === "video" && item.posterUrl ? (
          // Use the poster as a static thumbnail to avoid downloading the
          // full video just to render a preview tile.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.posterUrl}
            alt={item.name ?? ""}
            className="h-full w-full object-cover"
          />
        ) : item.kind === "video" && item.url ? (
          <video
            src={item.url}
            muted
            playsInline
            preload="metadata"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[10px] tracking-wider text-zinc-500 uppercase">
            Text
          </div>
        )}
      </div>
      <div className="mt-1 flex items-center justify-between text-[11px] text-zinc-500">
        <span className="truncate">{channelLabel}</span>
        <span className="ml-2 shrink-0">{secondary}</span>
      </div>
    </Link>
  );
}
