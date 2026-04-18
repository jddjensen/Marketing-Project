"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { UserMenu } from "./UserMenu";

type Unit = "in" | "ft" | "cm" | "m" | "px";

type SignageFormat = {
  id: string;
  label: string;
  presetKey: string | null;
  width: number;
  height: number;
  unit: Unit;
  createdAt: number;
};

type MediaItem = {
  id: string;
  url: string;
  name: string;
  kind: "image" | "video";
  ratio: string;
  uploadedAt: number;
};

type SignagePayload = {
  formats: SignageFormat[];
  mediaByFormat: Record<string, MediaItem[]>;
};

export type Preset = {
  key: string;
  label: string;
  width: number;
  height: number;
  unit: Unit;
};

export const SIGNAGE_PRESETS: Preset[] = [
  { key: "billboard-bulletin", label: "Billboard — Bulletin", width: 48, height: 14, unit: "ft" },
  { key: "billboard-30sheet", label: "Billboard — 30-Sheet", width: 22.75, height: 10.5, unit: "ft" },
  { key: "digital-billboard", label: "Digital Billboard", width: 1920, height: 1080, unit: "px" },
  { key: "bus-shelter", label: "Bus Shelter", width: 4, height: 6, unit: "ft" },
  { key: "aframe", label: "A-Frame Sidewalk Sign", width: 24, height: 36, unit: "in" },
  { key: "hframe-small", label: "H-Frame (small)", width: 24, height: 24, unit: "in" },
  { key: "hframe-standard", label: "H-Frame (standard)", width: 18, height: 24, unit: "in" },
  { key: "yard-sign", label: "Yard Sign", width: 18, height: 24, unit: "in" },
  { key: "poster-small", label: "Poster — Small (11×17)", width: 11, height: 17, unit: "in" },
  { key: "poster-standard", label: "Poster — Standard (18×24)", width: 18, height: 24, unit: "in" },
  { key: "poster-large", label: "Poster — Large (24×36)", width: 24, height: 36, unit: "in" },
  { key: "window-cling", label: "Window Cling", width: 18, height: 24, unit: "in" },
];

function formatDimensions(f: SignageFormat): string {
  return `${trim(f.width)}×${trim(f.height)} ${f.unit}`;
}

function trim(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(3)));
}

export function SignageBoard({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName: string;
}) {
  const [data, setData] = useState<SignagePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [addingFormat, setAddingFormat] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/signage-formats`, { cache: "no-store" });
    if (!res.ok) {
      setData({ formats: [], mediaByFormat: {} });
      return;
    }
    const body = (await res.json()) as SignagePayload;
    setData({ formats: body.formats ?? [], mediaByFormat: body.mediaByFormat ?? {} });
  }, [projectId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const addFormat = useCallback(
    async (input: { label: string; width: number; height: number; unit: Unit; presetKey: string | null }) => {
      const res = await fetch(`/api/projects/${projectId}/signage-formats`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "failed to add format");
      }
      await fetchData();
    },
    [projectId, fetchData]
  );

  const deleteFormat = useCallback(
    async (formatId: string, label: string) => {
      if (
        !window.confirm(
          `Delete "${label}" and all media uploaded for it? This can't be undone.`
        )
      )
        return;
      const res = await fetch(
        `/api/projects/${projectId}/signage-formats/${formatId}`,
        { method: "DELETE" }
      );
      if (res.ok) await fetchData();
    },
    [projectId, fetchData]
  );

  const uploadFiles = useCallback(
    async (format: SignageFormat, files: FileList) => {
      setError(null);
      setUploadingId(format.id);
      try {
        for (const file of Array.from(files)) {
          const fd = new FormData();
          fd.append("file", file);
          fd.append("platform", "signage");
          fd.append("projectId", projectId);
          fd.append("ratio", `${trim(format.width)}x${trim(format.height)}`);
          fd.append("signageFormatId", format.id);
          const res = await fetch("/api/upload", { method: "POST", body: fd });
          if (!res.ok) {
            const body = (await res.json().catch(() => ({}))) as { error?: string };
            throw new Error(body.error ?? "upload failed");
          }
        }
        await fetchData();
      } catch (e) {
        setError(e instanceof Error ? e.message : "upload failed");
      } finally {
        setUploadingId(null);
      }
    },
    [projectId, fetchData]
  );

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <header className="apple-header sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-start justify-between gap-4">
          <div>
            <Link
              href={`/projects/${projectId}`}
              className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              ← {projectName}
            </Link>
            <h1 className="text-2xl font-semibold mt-1">Physical Signage — Campaign Media</h1>
            <p className="text-sm text-zinc-500 mt-1">
              Define the formats you&apos;re producing — billboards, A-frames, posters, custom — and
              upload creative at each size.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setAddingFormat(true)}
              className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-md px-2 py-1"
            >
              + Add format
            </button>
            <UserMenu />
          </div>
        </div>
      </header>

      {error && (
        <div className="max-w-7xl mx-auto px-6 pt-4">
          <div className="rounded-md border border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200 px-4 py-2 text-sm">
            {error}
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-6 py-8">
        {data === null ? (
          <div className="text-sm text-zinc-500">Loading…</div>
        ) : data.formats.length === 0 ? (
          <EmptyState onAdd={() => setAddingFormat(true)} />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {data.formats.map((format) => (
              <FormatColumn
                key={format.id}
                format={format}
                items={data.mediaByFormat[format.id] ?? []}
                uploading={uploadingId === format.id}
                menuOpen={menuId === format.id}
                onOpenMenu={() => setMenuId(menuId === format.id ? null : format.id)}
                onCloseMenu={() => setMenuId(null)}
                onDelete={() => deleteFormat(format.id, format.label)}
                onUpload={(files) => uploadFiles(format, files)}
              />
            ))}
          </div>
        )}
      </main>

      {addingFormat && (
        <AddFormatDialog
          onClose={() => setAddingFormat(false)}
          onAdd={async (input) => {
            await addFormat(input);
            setAddingFormat(false);
          }}
        />
      )}
    </div>
  );
}

