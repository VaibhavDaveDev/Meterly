import { test, expect, type Page } from "@playwright/test";

const TENANT_EMAIL = "tenant@demo.meterly.app";
const TENANT_PASSWORD = "DemoTenant123";
const TENANCY_ID = "tenancy-001";
const BILL_ID = "bill-2026-06";

async function loginAs(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), {
    timeout: 20_000,
  });
}

async function assertNoErrorBoundary(page: Page): Promise<void> {
  await expect(
    page.getByRole("heading", { name: "Something went wrong" })
  ).not.toBeVisible();
}

async function smokeCheck(
  page: Page,
  url: string,
  visibleLocator: ReturnType<Page["locator"]>
): Promise<void> {
  await page.goto(url, { waitUntil: "networkidle" });
  await expect(visibleLocator).toBeVisible({ timeout: 10_000 });
  await assertNoErrorBoundary(page);
}

test.describe("Tenant smoke tests", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, TENANT_EMAIL, TENANT_PASSWORD);
  });

  test("dashboard renders", async ({ page }) => {
    await smokeCheck(
      page,
      "/dashboard",
      page.getByRole("heading", { level: 1 })
    );
  });

  test("tenancy overview renders", async ({ page }) => {
    await smokeCheck(
      page,
      `/tenancies/${TENANCY_ID}`,
      // TenancyOverview renders the property name
      page.getByText("Sunshine Residency")
    );
  });

  test("tenant bills list renders", async ({ page }) => {
    await smokeCheck(
      page,
      `/tenancies/${TENANCY_ID}/bills`,
      page.getByRole("heading", { name: /bills/i })
    );
  });

  test("bill detail page renders", async ({ page }) => {
    await smokeCheck(
      page,
      `/tenancies/${TENANCY_ID}/bills/${BILL_ID}`,
      // BillDetailPage renders the June 2026 heading
      page.getByRole("heading", { level: 1 })
    );
  });

  test("new edit request page renders", async ({ page }) => {
    await smokeCheck(
      page,
      `/tenancies/${TENANCY_ID}/edit-requests/new`,
      page.getByRole("heading", { name: /request edit/i })
    );
  });

  test("export page renders", async ({ page }) => {
    await smokeCheck(
      page,
      "/export",
      page.getByRole("heading", { name: /export/i })
    );
  });
});
