import { PlatformMediaBoard, type RatioConfig } from "@/app/_components/PlatformMediaBoard";
import { TrackingLinksPanel } from "@/app/_components/TrackingLinksPanel";
import { loadProject } from "@/lib/projects";

const OTT_SLOTS: RatioConfig[] = [
  { key: "office", label: "Office", aspect: "aspect-video", hint: "Internal OTT office placement" },
  { key: "streaming-network-1", label: "Streaming Network 1", aspect: "aspect-video", hint: "Primary OTT network placement", recommended: true },
  { key: "streaming-network-2", label: "Streaming Network 2", aspect: "aspect-video", hint: "Secondary OTT network placement" },
];

export default async function OttPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await loadProject(id);
  const showTracking =
    project.trackingLinksLocation === "platform_panel" ||
    project.trackingLinksLocation === "both";

  return (
    <PlatformMediaBoard
      projectId={id}
      projectName={project.name}
      platform="ott"
      title="OTT — Campaign Media"
      subtitle="Office and streaming network placements for aquarium OTT creative."
      ratios={OTT_SLOTS}
    >
      {showTracking && (
        <div className="mt-10">
          <TrackingLinksPanel projectId={id} projectName={project.name} platform="ott" />
        </div>
      )}
    </PlatformMediaBoard>
  );
}
