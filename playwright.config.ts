import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for end-to-end smoke tests.
 *
 * Local: tests run against `npm run dev` started automatically by Playwright.
 * CI: same, but with retries and a single worker for determinism.
 *
 * E2E tests live in tests/e2e/ and require a Supabase project + the env vars
 * documented in README.md. Tests skip themselves when those aren't set so
 * `npm run test:e2e` is safe to run in any environment.
 */
const PORT = Number(process.env.PORT ?? 3000);
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
