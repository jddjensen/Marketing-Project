import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(rootDir, "public", "test-assets");
const mediaDir = path.join(outputDir, "media");

const campaignName = "Ocean Nights Test Campaign";

const slots = [
  // Owned and direct
  ["website", "Website", "hero-slider", "Hero Slider", 1600, 900],
  ["website", "Website", "pop-up", "Pop Up", 1080, 1350],
  ["website", "Website", "landing-page", "Landing Page", 1600, 900],
  ["website", "Website", "blog", "Blog", 1200, 900],
  ["website", "Website", "habitat-slider", "Habitat Slider", 1600, 900],
  ["email", "Email", "campaign", "Campaign", 1080, 1350],
  ["email", "Email", "flow", "Flow", 1080, 1350],
  ["sms", "SMS", "campaign", "Campaign", 1080, 1920],
  ["sms", "SMS", "flow", "Flow", 1080, 1920],
  ["internal-messaging", "Internal Messaging", "team-talk", "Team Talk", 1200, 900],
  ["internal-messaging", "Internal Messaging", "front-desk-faq", "Front Desk FAQ", 1200, 900],

  // Paid media
  ["meta", "Meta", "4x5", "4:5 Feed", 1080, 1350],
  ["meta", "Meta", "9x16", "9:16 Stories / Reels", 1080, 1920],
  ["meta", "Meta", "1x1", "1:1 Square", 1080, 1080],
  ["meta", "Meta", "1.91x1", "1.91:1 Landscape", 1200, 628],
  ["meta", "Meta", "16x9", "16:9 Horizontal", 1920, 1080],
  ["tiktok", "TikTok", "9x16", "9:16 Vertical", 1080, 1920],
  ["tiktok", "TikTok", "1x1", "1:1 Square", 1080, 1080],
  ["tiktok", "TikTok", "16x9", "16:9 Horizontal", 1920, 1080],
  ["youtube", "YouTube", "16x9", "16:9 Horizontal", 1920, 1080],
  ["youtube", "YouTube", "9x16", "9:16 Vertical", 1080, 1920],
  ["youtube", "YouTube", "1x1", "1:1 Square", 1080, 1080],
  ["youtube", "YouTube", "youtube-thumbnail", "Thumbnail", 1920, 1080],
  ["youtube", "YouTube", "companion-banner", "Companion Banner", 1500, 300],
  ["google-search", "Google Search", "1x1", "1:1 Square Image", 1200, 1200],
  ["google-search", "Google Search", "1.91x1", "1.91:1 Landscape Image", 1200, 628],
  ["google-search", "Google Search", "logo-1x1", "1:1 Business Logo", 1200, 1200],

  // Distribution and PR
  ["ott", "OTT", "office", "Office", 1920, 1080],
  ["ott", "OTT", "streaming-network-1", "Streaming Network 1", 1920, 1080],
  ["ott", "OTT", "streaming-network-2", "Streaming Network 2", 1920, 1080],
  ["pr", "PR", "youtube", "Partner YouTube", 1920, 1080],
  ["pr", "PR", "influencers", "Influencers", 1080, 1920],
  ["pr", "PR", "regional-utah", "Regional Utah", 1080, 1350],
  ["pr", "PR", "national", "National", 1080, 1350],

  // On-site and print
  ["digital-signage", "Digital Signage", "admission", "Admission", 1920, 1080],
  ["digital-signage", "Digital Signage", "info-desk", "Info Desk", 1920, 1080],
  ["digital-signage", "Digital Signage", "on-campus", "On Campus", 1920, 1080],
  ["flyers", "Flyers", "8.5x11", "8.5 x 11 Letter", 1275, 1650],
  ["flyers", "Flyers", "5.5x8.5", "5.5 x 8.5 Half-Sheet", 1100, 1700],
  ["flyers", "Flyers", "11x17", "11 x 17 Tabloid", 1100, 1700],

  // Physical signage uses project-created formats, so these match common presets.
  ["signage", "Physical Signage", "billboard-highway-default", "Billboard Highway Default", 1920, 560],
  ["signage", "Physical Signage", "billboard-poster", "Billboard Poster", 1600, 800],
  ["signage", "Physical Signage", "aframe", "A-Frame Sidewalk Sign", 800, 1200],
  ["signage", "Physical Signage", "hframe-standard", "H-Frame Standard", 900, 1200],
  ["signage", "Physical Signage", "poster-standard", "Poster Standard", 900, 1200],
];

