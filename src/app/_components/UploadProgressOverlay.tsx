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

export function UploadProgressOverlay({
  state,
  onCancel,
  title = "Uploading",
}: {
  state: UploadProgressState | null;
  onCancel?: () => void;
  title?: string;
}) {
  const { mounted, state: animState } = useExitAnimation(state !== null, 200);
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

  if (!mounted || !latest) return null;

  const indeterminate = latest.bytesTotal === 0 && latest.percent === 0;
  const showCounter = latest.fileTotal > 1;

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
              className="h-4 w-4 animate-pulse text-blue-600 dark:text-blue-400"
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
              {title}
              {showCounter && (
                <span className="ml-1.5 text-xs font-normal text-zinc-500">
                  {latest.fileIndex} of {latest.fileTotal}
                </span>
              )}
            </div>
            <div
              className="truncate text-xs text-zinc-500"
              title={latest.fileName}
            >
              {latest.fileName}
            </div>
          </div>
          <div
            className="font-mono text-sm text-zinc-700 tabular-nums dark:text-zinc-200"
            aria-live="polite"
          >
            {indeterminate ? "…" : `${latest.percent}%`}
          </div>
        </div>

        <div
          className="progress-track"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={indeterminate ? undefined : latest.percent}
        >
          <div
            className="progress-fill"
            data-indeterminate={indeterminate ? "true" : "false"}
            style={indeterminate ? undefined : { width: `${latest.percent}%` }}
          />
        </div>

        <div className="mt-3 flex items-center justify-between font-mono text-[11px] text-zinc-500 tabular-nums">
          <span>
            {latest.bytesTotal > 0
              ? `${formatBytes(latest.bytesLoaded)} / ${formatBytes(latest.bytesTotal)}`
              : "Preparing…"}
          </span>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="font-sans text-zinc-500 transition-colors hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
