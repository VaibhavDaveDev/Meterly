import { defineConfig, devices } from "@playwright/test";

/**
 * E2E_BASE_URL — set in CI when running against a deployed preview URL.
 * When unset (local dev), Playwright starts `pnpm dev` itself.
 */
const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:4321";

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  // ponytail: workers: 1 and fullyParallel: false because local D1 is a single SQLite file;
  // parallel workers would race on the same sessions/tables.
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    actionTimeout: 20_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // Start the dev server automatically when E2E_BASE_URL is not provided.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        // ponytail: --ignore-lock and ASTRO_DEV_BACKGROUND="false" ensure Astro runs in the foreground
        // even in agent environments (Astro 7+ auto-backgrounds when am-i-vibing detects an agent).
        command: "pnpm dev --ignore-lock",
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000, // wrangler D1 init can be slow on first run
        stdout: "pipe",
        stderr: "pipe",
        env: {
          ASTRO_DEV_BACKGROUND: "false",
        },
      },
});
