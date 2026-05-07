"use client";

import type { CopyField } from "@/lib/platformCopy";

export type CopyValue = Record<string, unknown>;

// Renders the platform-specific copy fields (text/textarea/list/select).
// Used by both the inline CreativeCopyPanel under each tile and the
// TextCreativeDialog for creating text-only creatives, so the form layout,
// validation hints, and char counters stay consistent across both.
export function CopyFieldsForm({
  fields,
  value,
  onChange,
  textareaRows = 3,
}: {
  fields: CopyField[];
  value: CopyValue;
  onChange: (next: CopyValue) => void;
  textareaRows?: number;
}) {
  const setField = (key: string, next: unknown) =>
    onChange({ ...value, [key]: next });

  return (
    <div className="space-y-3">
      {fields.map((field) => (
        <CopyFieldInput
          key={field.key}
          field={field}
          value={value[field.key]}
          onChange={(next) => setField(field.key, next)}
          textareaRows={textareaRows}
        />
      ))}
    </div>
  );
}

function CopyFieldInput({
  field,
  value,
  onChange,
  textareaRows,
}: {
  field: CopyField;
  value: unknown;
  onChange: (next: unknown) => void;
  textareaRows: number;
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
  return (
    <label className="block">
      <FieldHeader field={field} length={v.length} />
      {field.type === "textarea" ? (
        <textarea
          rows={textareaRows}
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
              className="apple-tap text-[11px] text-zinc-500 hover:text-red-500 px-2"
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
            className="apple-tap text-[11px] text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
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
