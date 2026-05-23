"use client";

import Link from "next/link";

type EmptyStateAction =
  | {
      label: string;
      onClick: () => void;
      href?: never;
    }
  | {
      label: string;
      href: string;
      onClick?: never;
    };

type EmptyStateProps = {
  title: string;
  description: string;
  action?: EmptyStateAction;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
};

export function EmptyState({
  title,
  description,
  action,
  icon,
  children,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`rounded-xl border border-dashed border-zinc-300 bg-white/60 px-6 py-10 text-center shadow-[var(--shadow-soft)] dark:border-zinc-700 dark:bg-zinc-900/50 ${className}`}
    >
      {icon && (
        <div
          className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-(--accent-soft) text-(--accent)"
          aria-hidden="true"
        >
          {icon}
        </div>
      )}
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <p className="mx-auto mt-1.5 max-w-md text-sm text-zinc-500">{description}</p>
      {children && <div className="mt-5">{children}</div>}
      {action && (
        <div className="mt-6">
          {"href" in action ? (
            <Link
              href={action.href}
              className="apple-tap inline-flex min-h-10 items-center justify-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:opacity-90 dark:bg-zinc-100 dark:text-zinc-900"
            >
              {action.label}
            </Link>
          ) : (
            <button
              type="button"
              onClick={action.onClick}
              className="apple-tap inline-flex min-h-10 items-center justify-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:opacity-90 dark:bg-zinc-100 dark:text-zinc-900"
            >
              {action.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
