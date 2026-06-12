"use client";

import { useEffect, useState } from "react";
import { useExitAnimation } from "./useExitAnimation";

export type UploadProgressState = {
  fileName: string;
  fileIndex: number;
  fileTotal: number;
  percent: number;
  bytesLoaded: number;
  bytesTotal: number;
};

export type UploadQueueEntryStatus =
  | "queued"
  | "checking"
  | "confirming"
  | "uploading"
  | "done"
  | "skipped"
  | "error";

export type UploadQueueEntry = {
  id: number;
  fileName: string;
  slotLabel: string;
  status: UploadQueueEntryStatus;
  percent: number;
  error?: string;
};

const TERMINAL_STATUSES: ReadonlySet<UploadQueueEntryStatus> = new Set([
  "done",
  "skipped",
  "error",
]);

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function entryStatusText(entry: UploadQueueEntry): string {
  switch (entry.status) {
    case "queued":
      return "Queued";
    case "checking":
      return "Checking size…";
    case "confirming":
      return "Needs confirmation";
    case "uploading":
      return `${entry.percent}%`;
    case "done":
      return "Done";
    case "skipped":
      return entry.error === "Cancelled" ? "Cancelled" : "Skipped";
    case "error":
      return "Failed";
  }
}

export function UploadProgressOverlay({
  state,
  onCancel,
  title = "Uploading",
  queue,
  onRemoveQueued,
  onCancelAll,
  onClose,
}: {
  state: UploadProgressState | null;
  onCancel?: () => void;
  title?: string;
  // Optional multi-file queue. When provided, the overlay stays open while
  // any entry is pending and lists every file with its status.
  queue?: UploadQueueEntry[];
  onRemoveQueued?: (id: number) => void;
  onCancelAll?: () => void;
  onClose?: () => void;
}) {
  const entries = queue ?? [];
  const open = state !== null || entries.length > 0;
  const { mounted, state: animState } = useExitAnimation(open, 200);
  // Keep the last non-null progress value during the fade-out so the modal
  // doesn't suddenly become blank as it animates away.
  const [latest, setLatest] = useState<UploadProgressState | null>(state);
  if (state && state !== latest) {
    // setState during render is fine here — it's bounded by the equality
    // check and only fires when the prop actually changes.
    setLatest(state);
  }

  useEffect(() => {
    if (!mounted) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mounted]);

  if (!mounted) return null;

  const active = state !== null ? state : null;
  const display = active ?? latest;
  const allTerminal =
    entries.length > 0 && entries.every((e) => TERMINAL_STATUSES.has(e.status));
  const doneCount = entries.filter((e) => e.status === "done").length;
  const failedCount = entries.filter((e) => e.status === "error").length;
  const queuedCount = entries.filter((e) => e.status === "queued").length;
  // The single-file header duplicates a one-row list; only show the list when
  // there's a queue worth scanning, or results worth reviewing.
  const showList = entries.length > 1 || (entries.length === 1 && allTerminal);

  const indeterminate =
    display !== null && display.bytesTotal === 0 && display.percent === 0;
  const showCounter = display !== null && display.fileTotal > 1;

  return (
    <div
      className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
      data-state={animState}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="modal-surface w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
        data-state={animState}
      >
        <div className="mb-4 flex items-center gap-3">
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950/50">
            <svg
              className={`h-4 w-4 text-blue-600 dark:text-blue-400 ${allTerminal ? "" : "animate-pulse"}`}
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M8 2v8m0 0L4.5 6.5M8 10l3.5-3.5M3 13h10"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {allTerminal ? "Uploads finished" : title}
              {showCounter && !allTerminal && (
                <span className="ml-1.5 text-xs font-normal text-zinc-500">
                  {display.fileIndex} of {display.fileTotal}
                </span>
              )}
            </div>
            <div
              className="truncate text-xs text-zinc-500"
              title={allTerminal ? undefined : (display?.fileName ?? "")}
            >
              {allTerminal
                ? `${doneCount} uploaded${failedCount > 0 ? ` · ${failedCount} failed` : ""}${
                    entries.length - doneCount - failedCount > 0
                      ? ` · ${entries.length - doneCount - failedCount} skipped`
                      : ""
                  }`
                : (display?.fileName ?? "Preparing…")}
            </div>
          </div>
          {!allTerminal && display && (
            <div
              className="font-mono text-sm text-zinc-700 tabular-nums dark:text-zinc-200"
              aria-live="polite"
            >
              {indeterminate ? "…" : `${display.percent}%`}
            </div>
          )}
        </div>

        {!allTerminal && display && (
          <div
            className="progress-track"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={indeterminate ? undefined : display.percent}
          >
            <div
              className="progress-fill"
              data-indeterminate={indeterminate ? "true" : "false"}
              style={
                indeterminate ? undefined : { width: `${display.percent}%` }
              }
            />
          </div>
        )}

        {showList && (
          <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs odd:bg-zinc-50 dark:odd:bg-zinc-950/50"
                title={entry.error}
              >
                <span
                  className={`min-w-0 flex-1 truncate ${
                    entry.status === "skipped" || entry.status === "queued"
                      ? "text-zinc-400 dark:text-zinc-500"
                      : "text-zinc-700 dark:text-zinc-200"
                  }`}
                  title={entry.fileName}
                >
                  {entry.fileName}
                </span>
                <span className="shrink-0 text-[10px] text-zinc-400 dark:text-zinc-500">
                  {entry.slotLabel}
                </span>
                <span
                  className={`shrink-0 font-medium tabular-nums ${
                    entry.status === "error"
                      ? "text-red-600 dark:text-red-400"
                      : entry.status === "done"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-zinc-500"
                  }`}
                >
                  {entryStatusText(entry)}
                </span>
                {entry.status === "queued" && onRemoveQueued && (
                  <button
                    type="button"
                    onClick={() => onRemoveQueued(entry.id)}
                    aria-label={`Remove ${entry.fileName} from the queue`}
                    className="focus-ring shrink-0 rounded px-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                  >
                    ✕
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-3 flex items-center justify-between font-mono text-[11px] text-zinc-500 tabular-nums">
          <span>
            {allTerminal
              ? ""
              : display && display.bytesTotal > 0
                ? `${formatBytes(display.bytesLoaded)} / ${formatBytes(display.bytesTotal)}`
                : "Preparing…"}
          </span>
          <span className="flex items-center gap-3 font-sans">
            {!allTerminal && queuedCount > 0 && onCancelAll && (
              <button
                type="button"
                onClick={onCancelAll}
                className="text-zinc-500 transition-colors hover:text-zinc-900 dark:hover:text-zinc-100"
              >
                Cancel all
              </button>
            )}
            {!allTerminal && onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="text-zinc-500 transition-colors hover:text-zinc-900 dark:hover:text-zinc-100"
              >
                Cancel
              </button>
            )}
            {allTerminal && onClose && (
              <button
                type="button"
                onClick={onClose}
                className="apple-tap focus-ring rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 dark:bg-zinc-100 dark:text-zinc-900"
              >
                Close
              </button>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
