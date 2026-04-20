import { PlatformMediaBoard, type RatioConfig } from "@/app/_components/PlatformMediaBoard";
import { TrackingLinksPanel } from "@/app/_components/TrackingLinksPanel";
import { loadProject } from "@/lib/projects";

const FLYER_RATIOS: RatioConfig[] = [
  {
    key: "8.5x11",
    label: "8.5 × 11 Letter",
    aspect: "aspect-[8.5/11]",
    hint: "Standard flyer — 2550×3300 at 300 DPI",
    recommended: true,
  },
  {
    key: "5.5x8.5",
    label: "5.5 × 8.5 Half-Sheet",
    aspect: "aspect-[5.5/8.5]",
    hint: "Quarter-page handout / leave-behind — 1650×2550 at 300 DPI",
  },
  {
    key: "11x17",
    label: "11 × 17 Tabloid",
    aspect: "aspect-[11/17]",
    hint: "Large-format flyer — 3300×5100 at 300 DPI",
  },
];

export default async function FlyersPage({
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
      platform="flyers"
      title="Flyers — Campaign Media"
      subtitle="Upload print-ready flyer creative by size. Letter is the safest default; add tracked destinations or QR-ready links for distribution pieces."
      ratios={FLYER_RATIOS}
      trackingEnabled
    >
      {showTracking && (
        <div className="mt-10">
          <TrackingLinksPanel projectId={id} projectName={project.name} platform="flyers" />
        </div>
      )}
    </PlatformMediaBoard>
  );
}
