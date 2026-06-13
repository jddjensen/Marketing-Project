// Throwaway E2E driver for upload-pipeline verification. Not part of the app.
import { chromium } from "playwright";
import { mkdirSync, copyFileSync } from "node:fs";

const BASE = "http://localhost:3000";
const SHOTS = "/tmp/verify-shots";
const ASSETS = "public/test-assets/media";
mkdirSync(SHOTS, { recursive: true });

const log = (...a) => console.log("[verify]", ...a);

async function recordTestVideo() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1600, height: 900 },
    recordVideo: { dir: "/tmp/pw-video", size: { width: 1600, height: 900 } },
  });
  const page = await ctx.newPage();
  await page.setContent(
    `<style>body{margin:0;background:linear-gradient(45deg,#1e3a8a,#9333ea);display:grid;place-items:center;height:100vh;color:#fff;font:700 140px sans-serif}</style><div id="t">VIDEO 0</div><script>let i=0;setInterval(()=>{document.getElementById("t").textContent="VIDEO "+(++i)},100)</script>`
  );
  await page.waitForTimeout(2500);
  const video = page.video();
  await ctx.close();
  const path = await video.path();
  await browser.close();
  copyFileSync(path, "/tmp/test-video-1600x900.webm");
  log("test video recorded:", path, "-> /tmp/test-video-1600x900.webm");
}

const consoleErrors = [];
const failedRequests = [];

