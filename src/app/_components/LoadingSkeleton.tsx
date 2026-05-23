type LoadingSkeletonProps = {
  rows?: number;
  variant?: "cards" | "list" | "text";
  className?: string;
};

export function LoadingSkeleton({
  rows = 3,
  variant = "list",
  className = "",
}: LoadingSkeletonProps) {
  if (variant === "cards") {
    return (
      <div
        className={`grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 ${className}`}
        aria-busy="true"
        aria-label="Loading"
      >
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="skeleton aspect-[4/3] w-full" />
            <div className="space-y-2 p-4">
              <div className="skeleton h-4 w-2/3" />
              <div className="skeleton h-3 w-full" />
              <div className="skeleton h-3 w-4/5" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (variant === "text") {
    return (
      <div className={`space-y-2 ${className}`} aria-busy="true" aria-label="Loading">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className={`skeleton h-3 ${i % 3 === 0 ? "w-2/3" : "w-full"}`} />
        ))}
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`} aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="skeleton h-4 w-1/3" />
          <div className="mt-2 space-y-2">
            <div className="skeleton h-3 w-full" />
            <div className="skeleton h-3 w-4/5" />
          </div>
        </div>
      ))}
    </div>
  );
}
