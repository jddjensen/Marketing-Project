import { PlatformMediaBoard, type RatioConfig } from "../_components/PlatformMediaBoard";

const TIKTOK_RATIOS: RatioConfig[] = [
  {
    key: "9x16",
    label: "9:16 Vertical",
    aspect: "aspect-[9/16]",
    hint: "In-Feed Ads, TopView, Spark Ads — 720×1280+",
    recommended: true,
  },
  { key: "1x1", label: "1:1 Square", aspect: "aspect-square", hint: "Supported — 640×640 min" },
  {
    key: "16x9",
    label: "16:9 Horizontal",
    aspect: "aspect-video",
    hint: "Supported — 960×540 min",
  },
];

export default function TikTokPage() {
  return (
    <PlatformMediaBoard
      platform="tiktok"
      title="TikTok — Campaign Media"
      subtitle="9:16 is king. Keep videos ≤60s (15–20s recommended) and under 500MB."
      ratios={TIKTOK_RATIOS}
    />
  );
}