async function main() {
  await recordTestVideo();

  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(30000);
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text().slice(0, 300));
  });
  page.on("pageerror", (e) =>
    consoleErrors.push("PAGEERROR: " + String(e).slice(0, 300))
  );
  page.on("requestfailed", (r) =>
    failedRequests.push(`${r.failure()?.errorText} ${r.url().slice(0, 140)}`)
  );

  // ---- login ----
  await page.goto(BASE + "/login", {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.locator('input[type="email"]').fill("admin@example.com");
  await page.locator('input[type="password"]').fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(BASE + "/", { timeout: 60000 });
  log("logged in");

  // ---- create project via /?new=1 deep link (contract C2) ----
  await page.goto(BASE + "/?new=1", { waitUntil: "domcontentloaded" });
  const createDialog = page
    .getByRole("dialog")
    .filter({ hasText: "Create project" })
    .first();
  await createDialog.waitFor({ timeout: 30000 });
  await page.screenshot({ path: SHOTS + "/01-create-dialog-via-new1.png" });
  const projectName = "Upload Verify " + Date.now().toString().slice(-6);
  await createDialog
    .locator('input[placeholder="Q2 Spring Launch"]')
    .fill(projectName);
  // enable the Website channel
  const websiteRow = createDialog
    .locator("label", { hasText: "Website" })
    .first();
  await websiteRow.locator('input[type="checkbox"]').check();
  await createDialog.getByRole("button", { name: /Create project/ }).click();
  await createDialog.waitFor({ state: "hidden", timeout: 30000 });
  log("project created:", projectName);

  // ---- open the project, go to Website board ----
  await page
    .getByRole("link", { name: new RegExp(projectName) })
    .first()
    .click();
  await page.waitForURL(/\/projects\/[0-9a-f-]+$/, { timeout: 60000 });
  const projectUrl = page.url();
  log("project url:", projectUrl);
  await page
    .getByRole("navigation", { name: "Project channels" })
    .getByRole("link", { name: "Website", exact: true })
    .click();
  await page.waitForURL(/\/website$/, { timeout: 60000 });
  const heroColumn = page.locator("section", {
    has: page.getByRole("heading", { name: "Hero Slider", exact: true }),
  });
  await heroColumn.waitFor();
  log("on website board");

  // ---- batch 1: multi-file queue + mismatch confirm (Upload anyway) ----
  const heroInput = heroColumn.locator('input[type="file"]').first();
  await heroInput.setInputFiles([
    ASSETS + "/website__hero-slider__1600x900.png", // match
    ASSETS + "/website__pop-up__1080x1350.png", // ratio mismatch for this slot
    ASSETS + "/website__habitat-slider__1600x900.png", // match
  ]);
  const overlay = page.getByRole("dialog", { name: "Uploading" });
  await overlay.waitFor({ timeout: 15000 });
  await page.screenshot({ path: SHOTS + "/02-queue-overlay.png" });
  const confirmSheet = page.getByRole("alertdialog");
  await confirmSheet.waitFor({ timeout: 30000 });
  await page.screenshot({ path: SHOTS + "/03-fit-confirm-with-queue.png" });
  const confirmText = await confirmSheet.innerText();
  log("confirm sheet text:", confirmText.replace(/\n/g, " | ").slice(0, 300));
  await confirmSheet.getByRole("button", { name: "Upload anyway" }).click();
  // batch is NOT all-done (no errors though) -> all done -> auto-clears
  await overlay.waitFor({ state: "hidden", timeout: 90000 });
  log("batch 1 complete (queue auto-cleared)");

  // ---- batch 2 probe: mismatch -> Skip this file ----
  await heroInput.setInputFiles([ASSETS + "/website__blog__1200x900.png"]);
  await confirmSheet.waitFor({ timeout: 30000 });
  await confirmSheet.getByRole("button", { name: "Skip this file" }).click();
  // single skipped file -> overlay stays with Close button
  await overlay
    .getByRole("button", { name: "Close" })
    .waitFor({ timeout: 15000 });
  await page.screenshot({ path: SHOTS + "/04-skipped-summary.png" });
  await overlay.getByRole("button", { name: "Close" }).click();
  await overlay.waitFor({ state: "hidden", timeout: 15000 });
  log("batch 2 (skip path) complete");

  // ---- batch 3: video upload (matches slot, no confirm) ----
  await heroInput.setInputFiles(["/tmp/test-video-1600x900.webm"]);
  await overlay.waitFor({ timeout: 15000 });
  await overlay.waitFor({ state: "hidden", timeout: 120000 });
  log("video upload complete");

  // ---- board assertions ----
  await page.waitForTimeout(1500); // let fetchMedia paint
  const headerRollup = await heroColumn
    .locator("div.text-right")
    .first()
    .innerText();
  log("hero column header:", headerRollup.replace(/\n/g, " | "));
  const badges = await heroColumn.locator("figure").allInnerTexts();
  log("tile count:", badges.length);
  const imgs = await page.evaluate(() =>
    Array.from(document.querySelectorAll("main img")).map((i) => ({
      src: i.src.slice(0, 90),
      ok: i.complete && i.naturalWidth > 0,
    }))
  );
  log("board imgs:", JSON.stringify(imgs, null, 1));
  const vids = await page.evaluate(() =>
    Array.from(document.querySelectorAll("main video")).map((v) => ({
      poster: v.poster ? v.poster.slice(0, 90) : null,
      src: (v.currentSrc || v.src || "").slice(0, 90),
    }))
  );
  log("board videos:", JSON.stringify(vids, null, 1));
  await page.screenshot({
    path: SHOTS + "/05-board-after-uploads.png",
    fullPage: true,
  });

  // ---- dashboard display ----
  await page.goto(projectUrl, { waitUntil: "domcontentloaded" });
  await page
    .getByRole("heading", { name: "Channels" })
    .waitFor({ timeout: 30000 });
  await page.waitForTimeout(2500); // media + platforms fetches
  const websiteCard = page.locator("a", { hasText: "Website" }).first();
  const cardText = (await websiteCard.innerText()).replace(/\n/g, " | ");
  log("website channel card:", cardText);
  const dashImgs = await page.evaluate(() =>
    Array.from(document.querySelectorAll("main img")).map((i) => ({
      src: i.src.slice(0, 90),
      ok: i.complete && i.naturalWidth > 0,
    }))
  );
  log("dashboard imgs:", JSON.stringify(dashImgs, null, 1));
  await page.screenshot({ path: SHOTS + "/06-dashboard.png", fullPage: true });

  // ---- report listeners ----
  log(
    "console errors:",
    consoleErrors.length ? JSON.stringify(consoleErrors, null, 1) : "none"
  );
  log(
    "failed requests:",
    failedRequests.length ? JSON.stringify(failedRequests, null, 1) : "none"
  );

  await browser.close();
}

main().catch((e) => {
  console.error("[verify] FAILED:", e);
  process.exitCode = 1;
});
