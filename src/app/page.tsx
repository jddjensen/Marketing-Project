import Link from "next/link";
import { UserMenu } from "./_components/UserMenu";
import { ProjectsGrid } from "./_components/ProjectsGrid";
import { CommunicationPlatforms } from "./_components/CommunicationPlatforms";

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <header className="apple-header sticky top-0 z-40">
        <div className="mx-auto flex max-w-7xl items-start justify-between gap-4 px-6 py-6">
          <div>
            <h1 className="text-2xl font-semibold">Marketing Platform</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Every campaign and communication channel lives in a project.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/calendar"
              transitionTypes={["nav-forward"]}
              className="apple-tap rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-600"
            >
              Calendar
            </Link>
            <UserMenu />
          </div>
        </div>
      </header>
      <ProjectsGrid />
      <CommunicationPlatforms />
      <footer className="mx-auto flex max-w-7xl justify-end border-t border-zinc-200 px-6 py-6 text-xs text-zinc-500 dark:border-zinc-800">
        <Link
          href="/privacy"
          transitionTypes={["nav-forward"]}
          className="hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          Privacy
        </Link>
      </footer>
    </div>
  );
}
