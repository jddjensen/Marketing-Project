import Link from "next/link";
import { UserMenu } from "@/app/_components/UserMenu";
import { loadProject } from "@/lib/projects";

const PLATFORMS = [
  {
    key: "meta",
    name: "Meta",
    desc: "Facebook, Instagram, Reels",
    href: "meta",
  },
  {
    key: "tiktok",
    name: "TikTok",
    desc: "In-Feed, TopView, Spark Ads",
    href: "tiktok",
  },
  {
    key: "youtube",
    name: "YouTube",
    desc: "In-Stream, Shorts, Bumper",
    href: "youtube",
  },
  {
    key: "google-search",
    name: "Google Search",
    desc: "Image assets & search terms",
    href: "google-search",
  },
];

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await loadProject(id);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
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

      <main className="max-w-7xl mx-auto px-6 py-10">
        <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500 mb-4">
          Platforms
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {PLATFORMS.map((p) => (
            <Link
              key={p.key}
              href={`/projects/${id}/${p.href}`}
              className="block rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors"
            >
              <div className="font-semibold">{p.name}</div>
              <div className="text-sm text-zinc-500 mt-1">{p.desc}</div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
