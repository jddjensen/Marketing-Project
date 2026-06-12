"use client";

import { useId, useRef, type ReactNode } from "react";
import { useDialogChrome } from "./useDialogChrome";
import { useExitAnimation } from "./useExitAnimation";

// Styled replacement for window.confirm. Keep it mounted and toggle `open`;
// exit animation and focus return are handled internally.
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "default",
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "default";
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { mounted, state } = useExitAnimation(open, 200);
  const titleId = useId();
  const messageId = useId();
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const confirmRef = useRef<HTMLButtonElement | null>(null);
  const { dialogRef } = useDialogChrome<HTMLDivElement>({
    open,
    // Escape/backdrop must not abandon an in-flight confirm.
    onClose: () => {
      if (!busy) onCancel();
    },
    // Danger defaults to the safe action; otherwise confirm is the primary.
    initialFocusRef: tone === "danger" ? cancelRef : confirmRef,
  });

  if (!mounted) return null;

  return (
    <div
      className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
      data-state={state}
      onClick={() => {
        if (!busy) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={message != null ? messageId : undefined}
        className="modal-surface w-full max-w-sm rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
        data-state={state}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-4">
          <h2 id={titleId} className="text-sm font-semibold">
            {title}
          </h2>
          {message != null && (
            <div id={messageId} className="mt-1.5 text-sm text-zinc-500">
              {message}
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-zinc-200 px-5 py-3 dark:border-zinc-800">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="apple-tap focus-ring rounded-md px-3 py-2 text-sm text-zinc-500 hover:text-zinc-900 disabled:opacity-50 dark:hover:text-zinc-100"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`apple-tap focus-ring rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${
              tone === "danger"
                ? "bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600"
                : "bg-(--accent)"
            }`}
          >
            {busy ? `${confirmLabel}…` : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
