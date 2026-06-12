"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "./ConfirmDialog";
import { useDialogChrome } from "./useDialogChrome";

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
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
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
  // open tracks !closing so focus returns when the close starts, not 200ms
  // later at unmount.
  const { dialogRef } = useDialogChrome<HTMLDivElement>({
    open: !closing,
    onClose: requestClose,
  });

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
    const body = (await res.json().catch(() => ({}))) as {
      versions?: Version[];
    };
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
      setConfirmDeleteId(null);
    }
  };

  return (
    <div
      className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
      data-state={closing ? "closed" : "open"}
      onClick={requestClose}
    >
      <div
        ref={dialogRef}
        className="modal-surface flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
        data-state={closing ? "closed" : "open"}
        role="dialog"
        aria-modal="true"
        aria-label="Version history"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <div>
            <h2 className="text-sm font-semibold">Version history</h2>
            <p className="mt-0.5 text-xs text-zinc-500">
              Restore an older version or delete archived ones.
            </p>
          </div>
          <button
            type="button"
            onClick={requestClose}
            className="apple-tap px-2 py-1 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          {error && (
            <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
              {error}
            </div>
          )}

          {versions === null ? (
            <div className="py-8 text-center text-sm text-zinc-500">
              Loading…
            </div>
          ) : versions.length === 0 ? (
            <div className="py-8 text-center text-sm text-zinc-500">
              No versions found.
            </div>
          ) : (
            versions.map((v) => (
              <div
                key={v.id}
                className={`flex gap-3 rounded-xl border p-3 ${
                  v.isCurrent
                    ? "border-blue-300 bg-blue-50/40 dark:border-blue-700 dark:bg-blue-950/20"
                    : "border-zinc-200 dark:border-zinc-800"
                }`}
              >
                <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md bg-zinc-100 text-[10px] text-zinc-500 dark:bg-zinc-800">
                  {v.kind === "text" ? (
                    "TEXT"
                  ) : v.posterUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={v.posterUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : v.kind === "image" && v.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={v.url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    v.kind.toUpperCase()
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">
                      v{v.versionNum}
                    </span>
                    {v.isCurrent && (
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium tracking-wide text-blue-700 uppercase dark:bg-blue-900/40 dark:text-blue-300">
                        Current
                      </span>
                    )}
                    <span className="text-[11px] tracking-wide text-zinc-500 uppercase">
                      {v.kind}
                    </span>
                  </div>
                  {v.name && (
                    <div
                      className="truncate text-xs text-zinc-500"
                      title={v.name}
                    >
                      {v.name}
                    </div>
                  )}
                  <div className="mt-0.5 text-[11px] text-zinc-400">
                    {new Date(v.uploadedAt).toLocaleString()}
                  </div>
                  {v.copy && Object.keys(v.copy).length > 0 && (
                    <div className="mt-1 line-clamp-2 text-[11px] text-zinc-500">
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
                      className="rounded-md bg-zinc-900 px-3 py-1 text-xs text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
                    >
                      Restore
                    </button>
                  )}
                  {!v.isCurrent && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setConfirmDeleteId(v.id)}
                      className="rounded-md px-3 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-950/40"
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
      <ConfirmDialog
        open={confirmDeleteId !== null}
        title="Delete this version?"
        message="The file is removed permanently. This can't be undone."
        confirmLabel="Delete"
        tone="danger"
        busy={busy}
        onConfirm={() => {
          if (confirmDeleteId) void remove(confirmDeleteId);
        }}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
}

function summariseCopy(copy: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(copy)) {
    if (typeof value === "string" && value.trim().length > 0) {
      parts.push(`${key}: ${value.slice(0, 80)}`);
    } else if (Array.isArray(value) && value.length > 0) {
      parts.push(
        `${key}: ${value.length} item${value.length === 1 ? "" : "s"}`
      );
    }
  }
  return parts.join(" · ");
}
