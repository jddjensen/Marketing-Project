"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Project = {
  id: string;
  name: string;
  description: string | null;
  createdAt: number;
  updatedAt: number;
  archivedAt: number | null;
};

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
    fetchProjects();
  }, [fetchProjects]);

  const onCreate = useCallback(
    async (name: string) => {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
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
  onSubmit: (name: string) => void;
}) {
  const [name, setName] = useState("");
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <div
        className="modal-surface w-full max-w-sm rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 shadow-[var(--shadow-lift)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-semibold text-lg">New project</h2>
        <p className="text-sm text-zinc-500 mt-1">
          Projects hold all the media, tracking, and search terms for a single campaign.
        </p>
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!busy && name.trim()) onSubmit(name.trim());
          }}
        >
          <div>
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
          {error && (
            <div className="rounded-md border border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200 px-3 py-2 text-sm">
              {error}
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
              disabled={busy || !name.trim()}
              className="apple-tap rounded-md bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 px-4 py-2 text-sm font-medium disabled:opacity-50 hover:opacity-90"
            >
              {busy ? "Creating…" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-white/40 dark:bg-zinc-900/40 py-16 flex flex-col items-center text-center">
      <div className="text-lg font-semibold">No projects yet</div>
      <p className="text-sm text-zinc-500 mt-1 max-w-sm">
        Create your first project to start uploading creatives, tracking clicks, and managing
        search terms.
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
