"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { CHANNELS } from "@/lib/channels";
import { customChannelIdFromKey } from "@/lib/customChannels";
import { isUuid } from "@/lib/ids";
import { useDialogChrome } from "./useDialogChrome";
import { useExitAnimation } from "./useExitAnimation";

// Global ⌘K / Ctrl+K command palette, mounted once in the root layout. Data
// (projects, current project's channels) is fetched lazily on first open and
// cached for the session — the component never unmounts, so component state
// and refs double as the session cache.

type PaletteItem = {
  id: string;
  label: string;
  hint?: string;
  href: string;
};

type PaletteGroup = {
  key: string;
  label: string;
  items: PaletteItem[];
  // Index of the group's first item in the flattened results list, so
  // selection can move across group boundaries.
  start: number;
};

type ProjectEntry = { id: string; name: string; description: string | null };
type CustomChannelEntry = { id: string; key: string; name: string };

const ACTION_ITEMS: PaletteItem[] = [
  {
    id: "action-new-campaign",
    label: "New campaign",
    hint: "Create a campaign",
    href: "/?new=1",
  },
  { id: "action-calendar", label: "Calendar", href: "/calendar" },
  { id: "action-settings", label: "Settings", href: "/settings" },
  { id: "action-home", label: "Home", href: "/" },
];

const BUILT_IN_CHANNEL_NAMES = new Map<string, string>(
  CHANNELS.map((channel) => [channel.key, channel.name])
);

