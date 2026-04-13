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
 * Review phase E2E tests.
 * User stories: US-REV-001 through US-REV-004.
 *
 * The Review phase requires scored job results from the Search phase.
 * Tests that need full pipeline traversal with real scored data are
 * marked with test.fixme() since they require the Anthropic API to
 * score results into tiers. Structural tests that verify reachable
 * UI elements are run normally.
 */

const FAKE_RESUME = [
  "Carmen Reed",
  "Solutions Architect",
  "10+ years experience in enterprise software architecture, full-stack .NET development, and AI integration.",
  "Skills: React, Node.js, Azure, C#, TypeScript, Python",
  "Location: Tampa, FL",
  "Experience: Senior Solutions Architect at TechCorp (2019-present)",
  "Led migration of monolithic .NET Framework application to microservices on Azure Kubernetes Service.",
  "Designed and implemented real-time data pipelines processing 2M+ events per day.",
].join("\n");

/**
 * Navigate through landing -> scout -> search to reach the Search phase.
 * This is the furthest we can reliably get without real scored results.
 */
async function navigateToSearch(page: import("@playwright/test").Page) {
  await mockAnthropicApi(page);
  await mockSearchApis(page);

  await goToLanding(page);
  await dismissBanners(page);
  await loginAsGuest(page);
  await waitForPhase(page, "Scout");

  const pasteTab = page.getByText("Paste Resume Text", { exact: false });
  await pasteTab.click();

  const textarea = page.locator("textarea").first();
  await textarea.fill(FAKE_RESUME);

  const extractBtn = page.getByText(/extract|analyze|parse|submit/i).first();
  if (await extractBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await extractBtn.click();
  }

  await expect(
    page.getByText("Review Extracted Profile", { exact: false }),
  ).toBeVisible({ timeout: 15_000 });

  const continueBtn = page.getByText("Continue to Search", { exact: false });
  await expect(continueBtn).toBeVisible({ timeout: 10_000 });
  await continueBtn.click();

  await waitForPhase(page, "Search");
}

test.describe("Review Phase", () => {
  // US-REV-001: Review phase shows tier tabs
  test.fixme(
    'shows tier tabs: "Strong", "Possible", "Weak" after scoring',
    async ({ page }) => {
      await navigateToSearch(page);

      await expect(
        page.getByText("Strong", { exact: false }),
      ).toBeVisible();
      await expect(
        page.getByText("Possible", { exact: false }),
      ).toBeVisible();
      await expect(page.getByText("Weak", { exact: false })).toBeVisible();
    },
  );

  // US-REV-002: Sort dropdown is present with options
  test.fixme(
    "sort dropdown is present with Score, Date Posted, Company options",
    async ({ page }) => {
      await navigateToSearch(page);

      const sortDropdown = page.locator("select, [role='listbox']").first();
      await expect(sortDropdown).toBeVisible();

      await expect(page.getByText("Score", { exact: false })).toBeVisible();
      await expect(
        page.getByText("Date Posted", { exact: false }),
      ).toBeVisible();
      await expect(page.getByText("Company", { exact: false })).toBeVisible();
    },
  );

  // US-REV-003: Advance to Complete button shows selected count, disabled when none
  test.fixme(
    '"Advance to Complete" button shows selected count and is disabled when none selected',
    async ({ page }) => {
      await navigateToSearch(page);

      const advanceBtn = page.getByText("Advance to Complete", { exact: false });
      await expect(advanceBtn).toBeVisible();
      await expect(
        page.getByRole("button", { name: /advance to complete/i }),
      ).toBeDisabled();
    },
  );

  // US-REV-004: Tier tab buttons show job counts in parentheses
  test.fixme(
    "tier tab buttons show job counts in parentheses",
    async ({ page }) => {
      await navigateToSearch(page);

      const tierWithCount = page.locator("button", {
        hasText: /\(\d+\)/,
      });
      await expect(tierWithCount.first()).toBeVisible();
    },
  );

  // US-REV-004 (supplemental): Guide bar shows contextual text for Review
  test.fixme(
    "guide bar shows contextual text for Review phase",
    async ({ page }) => {
      await navigateToSearch(page);

      const guide = page.locator(".guide");
      await expect(guide).toBeVisible();

      const guideText = page.locator(".guide-text");
      await expect(guideText).toBeVisible();
      await expect(guideText).toContainText(/review|select|pick|choose/i);
    },
  );
});

test.describe("Review Phase - reachable structural checks", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToSearch(page);
  });

  test("Search phase is reachable and renders correctly before Review", async ({
    page,
  }) => {
    const currentLabel = page.locator(".step-label.current-label", {
      hasText: "Search",
    });
    await expect(currentLabel).toBeVisible();

    const scoreBtn = page.getByText("Score & Review", { exact: false });
    await expect(scoreBtn.first()).toBeVisible({ timeout: 10_000 });
  });

  // Verify the stepper shows all 4 phases including Review
  test("progress stepper shows all 4 phases including Review", async ({
    page,
  }) => {
    const phases = ["Scout", "Search", "Review", "Complete"];
    for (const phase of phases) {
      const label = page.locator(".step-label", { hasText: phase });
      await expect(label).toBeVisible();
    }
  });

  test("guide bar component is present and functional on Search phase", async ({
    page,
  }) => {
    const guide = page.locator(".guide");
    await expect(guide).toBeVisible();

    const guideEmoji = page.locator(".guide-emoji");
    await expect(guideEmoji).toBeVisible();

    const guideText = page.locator(".guide-text");
    await expect(guideText).toBeVisible();
  });
});
