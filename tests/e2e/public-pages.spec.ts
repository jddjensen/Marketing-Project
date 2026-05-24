import { test, expect } from "@playwright/test";

/**
 * Smoke tests for pages that don't require authentication.
 *
 * These cover the routes whitelisted in src/proxy.ts (login, register,
 * privacy, /c/*, /go/*, /qr/*) plus the unauthenticated redirect for
 * protected routes. They prove the dev server boots, Next compiles, and
 * the proxy auth gate behaves as expected.
 */
test.describe("public pages render", () => {
  test("login page shows the auth form", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveTitle(/Sign in|Log in|Marketing Platform/i);
    await expect(
      page.getByRole("button", { name: /sign in|log in/i })
    ).toBeVisible();
  });

  test("register page renders", async ({ page }) => {
    await page.goto("/register");
    await expect(
      page.getByRole("button", { name: /sign up|create/i })
    ).toBeVisible();
  });

  test("privacy policy is publicly accessible", async ({ page }) => {
    await page.goto("/privacy");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});

test.describe("auth gate", () => {
  test("unauthenticated visit to the dashboard redirects to /login", async ({
    page,
  }) => {
    const response = await page.goto("/");
    expect(response).toBeTruthy();
    await expect(page).toHaveURL(/\/login/);
  });

  test("unauthenticated visit to /projects preserves the next= param", async ({
    page,
  }) => {
    await page.goto("/projects");
    await expect(page).toHaveURL(/\/login\?next=%2Fprojects/);
  });

  test("protected API returns 401 JSON, not a redirect", async ({
    request,
  }) => {
    const response = await request.get("/api/projects");
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body).toEqual({ error: "unauthorized" });
  });
});
