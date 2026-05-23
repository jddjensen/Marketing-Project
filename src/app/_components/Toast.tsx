"use client";

type ToastTone = "success" | "error" | "info";

const TONE_CLASSES: Record<ToastTone, string> = {
  success:
    "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200",
  error:
    "border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200",
  info:
    "border-zinc-200 bg-white text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100",
};

type ToastProps = {
  message: string;
  tone?: ToastTone;
  onDismiss?: () => void;
  className?: string;
};

export function Toast({ message, tone = "info", onDismiss, className = "" }: ToastProps) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`fixed right-4 top-4 z-50 flex max-w-sm items-start gap-3 rounded-lg border px-4 py-3 text-sm shadow-[var(--shadow-lift)] ${TONE_CLASSES[tone]} ${className}`}
    >
      <div className="min-w-0 flex-1">{message}</div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded px-1 text-current opacity-70 hover:opacity-100 focus-ring"
          aria-label="Dismiss notification"
        >
          x
        </button>
      )}
    </div>
  );
}
