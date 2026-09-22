import { test, expect, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Constants — match scripts/seed.ts demo fixtures
// ---------------------------------------------------------------------------
const OWNER_EMAIL = "owner@demo.meterly.app";
const OWNER_PASSWORD = "DemoOwner123";
const PROP_ID = "prop-001";
const PERIOD_ID = "period-2026-06";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Log in via the /login form. Waits for redirect away from /login. */
async function loginAs(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  // Wait until we are no longer on /login
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), {
    timeout: 15_000,
  });
}

/** Assert that the error-boundary fallback is NOT rendered on the page. */
async function assertNoErrorBoundary(page: Page): Promise<void> {
  await expect(
    page.getByRole("heading", { name: "Something went wrong" })
  ).not.toBeVisible();
}

/** Navigate, wait for network idle, then run both assertions. */
async function smokeCheck(
  page: Page,
  url: string,
  visibleLocator: ReturnType<Page["locator"]>
): Promise<void> {
  await page.goto(url, { waitUntil: "networkidle" });
  await expect(visibleLocator).toBeVisible({ timeout: 10_000 });
  await assertNoErrorBoundary(page);
}

// ---------------------------------------------------------------------------
// Owner flows
// ---------------------------------------------------------------------------

test.describe("Owner smoke tests", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, OWNER_EMAIL, OWNER_PASSWORD);
  });

  test("dashboard renders", async ({ page }) => {
    await smokeCheck(
      page,
      "/dashboard",
      page.getByRole("heading", { level: 1 })
    );
  });

  test("properties list renders", async ({ page }) => {
    await smokeCheck(
      page,
      "/properties",
      page.getByRole("heading", { name: /properties/i })
    );
  });

  test("property detail renders", async ({ page }) => {
    await smokeCheck(
      page,
      `/properties/${PROP_ID}`,
      // PropertyDetails renders the property name — seed value is "Sunshine Residency"
      page.getByText("Sunshine Residency")
    );
  });

  test("property edit-requests page renders", async ({ page }) => {
    await smokeCheck(
      page,
      `/properties/${PROP_ID}/edit-requests`,
      page.getByRole("heading", { name: /edit request/i })
    );
  });

  test("new billing period form renders", async ({ page }) => {
    await smokeCheck(
      page,
      `/properties/${PROP_ID}/periods/new`,
      page.getByRole("heading", { name: /create new period/i })
    );
  });

  test("submit reading page renders", async ({ page }) => {
    await smokeCheck(
      page,
      `/properties/${PROP_ID}/periods/${PERIOD_ID}`,
      page.getByRole("heading", { name: "Submit Readings", exact: true })
    );
  });

  test("requests manager renders", async ({ page }) => {
    await smokeCheck(
      page,
      "/requests",
      page.getByRole("heading", { name: "Edit Requests", exact: true })
    );
  });

  test("export page renders", async ({ page }) => {
    await smokeCheck(
      page,
      "/export",
      page.getByRole("heading", { name: /export/i })
    );
  });

  test("settings page renders", async ({ page }) => {
    await smokeCheck(
      page,
      "/settings",
      page.getByRole("heading", { name: /settings/i })
    );
  });
});
