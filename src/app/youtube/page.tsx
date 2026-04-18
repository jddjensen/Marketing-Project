import { PlatformMediaBoard, type RatioConfig } from "../_components/PlatformMediaBoard";

const YOUTUBE_RATIOS: RatioConfig[] = [
  {
    key: "16x9",
    label: "16:9 Horizontal",
    aspect: "aspect-video",
    hint: "In-Stream, Bumper, Masthead — 1920×1080",
    recommended: true,
  },
  {
    key: "9x16",
    label: "9:16 Vertical (YouTube Shorts)",
    aspect: "aspect-[9/16]",
    hint: "YouTube Shorts only — 1080×1920",
  },
  {
    key: "1x1",
    label: "1:1 Square",
    aspect: "aspect-square",
    hint: "In-Feed / Discovery — 1080×1080",
  },
];

export default function YouTubePage() {
  return (
    <PlatformMediaBoard
      platform="youtube"
      title="YouTube — Campaign Media"
      subtitle="16:9 for In-Stream; 9:16 for Shorts. Bumpers = 6s, Skippable In-Stream ≤3 min. 1080p recommended."
      ratios={YOUTUBE_RATIOS}
    />
  );
}
