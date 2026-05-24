"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function ProjectDetailError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-16">
      <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-xs font-medium tracking-widest text-zinc-400 uppercase">
          Project couldn&apos;t load
        </p>
        <h1 className="mt-3 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          Something went wrong loading this project
        </h1>
        <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
          The rest of the app is fine. Retry this view, or jump back to your
          projects list.
        </p>
        {error.digest ? (
          <p className="mt-4 inline-block rounded-md bg-zinc-100 px-3 py-1 font-mono text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
            ref: {error.digest}
          </p>
        ) : null}
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => unstable_retry()}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-700 focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2 focus:outline-none dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 dark:focus:ring-zinc-600 dark:focus:ring-offset-zinc-900"
          >
            Retry
          </button>
          <Link
            href="/projects"
            className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-600"
          >
            Back to projects
          </Link>
        </div>
      </div>
    </main>
  );
}
