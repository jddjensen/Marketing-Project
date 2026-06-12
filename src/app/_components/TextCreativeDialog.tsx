"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getCopyFields } from "@/lib/platformCopy";
import type { PlatformKey } from "@/lib/utm";
import { CopyFieldsForm, type CopyValue } from "./CopyFieldsForm";
import { useDialogChrome } from "./useDialogChrome";

export function TextCreativeDialog({
  projectId,
  platform,
  ratio,
  ratioLabel,
  onClose,
  onSaved,
}: {
  projectId: string;
  platform: PlatformKey;
  ratio: string;
  ratioLabel: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const fields = getCopyFields(platform);
  const [draft, setDraft] = useState<CopyValue>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/creatives`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, ratio, copy: draft }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(body.error ?? "save failed");
        return;
      }
      onSaved();
      requestClose();
    } finally {
      setSaving(false);
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
        className="modal-surface flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
        data-state={closing ? "closed" : "open"}
        role="dialog"
        aria-modal="true"
        aria-label="Create text creative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <h2 className="text-sm font-semibold">New text creative</h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            For {ratioLabel} — copy only, no media file.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <CopyFieldsForm
            fields={fields}
            value={draft}
            onChange={setDraft}
            textareaRows={4}
          />
          {error && (
            <div className="mt-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-zinc-200 px-5 py-3 dark:border-zinc-800">
          <button
            type="button"
            onClick={requestClose}
            className="apple-tap px-3 py-2 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="apple-tap rounded-md bg-(--accent) px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save creative"}
          </button>
        </div>
      </div>
    </div>
  );
}
