"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { UserMenu } from "./UserMenu";
import {
  formatDimensions,
  type SignageBlueprint,
  SIGNAGE_PRESETS,
  trimDimension,
  type Unit,
} from "@/lib/signage";

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

type AddFormatInput = {
  label: string;
  width: number;
  height: number;
  unit: Unit;
  presetKey: string | null;
};

const PRESET_CATEGORIES = [
  { key: "billboard", label: "Billboards" },
  { key: "street", label: "Street & outdoor" },
  { key: "poster", label: "Posters" },
  { key: "retail", label: "Retail" },
  { key: "other", label: "Other" },
] as const;

export function SignageBoard({
  projectId,
  projectName,
  children,
}: {
  projectId: string;
  projectName: string;
  children?: React.ReactNode;
}) {
  const [data, setData] = useState<SignagePayload | null>(null);
  const [blueprints, setBlueprints] = useState<SignageBlueprint[]>([]);
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

  const fetchBlueprints = useCallback(async () => {
    const res = await fetch("/api/signage-blueprints", { cache: "no-store" });
    if (!res.ok) {
      setBlueprints([]);
      return;
    }
    const body = (await res.json()) as { blueprints?: SignageBlueprint[] };
    setBlueprints(body.blueprints ?? []);
  }, []);

  useEffect(() => {
    let active = true;

    async function loadFormats() {
      const res = await fetch(`/api/projects/${projectId}/signage-formats`, { cache: "no-store" });
      if (!active) return;
      if (!res.ok) {
        setData({ formats: [], mediaByFormat: {} });
        return;
      }
      const body = (await res.json()) as SignagePayload;
      if (!active) return;
      setData({ formats: body.formats ?? [], mediaByFormat: body.mediaByFormat ?? {} });
    }

    async function loadBlueprints() {
      const res = await fetch("/api/signage-blueprints", { cache: "no-store" });
      if (!active) return;
      if (!res.ok) {
        setBlueprints([]);
        return;
      }
      const body = (await res.json()) as { blueprints?: SignageBlueprint[] };
      if (!active) return;
      setBlueprints(body.blueprints ?? []);
    }

    void loadFormats();
    void loadBlueprints();

    return () => {
      active = false;
    };
  }, [projectId]);

  const addFormat = useCallback(
    async (input: AddFormatInput) => {
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

  const saveBlueprint = useCallback(async (input: Omit<SignageBlueprint, "id" | "createdAt">) => {
    const res = await fetch("/api/signage-blueprints", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error ?? "failed to save blueprint");
    }
    await fetchBlueprints();
  }, [fetchBlueprints]);

  const deleteFormat = useCallback(
    async (formatId: string, label: string) => {
      if (!window.confirm(`Delete "${label}" and all media uploaded for it? This can't be undone.`)) {
        return;
      }
      const res = await fetch(`/api/projects/${projectId}/signage-formats/${formatId}`, {
        method: "DELETE",
      });
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
          fd.append("ratio", `${trimDimension(format.width)}x${trimDimension(format.height)}`);
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
              Build out physical formats for this campaign, including highway billboards, posters,
              A-frames, and saved custom blueprints you can reuse on future projects.
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
        <section className="mb-8 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
                Billboard defaults
              </h2>
              <p className="text-sm text-zinc-500 mt-1 max-w-3xl">
                14&apos; × 48&apos; is the safest default. You&apos;ll also find common 10&apos; × 40&apos;,
                10&apos;6&quot; × 36&apos;, 12&apos; × 24&apos;, and spectacular billboard sizes in the preset picker,
                plus digital billboard presets that follow the same overall dimensions.
              </p>
              <p className="text-xs text-zinc-500 mt-2">
                Aquarium physical signage placements covered here include parking lot signage,
                H-frames, little H-frames, A-frames, bathroom signs, construction banners,
                fabric evergreen, and ship banners.
              </p>
            </div>
            <div className="text-xs text-zinc-500 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 px-3 py-2">
              {blueprints.length} saved blueprint{blueprints.length === 1 ? "" : "s"}
            </div>
          </div>
        </section>

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
        {children}
      </main>

      {addingFormat && (
        <AddFormatDialog
          blueprints={blueprints}
          onClose={() => setAddingFormat(false)}
          onAdd={async (input) => {
            await addFormat(input);
            setAddingFormat(false);
          }}
          onSaveBlueprint={saveBlueprint}
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

  const aspect = `aspect-[${trimDimension(format.width)}/${trimDimension(format.height)}]`;

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
        Add a format to describe what you&apos;re producing, from a 14&apos; × 48&apos; highway billboard
        to a 24 × 36 in A-frame or a saved custom blueprint, then upload creative at that size.
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
  blueprints,
  onClose,
  onAdd,
  onSaveBlueprint,
}: {
  blueprints: SignageBlueprint[];
  onClose: () => void;
  onAdd: (input: AddFormatInput) => Promise<void>;
  onSaveBlueprint: (input: Omit<SignageBlueprint, "id" | "createdAt">) => Promise<void>;
}) {
  const [mode, setMode] = useState<"preset" | "blueprint" | "custom">("preset");
  const [selectedPreset, setSelectedPreset] = useState<string>("billboard-highway-default");
  const [selectedBlueprintId, setSelectedBlueprintId] = useState("");
  const [labelOverride, setLabelOverride] = useState("");
  const [customLabel, setCustomLabel] = useState("");
  const [customWidth, setCustomWidth] = useState<string>("");
  const [customHeight, setCustomHeight] = useState<string>("");
  const [customUnit, setCustomUnit] = useState<Unit>("in");
  const [saveAsBlueprint, setSaveAsBlueprint] = useState(false);
  const [blueprintLabel, setBlueprintLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const preset = SIGNAGE_PRESETS.find((item) => item.key === selectedPreset);
  const activeBlueprintId = blueprints.some((item) => item.id === selectedBlueprintId)
    ? selectedBlueprintId
    : (blueprints[0]?.id ?? "");
  const blueprint = blueprints.find((item) => item.id === activeBlueprintId);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);

    try {
      if (mode === "preset") {
        if (!preset) throw new Error("pick a preset");
        await onAdd({
          label: labelOverride.trim() || preset.label,
          width: preset.width,
          height: preset.height,
          unit: preset.unit,
          presetKey: preset.key,
        });
        return;
      }

      if (mode === "blueprint") {
        if (!blueprint) throw new Error("pick a blueprint");
        await onAdd({
          label: labelOverride.trim() || blueprint.label,
          width: blueprint.width,
          height: blueprint.height,
          unit: blueprint.unit,
          presetKey: `blueprint:${blueprint.id}`,
        });
        return;
      }

      const label = customLabel.trim();
      const width = Number(customWidth);
      const height = Number(customHeight);

      if (!label) throw new Error("label is required");
      if (!Number.isFinite(width) || width <= 0) throw new Error("width must be > 0");
      if (!Number.isFinite(height) || height <= 0) throw new Error("height must be > 0");

      if (saveAsBlueprint) {
        const savedLabel = blueprintLabel.trim() || label;
        await onSaveBlueprint({ label: savedLabel, width, height, unit: customUnit });
      }

      await onAdd({ label, width, height, unit: customUnit, presetKey: null });
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
        className="modal-surface w-full max-w-3xl rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 shadow-[var(--shadow-lift)] max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-semibold text-lg">Add signage format</h2>
        <p className="text-sm text-zinc-500 mt-1">
          Start from a billboard preset, reuse a saved blueprint, or define a custom physical size.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-1 text-xs rounded-md border border-zinc-200 dark:border-zinc-800 p-0.5 bg-white dark:bg-zinc-900 w-fit">
          {(["preset", "blueprint", "custom"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              className={`px-3 py-1.5 rounded ${
                mode === value
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
              }`}
            >
              {value === "preset" ? "Preset" : value === "blueprint" ? "Blueprint" : "Custom"}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="mt-4 space-y-4">
          {mode === "preset" && (
            <>
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/40 p-4">
                <div className="text-sm font-medium">Recommended billboard starter</div>
                <p className="text-xs text-zinc-500 mt-1">
                  Highway billboard 14&apos; × 48&apos; is preselected because it&apos;s the safest default for
                  design specs.
                </p>
              </div>

              <div className="space-y-4">
                {PRESET_CATEGORIES.map((category) => {
                  const items = SIGNAGE_PRESETS.filter((preset) => preset.category === category.key);
                  if (items.length === 0) return null;

                  return (
                    <div key={category.key}>
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400 mb-2">
                        {category.label}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {items.map((item) => {
                          const selected = selectedPreset === item.key;
                          return (
                            <button
                              key={item.key}
                              type="button"
                              onClick={() => setSelectedPreset(item.key)}
                              className={`rounded-lg border p-3 text-left transition-colors ${
                                selected
                                  ? "border-zinc-900 dark:border-zinc-100 bg-zinc-50 dark:bg-zinc-800/60"
                                  : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="text-sm font-medium">{item.label}</div>
                                  <div className="text-xs text-zinc-500 mt-0.5">
                                    {formatDimensions(item)}
                                  </div>
                                </div>
                                <span className="text-xs text-zinc-400">
                                  {selected ? "Selected" : "Use"}
                                </span>
                              </div>
                              {item.note && (
                                <p className="text-xs text-zinc-500 mt-2 leading-relaxed">{item.note}</p>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {preset && (
                <div>
                  <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Label override
                  </label>
                  <input
                    type="text"
                    maxLength={120}
                    value={labelOverride}
                    onChange={(e) => setLabelOverride(e.target.value)}
                    placeholder={preset.label}
                    className="mt-1 w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
            </>
          )}

          {mode === "blueprint" && (
            <>
              {blueprints.length === 0 ? (
                <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50/70 dark:bg-zinc-950/40 py-10 px-4 text-center">
                  <div className="font-medium">No saved blueprints yet</div>
                  <p className="text-sm text-zinc-500 mt-1">
                    Create a custom size and enable “Save as blueprint” to reuse it in future projects.
                  </p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {blueprints.map((item) => {
                      const selected = activeBlueprintId === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setSelectedBlueprintId(item.id)}
                          className={`rounded-lg border p-3 text-left transition-colors ${
                            selected
                              ? "border-zinc-900 dark:border-zinc-100 bg-zinc-50 dark:bg-zinc-800/60"
                              : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-medium">{item.label}</div>
                              <div className="text-xs text-zinc-500 mt-0.5">
                                {formatDimensions(item)}
                              </div>
                            </div>
                            <span className="text-xs text-zinc-400">
                              {selected ? "Selected" : "Use"}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {blueprint && (
                    <div>
                      <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                        Label override
                      </label>
                      <input
                        type="text"
                        maxLength={120}
                        value={labelOverride}
                        onChange={(e) => setLabelOverride(e.target.value)}
                        placeholder={blueprint.label}
                        className="mt-1 w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {mode === "custom" && (
            <>
              <div>
                <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Format name
                </label>
                <input
                  type="text"
                  required
                  maxLength={120}
                  value={customLabel}
                  onChange={(e) => setCustomLabel(e.target.value)}
                  placeholder="e.g. Downtown wallscape"
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

              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={saveAsBlueprint}
                    onChange={(e) => setSaveAsBlueprint(e.target.checked)}
                    className="mt-0.5 accent-zinc-900 dark:accent-zinc-100"
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-medium">Save as reusable blueprint</div>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      Store this size and name so it shows up in the blueprint tab for future projects.
                    </p>
                  </div>
                </label>

                {saveAsBlueprint && (
                  <div className="mt-3">
                    <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Blueprint name
                    </label>
                    <input
                      type="text"
                      maxLength={120}
                      value={blueprintLabel}
                      onChange={(e) => setBlueprintLabel(e.target.value)}
                      placeholder="Defaults to the format name above"
                      className="mt-1 w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}
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
              disabled={
                busy ||
                (mode === "preset" && !preset) ||
                (mode === "blueprint" && blueprints.length > 0 && !blueprint)
              }
              className="apple-tap rounded-md bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 px-4 py-2 text-sm font-medium disabled:opacity-50 hover:opacity-90"
            >
              {busy ? "Saving…" : "Add format"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
