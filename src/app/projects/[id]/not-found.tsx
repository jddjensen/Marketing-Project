import Link from "next/link";

export default function ProjectNotFound() {
  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-16">
      <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-xs font-medium tracking-widest text-zinc-400 uppercase">
          Project not found
        </p>
        <h1 className="mt-3 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          We couldn&apos;t find that project
        </h1>
        <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
          It may have been archived, deleted, or the link is wrong.
        </p>
        <Link
          href="/projects"
          className="mt-6 inline-block rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-700 focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2 focus:outline-none dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 dark:focus:ring-zinc-600 dark:focus:ring-offset-zinc-900"
        >
          Back to projects
        </Link>
      </div>
    </main>
  );
}
