import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServerClient } from "@supabase/ssr";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = process.env.TEST_ASSET_BASE_URL ?? "http://localhost:3000";
const envPath = path.join(rootDir, ".env.local");
const manifestPath = path.join(rootDir, "public", "test-assets", "manifest.json");

const signageSpecs = {
  "billboard-highway-default": {
    label: "Billboard - Highway Default",
    presetKey: "billboard-highway-default",
    width: 48,
    height: 14,
    unit: "ft",
  },
  "billboard-poster": {
    label: "Billboard - Poster",
    presetKey: "billboard-poster",
    width: 24,
    height: 12,
    unit: "ft",
  },
  aframe: {
    label: "A-Frame Sidewalk Sign",
    presetKey: "aframe",
    width: 24,
    height: 36,
    unit: "in",
  },
  "hframe-standard": {
    label: "H-Frame Standard",
    presetKey: "hframe-standard",
    width: 18,
    height: 24,
    unit: "in",
  },
  "poster-standard": {
    label: "Poster Standard",
    presetKey: "poster-standard",
    width: 18,
    height: 24,
    unit: "in",
  },
};

function loadEnvFile(filePath) {
  let raw = "";
  try {
    raw = readFileSync(filePath, "utf8");
  } catch {
    return;
  }

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, value] = match;
    if (process.env[key] != null) continue;
    process.env[key] = value.replace(/^['"]|['"]$/g, "");
  }
}

async function createAuthSession() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required");
  }

  const jar = new Map();
  const supabase = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll() {
        return [...jar].map(([name, value]) => ({ name, value }));
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) jar.set(name, value);
      },
    },
  });

  const configuredEmail = process.env.TEST_ASSET_EMAIL;
  const configuredPassword = process.env.TEST_ASSET_PASSWORD;
  const email = configuredEmail ?? `asset-upload-${Date.now()}@example.test`;
  const password = configuredPassword ?? `TestAssets-${Date.now()}!Aa`;

  const authResult =
    configuredEmail && configuredPassword
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });

  if (authResult.error) throw authResult.error;
  if (!authResult.data.session) {
    throw new Error(
      "Supabase did not return a session. Set TEST_ASSET_EMAIL and TEST_ASSET_PASSWORD to an existing confirmed user."
    );
  }

  return { jar, email, temporaryUser: !(configuredEmail && configuredPassword) };
}

function cookieHeader(jar) {
  return [...jar].map(([name, value]) => `${name}=${encodeURIComponent(value)}`).join("; ");
}

async function apiFetch(jar, pathname, init = {}) {
  const headers = new Headers(init.headers ?? {});
  headers.set("cookie", cookieHeader(jar));
  const response = await fetch(new URL(pathname, baseUrl), { ...init, headers });
  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json")
    ? await response.json().catch(() => null)
    : await response.text().catch(() => "");
  if (!response.ok) {
    const detail =
      payload && typeof payload === "object" && "error" in payload
        ? payload.error
        : typeof payload === "string"
          ? payload.slice(0, 200)
          : "request failed";
    throw new Error(`${init.method ?? "GET"} ${pathname} -> ${response.status}: ${detail}`);
  }
  return payload;
}

