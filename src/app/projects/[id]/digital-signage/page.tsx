import { PlatformMediaBoard, type RatioConfig } from "@/app/_components/PlatformMediaBoard";
import { TrackingLinksPanel } from "@/app/_components/TrackingLinksPanel";
import { loadProject } from "@/lib/projects";

const DIGITAL_SIGNAGE_SLOTS: RatioConfig[] = [
  { key: "admission", label: "Admission", aspect: "aspect-video", hint: "Entrance and admissions screens", recommended: true },
  { key: "info-desk", label: "Info Desk", aspect: "aspect-video", hint: "Information desk digital signage" },
  { key: "on-campus", label: "On Campus", aspect: "aspect-video", hint: "General on-campus screen network" },
];

export default async function DigitalSignagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await loadProject(id);
  const showTracking =
    project.trackingLinksLocation === "platform_panel" ||
    project.trackingLinksLocation === "both";

  return (
    <PlatformMediaBoard
      projectId={id}
      projectName={project.name}
      platform="digital-signage"
      title="Digital Signage — Campaign Media"
      subtitle="Admission, Info Desk, and on-campus digital screen creative for the aquarium."
      ratios={DIGITAL_SIGNAGE_SLOTS}
    >
      {showTracking && (
        <div className="mt-10">
          <TrackingLinksPanel projectId={id} projectName={project.name} platform="digital-signage" />
        </div>
      )}
    </PlatformMediaBoard>
  );
}
