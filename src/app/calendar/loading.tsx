export default function CalendarLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="mx-auto w-full max-w-7xl px-6 py-8"
    >
      <span className="sr-only">Loading calendar</span>
      <div className="space-y-6" aria-hidden="true">
        <div className="flex items-center justify-between">
          <div className="h-7 w-40 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-9 w-32 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800" />
        </div>
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 35 }).map((_, i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
