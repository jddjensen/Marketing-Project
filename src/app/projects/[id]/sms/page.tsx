import { PlatformMediaBoard, type RatioConfig } from "@/app/_components/PlatformMediaBoard";
import { TrackingLinksPanel } from "@/app/_components/TrackingLinksPanel";
import { loadProject } from "@/lib/projects";

const SMS_SLOTS: RatioConfig[] = [
  { key: "campaign", label: "Campaign", aspect: "aspect-[9/16]", hint: "Broadcast SMS and MMS campaigns", recommended: true },
  { key: "flow", label: "Flow", aspect: "aspect-[9/16]", hint: "Automated text message flows" },
];

export default async function SmsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await loadProject(id);
  const showTracking =
    project.trackingLinksLocation === "platform_panel" ||
    project.trackingLinksLocation === "both";

  return (
    <PlatformMediaBoard
      projectId={id}
      projectName={project.name}
      platform="sms"
      title="SMS — Campaign Media"
      subtitle="Campaign and flow messaging assets for aquarium SMS programs."
      ratios={SMS_SLOTS}
    >
      {showTracking && (
        <div className="mt-10">
          <TrackingLinksPanel projectId={id} projectName={project.name} platform="sms" />
        </div>
      )}
    </PlatformMediaBoard>
  );
}