async function jsonFetch(jar, pathname, method, body) {
  return apiFetch(jar, pathname, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function uploadAsset(jar, projectId, asset, signageFormatIds) {
  const absolutePath = path.join(rootDir, "public", "test-assets", asset.file);
  const fileBytes = await readFile(absolutePath);
  const formData = new FormData();
  formData.append("file", new Blob([fileBytes], { type: asset.mimeType }), path.basename(asset.file));
  formData.append("ratio", asset.slot);
  formData.append("platform", asset.platform);
  formData.append("projectId", projectId);
  if (asset.platform === "signage") {
    const signageFormatId = signageFormatIds.get(asset.slot);
    if (!signageFormatId) throw new Error(`Missing signage format for ${asset.slot}`);
    formData.append("signageFormatId", signageFormatId);
  }
  if (asset.suggestedCopy && Object.keys(asset.suggestedCopy).length > 0) {
    formData.append("copy", JSON.stringify(asset.suggestedCopy));
  }
  return apiFetch(jar, "/api/upload", { method: "POST", body: formData });
}

async function main() {
  loadEnvFile(envPath);

  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const { jar, email, temporaryUser } = await createAuthSession();

  const projectName =
    process.env.TEST_ASSET_PROJECT_NAME ??
    `Ocean Nights Test Campaign - ${new Date().toISOString().slice(0, 19).replace("T", " ")}`;
  const platforms = [...new Set(manifest.map((asset) => asset.platform))];

  const { project } = await jsonFetch(jar, "/api/projects", "POST", {
    name: projectName,
    description: "Generated test campaign used to validate uploads, media boards, moodboard review, and UTM tracking.",
    platforms,
  });

  await jsonFetch(jar, `/api/projects/${project.id}`, "PATCH", {
    campaignBrief: {
      objective: "Validate every generated test asset across all campaign channels.",
      audience: "Internal QA, marketing operators, and CMO reviewers.",
      offer: "Ocean Nights after-dark aquarium campaign.",
      cta: "Plan your visit",
      kpiTargets: "Confirm uploads, media retrieval, signed URLs, and UTM creation.",
      launchStartDate: "2026-06-01",
      launchEndDate: "2026-06-30",
      owner: "Marketing QA",
      budget: 12500,
      successDefinition: "All generated fixtures upload and appear in project review surfaces.",
      event: "Ocean Nights",
      exhibit: "After Dark Galleries",
    },
  });

  const { link: landingPage } = await jsonFetch(jar, `/api/projects/${project.id}/tracking-links`, "POST", {
    url: "https://example.com/ocean-nights",
    label: "Ocean Nights Landing Page",
  });

  const signageFormatIds = new Map();
  for (const asset of manifest.filter((item) => item.platform === "signage")) {
    if (signageFormatIds.has(asset.slot)) continue;
    const spec = signageSpecs[asset.slot];
    if (!spec) throw new Error(`Missing signage spec for ${asset.slot}`);
    const { format } = await jsonFetch(jar, `/api/projects/${project.id}/signage-formats`, "POST", spec);
    signageFormatIds.set(asset.slot, format.id);
  }

  const uploaded = [];
  for (const [index, asset] of manifest.entries()) {
    const item = await uploadAsset(jar, project.id, asset, signageFormatIds);
    uploaded.push({ ...item, platform: asset.platform, slot: asset.slot });
    await jsonFetch(
      jar,
      `/api/tracking?platform=${encodeURIComponent(asset.platform)}&projectId=${encodeURIComponent(project.id)}`,
      "POST",
      { creativeId: item.creativeId, landingPageId: landingPage.id }
    );
    console.log(`${String(index + 1).padStart(2, "0")}/${manifest.length} uploaded ${asset.platform}/${asset.slot}`);
  }

  const mediaResponse = await apiFetch(jar, `/api/projects/${project.id}/media`);
  const trackingResponse = await apiFetch(jar, `/api/projects/${project.id}/tracking-links`);
  const signageResponse = await apiFetch(jar, `/api/projects/${project.id}/signage-formats`);

  const mediaCount = Array.isArray(mediaResponse.items) ? mediaResponse.items.length : 0;
  const trackingCount = Array.isArray(trackingResponse.links) ? trackingResponse.links.length : 0;
  const signageMediaCount = Object.values(signageResponse.mediaByFormat ?? {}).reduce(
    (total, rows) => total + (Array.isArray(rows) ? rows.length : 0),
    0
  );

  if (mediaCount !== manifest.length) {
    throw new Error(`Expected ${manifest.length} project media items, found ${mediaCount}`);
  }
  if (trackingCount !== manifest.length + 1) {
    throw new Error(`Expected ${manifest.length + 1} tracking links including landing page, found ${trackingCount}`);
  }
  if (signageMediaCount !== manifest.filter((asset) => asset.platform === "signage").length) {
    throw new Error(`Expected all signage media to appear under signage formats, found ${signageMediaCount}`);
  }

  console.log("");
  console.log(`Project: ${project.name}`);
  console.log(`Project ID: ${project.id}`);
  console.log(`Project URL: ${new URL(`/projects/${project.id}`, baseUrl).toString()}`);
  console.log(`Uploaded assets: ${uploaded.length}`);
  console.log(`Tracking links: ${trackingCount}`);
  console.log(`Signage formats: ${signageFormatIds.size}`);
  console.log(`Authenticated as: ${temporaryUser ? "temporary test user" : email}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