function FormatColumn({
  format,
  items,
  uploading,
  menuOpen,
  onOpenMenu,
  onCloseMenu,
  onDelete,
  onUpload,
}: {
  format: SignageFormat;
  items: MediaItem[];
  uploading: boolean;
  menuOpen: boolean;
  onOpenMenu: () => void;
  onCloseMenu: () => void;
  onDelete: () => void;
  onUpload: (files: FileList) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const h = () => onCloseMenu();
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [menuOpen, onCloseMenu]);

  const aspect = `aspect-[${trim(format.width)}/${trim(format.height)}]`;

  return (
    <section className="flex flex-col bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-semibold truncate">{format.label}</h2>
          <p className="text-xs text-zinc-500 mt-0.5">{formatDimensions(format)}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500">
            {items.length} item{items.length === 1 ? "" : "s"}
          </span>
          <div className="relative">
            <button
              type="button"
              aria-label="Format menu"
              onClick={(e) => {
                e.stopPropagation();
                onOpenMenu();
              }}
              className="w-6 h-6 rounded-md text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center"
            >
              ⋯
            </button>
            {menuOpen && (
              <div
                className="absolute top-7 right-0 z-10 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg py-1 min-w-[160px] text-sm"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => {
                    onCloseMenu();
                    onDelete();
                  }}
                  className="block w-full text-left px-3 py-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
                >
                  Delete format
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div
        className={`m-4 rounded-lg border-2 border-dashed transition-colors ${
          dragOver ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30" : "border-zinc-300 dark:border-zinc-700"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files) onUpload(e.dataTransfer.files);
        }}
      >
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-full py-5 text-sm text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 disabled:opacity-60"
        >
          {uploading ? "Uploading…" : "Drop file or click to upload"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) onUpload(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      <div className="px-4 pb-4 flex-1 flex flex-col gap-3">
        {items.length === 0 ? (
          <div className="text-sm text-zinc-500 py-6 text-center">No media yet.</div>
        ) : (
          items.map((item) => (
            <figure key={item.id} className="group">
              <div
                className={`${aspect} w-full rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700`}
              >
                {item.kind === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.url} alt={item.name} className="w-full h-full object-cover" />
                ) : (
                  <video src={item.url} controls playsInline className="w-full h-full object-cover" />
                )}
              </div>
              <figcaption className="mt-1.5 text-xs text-zinc-500 truncate" title={item.name}>
                {item.name}
              </figcaption>
            </figure>
          ))
        )}
      </div>
    </section>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-white/40 dark:bg-zinc-900/40 py-16 flex flex-col items-center text-center">
      <div className="text-lg font-semibold">No signage formats yet</div>
      <p className="text-sm text-zinc-500 mt-1 max-w-md">
        Add a format to describe what you&apos;re producing — a 48×14 ft billboard, a 24×36 in
        A-frame, or any custom size — then upload creative at that dimension.
      </p>
      <button
        type="button"
        onClick={onAdd}
        className="apple-tap mt-4 apple-tap rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 px-4 py-2 text-sm font-medium hover:opacity-90"
      >
        + Add your first format
      </button>
    </div>
  );
}

function AddFormatDialog({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (input: {
    label: string;
    width: number;
    height: number;
    unit: Unit;
    presetKey: string | null;
  }) => Promise<void>;
}) {
  const [mode, setMode] = useState<"preset" | "custom">("preset");
  const [selectedPreset, setSelectedPreset] = useState<string>("");
  const [labelOverride, setLabelOverride] = useState("");
  const [customLabel, setCustomLabel] = useState("");
  const [customWidth, setCustomWidth] = useState<string>("");
  const [customHeight, setCustomHeight] = useState<string>("");
  const [customUnit, setCustomUnit] = useState<Unit>("in");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const preset = SIGNAGE_PRESETS.find((p) => p.key === selectedPreset);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      if (mode === "preset") {
        if (!preset) throw new Error("pick a preset");
        const label = labelOverride.trim() || preset.label;
        await onAdd({
          label,
          width: preset.width,
          height: preset.height,
          unit: preset.unit,
          presetKey: preset.key,
        });
      } else {
        const label = customLabel.trim();
        const width = Number(customWidth);
        const height = Number(customHeight);
        if (!label) throw new Error("label is required");
        if (!Number.isFinite(width) || width <= 0) throw new Error("width must be > 0");
        if (!Number.isFinite(height) || height <= 0) throw new Error("height must be > 0");
        await onAdd({ label, width, height, unit: customUnit, presetKey: null });
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "failed to add");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <div
        className="modal-surface w-full max-w-lg rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 shadow-[var(--shadow-lift)] max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-semibold text-lg">Add signage format</h2>
        <p className="text-sm text-zinc-500 mt-1">
          Pick a preset or enter custom dimensions.
        </p>

        <div className="mt-4 flex items-center gap-1 text-xs rounded-md border border-zinc-200 dark:border-zinc-800 p-0.5 bg-white dark:bg-zinc-900 w-fit">
          {(["preset", "custom"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`px-3 py-1.5 rounded ${
                mode === m
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
              }`}
            >
              {m === "preset" ? "Preset" : "Custom"}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="mt-4 space-y-3">
          {mode === "preset" ? (
            <>
              <div>
                <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Format
                </label>
                <select
                  value={selectedPreset}
                  onChange={(e) => setSelectedPreset(e.target.value)}
                  className="mt-1 w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a preset…</option>
                  {SIGNAGE_PRESETS.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.label} — {trim(p.width)}×{trim(p.height)} {p.unit}
                    </option>
                  ))}
                </select>
              </div>
              {preset && (
                <div>
                  <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Label (optional)
                  </label>
                  <input
                    type="text"
                    maxLength={120}
                    value={labelOverride}
                    onChange={(e) => setLabelOverride(e.target.value)}
                    placeholder={preset.label}
                    className="mt-1 w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-[11px] text-zinc-500 mt-1">
                    e.g. &quot;Times Square billboard&quot; — defaults to &quot;{preset.label}&quot;.
                  </p>
                </div>
              )}
            </>
          ) : (
            <>
              <div>
                <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Label
                </label>
                <input
                  type="text"
                  required
                  maxLength={120}
                  value={customLabel}
                  onChange={(e) => setCustomLabel(e.target.value)}
                  placeholder="e.g. Subway wall graphic"
                  className="mt-1 w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Width
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={customWidth}
                    onChange={(e) => setCustomWidth(e.target.value)}
                    className="mt-1 w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Height
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={customHeight}
                    onChange={(e) => setCustomHeight(e.target.value)}
                    className="mt-1 w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Unit
                  </label>
                  <select
                    value={customUnit}
                    onChange={(e) => setCustomUnit(e.target.value as Unit)}
                    className="mt-1 w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="in">in</option>
                    <option value="ft">ft</option>
                    <option value="cm">cm</option>
                    <option value="m">m</option>
                    <option value="px">px</option>
                  </select>
                </div>
              </div>
            </>
          )}

          {err && (
            <div className="rounded-md border border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200 px-3 py-2 text-sm">
              {err}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 px-3 py-2"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy || (mode === "preset" && !preset)}
              className="apple-tap rounded-md bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 px-4 py-2 text-sm font-medium disabled:opacity-50 hover:opacity-90"
            >
              {busy ? "Adding…" : "Add format"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
