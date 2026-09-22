import { chromium } from "@playwright/test";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:4321";

/**
 * Global setup: warm up the dev server + D1 before any tests run.
 *
 * The first request to wrangler's platformProxy D1 binding can take a few
 * seconds to initialise the SQLite worker.  Without a warm-up the first two
 * owner login attempts time out while the DB is still starting, causing
 * flaky failures.
 *
 * We simply hit /api/readyz (deep health check that queries D1) and then
 * do a real login+logout cycle so that the auth stack is also warm.
 */
export default async function globalSetup() {
  // 1. Poll /api/readyz until D1 is reachable (max 30 s)
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE_URL}/api/readyz`);
      if (res.ok) break;
    } catch {
      // server not yet ready — keep polling
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  // 2. Do a headless login as owner to warm the auth + D1 session stack
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
    await page.locator('input[type="email"]').fill("owner@demo.meterly.app");
    await page.locator('input[type="password"]').fill("DemoOwner123");
    await page.locator('button[type="submit"]').click();
    // Wait up to 20 s — generous because D1 may still be cold
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), {
      timeout: 20_000,
    });
  } catch {
    // Warm-up failure is non-fatal; the tests will surface the real error.
    console.warn(
      "[global-setup] Owner warm-up login did not complete — tests may be flaky."
    );
  } finally {
    await browser.close();
  }
}
