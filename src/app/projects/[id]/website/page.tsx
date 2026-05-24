import { PlatformMediaBoard } from "@/app/_components/PlatformMediaBoard";
import { CHANNEL_BY_KEY } from "@/lib/channels";
import { loadProject } from "@/lib/projects";

export default async function WebsitePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await loadProject(id);
  const channel = CHANNEL_BY_KEY.website;

  return (
    <PlatformMediaBoard
      projectId={id}
      projectName={project.name}
      platform="website"
      title={channel.boardTitle ?? "Website — Campaign Media"}
      subtitle={channel.boardSubtitle ?? channel.desc}
      ratios={channel.slots ?? []}
    />
  );
}
