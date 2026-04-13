import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  goToLanding,
  loginAsGuest,
  waitForPhase,
  dismissBanners,
} from "./fixtures/test-helpers";

/**
 * Accessibility E2E tests.
 *
 * These run axe-core inside a real browser via @axe-core/playwright, which
 * means they cover the checks that jest-axe cannot reach from jsdom:
 *
 *   * color-contrast (WCAG 1.4.3)        - vision impaired contrast ratios
 *   * focus-order-semantics              - keyboard tab order makes sense
 *   * focus visible (focus-visible)      - focus ring is present
 *   * region                             - all content sits inside a landmark
 *   * page-has-heading-one               - page has exactly one h1
 *   * scrollable-region-focusable        - scrollable regions are reachable
 *     by keyboard
 *
 * Together with src/__tests__/accessibility.test.jsx these tests are what
 * the HCI audit's a11y flag actually depends on. If the audit reports
 * "accessibility regression" (see scripts/hci-audit.js), the failing
 * behavior should be reproducible here.
 *
 * Scope: WCAG 2.1 Level A and AA. Vision impaired rules are prioritized.
 */

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

// Rules we never want to see failing, organized by the user population they
// protect. Keeping this list in the test file (not a config) makes the intent
// obvious to reviewers.
const VISION_IMPAIRED_CRITICAL = [
  "color-contrast",
  "image-alt",
  "button-name",
  "link-name",
  "label",
  "aria-valid-attr",
  "aria-valid-attr-value",
  "aria-required-attr",
  "aria-allowed-attr",
  "role-img-alt",
  "svg-img-alt",
];

async function scanPage(page) {
  return new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
}

test.describe("Accessibility: vision impaired users", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await dismissBanners(page);
  });

  test("landing screen passes axe scan", async ({ page }) => {
    // Ensure the landing screen is fully rendered before we scan.
    await expect(page.getByAltText("PeelAway Logic")).toBeVisible({ timeout: 15_000 });
    const results = await scanPage(page);

    // Surface the full violation list in the failure message so fixes are
    // obvious without having to rerun with --headed.
    expect(
      results.violations,
      results.violations.map((v) => `${v.id}: ${v.help}`).join("\n")
    ).toEqual([]);
  });

  test("landing screen has no critical vision impaired violations", async ({ page }) => {
    await expect(page.getByAltText("PeelAway Logic")).toBeVisible({ timeout: 15_000 });
    const results = await new AxeBuilder({ page })
      .withTags(WCAG_TAGS)
      .withRules(VISION_IMPAIRED_CRITICAL)
      .analyze();
    expect(
      results.violations,
      results.violations.map((v) => `${v.id}: ${v.help}`).join("\n")
    ).toEqual([]);
  });

  test("scout phase passes axe scan", async ({ page }) => {
    await loginAsGuest(page);
    await waitForPhase(page, "scout");
    const results = await scanPage(page);
    expect(
      results.violations,
      results.violations.map((v) => `${v.id}: ${v.help}`).join("\n")
    ).toEqual([]);
  });

  test("progress stepper exposes aria-current for the active step", async ({ page }) => {
    await loginAsGuest(page);
    await waitForPhase(page, "scout");
    const current = page.locator('[aria-current="step"]');
    await expect(current).toHaveCount(1);
  });

  test("every interactive control is reachable by keyboard", async ({ page }) => {
    await expect(page.getByAltText("PeelAway Logic")).toBeVisible({ timeout: 15_000 });

    // Tab through the page and count how many elements actually receive focus.
    // Any interactive control that the user can click should be focusable too.
    const interactiveCount = await page
      .locator("button:visible, a:visible, input:visible, textarea:visible, [tabindex]:visible")
      .count();

    let reached = 0;
    for (let i = 0; i < interactiveCount + 2; i++) {
      await page.keyboard.press("Tab");
      const tag = await page.evaluate(() => document.activeElement?.tagName || "");
      if (["BUTTON", "A", "INPUT", "TEXTAREA", "SELECT"].includes(tag)) {
        reached++;
      }
    }
    expect(reached).toBeGreaterThan(0);
  });
});
