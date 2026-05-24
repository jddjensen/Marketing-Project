"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CHANNELS,
  CHANNEL_CATEGORY_LABELS,
  CHANNEL_CATEGORY_ORDER,
  NON_PHYSICAL_CHANNEL_KEYS,
  PHYSICAL_CHANNEL_KEYS,
} from "@/lib/channels";
import { apiErrorMessage } from "@/lib/api";
import type { PlatformKey } from "@/lib/utm";
import { EmptyState as SharedEmptyState } from "./EmptyState";
import { ErrorMessage } from "./ErrorMessage";
import { LoadingSkeleton } from "./LoadingSkeleton";
import { Toast } from "./Toast";

type Project = {
  id: string;
  name: string;
  description: string | null;
  createdAt: number;
  updatedAt: number;
  archivedAt: number | null;
};

const ALL_KEYS: PlatformKey[] = CHANNELS.map((c) => c.key);
const DIGITAL_KEYS: PlatformKey[] = [...NON_PHYSICAL_CHANNEL_KEYS];
const PHYSICAL_KEYS: PlatformKey[] = [...PHYSICAL_CHANNEL_KEYS];

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
  const [toast, setToast] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    const qs = showArchived ? "?includeArchived=1" : "";
    const res = await fetch(`/api/projects${qs}`, { cache: "no-store" });
    const body = (await res.json().catch(() => null)) as {
      projects?: Project[];
      error?: unknown;
    } | null;
    if (!res.ok) {
      throw new Error(apiErrorMessage(body, "Failed to load projects."));
    }
    setProjects(body?.projects ?? []);
  }, [showArchived]);

  useEffect(() => {
    let active = true;

    async function loadProjects() {
      try {
        const qs = showArchived ? "?includeArchived=1" : "";
        const res = await fetch(`/api/projects${qs}`, { cache: "no-store" });
        const body = (await res.json().catch(() => null)) as {
          projects?: Project[];
          error?: unknown;
        } | null;
        if (!active) return;
        if (!res.ok) {
          throw new Error(apiErrorMessage(body, "Failed to load projects."));
        }
        setProjects(body?.projects ?? []);
      } catch (e) {
        if (!active) return;
        setProjects([]);
        setToast(e instanceof Error ? e.message : "Failed to load projects.");
      }
    }

    void loadProjects();

    return () => {
      active = false;
    };
  }, [showArchived]);

  const onCreate = useCallback(
    async (input: {
      name: string;
      description: string | null;
      platforms: PlatformKey[];
    }) => {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        const body = (await res.json()) as {
          project?: Project;
          error?: string;
        };
        if (!res.ok || !body.project) {
          throw new Error(apiErrorMessage(body, "Failed to create project."));
        }
        setCreating(false);
        router.push(`/projects/${body.project.id}`, {
          transitionTypes: ["nav-forward"],
        });
      } catch (e) {
        const message =
          e instanceof Error ? e.message : "Failed to create project.";
        setError(message);
        setToast(message);
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
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: unknown;
        } | null;
        setToast(
          apiErrorMessage(
            body,
            archive
              ? "Failed to archive project."
              : "Failed to restore project."
          )
        );
        return;
      }
      try {
        await fetchProjects();
      } catch (e) {
        setToast(
          e instanceof Error ? e.message : "Failed to refresh projects."
        );
      }
    },
    [fetchProjects]
  );

  const onDelete = useCallback(
    async (id: string, name: string) => {
      if (
        !window.confirm(
          `Delete "${name}" and all of its media? This cannot be undone.`
        )
      ) {
        return;
      }
      const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: unknown;
        } | null;
        setToast(apiErrorMessage(body, "Failed to delete project."));
        return;
      }
      try {
        await fetchProjects();
      } catch (e) {
        setToast(
          e instanceof Error ? e.message : "Failed to refresh projects."
        );
      }
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
    <main className="mx-auto max-w-7xl px-6 py-10">
      {toast && (
        <Toast tone="error" message={toast} onDismiss={() => setToast(null)} />
      )}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3 text-sm">
          <span className="font-medium tracking-wide text-zinc-500 uppercase">
            Projects
          </span>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-500 select-none">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="check-tactile"
            />
            Show archived
          </label>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="apple-tap rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 dark:bg-zinc-100 dark:text-zinc-900"
        >
          + New project
        </button>
      </div>

      {projects === null ? (
        <LoadingSkeleton variant="cards" rows={6} />
      ) : active.length === 0 && archived.length === 0 ? (
        <ProjectsEmptyState onCreate={() => setCreating(true)} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
              className="apple-tap flex aspect-[4/3] flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-white/40 text-zinc-500 hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900/40 dark:hover:border-zinc-600 dark:hover:text-zinc-100"
            >
              <span className="mb-2 text-3xl">+</span>
              <span className="text-sm font-medium">New project</span>
            </button>
          </div>

          {showArchived && archived.length > 0 && (
            <div className="mt-12">
              <h2 className="mb-3 text-xs font-medium tracking-wide text-zinc-500 uppercase">
                Archived
              </h2>
              <div className="grid grid-cols-1 gap-4 opacity-70 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        onCloseMenu();
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen, onCloseMenu]);

  return (
    <div className="group relative">
      <Link
        href={`/projects/${project.id}`}
        transitionTypes={["nav-forward"]}
        className="apple-lift block overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-[var(--shadow-soft)] hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600"
      >
        <div
          className={`aspect-[4/3] bg-gradient-to-br ${hashGradient(project.id)} flex flex-col justify-end p-4`}
        >
          <div className="text-white drop-shadow">
            <div className="text-lg leading-tight font-semibold">
              {project.name}
            </div>
            {project.description && (
              <div className="mt-0.5 line-clamp-2 text-xs opacity-90">
                {project.description}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between px-4 py-2.5 text-xs text-zinc-500">
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
        className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-md bg-black/30 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/50"
      >
        ⋯
      </button>

      {menuOpen && (
        <div
          ref={menuRef}
          className="absolute top-10 right-2 z-10 min-w-[140px] rounded-md border border-zinc-200 bg-white py-1 text-sm shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        >
          <button
            type="button"
            onClick={() => {
              onCloseMenu();
              onArchive();
            }}
            className="block w-full px-3 py-1.5 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            {project.archivedAt ? "Unarchive" : "Archive"}
          </button>
          <button
            type="button"
            onClick={() => {
              onCloseMenu();
              onDelete();
            }}
            className="block w-full px-3 py-1.5 text-left text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
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
  onSubmit: (input: {
    name: string;
    description: string | null;
    platforms: PlatformKey[];
  }) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<Set<PlatformKey>>(() => new Set());

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
      className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="modal-surface flex max-h-[90vh] w-full max-w-xl flex-col rounded-xl border border-zinc-200 bg-white shadow-[var(--shadow-lift)] dark:border-zinc-800 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-5">
          <h2 className="text-lg font-semibold">New project</h2>
          <p className="mt-1 text-sm text-zinc-500">
            A project gathers every top-level channel in one place. Channels
            like Website and Meta each hold their own placements and size slots
            inside the channel board.
          </p>
        </div>

        <form
          className="flex-1 space-y-5 overflow-y-auto px-5 py-4"
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="sm:col-span-1">
              <label className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
                Name
              </label>
              <input
                autoFocus
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Q2 Spring Launch"
                maxLength={120}
                className="input-tactile mt-1 w-full"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
                Description{" "}
                <span className="text-zinc-400 normal-case">(optional)</span>
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Regional launch targeting Pacific Northwest, April–June"
                maxLength={240}
                className="input-tactile mt-1 w-full"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
                Channels
              </label>
              <span className="text-[11px] text-zinc-400">
                {selected.size} selected
              </span>
            </div>

            <div className="mt-2 flex flex-wrap gap-1.5">
              {[
                { key: "all" as const, label: "Select all" },
                { key: "digital" as const, label: "Digital" },
                { key: "physical" as const, label: "Physical only" },
              ].map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => applyPreset(p.key)}
                  className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                    preset === p.key
                      ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                      : "border-zinc-200 text-zinc-600 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-500"
                  }`}
                >
                  {p.label}
                </button>
              ))}
              {preset === "custom" && (
                <span className="rounded-full border border-dashed border-zinc-300 px-3 py-1 text-xs text-zinc-500 dark:border-zinc-700">
                  Custom
                </span>
              )}
            </div>

            <div className="mt-3 space-y-4">
              {CHANNEL_CATEGORY_ORDER.map((group) => {
                const items = CHANNELS.filter((c) => c.category === group);
                if (items.length === 0) return null;
                return (
                  <div key={group}>
                    <div className="mb-1.5 text-[11px] font-semibold tracking-wide text-zinc-400 uppercase">
                      {CHANNEL_CATEGORY_LABELS[group]}
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {items.map((c) => {
                        const checked = selected.has(c.key);
                        return (
                          <label
                            key={c.key}
                            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                              checked
                                ? "border-zinc-900 bg-zinc-50 dark:border-zinc-100 dark:bg-zinc-800/60"
                                : "border-zinc-200 hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="check-tactile mt-0.5"
                              checked={checked}
                              onChange={() => toggle(c.key)}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-medium">
                                {c.name}
                              </div>
                              <div className="mt-0.5 text-xs text-zinc-500">
                                {c.desc}
                              </div>
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
            <ErrorMessage title="Project was not created" message={error} />
          )}
        </form>

        <div className="flex items-center justify-between gap-2 border-t border-zinc-200 px-5 py-3 dark:border-zinc-800">
          <span className="text-[11px] text-zinc-500">
            You can add or remove channels anytime from the project dashboard.
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
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
              className="apple-tap rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
            >
              {busy ? "Creating…" : "Create project"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProjectsEmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <SharedEmptyState
      title="Start your first campaign"
      description="A project bundles every channel, creative, and tracked link for one campaign so the team works from one source of truth."
      action={{ label: "+ Create your first project", onClick: onCreate }}
      className="border-solid bg-white px-8 py-12 sm:py-16 dark:bg-zinc-900"
      icon={
        <svg
          viewBox="0 0 24 24"
          className="h-7 w-7"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 3v18" />
          <path d="M3 12h18" />
        </svg>
      }
    >
      <ul className="mt-6 grid w-full max-w-2xl grid-cols-1 gap-3 text-left sm:grid-cols-3 sm:gap-4">
        <FeatureBullet
          title="Pick channels"
          body="Meta, TikTok, YouTube, email, signage, and 8 more — turn on the ones you're using."
        />
        <FeatureBullet
          title="Upload creative"
          body="Drag in images or videos up to 2 GB. Versioned, with per-platform copy fields."
        />
        <FeatureBullet
          title="Track results"
          body="Generate UTM-tagged links and QR codes. See clicks and analytics roll up."
        />
      </ul>
      <p className="mt-3 text-[11px] text-zinc-500">
        Takes about 30 seconds. You can edit everything later.
      </p>
    </SharedEmptyState>
  );
}

function FeatureBullet({ title, body }: { title: string; body: string }) {
  return (
    <li className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
      <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
        {title}
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">{body}</p>
    </li>
  );
}