function projectIdFromPathname(pathname: string): string | null {
  const match = /^\/projects\/([^/?#]+)/.exec(pathname);
  if (!match) return null;
  return isUuid(match[1]) ? match[1] : null;
}

// Case-insensitive substring first, then in-order subsequence ("gsea" →
// "Google Search") so near-miss typing still finds things.
function matchesQuery(label: string, q: string): boolean {
  const lower = label.toLowerCase();
  if (lower.includes(q)) return true;
  let i = 0;
  for (let j = 0; j < lower.length && i < q.length; j++) {
    if (lower[j] === q[i]) i++;
  }
  return i === q.length;
}

export function CommandPalette() {
  const router = useRouter();
  const pathname = usePathname();
  const baseId = useId();
  const listboxId = `${baseId}-listbox`;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);

  // Session caches. Refs mirror the fetched-or-not state so the open effect
  // can consult them without taking the state values as dependencies.
  const [projects, setProjects] = useState<ProjectEntry[] | null>(null);
  const projectsRef = useRef(projects);
  const [customChannels, setCustomChannels] = useState<
    CustomChannelEntry[] | null
  >(null);
  const customChannelsRef = useRef(customChannels);
  const [currentProject, setCurrentProject] = useState<{
    id: string;
    platforms: string[];
  } | null>(null);
  const platformsCacheRef = useRef(new Map<string, string[]>());

  // Rendered only after a client-side keypress, so navigator is safe here.
  const [isMac] = useState(
    () =>
      typeof navigator !== "undefined" &&
      /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent)
  );

  const { mounted, state } = useExitAnimation(open, 200);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const close = useCallback(() => setOpen(false), []);
  const { dialogRef } = useDialogChrome<HTMLDivElement>({
    open,
    onClose: close,
    initialFocusRef: inputRef,
  });

  // ⌘K / Ctrl+K toggles from anywhere, including while typing in inputs —
  // the modifier means it can't collide with plain text entry.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey || e.repeat)
        return;
      if (e.key.toLowerCase() !== "k") return;
      e.preventDefault();
      if (open) {
        setOpen(false);
      } else {
        setQuery("");
        setSelectedIndex(0);
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // Any navigation closes the palette (activation also closes explicitly,
  // before pushing, so focus return doesn't fight the route change).
  // Tracked-prop render pattern instead of an effect — no side effects here,
  // just state that must follow the pathname.
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setOpen(false);
  }

  // Lazy fetch on open; everything already cached is a no-op.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const tasks: Promise<unknown>[] = [];

    // Global data (projects, custom channels) is written to the cache even if
    // this open was cancelled mid-fetch — it stays valid for the next open.
    if (projectsRef.current === null) {
      tasks.push(
        fetch("/api/projects")
          .then((r) => (r.ok ? r.json() : null))
          .then((data: { projects?: ProjectEntry[] } | null) => {
            if (!data?.projects) return;
            projectsRef.current = data.projects;
            setProjects(data.projects);
          })
          .catch(() => {})
      );
    }

    const projectId = projectIdFromPathname(window.location.pathname);
    if (projectId) {
      const cached = platformsCacheRef.current.get(projectId);
      setCurrentProject(cached ? { id: projectId, platforms: cached } : null);
      if (!cached) {
        tasks.push(
          fetch(`/api/projects/${projectId}/platforms`)
            .then((r) => (r.ok ? r.json() : null))
            .then((data: { platforms?: { platform: string }[] } | null) => {
              if (!data?.platforms) return;
              const keys = data.platforms.map((p) => p.platform);
              platformsCacheRef.current.set(projectId, keys);
              // Only the live open may set the visible project context.
              if (!cancelled)
                setCurrentProject({ id: projectId, platforms: keys });
            })
            .catch(() => {})
        );
      }
      if (customChannelsRef.current === null) {
        tasks.push(
          fetch("/api/channels/custom")
            .then((r) => (r.ok ? r.json() : null))
            .then((data: { channels?: CustomChannelEntry[] } | null) => {
              if (!data?.channels) return;
              customChannelsRef.current = data.channels;
              setCustomChannels(data.channels);
            })
            .catch(() => {})
        );
      }
    } else {
      setCurrentProject(null);
    }

    // Always reset (covers a previous open cancelled mid-fetch, which leaves
    // `loading` true but may have populated the caches anyway).
    setLoading(tasks.length > 0);
    if (tasks.length > 0) {
      Promise.allSettled(tasks).then(() => {
        if (!cancelled) setLoading(false);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [open]);

  const { groups, flatItems } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filter = (items: PaletteItem[]) =>
      q === "" ? items : items.filter((item) => matchesQuery(item.label, q));

    const channelItems: PaletteItem[] = [];
    if (currentProject) {
      channelItems.push({
        id: "channel-overview",
        label: "Project overview",
        href: `/projects/${currentProject.id}`,
      });
      for (const key of currentProject.platforms) {
        const customId = customChannelIdFromKey(key);
        if (customId) {
          const channel = customChannels?.find((c) => c.id === customId);
          if (channel) {
            channelItems.push({
              id: `channel-${key}`,
              label: channel.name,
              href: `/projects/${currentProject.id}/channels/${customId}`,
            });
          }
        } else {
          const name = BUILT_IN_CHANNEL_NAMES.get(key);
          if (name) {
            channelItems.push({
              id: `channel-${key}`,
              label: name,
              href: `/projects/${currentProject.id}/${key}`,
            });
          }
        }
      }
    }

    const projectItems: PaletteItem[] = (projects ?? []).map((p) => ({
      id: `project-${p.id}`,
      label: p.name,
      hint: p.description ?? undefined,
      href: `/projects/${p.id}`,
    }));

    const groups: PaletteGroup[] = [];
    let offset = 0;
    const push = (key: string, label: string, items: PaletteItem[]) => {
      if (items.length === 0) return;
      groups.push({ key, label, items, start: offset });
      offset += items.length;
    };
    push("actions", "Actions", filter(ACTION_ITEMS));
    push("this-project", "This project", filter(channelItems));
    push("projects", "Projects", filter(projectItems));
    return { groups, flatItems: groups.flatMap((g) => g.items) };
  }, [query, projects, customChannels, currentProject]);

  const clampedIndex =
    flatItems.length === 0 ? -1 : Math.min(selectedIndex, flatItems.length - 1);
  const activeItem = clampedIndex >= 0 ? flatItems[clampedIndex] : null;
  const optionDomId = (item: PaletteItem) => `${baseId}-${item.id}`;
  const activeOptionId = activeItem ? optionDomId(activeItem) : undefined;

  // block:"nearest" never scrolls an already-visible item, so hover-driven
  // selection doesn't cause scroll jumps — only keyboard moves do.
  useEffect(() => {
    if (!open || !activeOptionId) return;
    document
      .getElementById(activeOptionId)
      ?.scrollIntoView({ block: "nearest" });
  }, [open, activeOptionId]);

  const activate = (item: PaletteItem) => {
    setOpen(false);
    router.push(item.href);
  };

  const moveSelection = (delta: number) => {
    setSelectedIndex((prev) => {
      const count = flatItems.length;
      if (count === 0) return 0;
      const current = Math.min(prev, count - 1);
      return (current + delta + count) % count;
    });
  };

  const onPanelKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      moveSelection(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      moveSelection(-1);
    } else if (e.key === "Enter") {
      if (activeItem) {
        e.preventDefault();
        activate(activeItem);
      }
    }
  };

  if (!mounted) return null;

  return (
    <div
      className="modal-backdrop fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-[20vh] backdrop-blur-sm"
      data-state={state}
      onClick={close}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        data-state={state}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onPanelKeyDown}
        className="modal-surface flex max-h-[min(60vh,28rem)] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className="flex shrink-0 items-center gap-3 border-b border-zinc-200 px-4 dark:border-zinc-800">
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="h-4 w-4 shrink-0 text-zinc-400"
          >
            <circle cx="9" cy="9" r="5.5" />
            <path d="m13.5 13.5 3 3" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls={listboxId}
            aria-activedescendant={activeOptionId}
            aria-autocomplete="list"
            aria-label="Search projects, channels, and actions"
            placeholder="Search projects, channels, actions…"
            autoComplete="off"
            spellCheck={false}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            className="min-w-0 flex-1 bg-transparent py-3.5 text-sm outline-none placeholder:text-zinc-400"
          />
          <kbd className="pointer-events-none shrink-0 rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-sans text-[10px] font-medium text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-500">
            {isMac ? "⌘K" : "Ctrl K"}
          </kbd>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto py-2">
          <div role="listbox" id={listboxId} aria-label="Results">
            {groups.map((group) => (
              <div
                key={group.key}
                role="group"
                aria-labelledby={`${baseId}-label-${group.key}`}
              >
                <div
                  id={`${baseId}-label-${group.key}`}
                  role="presentation"
                  className="px-5 pt-3 pb-1 text-[11px] font-semibold tracking-wide text-zinc-400 uppercase"
                >
                  {group.label}
                </div>
                {group.items.map((item, i) => {
                  const itemIndex = group.start + i;
                  const selected = itemIndex === clampedIndex;
                  return (
                    <div
                      key={item.id}
                      id={optionDomId(item)}
                      role="option"
                      aria-selected={selected}
                      onMouseMove={() => {
                        if (!selected) setSelectedIndex(itemIndex);
                      }}
                      // Keep focus in the search input through the click.
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => activate(item)}
                      className={`mx-2 flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm ${
                        selected ? "bg-zinc-100 dark:bg-zinc-800" : ""
                      }`}
                    >
                      <span className="min-w-0 flex-1 truncate">
                        {item.label}
                      </span>
                      {item.hint && (
                        <span className="max-w-[45%] truncate text-xs text-zinc-400">
                          {item.hint}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          {loading && flatItems.length === 0 && (
            <div className="px-5 py-6 text-center text-sm text-zinc-500">
              Loading…
            </div>
          )}
          {!loading && flatItems.length === 0 && (
            <div className="px-5 py-6 text-center text-sm text-zinc-500">
              No results for &ldquo;{query.trim()}&rdquo;
            </div>
          )}
          {loading && flatItems.length > 0 && (
            <div className="px-5 pt-2 pb-1 text-[11px] text-zinc-400">
              Loading…
            </div>
          )}
        </div>

        <div role="status" aria-live="polite" className="sr-only">
          {loading
            ? "Loading results"
            : `${flatItems.length} ${
                flatItems.length === 1 ? "result" : "results"
              } available`}
        </div>
      </div>
    </div>
  );
}
