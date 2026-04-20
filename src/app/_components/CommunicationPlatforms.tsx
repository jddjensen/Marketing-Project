import {
  CHANNEL_CATEGORY_DESCRIPTIONS,
  CHANNEL_CATEGORY_LABELS,
  CHANNEL_CATEGORY_ORDER,
  CHANNELS,
} from "@/lib/channels";

export function CommunicationPlatforms() {
  return (
    <section className="max-w-7xl mx-auto px-6 py-10 border-t border-zinc-200 dark:border-zinc-800">
      <div className="mb-6">
        <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">
          Channel Taxonomy
        </h2>
        <p className="text-sm text-zinc-500 mt-1">
          A complete audit view of the aquarium&apos;s communication channels. Top-level channels stay
          grouped by category, and each channel keeps its own placements or size slots nested inside it.
        </p>
      </div>

      <div className="space-y-6">
        {CHANNEL_CATEGORY_ORDER.map((category) => {
          const channels = CHANNELS.filter((channel) => channel.category === category);
          if (channels.length === 0) return null;

          return (
            <section key={category}>
              <div className="mb-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  {CHANNEL_CATEGORY_LABELS[category]}
                </h3>
                <p className="text-sm text-zinc-500 mt-1">
                  {CHANNEL_CATEGORY_DESCRIPTIONS[category]}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {channels.map((channel) => (
                  <article
                    key={channel.key}
                    className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-[var(--shadow-soft)]"
                  >
                    <h4 className="font-semibold text-sm">{channel.name}</h4>
                    <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                      {channel.inventoryDescription}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {channel.inventoryItems.map((item) => (
                        <span
                          key={item}
                          className="rounded-full border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 px-2.5 py-1 text-[11px] text-zinc-600 dark:text-zinc-300"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
}
