import { PlatformMediaBoard, type RatioConfig } from "@/app/_components/PlatformMediaBoard";
import { TrackingLinksPanel } from "@/app/_components/TrackingLinksPanel";
import { loadProject } from "@/lib/projects";

const INTERNAL_SLOTS: RatioConfig[] = [
  { key: "team-talk", label: "Team Talk", aspect: "aspect-[4/3]", hint: "Internal staff messaging", recommended: true },
  { key: "front-desk-faq", label: "Front Desk FAQ", aspect: "aspect-[4/3]", hint: "Front desk reference materials" },
];

export default async function InternalMessagingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await loadProject(id);
  const showTracking =
    project.trackingLinksLocation === "platform_panel" ||
    project.trackingLinksLocation === "both";

  return (
    <PlatformMediaBoard
      projectId={id}
      projectName={project.name}
      platform="internal-messaging"
      title="Internal Messaging — Campaign Media"
      subtitle="Assets and references for Team Talk and Front Desk FAQ communication."
      ratios={INTERNAL_SLOTS}
    >
      {showTracking && (
        <div className="mt-10">
          <TrackingLinksPanel projectId={id} projectName={project.name} platform="internal-messaging" />
        </div>
      )}
    </PlatformMediaBoard>
  );
}
