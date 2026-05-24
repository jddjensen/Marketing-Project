"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function RootError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    // Sentry's Next SDK auto-captures error boundaries, but log once for the
    // local console too so developers see the stack without opening Sentry.
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-6 py-16 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="w-full max-w-md text-center">
        <p className="text-xs font-medium tracking-widest text-zinc-400 uppercase">
          Something went wrong
        </p>
        <h1 className="mt-3 text-2xl font-semibold">
          We hit an unexpected error
        </h1>
        <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
          Try again in a moment. If it keeps happening, share the reference
          below with support.
        </p>
        {error.digest ? (
          <p className="mt-4 inline-block rounded-md bg-zinc-100 px-3 py-1 font-mono text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
            ref: {error.digest}
          </p>
        ) : null}
        <div className="mt-8 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => unstable_retry()}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-700 focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2 focus:outline-none dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 dark:focus:ring-zinc-600 dark:focus:ring-offset-zinc-950"
          >
            Try again
          </button>
          <Link
            href="/"
            className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-600"
          >
            Go home
          </Link>
        </div>
      </div>
    </main>
  );
}
