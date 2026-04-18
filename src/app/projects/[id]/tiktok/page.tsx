import { PlatformMediaBoard, type RatioConfig } from "@/app/_components/PlatformMediaBoard";
import { TrackingLinksPanel } from "@/app/_components/TrackingLinksPanel";
import { loadProject } from "@/lib/projects";

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

export default async function TikTokPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await loadProject(id);
  const showTracking =
    project.trackingLinksLocation === "platform_panel" ||
    project.trackingLinksLocation === "both";
  return (
    <PlatformMediaBoard
      projectId={id}
      projectName={project.name}
      platform="tiktok"
      title="TikTok — Campaign Media"
      subtitle="9:16 is king. Keep videos ≤60s (15–20s recommended) and under 500MB."
      ratios={TIKTOK_RATIOS}
    >
      {showTracking && (
        <div className="mt-10">
          <TrackingLinksPanel projectId={id} projectName={project.name} platform="tiktok" />
        </div>
      )}
    </PlatformMediaBoard>
  );
}
