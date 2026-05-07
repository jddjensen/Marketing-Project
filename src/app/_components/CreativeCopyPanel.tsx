"use client";

import { useState } from "react";
import { getCopyFields, type CopyField } from "@/lib/platformCopy";
import type { PlatformKey } from "@/lib/utm";

type CopyValue = Record<string, unknown>;

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

  // React 19 pattern: when the version we're editing changes (e.g. parent
  // refreshed and now a new version is current), reset the draft. Doing this
  // during render — guarded by a comparison — avoids the cascading render
  // useEffect would cause.
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
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-zinc-700 dark:text-zinc-200"
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
        <div className="px-3 pb-3 pt-1 space-y-3 border-t border-zinc-200 dark:border-zinc-800">
          {fields.map((field) => (
            <CopyFieldInput
              key={field.key}
              field={field}
              value={draft[field.key]}
              onChange={(v) => setDraft((prev) => ({ ...prev, [field.key]: v }))}
            />
          ))}
          {error && <div className="text-[11px] text-red-600 dark:text-red-400">{error}</div>}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="apple-tap rounded-md bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 px-3 py-1.5 text-xs font-medium disabled:opacity-50"
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

function CopyFieldInput({
  field,
  value,
  onChange,
}: {
  field: CopyField;
  value: unknown;
  onChange: (next: unknown) => void;
}) {
  if (field.type === "list") {
    const items: string[] = Array.isArray(value)
      ? value.filter((v): v is string => typeof v === "string")
      : [];
    return (
      <ListField field={field} items={items} onChange={onChange} />
    );
  }

  if (field.type === "select") {
    const v = typeof value === "string" ? value : "";
    return (
      <label className="block">
        <FieldHeader field={field} length={null} />
        <select
          className="select-tactile mt-1 w-full"
          value={v}
          onChange={(e) => onChange(e.target.value || null)}
        >
          <option value="">— none —</option>
          {field.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  const v = typeof value === "string" ? value : "";
  const length = v.length;
  return (
    <label className="block">
      <FieldHeader field={field} length={length} />
      {field.type === "textarea" ? (
        <textarea
          rows={3}
          className="input-tactile mt-1 w-full leading-relaxed resize-y"
          value={v}
          maxLength={field.maxLength}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          type="text"
          className="input-tactile mt-1 w-full"
          value={v}
          maxLength={field.maxLength}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {field.hint && (
        <div className="text-[10px] text-zinc-500 mt-1 leading-snug">{field.hint}</div>
      )}
    </label>
  );
}

function FieldHeader({ field, length }: { field: CopyField; length: number | null }) {
  return (
    <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-wide text-zinc-500">
      <span>
        {field.label}
        {field.required && <span className="text-red-500 ml-0.5">*</span>}
      </span>
      {length != null && field.maxLength != null && (
        <span
          className={`tabular-nums ${
            length > field.maxLength
              ? "text-red-500"
              : field.recommendedLength != null && length > field.recommendedLength
                ? "text-amber-500"
                : "text-zinc-400"
          }`}
        >
          {length}/{field.maxLength}
        </span>
      )}
    </div>
  );
}

function ListField({
  field,
  items,
  onChange,
}: {
  field: CopyField;
  items: string[];
  onChange: (next: string[]) => void;
}) {
  const max = field.maxItems ?? Infinity;
  const min = field.minItems ?? 0;
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-wide text-zinc-500">
        <span>
          {field.label}
          {field.required && <span className="text-red-500 ml-0.5">*</span>}
        </span>
        <span className="tabular-nums text-zinc-400">
          {items.length}
          {Number.isFinite(max) ? `/${max}` : ""}
          {min > 0 && items.length < min ? ` (min ${min})` : ""}
        </span>
      </div>
      <div className="mt-1 space-y-1.5">
        {items.map((item, i) => (
          <div key={i} className="flex gap-1.5">
            <input
              type="text"
              className="input-tactile flex-1"
              value={item}
              maxLength={field.itemMaxLength}
              onChange={(e) => {
                const next = [...items];
                next[i] = e.target.value;
                onChange(next);
              }}
            />
            <button
              type="button"
              onClick={() => onChange(items.filter((_, idx) => idx !== i))}
              className="text-[11px] text-zinc-500 hover:text-red-500 px-2"
              aria-label={`Remove ${field.label} ${i + 1}`}
            >
              ×
            </button>
          </div>
        ))}
        {items.length < max && (
          <button
            type="button"
            onClick={() => onChange([...items, ""])}
            className="text-[11px] text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            + Add {field.label.toLowerCase()}
          </button>
        )}
      </div>
      {field.hint && (
        <div className="text-[10px] text-zinc-500 mt-1 leading-snug">{field.hint}</div>
      )}
    </div>
  );
}
