"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useAppearance } from "./AppearanceProvider";
import { useExitAnimation } from "./useExitAnimation";

export function UserMenu() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { theme } = useAppearance();
  const { mounted, state } = useExitAnimation(open, 130);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) setEmail(data.user?.email ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      setEmail(session?.user?.email ?? null);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function logout() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    setOpen(false);
    router.replace("/login");
    router.refresh();
  }

  if (!email) return null;

  const initial = email.trim().slice(0, 1).toUpperCase();

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open ? "true" : "false"}
        className="apple-tap focus-ring flex items-center gap-2 rounded-full border border-zinc-200 bg-white py-1 pr-3 pl-1 text-sm dark:border-zinc-800 dark:bg-zinc-900"
        title={`Signed in as ${email} (${theme} theme)`}
      >
        <span
          className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-(--accent) text-xs font-semibold text-white"
          aria-hidden="true"
        >
          {initial}
        </span>
        <span className="hidden max-w-[160px] truncate text-zinc-500 sm:inline">
          {email}
        </span>
      </button>

      {mounted && (
        <div
          aria-label="Account menu"
          data-state={state}
          className="popover-surface absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-[var(--shadow-lift)] dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <div className="text-[10px] font-semibold tracking-wide text-zinc-500 uppercase">
              Signed in as
            </div>
            <div className="truncate text-sm" title={email}>
              {email}
            </div>
          </div>

          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800/60"
          >
            <span>Settings</span>
            <span className="text-[11px] text-zinc-500 capitalize">
              {theme}
            </span>
          </Link>

          <button
            type="button"
            onClick={logout}
            className="w-full border-t border-zinc-200 px-4 py-2.5 text-left text-sm text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-800/60"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
