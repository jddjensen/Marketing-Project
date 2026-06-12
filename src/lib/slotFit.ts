import { aspectRatioFromClass } from "@/lib/channels";

// Shared logic for "does this media fit its slot?" — used by the channel
// boards to show target dimensions before upload and a fit verdict after.

export type SlotSpec = {
  label: string;
  aspect: string;
  ratio?: number;
  size?: { width: number; height: number; unit?: string };
};

export function slotRatio(spec: SlotSpec): number | null {
  if (spec.ratio != null) return spec.ratio;
  if (spec.size) return spec.size.width / spec.size.height;
  return aspectRatioFromClass(spec.aspect);
}

// "aspect-[4/5]" -> "4:5", for human-readable mismatch messages.
export function slotRatioText(spec: SlotSpec): string | null {
  if (spec.aspect === "aspect-video") return "16:9";
  if (spec.aspect === "aspect-square") return "1:1";
  const match = /^aspect-\[(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)\]$/.exec(
    spec.aspect
  );
  if (match) return `${match[1]}:${match[2]}`;
  if (spec.size) return `${spec.size.width}:${spec.size.height}`;
  return null;
}

export function slotTargetText(spec: SlotSpec): string | null {
  if (spec.size) {
    const unit = spec.size.unit ?? "px";
    return `${spec.size.width} × ${spec.size.height} ${unit}`;
  }
  const ratioText = slotRatioText(spec);
  return ratioText ? `${ratioText} ratio` : null;
}

export type SlotFit =
  | { state: "match" }
  | { state: "ratio-mismatch"; expected: string }
  | { state: "undersized"; expected: string }
  | { state: "unknown" };

// 2% tolerance: platform exports are often a pixel or two off a perfect
// ratio, and that's not worth alarming anyone about.
const RATIO_TOLERANCE = 0.02;

export function checkSlotFit(
  spec: SlotSpec,
  width: number | null | undefined,
  height: number | null | undefined
): SlotFit {
  if (!width || !height) return { state: "unknown" };
  const target = slotRatio(spec);
  if (target != null) {
    const actual = width / height;
    if (Math.abs(actual - target) / target > RATIO_TOLERANCE) {
      return {
        state: "ratio-mismatch",
        expected: slotRatioText(spec) ?? "the slot ratio",
      };
    }
  }
  if (
    spec.size &&
    (spec.size.unit ?? "px") === "px" &&
    (width < spec.size.width || height < spec.size.height)
  ) {
    return {
      state: "undersized",
      expected: `${spec.size.width} × ${spec.size.height} px`,
    };
  }
  if (target == null && !spec.size) return { state: "unknown" };
  return { state: "match" };
}
