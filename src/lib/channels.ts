import type { PlatformKey } from "@/lib/utm";

export type ChannelSlot = {
  key: string;
  label: string;
  aspect: string;
  hint: string;
  recommended?: boolean;
};

export type ChannelCategoryKey =
  | "owned-direct"
  | "paid-media"
  | "distribution-pr"
  | "on-site-print";

export type ChannelMeta = {
  key: PlatformKey;
  name: string;
  desc: string;
  category: ChannelCategoryKey;
  inventoryDescription: string;
  inventoryItems: string[];
  boardTitle?: string;
  boardSubtitle?: string;
  slots?: ChannelSlot[];
  trackingEnabled?: boolean;
};

export const CHANNEL_KEYS = [
  "website",
  "email",
  "sms",
  "internal-messaging",
  "digital-signage",
  "ott",
  "pr",
  "meta",
  "tiktok",
  "youtube",
  "google-search",
  "signage",
  "flyers",
] as const satisfies readonly PlatformKey[];

export const CHANNEL_CATEGORY_ORDER: ChannelCategoryKey[] = [
  "owned-direct",
  "paid-media",
  "distribution-pr",
  "on-site-print",
];

export const CHANNEL_CATEGORY_LABELS: Record<ChannelCategoryKey, string> = {
  "owned-direct": "Owned & Direct",
  "paid-media": "Paid Media",
  "distribution-pr": "Distribution & PR",
  "on-site-print": "On-Site & Print",
};

export const CHANNEL_CATEGORY_DESCRIPTIONS: Record<ChannelCategoryKey, string> = {
  "owned-direct": "Channels the aquarium directly controls, from the website to outbound messaging.",
  "paid-media": "Paid platform channels where the channel owns multiple ad sizes or placements.",
  "distribution-pr": "Broadcast, partner, influencer, and publicity channels that distribute campaign stories.",
  "on-site-print": "On-campus screens, installed signage, and printed handouts used inside the aquarium footprint.",
};

