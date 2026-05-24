export default function ProjectDetailLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="mx-auto w-full max-w-7xl px-6 py-8"
    >
      <span className="sr-only">Loading project</span>
      <div className="space-y-8" aria-hidden="true">
        <div className="space-y-3">
          <div className="h-7 w-72 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-4 w-96 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800" />
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="h-64 animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-64 animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-64 animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-800" />
        </div>
      </div>
    </div>
  );
}
