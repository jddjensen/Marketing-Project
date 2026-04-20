"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { PlatformKey } from "@/lib/utm";

type Project = {
  id: string;
  name: string;
  description: string | null;
  createdAt: number;
  updatedAt: number;
  archivedAt: number | null;
};

type ChannelGroup =
  | "paid-media"
  | "website"
  | "email"
  | "sms"
  | "internal-messaging"
  | "digital-signage"
  | "ott"
  | "pr"
  | "physical-signage"
  | "print";

type ChannelMeta = {
  key: PlatformKey;
  name: string;
  desc: string;
  group: ChannelGroup;
};

const CHANNELS: ChannelMeta[] = [
  { key: "website", name: "Website", desc: "Hero slider, pop up, landing page, blog", group: "website" },
  { key: "email", name: "Email", desc: "Campaign and flow sends", group: "email" },
  { key: "sms", name: "SMS", desc: "Campaign and flow messaging", group: "sms" },
  {
    key: "internal-messaging",
    name: "Internal Messaging",
    desc: "Team Talk and Front Desk FAQ",
    group: "internal-messaging",
  },
  {
    key: "digital-signage",
    name: "Digital Signage",
    desc: "Admission, Info Desk, On Campus screens",
    group: "digital-signage",
  },
  { key: "ott", name: "OTT", desc: "Office and streaming network placements", group: "ott" },
  { key: "pr", name: "PR", desc: "YouTube, influencers, regional and national", group: "pr" },
  { key: "meta", name: "Meta", desc: "Facebook, Instagram, Reels", group: "paid-media" },
  { key: "tiktok", name: "TikTok", desc: "In-Feed, TopView, Spark Ads", group: "paid-media" },
  { key: "youtube", name: "YouTube", desc: "In-Stream, Shorts, Bumper", group: "paid-media" },
  {
    key: "google-search",
    name: "Google Search",
    desc: "Image assets & search terms",
    group: "paid-media",
  },
  {
    key: "signage",
    name: "Physical Signage",
    desc: "Parking lot, H-frames, A-frame, bathroom, banners, evergreen",
    group: "physical-signage",
  },
  {
    key: "flyers",
    name: "Flyers",
    desc: "Letter flyers, half-sheets, one-pagers, handouts",
    group: "print",
  },
];

const GROUP_ORDER: ChannelGroup[] = [
  "website",
  "email",
  "sms",
  "internal-messaging",
  "digital-signage",
  "ott",
  "pr",
  "paid-media",
  "physical-signage",
  "print",
];

const GROUP_LABEL: Record<ChannelGroup, string> = {
  website: "Website",
  email: "Email",
  sms: "SMS",
  "internal-messaging": "Internal Messaging",
  "digital-signage": "Digital Signage",
  ott: "OTT",
  pr: "PR",
  "paid-media": "Paid Media",
  "physical-signage": "Physical Signage",
  print: "Print",
};

const ALL_KEYS: PlatformKey[] = CHANNELS.map((c) => c.key);
const PHYSICAL_GROUPS = new Set<ChannelGroup>(["physical-signage", "print"]);
const DIGITAL_KEYS: PlatformKey[] = CHANNELS.filter((c) => !PHYSICAL_GROUPS.has(c.group)).map((c) => c.key);
const PHYSICAL_KEYS: PlatformKey[] = CHANNELS.filter((c) => PHYSICAL_GROUPS.has(c.group)).map((c) => c.key);

type PresetKey = "all" | "digital" | "physical" | "custom";

function detectPreset(selected: Set<PlatformKey>): PresetKey {
  const sameSet = (keys: PlatformKey[]) =>
    keys.length === selected.size && keys.every((k) => selected.has(k));
  if (sameSet(ALL_KEYS)) return "all";
  if (sameSet(DIGITAL_KEYS)) return "digital";
  if (sameSet(PHYSICAL_KEYS)) return "physical";
  return "custom";
}

const GRADIENTS = [
  "from-orange-400 via-pink-400 to-rose-500",
  "from-sky-400 via-indigo-500 to-violet-600",
  "from-emerald-400 via-teal-500 to-cyan-600",
  "from-amber-400 via-orange-500 to-red-500",
  "from-fuchsia-400 via-purple-500 to-indigo-600",
  "from-lime-400 via-emerald-500 to-teal-600",
];

function hashGradient(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return GRADIENTS[Math.abs(h) % GRADIENTS.length];
}

function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  const d = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (d < 1) return "today";
  if (d < 7) return `${d}d ago`;
  if (d < 30) return `${Math.floor(d / 7)}w ago`;
  if (d < 365) return `${Math.floor(d / 30)}mo ago`;
  return `${Math.floor(d / 365)}y ago`;
}