export const CHANNELS: ChannelMeta[] = [
  {
    key: "website",
    name: "Website",
    desc: "Aquarium web placements and owned site surfaces",
    category: "owned-direct",
    inventoryDescription: "Aquarium-owned web placements and content surfaces.",
    inventoryItems: ["Hero Slider", "Pop Up", "Landing Page", "Blog", "Habitat Slider"],
    boardTitle: "Website — Campaign Media",
    boardSubtitle: "Homepage, landing, popup, blog, and habitat placements for aquarium web content.",
    slots: [
      {
        key: "hero-slider",
        label: "Hero Slider",
        aspect: "aspect-[16/9]",
        hint: "Homepage hero rotation",
        recommended: true,
      },
      { key: "pop-up", label: "Pop Up", aspect: "aspect-[4/5]", hint: "Modal or overlay promo" },
      {
        key: "landing-page",
        label: "Landing Page",
        aspect: "aspect-[16/9]",
        hint: "Campaign landing page creative",
        recommended: true,
      },
      { key: "blog", label: "Blog", aspect: "aspect-[4/3]", hint: "Blog header or article promo" },
      {
        key: "habitat-slider",
        label: "Habitat Slider",
        aspect: "aspect-[16/9]",
        hint: "Habitat or exhibit carousel asset",
      },
    ],
  },
  {
    key: "email",
    name: "Email",
    desc: "Campaign and flow sends",
    category: "owned-direct",
    inventoryDescription: "Outbound lifecycle and campaign messaging.",
    inventoryItems: ["Campaign", "Flow"],
    boardTitle: "Email — Campaign Media",
    boardSubtitle: "Campaign and flow creative for aquarium email sends.",
    slots: [
      {
        key: "campaign",
        label: "Campaign",
        aspect: "aspect-[4/5]",
        hint: "One-off email sends",
        recommended: true,
      },
      { key: "flow", label: "Flow", aspect: "aspect-[4/5]", hint: "Automated lifecycle email creative" },
    ],
  },
  {
    key: "sms",
    name: "SMS",
    desc: "Campaign and flow messaging",
    category: "owned-direct",
    inventoryDescription: "Text message campaigns and automated flows.",
    inventoryItems: ["Campaign", "Flow"],
    boardTitle: "SMS — Campaign Media",
    boardSubtitle: "Campaign and flow messaging assets for aquarium SMS programs.",
    slots: [
      {
        key: "campaign",
        label: "Campaign",
        aspect: "aspect-[9/16]",
        hint: "Broadcast SMS and MMS campaigns",
        recommended: true,
      },
      { key: "flow", label: "Flow", aspect: "aspect-[9/16]", hint: "Automated text message flows" },
    ],
  },
  {
    key: "internal-messaging",
    name: "Internal Messaging",
    desc: "Team Talk and Front Desk FAQ",
    category: "owned-direct",
    inventoryDescription: "Internal staff communication and operational references.",
    inventoryItems: ["Team Talk", "Front Desk FAQ"],
    boardTitle: "Internal Messaging — Campaign Media",
    boardSubtitle: "Assets and references for Team Talk and Front Desk FAQ communication.",
    slots: [
      {
        key: "team-talk",
        label: "Team Talk",
        aspect: "aspect-[4/3]",
        hint: "Internal staff messaging",
        recommended: true,
      },
      {
        key: "front-desk-faq",
        label: "Front Desk FAQ",
        aspect: "aspect-[4/3]",
        hint: "Front desk reference materials",
      },
    ],
  },
  {
    key: "meta",
    name: "Meta",
    desc: "Meta is a channel; feed, Reels, Stories, and video live inside it",
    category: "paid-media",
    inventoryDescription: "Paid Meta placements grouped inside one top-level channel.",
    inventoryItems: ["1:1 Square", "9:16 Vertical", "16:9 Horizontal"],
    boardTitle: "Meta — Campaign Media",
    boardSubtitle: "Meta is a channel. Feed, Reels, Stories, and in-stream sizes live here under one shared campaign surface.",
    trackingEnabled: true,
    slots: [
      { key: "1x1", label: "1:1 Square", aspect: "aspect-square", hint: "Feed post" },
      { key: "9x16", label: "9:16 Vertical", aspect: "aspect-[9/16]", hint: "Reels / Stories" },
      { key: "16x9", label: "16:9 Horizontal", aspect: "aspect-video", hint: "In-stream video" },
    ],
  },
  {
    key: "tiktok",
    name: "TikTok",
    desc: "In-Feed, TopView, and Spark Ads",
    category: "paid-media",
    inventoryDescription: "Paid TikTok placements grouped by supported aspect ratio.",
    inventoryItems: ["9:16 Vertical", "1:1 Square", "16:9 Horizontal"],
    boardTitle: "TikTok — Campaign Media",
    boardSubtitle: "TikTok is a channel. 9:16 is the lead format, with supported square and horizontal variants grouped under it.",
    slots: [
      {
        key: "9x16",
        label: "9:16 Vertical",
        aspect: "aspect-[9/16]",
        hint: "In-Feed Ads, TopView, Spark Ads — 720×1280+",
        recommended: true,
      },
      { key: "1x1", label: "1:1 Square", aspect: "aspect-square", hint: "Supported — 640×640 min" },
      { key: "16x9", label: "16:9 Horizontal", aspect: "aspect-video", hint: "Supported — 960×540 min" },
    ],
  },
  {
    key: "youtube",
    name: "YouTube",
    desc: "Paid YouTube video and Shorts creative",
    category: "paid-media",
    inventoryDescription: "Paid YouTube placements grouped by ad format and ratio.",
    inventoryItems: ["16:9 Horizontal", "9:16 Shorts", "1:1 Square"],
    boardTitle: "YouTube — Campaign Media",
    boardSubtitle: "YouTube is a channel. In-Stream, Shorts, and square discovery placements are grouped here by format.",
    slots: [
      {
        key: "16x9",
        label: "16:9 Horizontal",
        aspect: "aspect-video",
        hint: "In-Stream, Bumper, Masthead — 1920×1080",
        recommended: true,
      },
      {
        key: "9x16",
        label: "9:16 Vertical (YouTube Shorts)",
        aspect: "aspect-[9/16]",
        hint: "YouTube Shorts only — 1080×1920",
      },
      {
        key: "1x1",
        label: "1:1 Square",
        aspect: "aspect-square",
        hint: "In-Feed / Discovery — 1080×1080",
      },
    ],
  },
  {
    key: "google-search",
    name: "Google Search",
    desc: "Search image assets, logos, and terms",
    category: "paid-media",
    inventoryDescription: "Search creative and keyword support grouped inside one channel.",
    inventoryItems: ["1:1 Square", "1.91:1 Landscape", "4:1 Logo", "Search Terms"],
    boardTitle: "Google Search — Campaign Media",
    boardSubtitle: "Google Search is a channel. Image assets, logos, and search terms are grouped together here.",
    slots: [
      {
        key: "1x1",
        label: "1:1 Square",
        aspect: "aspect-square",
        hint: "Image asset — 1200×1200",
        recommended: true,
      },
      {
        key: "1.91x1",
        label: "1.91:1 Landscape",
        aspect: "aspect-[1.91/1]",
        hint: "Image asset — 1200×628",
        recommended: true,
      },
      { key: "4x1", label: "4:1 Logo", aspect: "aspect-[4/1]", hint: "Business logo — 1200×300" },
    ],
  },
  {
    key: "ott",
    name: "OTT",
    desc: "Office and streaming network placements",
    category: "distribution-pr",
    inventoryDescription: "Video placements across office and streaming networks.",
    inventoryItems: ["Office", "Streaming Network 1", "Streaming Network 2"],
    boardTitle: "OTT — Campaign Media",
    boardSubtitle: "Office and streaming network placements for aquarium OTT creative.",
    slots: [
      { key: "office", label: "Office", aspect: "aspect-video", hint: "Internal OTT office placement" },
      {
        key: "streaming-network-1",
        label: "Streaming Network 1",
        aspect: "aspect-video",
        hint: "Primary OTT network placement",
        recommended: true,
      },
      {
        key: "streaming-network-2",
        label: "Streaming Network 2",
        aspect: "aspect-video",
        hint: "Secondary OTT network placement",
      },
    ],
  },
  {
    key: "pr",
    name: "PR",
    desc: "Influencers, partner YouTube, regional, and national PR",
    category: "distribution-pr",
    inventoryDescription: "Earned and partner-facing publicity channels.",
    inventoryItems: ["Partner YouTube", "Influencers", "Regional (Utah)", "National"],
    boardTitle: "PR — Campaign Media",
    boardSubtitle: "Partner YouTube, influencer, regional Utah, and national PR collateral.",
    slots: [
      { key: "youtube", label: "Partner YouTube", aspect: "aspect-video", hint: "PR and earned YouTube placements" },
      {
        key: "influencers",
        label: "Influencers",
        aspect: "aspect-[9/16]",
        hint: "Creator and influencer collateral",
        recommended: true,
      },
      {
        key: "regional-utah",
        label: "Regional (Utah)",
        aspect: "aspect-[4/5]",
        hint: "Regional press and partner outreach",
      },
      { key: "national", label: "National", aspect: "aspect-[4/5]", hint: "National PR assets and distribution" },
    ],
  },
  {
    key: "digital-signage",
    name: "Digital Signage",
    desc: "Admission, Info Desk, and on-campus screens",
    category: "on-site-print",
    inventoryDescription: "On-site digital screens across the aquarium campus.",
    inventoryItems: ["Admission", "Info Desk", "On Campus"],
    boardTitle: "Digital Signage — Campaign Media",
    boardSubtitle: "Admission, Info Desk, and on-campus digital screen creative for the aquarium.",
    slots: [
      {
        key: "admission",
        label: "Admission",
        aspect: "aspect-video",
        hint: "Entrance and admissions screens",
        recommended: true,
      },
      { key: "info-desk", label: "Info Desk", aspect: "aspect-video", hint: "Information desk digital signage" },
      { key: "on-campus", label: "On Campus", aspect: "aspect-video", hint: "General on-campus screen network" },
    ],
  },
  {
    key: "signage",
    name: "Physical Signage",
    desc: "Parking lot, H-Frames, A-Frame, banners, billboards, and custom blueprints",
    category: "on-site-print",
    inventoryDescription: "Printed and installed signage throughout the aquarium footprint.",
    inventoryItems: [
      "Parking Lot",
      "H-Frames",
      "Little H-Frames",
      "A-Frame",
      "Bathroom Signs",
      "Construction Banner",
      "Fabric Evergreen",
      "Ship Banners",
      "Billboards",
      "Custom Blueprints",
    ],
  },
  {
    key: "flyers",
    name: "Flyers",
    desc: "Letter flyers, half-sheets, tabloid handouts",
    category: "on-site-print",
    inventoryDescription: "Printed handouts and leave-behinds for guests and partners.",
    inventoryItems: ["8.5 × 11 Letter", "5.5 × 8.5 Half-Sheet", "11 × 17 Tabloid"],
    boardTitle: "Flyers — Campaign Media",
    boardSubtitle: "Upload print-ready flyer creative by size. Letter is the safest default; add tracked destinations or QR-ready links for distribution pieces.",
    trackingEnabled: true,
    slots: [
      {
        key: "8.5x11",
        label: "8.5 × 11 Letter",
        aspect: "aspect-[8.5/11]",
        hint: "Standard flyer — 2550×3300 at 300 DPI",
        recommended: true,
      },
      {
        key: "5.5x8.5",
        label: "5.5 × 8.5 Half-Sheet",
        aspect: "aspect-[5.5/8.5]",
        hint: "Quarter-page handout / leave-behind — 1650×2550 at 300 DPI",
      },
      {
        key: "11x17",
        label: "11 × 17 Tabloid",
        aspect: "aspect-[11/17]",
        hint: "Large-format flyer — 3300×5100 at 300 DPI",
      },
    ],
  },
];

export const CHANNEL_ORDER = CHANNELS.map((channel) => channel.key);

export const CHANNEL_LABELS = Object.fromEntries(
  CHANNELS.map((channel) => [channel.key, channel.name])
) as Record<PlatformKey, string>;

export const CHANNEL_BY_KEY = Object.fromEntries(
  CHANNELS.map((channel) => [channel.key, channel])
) as Record<PlatformKey, ChannelMeta>;

export const PHYSICAL_CHANNEL_KEYS = ["signage", "flyers"] as const satisfies readonly PlatformKey[];
const PHYSICAL_CHANNEL_SET = new Set<PlatformKey>(PHYSICAL_CHANNEL_KEYS);
export const NON_PHYSICAL_CHANNEL_KEYS = CHANNELS.filter(
  (channel) => !PHYSICAL_CHANNEL_SET.has(channel.key)
).map((channel) => channel.key) as PlatformKey[];
