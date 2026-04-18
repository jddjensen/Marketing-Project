import { PlatformMediaBoard, type RatioConfig } from "@/app/_components/PlatformMediaBoard";
import { loadProject } from "@/lib/projects";

const META_RATIOS: RatioConfig[] = [
  { key: "1x1", label: "1:1 Square", aspect: "aspect-square", hint: "Feed post" },
  { key: "9x16", label: "9:16 Vertical", aspect: "aspect-[9/16]", hint: "Reels / Stories" },
  { key: "16x9", label: "16:9 Horizontal", aspect: "aspect-video", hint: "In-stream video" },
];

export default async function MetaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await loadProject(id);
  return (
    <PlatformMediaBoard
      projectId={id}
      projectName={project.name}
      platform="meta"
      title="Meta — Campaign Media"
      subtitle="Upload and review creative by aspect ratio. Add a destination URL per creative to track clicks."
      ratios={META_RATIOS}
      trackingEnabled
    />
  );
}
