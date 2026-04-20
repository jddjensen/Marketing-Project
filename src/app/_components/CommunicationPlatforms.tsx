type ChannelGroup = {
  name: string;
  description: string;
  items: string[];
};

const CHANNEL_GROUPS: ChannelGroup[] = [
  {
    name: "Website",
    description: "Aquarium-owned web placements and content surfaces.",
    items: ["Hero Slider", "Pop Up", "Landing Page", "Blog", "Habitat Slider"],
  },
  {
    name: "Email",
    description: "Outbound lifecycle and campaign messaging.",
    items: ["Campaign", "Flow"],
  },
  {
    name: "SMS",
    description: "Text message campaigns and automated flows.",
    items: ["Campaign", "Flow"],
  },
  {
    name: "Internal Messaging",
    description: "Internal staff communication and operational references.",
    items: ["Team Talk", "Front Desk FAQ"],
  },
  {
    name: "Digital Signage",
    description: "On-site digital screens across the aquarium campus.",
    items: ["Admission", "Info Desk", "On Campus"],
  },
  {
    name: "OTT",
    description: "Video placements across office and streaming networks.",
    items: ["Office", "Streaming Network 1", "Streaming Network 2"],
  },
  {
    name: "PR",
    description: "Earned and partner-facing publicity channels.",
    items: ["YouTube", "Influencers", "Regional (Utah)", "National"],
  },
  {
    name: "Physical Signage",
    description: "Printed and installed signage throughout the aquarium footprint.",
    items: [
      "Parking Lot",
      "H-Frames",
      "Little H-Frames",
      "A-Frame",
      "Bathroom Signs",
      "Construction Banner",
      "Fabric Evergreen",
      "Ship Banners",
    ],
  },
];

export function CommunicationPlatforms() {
  return (
    <section className="max-w-7xl mx-auto px-6 py-10 border-t border-zinc-200 dark:border-zinc-800">
      <div className="mb-6">
        <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">
          Aquarium Channel Inventory
        </h2>
        <p className="text-sm text-zinc-500 mt-1">
          A visible reference for the aquarium&apos;s communication ecosystem so projects can account
          for every active channel and placement.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {CHANNEL_GROUPS.map((group) => (
          <section
            key={group.name}
            className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-[var(--shadow-soft)]"
          >
            <h3 className="font-semibold text-sm">{group.name}</h3>
            <p className="text-xs text-zinc-500 mt-1 leading-relaxed">{group.description}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {group.items.map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 px-2.5 py-1 text-[11px] text-zinc-600 dark:text-zinc-300"
                >
                  {item}
                </span>
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
