import Link from "next/link";

type Platform = {
  name: string;
  category: "Email" | "SMS" | "Push & In-app" | "Marketing Automation" | "Chat";
  description: string;
  website: string;
  initials: string;
  accent: string;
};

const PLATFORMS: Platform[] = [
  {
    name: "Mailchimp",
    category: "Email",
    description: "Campaign email, automations, and landing pages. Broad ecosystem, good free tier.",
    website: "https://mailchimp.com",
    initials: "Mc",
    accent: "from-yellow-400 to-amber-500",
  },
  {
    name: "Klaviyo",
    category: "Email",
    description: "Ecommerce-focused email + SMS. Deep Shopify, BigCommerce, and data integrations.",
    website: "https://klaviyo.com",
    initials: "Kl",
    accent: "from-sky-500 to-blue-600",
  },
  {
    name: "SendGrid",
    category: "Email",
    description: "Transactional and marketing email API. Reliable deliverability at scale.",
    website: "https://sendgrid.com",
    initials: "Sg",
    accent: "from-blue-500 to-indigo-600",
  },
  {
    name: "HubSpot",
    category: "Marketing Automation",
    description: "Full CRM + email, forms, and workflow automation. Best when you own the funnel end-to-end.",
    website: "https://hubspot.com",
    initials: "Hs",
    accent: "from-orange-500 to-red-500",
  },
  {
    name: "ActiveCampaign",
    category: "Marketing Automation",
    description: "Email + automation + light CRM. Strong segmentation without enterprise pricing.",
    website: "https://activecampaign.com",
    initials: "Ac",
    accent: "from-blue-600 to-indigo-700",
  },
  {
    name: "Marketo Engage",
    category: "Marketing Automation",
    description: "Adobe's enterprise MAP. B2B lead scoring, nurture, and account-based marketing.",
    website: "https://business.adobe.com/products/marketo/adobe-marketo.html",
    initials: "Mk",
    accent: "from-purple-600 to-fuchsia-600",
  },
  {
    name: "Twilio",
    category: "SMS",
    description: "Programmable SMS, WhatsApp, and voice APIs. The default for developer-driven messaging.",
    website: "https://twilio.com",
    initials: "Tw",
    accent: "from-red-500 to-rose-600",
  },
  {
    name: "Attentive",
    category: "SMS",
    description: "Consumer SMS marketing. Strong ecommerce templates and compliance workflows.",
    website: "https://attentive.com",
    initials: "At",
    accent: "from-violet-500 to-purple-600",
  },
  {
    name: "Postscript",
    category: "SMS",
    description: "Shopify-native SMS. Tight integration for DTC abandoned-cart and winback flows.",
    website: "https://postscript.io",
    initials: "Ps",
    accent: "from-emerald-500 to-teal-600",
  },
  {
    name: "OneSignal",
    category: "Push & In-app",
    description: "Mobile and web push, in-app, and email. Generous free tier for getting started.",
    website: "https://onesignal.com",
    initials: "Os",
    accent: "from-rose-500 to-pink-600",
  },
  {
    name: "Braze",
    category: "Push & In-app",
    description: "Cross-channel customer engagement: push, in-app, email, SMS. Enterprise-grade.",
    website: "https://braze.com",
    initials: "Bz",
    accent: "from-indigo-500 to-violet-600",
  },
  {
    name: "Iterable",
    category: "Push & In-app",
    description: "Cross-channel marketing with journey orchestration. Strong for B2C lifecycle.",
    website: "https://iterable.com",
    initials: "It",
    accent: "from-cyan-500 to-sky-600",
  },
  {
    name: "Intercom",
    category: "Chat",
    description: "Live chat, chatbots, and product tours. Pairs well with onboarding and support.",
    website: "https://intercom.com",
    initials: "Ic",
    accent: "from-blue-400 to-indigo-500",
  },
  {
    name: "Drift",
    category: "Chat",
    description: "Conversational marketing and sales chat. Calendar booking and lead routing.",
    website: "https://drift.com",
    initials: "Df",
    accent: "from-teal-500 to-emerald-600",
  },
];

const CATEGORY_ORDER: Platform["category"][] = [
  "Email",
  "Marketing Automation",
  "SMS",
  "Push & In-app",
  "Chat",
];

export function CommunicationPlatforms() {
  const grouped = CATEGORY_ORDER.map((category) => ({
    category,
    items: PLATFORMS.filter((p) => p.category === category),
  }));

  return (
    <section className="max-w-7xl mx-auto px-6 py-10 border-t border-zinc-200 dark:border-zinc-800">
      <div className="mb-6">
        <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">
          Explore Communication Platforms
        </h2>
        <p className="text-sm text-zinc-500 mt-1">
          Email, SMS, push, and chat tools worth considering for your next campaign. Click through
          to learn more and connect manually — integrations aren&apos;t built in yet.
        </p>
      </div>

      <div className="space-y-8">
        {grouped.map(({ category, items }) => (
          <div key={category}>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500 mb-3">
              {category}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {items.map((p) => (
                <PlatformCard key={p.name} platform={p} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function PlatformCard({ platform }: { platform: Platform }) {
  return (
    <Link
      href={platform.website}
      target="_blank"
      rel="noopener noreferrer"
      className="apple-lift group flex gap-3 items-start rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 hover:border-zinc-400 dark:hover:border-zinc-600"
    >
      <div
        className={`shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br ${platform.accent} flex items-center justify-center text-white font-semibold text-sm shadow-sm`}
        aria-hidden
      >
        {platform.initials}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold text-sm">{platform.name}</span>
          <span className="text-[10px] text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 shrink-0">
            ↗
          </span>
        </div>
        <p className="text-xs text-zinc-500 mt-1 leading-relaxed line-clamp-3">
          {platform.description}
        </p>
      </div>
    </Link>
  );
}
