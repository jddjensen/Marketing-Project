"use client";

import { useCallback, useEffect, useRef } from "react";

type ToastTone = "success" | "error" | "info";

const AUTO_DISMISS_MS = 4000;

const TONE_CLASSES: Record<ToastTone, string> = {
  success:
    "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200",
  error:
    "border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200",
  info: "border-zinc-200 bg-white text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100",
};

type ToastProps = {
  message: string;
  tone?: ToastTone;
  onDismiss?: () => void;
  className?: string;
};

export function Toast({
  message,
  tone = "info",
  onDismiss,
  className = "",
}: ToastProps) {
  // Latest-ref so parent re-renders (new onDismiss identity) don't reset the countdown.
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  });

  // Errors stay until manually dismissed.
  const autoDismiss = tone !== "error" && Boolean(onDismiss);

  const timerRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);
  const remainingRef = useRef(AUTO_DISMISS_MS);
  const hoveredRef = useRef(false);
  const focusedRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    clearTimer();
    startedAtRef.current = Date.now();
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      onDismissRef.current?.();
    }, remainingRef.current);
  }, [clearTimer]);

  const pauseTimer = useCallback(() => {
    if (timerRef.current === null) return;
    clearTimer();
    remainingRef.current = Math.max(
      0,
      remainingRef.current - (Date.now() - startedAtRef.current)
    );
  }, [clearTimer]);

  useEffect(() => {
    if (!autoDismiss) return;
    remainingRef.current = AUTO_DISMISS_MS;
    if (!hoveredRef.current && !focusedRef.current) startTimer();
    return clearTimer;
  }, [autoDismiss, message, startTimer, clearTimer]);

  const handleMouseEnter = () => {
    hoveredRef.current = true;
    pauseTimer();
  };

  const handleMouseLeave = () => {
    hoveredRef.current = false;
    if (autoDismiss && !focusedRef.current) startTimer();
  };

  const handleFocus = () => {
    focusedRef.current = true;
    pauseTimer();
  };

  const handleBlur = (event: React.FocusEvent<HTMLDivElement>) => {
    // Ignore focus moving between descendants of the toast.
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
      return;
    }
    focusedRef.current = false;
    if (autoDismiss && !hoveredRef.current) startTimer();
  };

  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`toast-pop fixed top-4 right-4 z-50 flex max-w-sm items-start gap-3 rounded-lg border px-4 py-3 text-sm shadow-[var(--shadow-lift)] ${TONE_CLASSES[tone]} ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
    >
      <div className="min-w-0 flex-1">{message}</div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="focus-ring shrink-0 rounded px-1 text-current opacity-70 hover:opacity-100"
          aria-label="Dismiss notification"
        >
          x
        </button>
      )}
    </div>
  );
}
