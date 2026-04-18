import { PlatformMediaBoard, type RatioConfig } from "@/app/_components/PlatformMediaBoard";
import { SearchTermsPanel } from "@/app/_components/SearchTermsPanel";
import { TrackingLinksPanel } from "@/app/_components/TrackingLinksPanel";
import { loadProject } from "@/lib/projects";

const GOOGLE_SEARCH_RATIOS: RatioConfig[] = [
  {
    key: "1x1",
    label: "1:1 Square",
    aspect: "aspect-square",
    hint: "Image asset — 1200×1200",
    recommended: true,
  },
  {
    key: "1.91x1",
    label: "1.91:1 Landscape",
    aspect: "aspect-[1.91/1]",
    hint: "Image asset — 1200×628",
    recommended: true,
  },
  {
    key: "4x1",
    label: "4:1 Logo",
    aspect: "aspect-[4/1]",
    hint: "Business logo — 1200×300",
  },
];

export default async function GoogleSearchPage({
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
    <PlatformMediaBoard
      projectId={id}
      projectName={project.name}
      platform="google-search"
      title="Google Search — Campaign Media"
      subtitle="Image assets, logos, and search terms tied to this project."
      ratios={GOOGLE_SEARCH_RATIOS}
    >
      <SearchTermsPanel platform="google-search" projectId={id} />
      {showTracking && (
        <div className="mt-10">
          <TrackingLinksPanel projectId={id} projectName={project.name} platform="google-search" />
        </div>
      )}
    </PlatformMediaBoard>
  );
}
