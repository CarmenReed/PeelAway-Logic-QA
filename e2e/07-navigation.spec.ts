import { test, expect } from "@playwright/test";
import {
  goToLanding,
  loginAsGuest,
  waitForPhase,
  dismissBanners,
  mockAnthropicApi,
  mockSearchApis,
} from "./fixtures/test-helpers";

/**
 * Navigation & Cross-Cutting Concerns E2E tests.
 * User stories: US-NAV-001 through US-NAV-005.
 *
 * These tests verify the ProgressStepper, Header, GuideBar, responsive
 * layout, and navigation guards. They focus on elements that are directly
 * reachable from the landing/Scout phases without needing pipeline data.
 */

const PHASES = ["Scout", "Search", "Review", "Complete"] as const;
const MOBILE_BP = 640;

test.describe("Navigation & UI Chrome (US-NAV-001 to US-NAV-005)", () => {
  test.describe("ProgressStepper", () => {
    test.beforeEach(async ({ page }) => {
      await goToLanding(page);
      await dismissBanners(page);
      await loginAsGuest(page);
      await waitForPhase(page, "Scout");
    });

    // US-NAV-001: ProgressStepper shows all 4 phase labels
    test("stepper shows 4 phase labels: Scout, Search, Review, Complete", async ({
      page,
    }) => {
      const stepLabels = page.locator(".step-label");
      await expect(stepLabels).toHaveCount(4);

      for (const phase of PHASES) {
        await expect(
          page.locator(".step-label", { hasText: phase }),
        ).toBeVisible();
      }
    });

    // US-NAV-001: Scout is marked as current phase after starting
    test("Scout is marked as the current phase via .current-label", async ({
      page,
    }) => {
      const currentLabel = page.locator(".step-label.current-label");
      await expect(currentLabel).toHaveCount(1);
      await expect(currentLabel).toContainText("Scout");
    });

    // US-NAV-002: Future phase dots are not clickable
    test("future phase dots have .no-click class and are not interactive", async ({
      page,
    }) => {
      // When on Scout, Search/Review/Complete dots should not be clickable
      const futureDots = page.locator(".step-dot.no-click");
      const futureCount = await futureDots.count();
      // At minimum, Review and Complete should be non-clickable (2+)
      expect(futureCount).toBeGreaterThanOrEqual(2);
    });
  });

  test.describe("Header", () => {
    test.beforeEach(async ({ page }) => {
      await goToLanding(page);
      await dismissBanners(page);
      await loginAsGuest(page);
      await waitForPhase(page, "Scout");
    });

    // US-NAV-003: Header renders logo and brand text
    test('header renders logo (img alt "PeelAway Logic") and brand text', async ({
      page,
    }) => {
      const header = page.locator(".header");
      await expect(header).toBeVisible();

      const logo = header.locator("img[alt='PeelAway Logic']");
      await expect(logo).toBeVisible();

      const brand = header.locator(".header-brand");
      await expect(brand).toContainText("PeelAway Logic");
    });

    // US-NAV-003: Header shows the tagline
    test("header shows tagline text", async ({ page }) => {
      const headerTitle = page.locator(".header-title");
      await expect(headerTitle).toContainText(
        "Peel away the noise. Surface what matters.",
      );
    });

    // Logo click navigates to Landing
    test("clicking header logo navigates back to Landing page", async ({
      page,
    }) => {
      page.on("dialog", (dialog) => dialog.accept());
      const logo = page.getByTestId("header-logo");
      await expect(logo).toBeVisible();
      await logo.click();

      const guestBtn = page.getByText("Start as Guest", { exact: false });
      await expect(guestBtn).toBeVisible({ timeout: 15_000 });
    });
  });

  test.describe("GuideBar", () => {
    test.beforeEach(async ({ page }) => {
      await goToLanding(page);
      await dismissBanners(page);
      await loginAsGuest(page);
      await waitForPhase(page, "Scout");
    });

    // US-NAV-004: GuideBar shows emoji and text on Scout phase
    test("GuideBar displays emoji and guidance text on Scout phase", async ({
      page,
    }) => {
      const guide = page.locator(".guide");
      await expect(guide).toBeVisible();

      const emoji = page.locator(".guide-emoji");
      await expect(emoji).toBeVisible();

      const text = page.locator(".guide-text");
      await expect(text).toBeVisible();
      // Guide text should not be empty
      const content = await text.textContent();
      expect(content?.trim().length).toBeGreaterThan(0);
    });
  });

  test.describe("Responsive Layout", () => {
    // US-NAV-005: Mobile viewport shows compact stepper format
    test("at 640px viewport, stepper shows mobile format 'Step 1 of 4: Scout'", async ({
      page,
    }) => {
      await page.setViewportSize({ width: MOBILE_BP - 1, height: 800 });
      await goToLanding(page);
      await dismissBanners(page);
      await loginAsGuest(page);

      const mobileStepper = page.locator("[data-testid='progress-stepper-mobile']");
      await expect(mobileStepper).toBeVisible({ timeout: 15_000 });
      await expect(mobileStepper).toContainText(/Step 1 of 4/i);
    });

    // US-NAV-005: Desktop viewport shows full dot+label stepper
    test("at 1024px viewport, stepper shows full dot+label format", async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1024, height: 800 });
      await goToLanding(page);
      await dismissBanners(page);
      await loginAsGuest(page);
      await waitForPhase(page, "Scout");

      // In desktop, all 4 step labels and dots should be visible
      const stepLabels = page.locator(".step-label");
      await expect(stepLabels).toHaveCount(4);

      const stepDots = page.locator(".step-dot");
      await expect(stepDots).toHaveCount(4);

      for (const phase of PHASES) {
        await expect(
          page.locator(".step-label", { hasText: phase }),
        ).toBeVisible();
      }
    });
  });

  test.describe("Phase Navigation", () => {
    // US-NAV-001 (supplemental): Scout to Search navigation works
    test("navigating from Scout to Search by pasting resume and clicking Continue", async ({
      page,
    }) => {
      await goToLanding(page);
      await dismissBanners(page);
      await mockAnthropicApi(page);
      await mockSearchApis(page);
      await loginAsGuest(page);
      await waitForPhase(page, "Scout");

      // Switch to Paste Resume Text tab and fill the textarea
      const pasteTab = page.getByText("Paste Resume Text", { exact: false });
      await pasteTab.click();

      const textarea = page.locator("textarea").first();
      await expect(textarea).toBeVisible();
      await textarea.fill(
        "Experienced software engineer with 5+ years in React, Node.js, and cloud architecture. " +
        "Led development of distributed systems at scale. Strong background in TypeScript and AWS.",
      );

      // Wait for profile extraction to complete, then click Continue
      const continueBtn = page.getByText(/Continue to Search/i);
      await expect(continueBtn).toBeVisible({ timeout: 10_000 });
      await continueBtn.click();

      // Should arrive at Search phase
      await waitForPhase(page, "Search");
    });

    // US-NAV-002: Cannot skip to Review by clicking its dot
    test("clicking the Review phase dot does not navigate away from Scout", async ({
      page,
    }) => {
      await goToLanding(page);
      await dismissBanners(page);
      await loginAsGuest(page);
      await waitForPhase(page, "Scout");

      // The Review dot should have .no-click class
      const reviewLabel = page.locator(".step-label", { hasText: "Review" });
      await expect(reviewLabel).toBeVisible();

      // Click near the Review label/dot area: it should be non-interactive
      const reviewDotGeneral = page.locator(
        ".step-dot:near(.step-label:has-text('Review'))",
      ).first();

      // Even if we click, we should still be on Scout
      if (await reviewDotGeneral.isVisible()) {
        await reviewDotGeneral.click({ force: true });
      }

      // Verify we are still on Scout: the current label has not changed
      const currentLabel = page.locator(".step-label.current-label");
      await expect(currentLabel).toContainText("Scout");
    });
  });
});
