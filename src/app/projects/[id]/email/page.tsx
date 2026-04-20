import { PlatformMediaBoard, type RatioConfig } from "@/app/_components/PlatformMediaBoard";
import { TrackingLinksPanel } from "@/app/_components/TrackingLinksPanel";
import { loadProject } from "@/lib/projects";

const EMAIL_SLOTS: RatioConfig[] = [
  { key: "campaign", label: "Campaign", aspect: "aspect-[4/5]", hint: "One-off email sends", recommended: true },
  { key: "flow", label: "Flow", aspect: "aspect-[4/5]", hint: "Automated lifecycle email creative" },
];

export default async function EmailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await loadProject(id);
  const showTracking =
    project.trackingLinksLocation === "platform_panel" ||
    project.trackingLinksLocation === "both";

  return (
    <PlatformMediaBoard
      projectId={id}
      projectName={project.name}
      platform="email"
      title="Email — Campaign Media"
      subtitle="Campaign and flow creative for aquarium email sends."
      ratios={EMAIL_SLOTS}
    >
      {showTracking && (
        <div className="mt-10">
          <TrackingLinksPanel projectId={id} projectName={project.name} platform="email" />
        </div>
      )}
    </PlatformMediaBoard>
  );
}
