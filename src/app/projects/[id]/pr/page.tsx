import { PlatformMediaBoard, type RatioConfig } from "@/app/_components/PlatformMediaBoard";
import { TrackingLinksPanel } from "@/app/_components/TrackingLinksPanel";
import { loadProject } from "@/lib/projects";

const PR_SLOTS: RatioConfig[] = [
  { key: "youtube", label: "YouTube", aspect: "aspect-video", hint: "PR and earned YouTube placements" },
  { key: "influencers", label: "Influencers", aspect: "aspect-[9/16]", hint: "Creator and influencer collateral", recommended: true },
  { key: "regional-utah", label: "Regional (Utah)", aspect: "aspect-[4/5]", hint: "Regional press and partner outreach" },
  { key: "national", label: "National", aspect: "aspect-[4/5]", hint: "National PR assets and distribution" },
];

export default async function PrPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await loadProject(id);
  const showTracking =
    project.trackingLinksLocation === "platform_panel" ||
    project.trackingLinksLocation === "both";

  return (
    <PlatformMediaBoard
      projectId={id}
      projectName={project.name}
      platform="pr"
      title="PR — Campaign Media"
      subtitle="YouTube, influencer, regional Utah, and national PR collateral."
      ratios={PR_SLOTS}
    >
      {showTracking && (
        <div className="mt-10">
          <TrackingLinksPanel projectId={id} projectName={project.name} platform="pr" />
        </div>
      )}
    </PlatformMediaBoard>
  );
}
