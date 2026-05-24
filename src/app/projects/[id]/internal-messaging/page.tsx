import { PlatformMediaBoard } from "@/app/_components/PlatformMediaBoard";
import { CHANNEL_BY_KEY } from "@/lib/channels";
import { loadProject } from "@/lib/projects";

export default async function InternalMessagingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await loadProject(id);
  const channel = CHANNEL_BY_KEY["internal-messaging"];

  return (
    <PlatformMediaBoard
      projectId={id}
      projectName={project.name}
      platform="internal-messaging"
      title={channel.boardTitle ?? "Internal Messaging — Campaign Media"}
      subtitle={channel.boardSubtitle ?? channel.desc}
      ratios={channel.slots ?? []}
    />
  );
}
