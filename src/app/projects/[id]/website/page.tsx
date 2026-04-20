import { PlatformMediaBoard, type RatioConfig } from "@/app/_components/PlatformMediaBoard";
import { TrackingLinksPanel } from "@/app/_components/TrackingLinksPanel";
import { loadProject } from "@/lib/projects";

const WEBSITE_SLOTS: RatioConfig[] = [
  { key: "hero-slider", label: "Hero Slider", aspect: "aspect-[16/9]", hint: "Homepage hero rotation", recommended: true },
  { key: "pop-up", label: "Pop Up", aspect: "aspect-[4/5]", hint: "Modal or overlay promo" },
  { key: "landing-page", label: "Landing Page", aspect: "aspect-[16/9]", hint: "Campaign landing page creative", recommended: true },
  { key: "blog", label: "Blog", aspect: "aspect-[4/3]", hint: "Blog header or article promo" },
  { key: "habitat-slider", label: "Habitat Slider", aspect: "aspect-[16/9]", hint: "Habitat or exhibit carousel asset" },
];

export default async function WebsitePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await loadProject(id);
  const showTracking =
    project.trackingLinksLocation === "platform_panel" ||
    project.trackingLinksLocation === "both";

  return (
    <PlatformMediaBoard
      projectId={id}
      projectName={project.name}
      platform="website"
      title="Website — Campaign Media"
      subtitle="Homepage, landing, popup, blog, and habitat placements for aquarium web content."
      ratios={WEBSITE_SLOTS}
    >
      {showTracking && (
        <div className="mt-10">
          <TrackingLinksPanel projectId={id} projectName={project.name} platform="website" />
        </div>
      )}
    </PlatformMediaBoard>
  );
}
