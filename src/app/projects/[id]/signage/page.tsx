import { SignageBoard } from "@/app/_components/SignageBoard";
import { TrackingLinksPanel } from "@/app/_components/TrackingLinksPanel";
import { loadProject } from "@/lib/projects";

export default async function SignagePage({
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
    <SignageBoard projectId={id} projectName={project.name}>
      {showTracking && (
        <div className="mt-10">
          <TrackingLinksPanel projectId={id} projectName={project.name} platform="signage" />
        </div>
      )}
    </SignageBoard>
  );
}