export function ProjectsGrid() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    const qs = showArchived ? "?includeArchived=1" : "";
    const res = await fetch(`/api/projects${qs}`, { cache: "no-store" });
    const body = (await res.json()) as { projects?: Project[] };
    setProjects(body.projects ?? []);
  }, [showArchived]);

  useEffect(() => {
    let active = true;

    async function loadProjects() {
      const qs = showArchived ? "?includeArchived=1" : "";
      const res = await fetch(`/api/projects${qs}`, { cache: "no-store" });
      const body = (await res.json()) as { projects?: Project[] };
      if (!active) return;
      setProjects(body.projects ?? []);
    }

    void loadProjects();

    return () => {
      active = false;
    };
  }, [showArchived]);

  const onCreate = useCallback(
    async (input: { name: string; description: string | null; platforms: PlatformKey[] }) => {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        const body = (await res.json()) as { project?: Project; error?: string };
        if (!res.ok || !body.project) throw new Error(body.error ?? "failed to create");
        setCreating(false);
        router.push(`/projects/${body.project.id}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "failed to create");
      } finally {
        setBusy(false);
      }
    },
    [router]
  );

  const onArchive = useCallback(
    async (id: string, archive: boolean) => {
      const res = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archive }),
      });
      if (res.ok) fetchProjects();
    },
    [fetchProjects]
  );

  const onDelete = useCallback(
    async (id: string, name: string) => {
      if (!window.confirm(`Delete "${name}" and all of its media? This cannot be undone.`)) {
        return;
      }
      const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
      if (res.ok) fetchProjects();
    },
    [fetchProjects]
  );

  const active = useMemo(
    () => (projects ?? []).filter((p) => !p.archivedAt),
    [projects]
  );
  const archived = useMemo(
    () => (projects ?? []).filter((p) => p.archivedAt),
    [projects]
  );

  return (
    <main className="max-w-7xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3 text-sm">
          <span className="font-medium uppercase tracking-wide text-zinc-500">Projects</span>
          <label className="flex items-center gap-1.5 text-xs text-zinc-500">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="accent-zinc-900 dark:accent-zinc-100"
            />
            Show archived
          </label>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="apple-tap rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 px-3 py-1.5 text-sm font-medium hover:opacity-90"
        >
          + New project
        </button>
      </div>

      {projects === null ? (
        <div className="text-sm text-zinc-500">Loading…</div>
      ) : active.length === 0 && archived.length === 0 ? (
        <EmptyState onCreate={() => setCreating(true)} />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {active.map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                menuOpen={menuId === p.id}
                onOpenMenu={() => setMenuId(menuId === p.id ? null : p.id)}
                onCloseMenu={() => setMenuId(null)}
                onArchive={() => onArchive(p.id, true)}
                onDelete={() => onDelete(p.id, p.name)}
              />
            ))}
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="apple-tap rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-white/40 dark:bg-zinc-900/40 hover:border-zinc-400 dark:hover:border-zinc-600 flex flex-col items-center justify-center aspect-[4/3] text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              <span className="text-3xl mb-2">+</span>
              <span className="text-sm font-medium">New project</span>
            </button>
          </div>

          {showArchived && archived.length > 0 && (
            <div className="mt-12">
              <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500 mb-3">
                Archived
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 opacity-70">
                {archived.map((p) => (
                  <ProjectCard
                    key={p.id}
                    project={p}
                    menuOpen={menuId === p.id}
                    onOpenMenu={() => setMenuId(menuId === p.id ? null : p.id)}
                    onCloseMenu={() => setMenuId(null)}
                    onArchive={() => onArchive(p.id, false)}
                    onDelete={() => onDelete(p.id, p.name)}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {creating && (
        <CreateDialog
          busy={busy}
          error={error}
          onClose={() => {
            setCreating(false);
            setError(null);
          }}
          onSubmit={onCreate}
        />
      )}
    </main>
  );
}

function ProjectCard({
  project,
  menuOpen,
  onOpenMenu,
  onCloseMenu,
  onArchive,
  onDelete,
}: {
  project: Project;
  menuOpen: boolean;
  onOpenMenu: () => void;
  onCloseMenu: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onCloseMenu();
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen, onCloseMenu]);

  return (
    <div className="relative group">
      <Link
        href={`/projects/${project.id}`}
        className="apple-lift block rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-400 dark:hover:border-zinc-600 shadow-[var(--shadow-soft)]"
      >
        <div
          className={`aspect-[4/3] bg-gradient-to-br ${hashGradient(project.id)} p-4 flex flex-col justify-end`}
        >
          <div className="text-white drop-shadow">
            <div className="font-semibold text-lg leading-tight">{project.name}</div>
            {project.description && (
              <div className="text-xs opacity-90 mt-0.5 line-clamp-2">{project.description}</div>
            )}
          </div>
        </div>
        <div className="px-4 py-2.5 flex items-center justify-between text-xs text-zinc-500">
          <span>
            {project.archivedAt
              ? `Archived ${formatRelative(project.archivedAt)}`
              : `Updated ${formatRelative(project.updatedAt)}`}
          </span>
        </div>
      </Link>

      <button
        type="button"
        aria-label="Project menu"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onOpenMenu();
        }}
        className="absolute top-2 right-2 w-7 h-7 rounded-md bg-black/30 hover:bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
      >
        ⋯
      </button>

      {menuOpen && (
        <div
          ref={menuRef}
          className="absolute top-10 right-2 z-10 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg py-1 min-w-[140px] text-sm"
        >
          <button
            type="button"
            onClick={() => {
              onCloseMenu();
              onArchive();
            }}
            className="block w-full text-left px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            {project.archivedAt ? "Unarchive" : "Archive"}
          </button>
          <button
            type="button"
            onClick={() => {
              onCloseMenu();
              onDelete();
            }}
            className="block w-full text-left px-3 py-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

function CreateDialog({
  busy,
  error,
  onClose,
  onSubmit,
}: {
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (input: { name: string; description: string | null; platforms: PlatformKey[] }) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<Set<PlatformKey>>(() => new Set(ALL_KEYS));

  const preset = detectPreset(selected);

  const applyPreset = (p: Exclude<PresetKey, "custom">) => {
    if (p === "all") setSelected(new Set(ALL_KEYS));
    else if (p === "digital") setSelected(new Set(DIGITAL_KEYS));
    else setSelected(new Set(PHYSICAL_KEYS));
  };

  const toggle = (key: PlatformKey) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const canSubmit = !busy && name.trim().length > 0 && selected.size > 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <div
        className="modal-surface w-full max-w-xl rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-[var(--shadow-lift)] max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-5">
          <h2 className="font-semibold text-lg">New project</h2>
          <p className="text-sm text-zinc-500 mt-1">
            A project gathers every communication channel in one place, from website and email to
            digital signage, OTT, PR, physical signage, and flyers.
          </p>
        </div>

        <form
          className="flex-1 overflow-y-auto px-5 py-4 space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (!canSubmit) return;
            onSubmit({
              name: name.trim(),
              description: description.trim() ? description.trim() : null,
              platforms: Array.from(selected),
            });
          }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-1">
              <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Name
              </label>
              <input
                autoFocus
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Q2 Spring Launch"
                maxLength={120}
                className="mt-1 w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Description <span className="text-zinc-400 normal-case">(optional)</span>
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Regional launch targeting Pacific Northwest, April–June"
                maxLength={240}
                className="mt-1 w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Channels
              </label>
              <span className="text-[11px] text-zinc-400">
                {selected.size} selected
              </span>
            </div>

            <div className="mt-2 flex flex-wrap gap-1.5">
              {(
                [
                  { key: "all" as const, label: "Full inventory" },
                  { key: "digital" as const, label: "Non-physical" },
                  { key: "physical" as const, label: "Physical only" },
                ]
              ).map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => applyPreset(p.key)}
                  className={`text-xs rounded-full border px-3 py-1 transition-colors ${
                    preset === p.key
                      ? "bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100"
                      : "border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:border-zinc-400 dark:hover:border-zinc-500"
                  }`}
                >
                  {p.label}
                </button>
              ))}
              {preset === "custom" && (
                <span className="text-xs rounded-full border border-dashed border-zinc-300 dark:border-zinc-700 px-3 py-1 text-zinc-500">
                  Custom
                </span>
              )}
            </div>

            <div className="mt-3 space-y-4">
              {GROUP_ORDER.map((group) => {
                const items = CHANNELS.filter((c) => c.group === group);
                if (items.length === 0) return null;
                return (
                  <div key={group}>
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400 mb-1.5">
                      {GROUP_LABEL[group]}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {items.map((c) => {
                        const checked = selected.has(c.key);
                        return (
                          <label
                            key={c.key}
                            className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                              checked
                                ? "border-zinc-900 dark:border-zinc-100 bg-zinc-50 dark:bg-zinc-800/60"
                                : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600"
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="mt-0.5 accent-zinc-900 dark:accent-zinc-100"
                              checked={checked}
                              onChange={() => toggle(c.key)}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium">{c.name}</div>
                              <div className="text-xs text-zinc-500 mt-0.5">{c.desc}</div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {error && (
            <div className="rounded-md border border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200 px-3 py-2 text-sm">
              {error}
            </div>
          )}
        </form>

        <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-zinc-200 dark:border-zinc-800">
          <span className="text-[11px] text-zinc-500">
            You can add or remove channels anytime from the project dashboard.
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 px-3 py-2"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!canSubmit}
              onClick={() => {
                if (!canSubmit) return;
                onSubmit({
                  name: name.trim(),
                  description: description.trim() ? description.trim() : null,
                  platforms: Array.from(selected),
                });
              }}
              className="apple-tap rounded-md bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 px-4 py-2 text-sm font-medium disabled:opacity-50 hover:opacity-90"
            >
              {busy ? "Creating…" : "Create project"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-white/40 dark:bg-zinc-900/40 py-16 flex flex-col items-center text-center">
      <div className="text-lg font-semibold">No projects yet</div>
      <p className="text-sm text-zinc-500 mt-1 max-w-sm">
        Create your first project to start organizing channels, uploading creatives, tracking
        clicks, and managing search terms.
      </p>
      <button
        type="button"
        onClick={onCreate}
        className="apple-tap mt-4 apple-tap rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 px-4 py-2 text-sm font-medium hover:opacity-90"
      >
        + New project
      </button>
    </div>
  );
}
