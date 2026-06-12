import Link from "next/link";
import { UserMenu } from "../_components/UserMenu";
import { AppearanceSettings } from "../_components/AppearanceSettings";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  return (
    <div className="page-shell min-h-screen text-zinc-900 dark:text-zinc-100">
      <header className="apple-header sticky top-0 z-40">
        <div className="mx-auto flex max-w-3xl items-start justify-between gap-4 px-6 py-6">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              transitionTypes={["nav-back"]}
              className="text-xs font-medium tracking-wide text-zinc-500 uppercase hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              ← Projects
            </Link>
            <div>
              <h1 className="ink-gradient text-2xl font-semibold">Settings</h1>
              <p className="mt-1 text-sm text-zinc-500">
                Tune the look and feel of your workspace.
              </p>
            </div>
          </div>
          <UserMenu />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-8">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-[var(--shadow-soft)] dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-6">
            <h2 className="text-base font-semibold">Appearance</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Saved per-browser. Syncing across devices is on the roadmap.
            </p>
          </div>
          <AppearanceSettings />
        </div>
      </main>
    </div>
  );
}
