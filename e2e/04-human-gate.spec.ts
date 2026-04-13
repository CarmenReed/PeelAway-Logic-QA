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
 * Human Gate E2E tests — Review phase job selection and advance controls.
 * User stories: US-GATE-001 through US-GATE-005.
 *
 * The Human Gate is the core design principle of PeelAway Logic: nothing
 * happens without explicit user intent. In the Review phase, users must
 * manually select which scored jobs to advance into the Complete phase.
 * No API calls fire, no AI processing begins, until the user clicks
 * "Advance to Complete" with at least one job selected.
 *
 * Most tests here require scored job data from the Search phase, which is
 * difficult to reach through pure navigation in E2E. These are marked
 * test.fixme() with clear descriptions of what they verify.
 */

test.describe("Human Gate — Review Phase (US-GATE-001 to US-GATE-005)", () => {
  test.beforeEach(async ({ page }) => {
    await goToLanding(page);
    await dismissBanners(page);
  });

  // US-GATE-001: Job cards in Strong and Possible tiers have selection checkboxes
  test.fixme(
    "job cards in Strong and Possible tiers have checkboxes for selection",
    async ({ page }) => {
      // Requires: scored job data populated in Review phase.
      // Expected: each job card in the Strong and Possible tiers renders
      // a checkbox input that the user can toggle to select/deselect.
      await loginAsGuest(page);
      await waitForPhase(page, "Review");

      const checkboxes = page.locator(
        ".job-card input[type='checkbox'], .job-card [role='checkbox']",
      );
      await expect(checkboxes.first()).toBeVisible();
      const count = await checkboxes.count();
      expect(count).toBeGreaterThan(0);
    },
  );

  // US-GATE-002: Selecting a job increments the count in "Advance to Complete (N)"
  test.fixme(
    "selecting a job increments the selected count in Advance to Complete button",
    async ({ page }) => {
      // Requires: scored job data in Review phase.
      // Expected: the "Advance to Complete" button displays a count of
      // selected jobs, e.g. "Advance to Complete (1)" after one selection.
      await loginAsGuest(page);
      await waitForPhase(page, "Review");

      const advanceBtn = page.getByText(/Advance to Complete/i);
      await expect(advanceBtn).toContainText("(0)");

      const firstCheckbox = page
        .locator(".job-card input[type='checkbox'], .job-card [role='checkbox']")
        .first();
      await firstCheckbox.click();

      await expect(advanceBtn).toContainText("(1)");
    },
  );

  // US-GATE-003: Deselecting a job decrements the count
  test.fixme(
    "deselecting a job decrements the selected count",
    async ({ page }) => {
      // Requires: scored job data in Review phase.
      // Expected: toggling a checkbox off reduces the count back down.
      await loginAsGuest(page);
      await waitForPhase(page, "Review");

      const advanceBtn = page.getByText(/Advance to Complete/i);
      const firstCheckbox = page
        .locator(".job-card input[type='checkbox'], .job-card [role='checkbox']")
        .first();

      // Select then deselect
      await firstCheckbox.click();
      await expect(advanceBtn).toContainText("(1)");

      await firstCheckbox.click();
      await expect(advanceBtn).toContainText("(0)");
    },
  );

  // US-GATE-004: "Advance to Complete" is disabled when 0 jobs selected
  test.fixme(
    "Advance to Complete button is disabled when no jobs are selected",
    async ({ page }) => {
      // Requires: scored job data in Review phase.
      // Expected: the button is present but disabled (not clickable)
      // when the selection count is zero, enforcing the human gate.
      await loginAsGuest(page);
      await waitForPhase(page, "Review");

      const advanceBtn = page.getByText(/Advance to Complete/i);
      await expect(advanceBtn).toBeVisible();
      await expect(advanceBtn).toBeDisabled();
    },
  );

  // US-GATE-005: "Select All" in Strong tier selects all strong-tier jobs
  test.fixme(
    "Select All button in Strong tier selects all strong jobs",
    async ({ page }) => {
      // Requires: scored job data with multiple Strong-tier results.
      // Expected: clicking "Select All" within the Strong tier checks
      // every job card checkbox in that tier.
      await loginAsGuest(page);
      await waitForPhase(page, "Review");

      const selectAllBtn = page.getByText(/Select All/i).first();
      await selectAllBtn.click();

      const strongSection = page.locator("[data-tier='strong'], .tier-strong").first();
      const checkboxes = strongSection.locator(
        "input[type='checkbox'], [role='checkbox']",
      );
      const count = await checkboxes.count();
      for (let i = 0; i < count; i++) {
        await expect(checkboxes.nth(i)).toBeChecked();
      }
    },
  );

  // US-GATE-001 (supplemental): No API calls fire until explicit "Advance to Complete" click
  test.fixme(
    "no API calls fire until user explicitly clicks Advance to Complete",
    async ({ page }) => {
      // Requires: scored job data in Review phase.
      // This test verifies the human-gated design principle:
      // browsing and selecting jobs must NOT trigger any outbound API
      // requests. Only clicking "Advance to Complete" should initiate
      // the next processing stage.
      await loginAsGuest(page);
      await waitForPhase(page, "Review");

      const apiCalls: string[] = [];
      await page.route("**/*", (route) => {
        const url = route.request().url();
        if (
          url.includes("anthropic.com") ||
          url.includes("api.") ||
          url.includes("rapidapi.com")
        ) {
          apiCalls.push(url);
        }
        route.continue();
      });

      // Select a job — should NOT trigger any API calls
      const firstCheckbox = page
        .locator(".job-card input[type='checkbox'], .job-card [role='checkbox']")
        .first();
      await firstCheckbox.click();

      // Wait briefly to ensure no async calls fire
      await page.waitForTimeout(2000);
      expect(apiCalls).toHaveLength(0);
    },
  );
});
