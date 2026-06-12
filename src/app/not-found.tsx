import Link from "next/link";

export default function NotFound() {
  return (
    <main className="page-shell flex min-h-screen items-center justify-center px-6 py-16 text-zinc-900 dark:text-zinc-100">
      <div className="w-full max-w-md text-center">
        <p className="text-xs font-medium tracking-widest text-zinc-400 uppercase">
          404
        </p>
        <h1 className="mt-3 text-2xl font-semibold">
          We couldn&apos;t find that page
        </h1>
        <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
          The link may have moved or never existed. Head back home and try
          again.
        </p>
        <Link
          href="/"
          className="mt-8 inline-block rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-700 focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2 focus:outline-none dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 dark:focus:ring-zinc-600 dark:focus:ring-offset-zinc-950"
        >
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}
