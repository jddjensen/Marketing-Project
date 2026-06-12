export default function RootLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="page-shell flex min-h-screen items-center justify-center text-zinc-500 dark:text-zinc-400"
    >
      <span className="sr-only">Loading</span>
      <span
        aria-hidden="true"
        className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-transparent dark:border-zinc-700"
      />
    </div>
  );
}
