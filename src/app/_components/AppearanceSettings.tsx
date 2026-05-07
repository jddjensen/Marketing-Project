"use client";

import { THEMES, type ThemeId } from "@/lib/themes";
import type { ColorMode } from "@/lib/colorMode";
import { useAppearance } from "./AppearanceProvider";

const COLOR_MODE_OPTIONS: Array<{ value: ColorMode; label: string; hint: string }> = [
  { value: "auto", label: "Auto", hint: "Follow system" },
  { value: "light", label: "Light", hint: "Always light" },
  { value: "dark", label: "Dark", hint: "Always dark" },
];

export function AppearanceSettings() {
  const { theme, colorMode, setTheme, setColorMode } = useAppearance();
  const activeTheme = THEMES.find((t) => t.id === theme);

  return (
    <div className="space-y-8">
      <Section
        title="Theme color"
        description="Pick the personality color used across buttons, focus rings, and badges. Editorial neutrals stay the same — only the accent changes."
      >
        <ThemeGrid active={theme} onPick={setTheme} />
        {activeTheme && (
          <p className="mt-3 text-xs text-zinc-500">
            <span className="text-zinc-700 dark:text-zinc-200 font-medium">
              {activeTheme.name}
            </span>{" "}
            — {activeTheme.description}
          </p>
        )}
      </Section>

      <Section
        title="Color mode"
        description="Override your operating system's light/dark setting for this app."
      >
        <div className="segmented" role="group" aria-label="Color mode">
          {COLOR_MODE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setColorMode(opt.value)}
              className="segmented-option"
              data-active={colorMode === opt.value ? "true" : "false"}
              aria-pressed={colorMode === opt.value ? "true" : "false"}
              title={opt.hint}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          {colorMode === "auto"
            ? "Currently following your OS setting."
            : `Always rendering in ${colorMode} mode regardless of OS.`}
        </p>
      </Section>
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-sm font-semibold">{title}</h2>
      {description && (
        <p className="text-xs text-zinc-500 mt-1 max-w-xl">{description}</p>
      )}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function ThemeGrid({
  active,
  onPick,
}: {
  active: ThemeId;
  onPick: (id: ThemeId) => void;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {THEMES.map((t) => {
        const isActive = t.id === active;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onPick(t.id)}
            aria-label={`${t.name} — ${t.description}`}
            aria-pressed={isActive ? "true" : "false"}
            className={`group flex flex-col items-stretch gap-2 rounded-xl border p-3 text-left transition-all duration-150 ease-[var(--ease-apple)] focus-ring ${
              isActive
                ? "border-zinc-900 dark:border-zinc-100 bg-zinc-50 dark:bg-zinc-800/40"
                : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600"
            }`}
          >
            <div
              className="h-12 w-full rounded-md relative"
              style={{ background: t.swatch }}
              aria-hidden="true"
            >
              {isActive && (
                <svg
                  className="absolute inset-0 m-auto h-5 w-5 text-white drop-shadow"
                  viewBox="0 0 16 16"
                  fill="none"
                >
                  <path
                    d="M3.5 8.5L6.5 11.5L12.5 5"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </div>
            <div className="text-xs font-medium">{t.name}</div>
          </button>
        );
      })}
    </div>
  );
}
