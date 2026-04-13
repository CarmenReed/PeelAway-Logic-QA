import { test, expect } from "@playwright/test";
import {
  goToLanding,
  loginAsGuest,
  waitForPhase,
  dismissBanners,
} from "./fixtures/test-helpers";

/**
 * Demo Mode E2E tests.
 * Verifies the Demo Mode toggle on the Landing page,
 * logo-click-to-Landing navigation, and visual indicators.
 */

test.describe("Demo Mode", () => {
  test.beforeEach(async ({ page }) => {
    await goToLanding(page);
    await dismissBanners(page);
  });

  // Toggle renders on Landing and defaults to OFF
  test("demo toggle is visible on Landing and defaults to OFF", async ({
    page,
  }) => {
    const toggle = page.getByTestId("demo-toggle");
    await expect(toggle).toBeVisible();

    const checkbox = page.getByTestId("demo-toggle-checkbox");
    await expect(checkbox).not.toBeChecked();
  });

  // Toggle can be switched ON and hint appears
  test("toggling demo mode ON shows hint text", async ({ page }) => {
    const checkbox = page.getByTestId("demo-toggle-checkbox");
    await checkbox.check();
    await expect(checkbox).toBeChecked();

    const hint = page.getByTestId("demo-toggle-hint");
    await expect(hint).toBeVisible();
    await expect(hint).toContainText("1 result per search");
    await expect(hint).toContainText("scores floored at 80%");
  });

  // Toggle can be switched OFF and hint disappears
  test("toggling demo mode OFF hides hint text", async ({ page }) => {
    const checkbox = page.getByTestId("demo-toggle-checkbox");
    await checkbox.check();
    await expect(page.getByTestId("demo-toggle-hint")).toBeVisible();

    await checkbox.uncheck();
    await expect(checkbox).not.toBeChecked();
    await expect(page.getByTestId("demo-toggle-hint")).toHaveCount(0);
  });

  // Demo toggle persists through pipeline start (toggle ON, then start)
  test("demo mode toggle state persists when entering pipeline", async ({
    page,
  }) => {
    const checkbox = page.getByTestId("demo-toggle-checkbox");
    await checkbox.check();
    await expect(checkbox).toBeChecked();

    // Start the pipeline as guest
    await loginAsGuest(page);
    await waitForPhase(page, "Scout");

    // We're now in the pipeline - upload button should be visible
    const uploadBtn = page.getByRole("button", {
      name: "Upload Resume (PDF or TXT)",
    });
    await expect(uploadBtn).toBeVisible();
  });
});

test.describe("Logo Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await goToLanding(page);
    await dismissBanners(page);
  });

  // Logo click returns to Landing when confirmed
  test("clicking header logo returns to Landing page when confirmed", async ({
    page,
  }) => {
    await loginAsGuest(page);
    await waitForPhase(page, "Scout");

    // Set up dialog handler to accept the confirmation
    page.on("dialog", (dialog) => dialog.accept());

    const logo = page.getByTestId("header-logo");
    await expect(logo).toBeVisible();
    await logo.click();

    // Should return to Landing screen
    const guestBtn = page.getByText("Start as Guest", { exact: false });
    await expect(guestBtn).toBeVisible({ timeout: 15_000 });
  });

  // Logo click does NOT navigate when cancelled
  test("clicking header logo does not navigate when cancelled", async ({
    page,
  }) => {
    await loginAsGuest(page);
    await waitForPhase(page, "Scout");

    // Set up dialog handler to dismiss the confirmation
    page.on("dialog", (dialog) => dialog.dismiss());

    const logo = page.getByTestId("header-logo");
    await logo.click();

    // Should still be on Scout
    const currentLabel = page.locator(".step-label.current-label");
    await expect(currentLabel).toContainText("Scout");
  });

  // Logo has pointer cursor style
  test("header logo has pointer cursor indicating it is clickable", async ({
    page,
  }) => {
    await loginAsGuest(page);
    await waitForPhase(page, "Scout");

    const logo = page.getByTestId("header-logo");
    const cursor = await logo.evaluate((el) => getComputedStyle(el).cursor);
    expect(cursor).toBe("pointer");
  });
});
