import {
  CHANNEL_CATEGORY_DESCRIPTIONS,
  CHANNEL_CATEGORY_LABELS,
  CHANNEL_CATEGORY_ORDER,
  CHANNELS,
} from "@/lib/channels";

export function CommunicationPlatforms() {
  return (
    <section className="mx-auto max-w-7xl border-t border-zinc-200 px-6 py-10 dark:border-zinc-800">
      <div className="mb-6">
        <h2 className="text-sm font-medium tracking-wide text-zinc-500 uppercase">
          Channel Taxonomy
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          A complete audit view of the aquarium&apos;s communication channels.
          Top-level channels stay grouped by category, and each channel keeps
          its own placements or size slots nested inside it.
        </p>
      </div>

      <div className="space-y-6">
        {CHANNEL_CATEGORY_ORDER.map((category) => {
          const channels = CHANNELS.filter(
            (channel) => channel.category === category
          );
          if (channels.length === 0) return null;

          return (
            <section key={category}>
              <div className="mb-3">
                <h3 className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                  {CHANNEL_CATEGORY_LABELS[category]}
                </h3>
                <p className="mt-1 text-sm text-zinc-500">
                  {CHANNEL_CATEGORY_DESCRIPTIONS[category]}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {channels.map((channel) => (
                  <article
                    key={channel.key}
                    className="rounded-xl border border-zinc-200 bg-white p-4 shadow-[var(--shadow-soft)] dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    <h4 className="text-sm font-semibold">{channel.name}</h4>
                    <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                      {channel.inventoryDescription}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {channel.inventoryItems.map((item) => (
                        <span
                          key={item}
                          className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] text-zinc-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300"
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
