// "auto" follows the OS via prefers-color-scheme; "light" / "dark" override.
export type ColorMode = "auto" | "light" | "dark";

export const DEFAULT_COLOR_MODE: ColorMode = "auto";

export const COLOR_MODE_STORAGE_KEY = "marketing-platform.colorMode";

export function isColorMode(value: unknown): value is ColorMode {
  return value === "auto" || value === "light" || value === "dark";
}
