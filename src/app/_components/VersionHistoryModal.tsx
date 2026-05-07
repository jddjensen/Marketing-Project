"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Version = {
  id: string;
  versionNum: number;
  kind: "image" | "video" | "text";
  url: string | null;
  posterUrl: string | null;
  name: string | null;
  copy: Record<string, unknown> | null;
  isCurrent: boolean;
  uploadedAt: number;
};

export function VersionHistoryModal({
  projectId,
  creativeId,
  onClose,
  onChanged,
}: {
  projectId: string;
  creativeId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [versions, setVersions] = useState<Version[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestClose = useCallback(() => {
    if (closing) return;
    setClosing(true);
    closeTimer.current = setTimeout(onClose, 200);
  }, [closing, onClose]);
  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  useEffect(() => {
    let active = true;
    async function load() {
      const res = await fetch(
        `/api/projects/${projectId}/creatives/${creativeId}/versions`,
        { cache: "no-store" }
      );
      const body = (await res.json().catch(() => ({}))) as {
        versions?: Version[];
        error?: string;
      };
      if (!active) return;
      if (!res.ok) {
        setError(body.error ?? "failed to load versions");
        setVersions([]);
        return;
      }
      setVersions(body.versions ?? []);
    }
    void load();
    return () => {
      active = false;
    };
  }, [projectId, creativeId]);

  const reload = async () => {
    const res = await fetch(
      `/api/projects/${projectId}/creatives/${creativeId}/versions`,
      { cache: "no-store" }
    );
    const body = (await res.json().catch(() => ({}))) as { versions?: Version[] };
    setVersions(body.versions ?? []);
    onChanged();
  };

  const restore = async (versionId: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/creatives/${creativeId}/restore`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ versionId }),
        }
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "restore failed");
        return;
      }
      await reload();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (versionId: string) => {
    if (!window.confirm("Delete this version permanently? This can't be undone.")) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/creatives/${creativeId}/versions/${versionId}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "delete failed");
        return;
      }
      await reload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
      data-state={closing ? "closed" : "open"}
      role="dialog"
      aria-modal="true"
      aria-label="Version history"
      onClick={requestClose}
    >
      <div
        className="modal-surface w-full max-w-2xl max-h-[80vh] overflow-hidden rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col"
        data-state={closing ? "closed" : "open"}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">Version history</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Restore an older version or delete archived ones.
            </p>
          </div>
          <button
            type="button"
            onClick={requestClose}
            className="apple-tap text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 px-2 py-1"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {error && (
            <div className="rounded-md border border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200 px-3 py-2 text-xs">
              {error}
            </div>
          )}

          {versions === null ? (
            <div className="text-sm text-zinc-500 text-center py-8">Loading…</div>
          ) : versions.length === 0 ? (
            <div className="text-sm text-zinc-500 text-center py-8">No versions found.</div>
          ) : (
            versions.map((v) => (
              <div
                key={v.id}
                className={`flex gap-3 rounded-xl border p-3 ${
                  v.isCurrent
                    ? "border-blue-300 dark:border-blue-700 bg-blue-50/40 dark:bg-blue-950/20"
                    : "border-zinc-200 dark:border-zinc-800"
                }`}
              >
                <div className="w-20 h-20 shrink-0 rounded-md overflow-hidden bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-[10px] text-zinc-500">
                  {v.kind === "text" ? (
                    "TEXT"
                  ) : v.posterUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={v.posterUrl} alt="" className="w-full h-full object-cover" />
                  ) : v.kind === "image" && v.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={v.url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    v.kind.toUpperCase()
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">v{v.versionNum}</span>
                    {v.isCurrent && (
                      <span className="text-[10px] font-medium uppercase tracking-wide text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/40 rounded-full px-2 py-0.5">
                        Current
                      </span>
                    )}
                    <span className="text-[11px] text-zinc-500 uppercase tracking-wide">
                      {v.kind}
                    </span>
                  </div>
                  {v.name && (
                    <div className="text-xs text-zinc-500 truncate" title={v.name}>
                      {v.name}
                    </div>
                  )}
                  <div className="text-[11px] text-zinc-400 mt-0.5">
                    {new Date(v.uploadedAt).toLocaleString()}
                  </div>
                  {v.copy && Object.keys(v.copy).length > 0 && (
                    <div className="text-[11px] text-zinc-500 mt-1 line-clamp-2">
                      {summariseCopy(v.copy)}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1.5 self-start">
                  {!v.isCurrent && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => restore(v.id)}
                      className="text-xs rounded-md bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 px-3 py-1 disabled:opacity-50"
                    >
                      Restore
                    </button>
                  )}
                  {!v.isCurrent && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => remove(v.id)}
                      className="text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-md px-3 py-1 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function summariseCopy(copy: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(copy)) {
    if (typeof value === "string" && value.trim().length > 0) {
      parts.push(`${key}: ${value.slice(0, 80)}`);
    } else if (Array.isArray(value) && value.length > 0) {
      parts.push(`${key}: ${value.length} item${value.length === 1 ? "" : "s"}`);
    }
  }
  return parts.join(" · ");
}
