export type Unit = "in" | "ft" | "cm" | "m" | "px";

export type SignagePreset = {
  key: string;
  label: string;
  width: number;
  height: number;
  unit: Unit;
  category: "billboard" | "poster" | "street" | "retail" | "other";
  note?: string;
};

export type SignageBlueprint = {
  id: string;
  label: string;
  width: number;
  height: number;
  unit: Unit;
  createdAt: number;
};

export const SIGNAGE_PRESETS: SignagePreset[] = [
  {
    key: "billboard-highway-default",
    label: "Billboard — Highway Default",
    width: 48,
    height: 14,
    unit: "ft",
    category: "billboard",
    note: "Safest default for most billboard design specs.",
  },
  {
    key: "billboard-standard-10x40",
    label: "Billboard — Standard 10' × 40'",
    width: 40,
    height: 10,
    unit: "ft",
    category: "billboard",
  },
  {
    key: "billboard-standard-10.5x36",
    label: "Billboard — Standard 10'6\" × 36'",
    width: 36,
    height: 10.5,
    unit: "ft",
    category: "billboard",
  },
  {
    key: "billboard-poster",
    label: "Billboard — Poster 12' × 24'",
    width: 24,
    height: 12,
    unit: "ft",
    category: "billboard",
  },
  {
    key: "billboard-spectacular-16x60",
    label: "Billboard — Spectacular 16' × 60'",
    width: 60,
    height: 16,
    unit: "ft",
    category: "billboard",
  },
  {
    key: "billboard-spectacular-20x60",
    label: "Billboard — Spectacular 20' × 60'",
    width: 60,
    height: 20,
    unit: "ft",
    category: "billboard",
  },
  {
    key: "billboard-digital-bulletin",
    label: "Digital Billboard — Bulletin 14' × 48'",
    width: 48,
    height: 14,
    unit: "ft",
    category: "billboard",
    note: "Digital boards usually follow the same overall sizes as conventional bulletins.",
  },
  {
    key: "billboard-digital-poster",
    label: "Digital Billboard — Poster 12' × 24'",
    width: 24,
    height: 12,
    unit: "ft",
    category: "billboard",
  },
  {
    key: "billboard-oaaa-average",
    label: "Billboard — OAAA Bulletin Average",
    width: 41.3,
    height: 11.5,
    unit: "ft",
    category: "billboard",
    note: "Simple blended average across three common bulletin sizes.",
  },
  {
    key: "bus-shelter",
    label: "Bus Shelter",
    width: 4,
    height: 6,
    unit: "ft",
    category: "street",
  },
  {
    key: "aframe",
    label: "A-Frame Sidewalk Sign",
    width: 24,
    height: 36,
    unit: "in",
    category: "street",
  },
  {
    key: "hframe-small",
    label: "H-Frame (small)",
    width: 24,
    height: 24,
    unit: "in",
    category: "street",
  },
  {
    key: "hframe-standard",
    label: "H-Frame (standard)",
    width: 18,
    height: 24,
    unit: "in",
    category: "street",
  },
  {
    key: "yard-sign",
    label: "Yard Sign",
    width: 18,
    height: 24,
    unit: "in",
    category: "street",
  },
  {
    key: "poster-small",
    label: "Poster — Small (11×17)",
    width: 11,
    height: 17,
    unit: "in",
    category: "poster",
  },
  {
    key: "poster-standard",
    label: "Poster — Standard (18×24)",
    width: 18,
    height: 24,
    unit: "in",
    category: "poster",
  },
  {
    key: "poster-large",
    label: "Poster — Large (24×36)",
    width: 24,
    height: 36,
    unit: "in",
    category: "poster",
  },
  {
    key: "window-cling",
    label: "Window Cling",
    width: 18,
    height: 24,
    unit: "in",
    category: "retail",
  },
];

export function trimDimension(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(3)));
}

export function formatDimensions(input: {
  width: number;
  height: number;
  unit: Unit;
}): string {
  return `${trimDimension(input.width)}×${trimDimension(input.height)} ${input.unit}`;
}
