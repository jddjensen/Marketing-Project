import { PlatformMediaBoard } from "@/app/_components/PlatformMediaBoard";
import { TrackingLinksPanel } from "@/app/_components/TrackingLinksPanel";
import { CHANNEL_BY_KEY } from "@/lib/channels";
import { loadProject } from "@/lib/projects";

export default async function DigitalSignagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await loadProject(id);
  const channel = CHANNEL_BY_KEY["digital-signage"];
  const showTracking =
    project.trackingLinksLocation === "platform_panel" ||
    project.trackingLinksLocation === "both";

  return (
    <PlatformMediaBoard
      projectId={id}
      projectName={project.name}
      platform="digital-signage"
      title={channel.boardTitle ?? "Digital Signage — Campaign Media"}
      subtitle={channel.boardSubtitle ?? channel.desc}
      ratios={channel.slots ?? []}
    >
      {showTracking && (
        <div className="mt-10">
          <TrackingLinksPanel projectId={id} projectName={project.name} platform="digital-signage" />
        </div>
      )}
    </PlatformMediaBoard>
  );
}