const palette = [
  ["#0f3d4c", "#35a7a0", "#f5d76e", "#ffffff"],
  ["#22324a", "#e86f51", "#8dd3c7", "#ffffff"],
  ["#263238", "#7fc8f8", "#f7a072", "#ffffff"],
  ["#1f2937", "#84cc16", "#facc15", "#ffffff"],
  ["#3a2e39", "#5dd39e", "#f4d35e", "#ffffff"],
  ["#273c75", "#00a8ff", "#fbc531", "#ffffff"],
  ["#183a37", "#f6ae2d", "#86bbd8", "#ffffff"],
  ["#2b2d42", "#ef476f", "#06d6a0", "#ffffff"],
];

const copyPayloads = {
  website: {
    headline: "Meet the ocean after dark",
    subhead: "A limited-run evening event built for families, members, and first-time guests.",
    body: "Use this copy to test website creative fields and landing page selection.",
    cta: "Plan your visit",
    altText: "Guests walking through a glowing aquarium gallery during an evening event.",
  },
  email: {
    subject: "Ocean Nights tickets are live",
    preheader: "Reserve your evening aquarium visit before spots fill.",
    headline: "A new after-dark aquarium experience",
    body: "Bring the campaign to life with email copy, creative uploads, and tracked links.",
    cta: "Get tickets",
  },
  sms: {
    message: "Ocean Nights is live. Reserve your evening aquarium visit today: {{short_link}}",
    shortLink: "{{short_link}}",
  },
  "internal-messaging": {
    subject: "Team Talk: Ocean Nights launch",
    body: "Guests may ask about event hours, ticket availability, member discounts, and parking.",
  },
  meta: {
    primaryText: "See the aquarium glow after dark with limited Ocean Nights tickets.",
    headline: "Ocean Nights is here",
    description: "Limited evening tickets",
    cta: "learn_more",
  },
  tiktok: {
    caption: "The aquarium looks different after dark. Ocean Nights tickets are live.",
    displayName: "Aquarium Test",
    cta: "learn_more",
  },
  youtube: {
    title: "Ocean Nights at the Aquarium",
    description: "A test video creative for campaign review, UTM generation, and dashboard validation.",
    tags: ["aquarium", "family", "event", "ocean"],
  },
  "google-search": {
    headlines: ["Aquarium After Dark", "Ocean Nights Tickets", "Plan Your Visit"],
    descriptions: [
      "Reserve tickets for a limited evening aquarium experience.",
      "Explore glowing habitats, family activities, and member perks.",
    ],
    displayPaths: ["ocean-nights", "tickets"],
  },
  ott: {
    headline: "Ocean Nights",
    cta: "Plan your visit",
  },
  pr: {
    headline: "Aquarium announces Ocean Nights",
    subhead: "A limited after-dark experience opens for families and members.",
    body: "This is a test PR payload for upload, review, and collateral organization.",
    contact: "press@example.test",
  },
  "digital-signage": {
    headline: "Ocean Nights",
    cta: "Tickets on sale",
  },
  signage: {
    headline: "Ocean Nights",
    cta: "Scan for tickets",
  },
  flyers: {
    headline: "Ocean Nights",
    body: "A limited evening aquarium experience with glowing habitats and family activities.",
    cta: "Scan to reserve tickets",
  },
};

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function slug(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function wrapText(value, maxChars) {
  const words = String(value).split(/\s+/);
  const lines = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

function assetSvg({ index, platformName, slot, label, width, height }) {
  const [base, accent, highlight, text] = palette[index % palette.length];
  const isWide = width / height >= 1.6;
  const isTall = height / width >= 1.35;
  const pad = Math.round(Math.min(width, height) * 0.06);
  const hairline = Math.max(3, Math.round(Math.min(width, height) * 0.005));
  const titleSize = Math.round(Math.min(width, height) * (isWide ? 0.085 : isTall ? 0.08 : 0.09));
  const metaSize = Math.round(Math.min(width, height) * 0.035);
  const smallSize = Math.round(Math.min(width, height) * 0.024);
  const centerY = height / 2;
  const lineMax = Math.max(14, Math.floor(width / titleSize * 1.6));
  const labelLines = wrapText(label, lineMax);
  const textBlockHeight = labelLines.length * titleSize * 1.05;
  const textStartY = centerY - textBlockHeight / 2 + titleSize * 0.75;
  const circleR = Math.round(Math.min(width, height) * 0.14);
  const reefHeight = Math.round(height * 0.18);
  const safeInset = Math.round(Math.min(width, height) * 0.035);

  const labelText = labelLines
    .map(
      (line, lineIndex) =>
        `<text x="${pad}" y="${Math.round(textStartY + lineIndex * titleSize * 1.05)}" class="title">${escapeXml(line)}</text>`
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${base}"/>
      <stop offset="0.58" stop-color="${base}"/>
      <stop offset="1" stop-color="${accent}"/>
    </linearGradient>
    <pattern id="grid" width="${Math.max(48, Math.round(width / 12))}" height="${Math.max(48, Math.round(height / 12))}" patternUnits="userSpaceOnUse">
      <path d="M 0 0 H ${Math.max(48, Math.round(width / 12))} V ${Math.max(48, Math.round(height / 12))}" fill="none" stroke="#ffffff" stroke-opacity="0.11" stroke-width="${hairline}"/>
    </pattern>
    <style>
      text { font-family: Arial, Helvetica, sans-serif; letter-spacing: 0; }
      .eyebrow { fill: ${highlight}; font-size: ${metaSize}px; font-weight: 700; }
      .title { fill: ${text}; font-size: ${titleSize}px; font-weight: 800; }
      .small { fill: ${text}; font-size: ${smallSize}px; font-weight: 700; opacity: 0.9; }
      .meta { fill: ${text}; font-size: ${metaSize}px; font-weight: 700; opacity: 0.95; }
    </style>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bg)"/>
  <rect width="${width}" height="${height}" fill="url(#grid)"/>
  <circle cx="${width - pad - circleR * 0.2}" cy="${pad + circleR * 0.1}" r="${circleR}" fill="${highlight}" opacity="0.92"/>
  <circle cx="${width - pad - circleR * 0.7}" cy="${pad + circleR * 0.85}" r="${Math.round(circleR * 0.42)}" fill="${accent}" opacity="0.9"/>
  <path d="M 0 ${height - reefHeight}
           C ${width * 0.16} ${height - reefHeight * 1.4}, ${width * 0.22} ${height - reefHeight * 0.45}, ${width * 0.38} ${height - reefHeight}
           S ${width * 0.62} ${height - reefHeight * 1.55}, ${width * 0.76} ${height - reefHeight * 0.8}
           S ${width * 0.92} ${height - reefHeight * 0.28}, ${width} ${height - reefHeight * 0.78}
           V ${height} H 0 Z" fill="#000000" opacity="0.18"/>
  <rect x="${safeInset}" y="${safeInset}" width="${width - safeInset * 2}" height="${height - safeInset * 2}" rx="${Math.max(0, Math.round(safeInset * 0.3))}" fill="none" stroke="#ffffff" stroke-width="${hairline}" stroke-opacity="0.46" stroke-dasharray="${hairline * 4} ${hairline * 3}"/>
  <text x="${pad}" y="${pad + metaSize}" class="eyebrow">${escapeXml(campaignName.toUpperCase())}</text>
  ${labelText}
  <text x="${pad}" y="${height - pad - metaSize * 1.25}" class="meta">${escapeXml(platformName)} / ${escapeXml(slot)}</text>
  <text x="${pad}" y="${height - pad}" class="small">${width}x${height} PNG test fixture</text>
  <text x="${width - pad}" y="${height - pad}" text-anchor="end" class="small">safe-zone and crop check</text>
</svg>`;
}

function galleryHtml(manifest) {
  const cards = manifest
    .map(
      (item) => `<a class="card" href="./${item.file}" download>
        <img src="./${item.file}" alt="${escapeXml(`${item.platformName} ${item.label}`)}" loading="lazy">
        <span>${escapeXml(item.platformName)}</span>
        <strong>${escapeXml(item.label)}</strong>
        <small>${item.width}x${item.height} / ${escapeXml(item.slot)}</small>
      </a>`
    )
    .join("\n");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Marketing Project Test Assets</title>
    <style>
      :root { color-scheme: light; font-family: Arial, Helvetica, sans-serif; }
      body { margin: 0; background: #f7f8fb; color: #17202a; }
      main { width: min(1180px, calc(100% - 32px)); margin: 0 auto; padding: 32px 0 48px; }
      h1 { margin: 0 0 8px; font-size: clamp(28px, 4vw, 44px); letter-spacing: 0; }
      p { margin: 0 0 24px; max-width: 760px; line-height: 1.5; color: #4b5563; }
      .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 16px; }
      .card { display: grid; gap: 6px; padding: 10px; background: #fff; border: 1px solid #dfe5ee; border-radius: 8px; color: inherit; text-decoration: none; }
      .card:hover { border-color: #8ea4c6; box-shadow: 0 8px 24px rgba(23, 32, 42, 0.08); }
      img { width: 100%; aspect-ratio: 16 / 10; object-fit: contain; background: #eef2f7; border-radius: 6px; }
      span { font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #687385; }
      strong { font-size: 15px; line-height: 1.25; }
      small { color: #687385; }
    </style>
  </head>
  <body>
    <main>
      <h1>Marketing Project Test Assets</h1>
      <p>Download these fixtures and upload them into matching platform slots. Each image includes its platform, slot, dimensions, safe-zone border, and crop-check marks.</p>
      <section class="grid">${cards}</section>
    </main>
  </body>
</html>`;
}

function readmeMarkdown(manifest) {
  const platformCounts = manifest.reduce((counts, item) => {
    counts[item.platformName] = (counts[item.platformName] ?? 0) + 1;
    return counts;
  }, {});
  const countLines = Object.entries(platformCounts)
    .map(([platform, count]) => `- ${platform}: ${count}`)
    .join("\n");

  return `# Test Assets

Generated fixtures for manual campaign testing.

- Run \`npm run generate:test-assets\` to regenerate the full pack.
- Open \`/test-assets/\` while the dev server is running to preview and download files.
- Upload images from \`public/test-assets/media/\` into the matching platform and slot.
- Use \`copy-payloads.json\` as sample creative copy when testing platform copy fields.

Asset counts:

${countLines}
`;
}

async function main() {
  await mkdir(mediaDir, { recursive: true });

  const manifest = [];
  for (const [index, slot] of slots.entries()) {
    const [platform, platformName, slotKey, label, width, height] = slot;
    const fileName = `${slug(platform)}__${slug(slotKey)}__${width}x${height}.png`;
    const filePath = path.join(mediaDir, fileName);
    const svg = assetSvg({
      index,
      platformName,
      slot: slotKey,
      label,
      width,
      height,
    });

    await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(filePath);
    manifest.push({
      platform,
      platformName,
      slot: slotKey,
      label,
      width,
      height,
      mimeType: "image/png",
      file: `media/${fileName}`,
      suggestedCopy: copyPayloads[platform] ?? {},
    });
  }

  await writeFile(path.join(outputDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(path.join(outputDir, "copy-payloads.json"), `${JSON.stringify(copyPayloads, null, 2)}\n`);
  await writeFile(path.join(outputDir, "index.html"), galleryHtml(manifest));
  await writeFile(path.join(outputDir, "README.md"), readmeMarkdown(manifest));

  console.log(`Generated ${manifest.length} test assets in ${path.relative(rootDir, outputDir)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
