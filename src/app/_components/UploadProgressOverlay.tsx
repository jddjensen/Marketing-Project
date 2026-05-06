"use client";

import { useEffect } from "react";

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
  useEffect(() => {
    if (!state) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [state]);

  if (!state) return null;

  const indeterminate = state.bytesTotal === 0 && state.percent === 0;
  const showCounter = state.fileTotal > 1;

  return (
    <div
      className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="modal-surface w-full max-w-sm rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="relative h-9 w-9 shrink-0 rounded-full bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center">
            <svg
              className="h-4 w-4 text-blue-600 dark:text-blue-400 animate-pulse"
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
                  {state.fileIndex} of {state.fileTotal}
                </span>
              )}
            </div>
            <div className="text-xs text-zinc-500 truncate" title={state.fileName}>
              {state.fileName}
            </div>
          </div>
          <div
            className="text-sm font-mono tabular-nums text-zinc-700 dark:text-zinc-200"
            aria-live="polite"
          >
            {indeterminate ? "…" : `${state.percent}%`}
          </div>
        </div>

        <div
          className="progress-track"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={indeterminate ? undefined : state.percent}
        >
          <div
            className="progress-fill"
            data-indeterminate={indeterminate ? "true" : "false"}
            style={indeterminate ? undefined : { width: `${state.percent}%` }}
          />
        </div>

        <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-500 font-mono tabular-nums">
          <span>
            {state.bytesTotal > 0
              ? `${formatBytes(state.bytesLoaded)} / ${formatBytes(state.bytesTotal)}`
              : "Preparing…"}
          </span>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="font-sans text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
