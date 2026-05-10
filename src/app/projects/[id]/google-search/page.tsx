import { PlatformMediaBoard } from "@/app/_components/PlatformMediaBoard";
import { SearchTermsPanel } from "@/app/_components/SearchTermsPanel";
import { CHANNEL_BY_KEY } from "@/lib/channels";
import { loadProject } from "@/lib/projects";

export default async function GoogleSearchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await loadProject(id);
  const channel = CHANNEL_BY_KEY["google-search"];
  return (
    <PlatformMediaBoard
      projectId={id}
      projectName={project.name}
      platform="google-search"
      title={channel.boardTitle ?? "Google Search — Campaign Media"}
      subtitle={channel.boardSubtitle ?? channel.desc}
      ratios={channel.slots ?? []}
    >
      <SearchTermsPanel platform="google-search" projectId={id} />
    </PlatformMediaBoard>
  );
}
