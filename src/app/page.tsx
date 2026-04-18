import Link from "next/link";

const PLATFORMS = [
  { key: "meta", name: "Meta", desc: "Facebook, Instagram, Reels", href: "/meta", active: true },
  { key: "tiktok", name: "TikTok", desc: "In-Feed, TopView, Spark Ads", href: "/tiktok", active: true },
  { key: "youtube", name: "YouTube", desc: "In-Stream, Shorts, Bumper", href: "/youtube", active: true },
  { key: "google-search", name: "Google Search", desc: "Image assets & logos", href: "/google-search", active: true },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <h1 className="text-2xl font-semibold">Marketing Platform</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Visualize and review campaign media across platforms.
          </p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10">
        <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500 mb-4">
          Platforms
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {PLATFORMS.map((p) =>
            p.active ? (
              <Link
                key={p.key}
                href={p.href}
                className="block rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors"
              >
                <div className="font-semibold">{p.name}</div>
                <div className="text-sm text-zinc-500 mt-1">{p.desc}</div>
              </Link>
            ) : (
              <div
                key={p.key}
                className="rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 p-5 opacity-60"
              >
                <div className="font-semibold">{p.name}</div>
                <div className="text-sm text-zinc-500 mt-1">{p.desc}</div>
              </div>
            )
          )}
        </div>
      </main>
    </div>
  );
}
