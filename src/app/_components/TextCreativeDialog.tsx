"use client";

import { useState } from "react";
import { getCopyFields, type CopyField } from "@/lib/platformCopy";
import type { PlatformKey } from "@/lib/utm";

type CopyValue = Record<string, unknown>;

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
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Create text creative"
      onClick={onClose}
    >
      <div
        className="modal-surface w-full max-w-lg max-h-[85vh] overflow-hidden rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="text-sm font-semibold">New text creative</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            For {ratioLabel} — copy only, no media file.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {fields.map((field) => (
            <FieldRow
              key={field.key}
              field={field}
              value={draft[field.key]}
              onChange={(v) => setDraft((prev) => ({ ...prev, [field.key]: v }))}
            />
          ))}
          {error && (
            <div className="rounded-md border border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200 px-3 py-2 text-xs">
              {error}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 px-3 py-2"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="apple-tap rounded-md bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save creative"}
          </button>
        </div>
      </div>
    </div>
  );
}

function FieldRow({
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
    return <ListField field={field} items={items} onChange={onChange} />;
  }
  if (field.type === "select") {
    const v = typeof value === "string" ? value : "";
    return (
      <label className="block">
        <Header field={field} length={null} />
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
  return (
    <label className="block">
      <Header field={field} length={v.length} />
      {field.type === "textarea" ? (
        <textarea
          rows={4}
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

function Header({ field, length }: { field: CopyField; length: number | null }) {
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
