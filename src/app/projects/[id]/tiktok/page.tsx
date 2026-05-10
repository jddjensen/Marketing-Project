import { PlatformMediaBoard } from "@/app/_components/PlatformMediaBoard";
import { CHANNEL_BY_KEY } from "@/lib/channels";
import { loadProject } from "@/lib/projects";

export default async function TikTokPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await loadProject(id);
  const channel = CHANNEL_BY_KEY.tiktok;
  return (
    <PlatformMediaBoard
      projectId={id}
      projectName={project.name}
      platform="tiktok"
      title={channel.boardTitle ?? "TikTok — Campaign Media"}
      subtitle={channel.boardSubtitle ?? channel.desc}
      ratios={channel.slots ?? []}
    />
  );
}
