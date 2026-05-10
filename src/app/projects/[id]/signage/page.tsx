import { SignageBoard } from "@/app/_components/SignageBoard";
import { loadProject } from "@/lib/projects";

export default async function SignagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await loadProject(id);
  return <SignageBoard projectId={id} projectName={project.name} />;
}
