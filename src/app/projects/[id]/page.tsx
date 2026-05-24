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
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <header className="apple-header sticky top-0 z-40">
        <div className="mx-auto flex max-w-7xl items-start justify-between gap-4 px-6 py-6">
          <div>
            <Link
              href="/"
              transitionTypes={["nav-back"]}
              className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              ← Projects
            </Link>
            <h1 className="mt-1 text-2xl font-semibold">{project.name}</h1>
            {project.description && (
              <p className="mt-1 text-sm text-zinc-500">
                {project.description}
              </p>
            )}
          </div>
          <UserMenu />
        </div>
      </header>
      <ProjectDashboard
        projectId={id}
        initialCampaignBrief={project.campaignBrief}
      />
    </div>
  );
}
