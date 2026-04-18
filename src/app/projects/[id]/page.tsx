import Link from "next/link";
import { UserMenu } from "@/app/_components/UserMenu";
import { ProjectDashboard } from "@/app/_components/ProjectDashboard";
import { loadProject } from "@/lib/projects";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await loadProject(id);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <header className="apple-header sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-6 flex items-start justify-between gap-4">
          <div>
            <Link
              href="/"
              className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              ← Projects
            </Link>
            <h1 className="text-2xl font-semibold mt-1">{project.name}</h1>
            {project.description && (
              <p className="text-sm text-zinc-500 mt-1">{project.description}</p>
            )}
          </div>
          <UserMenu />
        </div>
      </header>
      <ProjectDashboard
        projectId={id}
        projectName={project.name}
        initialTrackingLinksLocation={project.trackingLinksLocation}
      />
    </div>
  );
}
