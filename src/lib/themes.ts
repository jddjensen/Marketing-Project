// Curated theme palettes. Each one swaps `--accent`, `--accent-soft`, and a
// few subtle background/surface tints. The neutral grays stay neutral so
// platform UI keeps its airy, premium feel — only the accent personality
// changes per theme.

export type ThemeId =
  | "slate"
  | "aurora"
  | "midnight"
  | "sunset"
  | "forest"
  | "rose"
  | "cyan"
  | "amber";

export type Theme = {
  id: ThemeId;
  name: string;
  description: string;
  // Hex shown on the swatch in the picker (light-mode accent).
  swatch: string;
};

export const THEMES: Theme[] = [
  {
    id: "slate",
    name: "Slate",
    description: "Editorial blue. The default.",
    swatch: "#2563eb",
  },
  {
    id: "aurora",
    name: "Aurora",
    description: "Deep violet with a faint cool wash.",
    swatch: "#8b5cf6",
  },
  {
    id: "midnight",
    name: "Midnight",
    description: "Pure indigo on a deep cobalt night.",
    swatch: "#6366f1",
  },
  {
    id: "sunset",
    name: "Sunset",
    description: "Warm coral on a smoky charcoal.",
    swatch: "#fb7185",
  },
  {
    id: "forest",
    name: "Forest",
    description: "Emerald on muted slate.",
    swatch: "#10b981",
  },
  {
    id: "rose",
    name: "Rose",
    description: "Hot pink on cool neutrals.",
    swatch: "#f43f5e",
  },
  {
    id: "cyan",
    name: "Cyan",
    description: "Electric teal on cool gray.",
    swatch: "#06b6d4",
  },
  {
    id: "amber",
    name: "Amber",
    description: "Polished gold on warm zinc.",
    swatch: "#f59e0b",
  },
];

export const DEFAULT_THEME: ThemeId = "slate";

export const THEME_STORAGE_KEY = "marketing-platform.theme";

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && THEMES.some((t) => t.id === value);
}
