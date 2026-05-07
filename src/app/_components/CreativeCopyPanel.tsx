"use client";

import { useState } from "react";
import { getCopyFields, type CopyField } from "@/lib/platformCopy";
import type { PlatformKey } from "@/lib/utm";
import { CopyFieldsForm, type CopyValue } from "./CopyFieldsForm";

export function CreativeCopyPanel({
  projectId,
  creativeId,
  versionId,
  platform,
  initialCopy,
  onSaved,
}: {
  projectId: string;
  creativeId: string;
  versionId: string;
  platform: PlatformKey;
  initialCopy: CopyValue | null;
  onSaved: (copy: CopyValue) => void;
}) {
  const fields = getCopyFields(platform);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<CopyValue>(() => initialCopy ?? {});
  const [trackedVersionId, setTrackedVersionId] = useState(versionId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset the draft when we render a different version (React 19 pattern).
  if (trackedVersionId !== versionId) {
    setTrackedVersionId(versionId);
    setDraft(initialCopy ?? {});
  }

  if (fields.length === 0) return null;

  const filledCount = countFilled(draft, fields);
  const totalCount = fields.length;

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/creatives/${creativeId}/versions/${versionId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ copy: draft }),
        }
      );
      const body = (await res.json().catch(() => ({}))) as { copy?: CopyValue; error?: string };
      if (!res.ok) {
        setError(body.error ?? "save failed");
        return;
      }
      onSaved(body.copy ?? draft);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/40 text-xs">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="apple-tap w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-zinc-700 dark:text-zinc-200"
        aria-expanded={open ? "true" : "false"}
      >
        <span className="font-medium">Copy</span>
        <span className="flex items-center gap-2 text-[11px] text-zinc-500">
          <span>
            {filledCount} / {totalCount} fields
          </span>
          <span aria-hidden="true">{open ? "▾" : "▸"}</span>
        </span>
      </button>
      {open && (
        <div className="px-3 pb-3 pt-1 border-t border-zinc-200 dark:border-zinc-800">
          <CopyFieldsForm fields={fields} value={draft} onChange={setDraft} />
          {error && <div className="text-[11px] text-red-600 dark:text-red-400 mt-2">{error}</div>}
          <div className="flex justify-end mt-3">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="apple-tap rounded-md bg-(--accent) text-white px-3 py-1.5 text-xs font-medium disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save copy"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function countFilled(copy: CopyValue, fields: CopyField[]): number {
  let n = 0;
  for (const f of fields) {
    const v = copy[f.key];
    if (v == null) continue;
    if (typeof v === "string" && v.trim().length > 0) n++;
    else if (Array.isArray(v) && v.length > 0) n++;
  }
  return n;
}
