import { test, expect } from "@playwright/test";
import {
  goToLanding,
  loginAsGuest,
  waitForPhase,
  dismissBanners,
} from "./fixtures/test-helpers";

/**
 * Landing page E2E tests.
 * User stories: US-LAND-001 through US-LAND-004.
 */

test.describe("Landing Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await dismissBanners(page);
  });

  // US-LAND-001: App loads with logo and tagline
  test("app loads and shows landing screen with logo and tagline", async ({
    page,
  }) => {
    const logo = page.getByAltText("PeelAway Logic");
    await expect(logo).toBeVisible({ timeout: 15_000 });

    // Tagline should be present on the landing page
    await expect(page.getByText("AI-powered job search pipeline for busy professionals.")).toBeVisible();
  });

  // US-LAND-002: Start as Guest button is visible and clickable
  test('"Start as Guest" button is visible and clickable', async ({ page }) => {
    const guestBtn = page.getByText("Start as Guest", { exact: false });
    await expect(guestBtn).toBeVisible({ timeout: 15_000 });
    await expect(guestBtn).toBeEnabled();
  });

  // US-LAND-003: Connect Your Workspace button is visible
  test('"Connect Your Workspace" button is visible', async ({ page }) => {
    const connectBtn = page.getByText("Connect Your Workspace", {
      exact: false,
    });
    await expect(connectBtn).toBeVisible({ timeout: 15_000 });
  });

  // US-LAND-004: Clicking Start as Guest navigates to Scout phase
  test("clicking Start as Guest navigates to Scout phase", async ({ page }) => {
    await loginAsGuest(page);
    await waitForPhase(page, "Scout");

    // Header shows app name
    const header = page.getByText("PeelAway Logic");
    await expect(header.first()).toBeVisible();

    // ProgressStepper is rendered
    const stepper = page.locator(".step-label");
    await expect(stepper.first()).toBeVisible();

    // Upload resume button is present in Scout phase
    const uploadBtn = page.getByRole("button", { name: "Upload Resume (PDF or TXT)" });
    await expect(uploadBtn).toBeVisible();
  });

  // US-LAND-003 (supplemental): Privacy notice text is visible
  test("privacy notice text is visible on landing", async ({ page }) => {
    await expect(
      page.getByText("Your data stays private. No account required to start."),
    ).toBeVisible({ timeout: 15_000 });
  });

  // Negative: Landing does not show pipeline components
  test("landing does not show pipeline components", async ({ page }) => {
    // ProgressStepper should NOT be visible on the landing screen
    const stepper = page.locator(".step-label");
    await expect(stepper).toHaveCount(0);
  });

  // Demo mode toggle visibility
  test("demo mode toggle is visible on landing page", async ({ page }) => {
    const toggle = page.getByTestId("demo-toggle");
    await expect(toggle).toBeVisible({ timeout: 15_000 });

    const checkbox = page.getByTestId("demo-toggle-checkbox");
    await expect(checkbox).toBeVisible();
    await expect(checkbox).not.toBeChecked();
  });

  // Demo mode toggle interaction
  test("demo mode toggle can be switched on and off", async ({ page }) => {
    const checkbox = page.getByTestId("demo-toggle-checkbox");
    await checkbox.check();
    await expect(checkbox).toBeChecked();

    await expect(page.getByTestId("demo-toggle-hint")).toBeVisible();

    await checkbox.uncheck();
    await expect(checkbox).not.toBeChecked();
    await expect(page.getByTestId("demo-toggle-hint")).toHaveCount(0);
  });
});
