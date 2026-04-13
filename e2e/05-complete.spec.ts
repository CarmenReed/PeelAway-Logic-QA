import { test, expect } from "@playwright/test";
import {
  goToLanding,
  loginAsGuest,
  waitForPhase,
  dismissBanners,
  mockAnthropicApi,
} from "./fixtures/test-helpers";

/**
 * Complete Phase E2E tests — document generation, downloads, applied-job tracking, reset.
 * User stories: US-COMP-001 through US-COMP-005 (includes former US-TAIL stories).
 *
 * The Complete phase is the final stage of the PeelAway Logic pipeline.
 * Users generate tailored resumes and cover letters per job, download
 * documents, mark jobs as applied, and start a new search. Applied-job
 * state is persisted in localStorage under "jsp-applied-jobs".
 * Document generation state is persisted under "jsp-tailor-results".
 *
 * Tests requiring full pipeline data are marked test.fixme().
 * localStorage-backed features are tested directly via page.evaluate().
 */

test.describe("Complete Phase (US-COMP-001 to US-COMP-005)", () => {
  test.beforeEach(async ({ page }) => {
    await goToLanding(page);
    await dismissBanners(page);
  });

  // US-COMP-001: Document generation buttons appear on Complete phase
  test.fixme(
    "document generation buttons (Create Resume, Create Cover Letter) appear on each job card",
    async ({ page }) => {
      // Requires: approved jobs from Review phase.
      // Expected: each job card shows "Create Resume" and "Create Cover Letter"
      // buttons that trigger one API call each on demand.
      await loginAsGuest(page);
      await waitForPhase(page, "Complete");

      const firstCard = page.locator(".card").first();
      await expect(firstCard.getByText(/Create Resume/i)).toBeVisible();
      await expect(firstCard.getByText(/Create Cover Letter/i)).toBeVisible();
    },
  );

  // US-COMP-001: Job posting link is visible on each job card
  test.fixme(
    "job posting link is visible and clickable on each job card",
    async ({ page }) => {
      // Requires: approved jobs from Review phase.
      // Expected: each job card shows a "View Posting" link that opens
      // the original job URL in a new tab.
      await loginAsGuest(page);
      await waitForPhase(page, "Complete");

      const viewLink = page.getByText("View Posting").first();
      await expect(viewLink).toBeVisible();
      await expect(viewLink).toHaveAttribute("target", "_blank");
    },
  );

  // US-COMP-002: Status chips update through Pending -> Generating... -> Ready
  test.fixme(
    "status chips update from Pending to Generating to Ready",
    async ({ page }) => {
      // Requires: approved job data in Complete phase with mocked API.
      // Expected: each job card shows a status chip that progresses
      // through "Pending" -> "Generating..." -> "Ready" as documents generate.
      await mockAnthropicApi(page);
      await loginAsGuest(page);
      await waitForPhase(page, "Complete");

      const firstCard = page.locator(".card").first();
      const statusChip = firstCard.locator(
        ".status-chip, [data-testid='status-chip']",
      );

      await expect(statusChip).toContainText(/Pending/i);

      const resumeBtn = firstCard.getByText(/Create Resume/i);
      await resumeBtn.click();

      await expect(statusChip).toContainText(/Generating/i, { timeout: 5_000 });
      await expect(statusChip).toContainText(/Ready/i, { timeout: 30_000 });
    },
  );

  // US-COMP-002: Download format selector is present
  test.fixme(
    "download format selector offers txt, md, and pdf options",
    async ({ page }) => {
      // Requires: approved jobs in Complete phase.
      await loginAsGuest(page);
      await waitForPhase(page, "Complete");

      const formatSelector = page.locator("select.form-select").first();
      await expect(formatSelector).toBeVisible();
      await expect(formatSelector.locator("option")).toHaveCount(3);
    },
  );

  // US-COMP-003: Generated documents are available with download buttons
  test.fixme(
    "generated documents are available with download buttons after generation",
    async ({ page }) => {
      // Requires: completed document generation from API calls.
      // Expected: after generating both resume and cover letter,
      // download buttons appear for each document.
      await loginAsGuest(page);
      await waitForPhase(page, "Complete");

      const downloadBtns = page.locator(
        "button:has-text('Download'), a:has-text('Download'), [data-testid='download-btn']",
      );
      await expect(downloadBtns.first()).toBeVisible();
    },
  );

  // US-COMP-003: "Mark Applied" button is present on unapplied jobs with documents
  test.fixme(
    "Mark Applied button is present on jobs with completed documents",
    async ({ page }) => {
      // Requires: completed pipeline data in Complete phase.
      await loginAsGuest(page);
      await waitForPhase(page, "Complete");

      const markAppliedBtn = page.getByText(/Mark Applied/i).first();
      await expect(markAppliedBtn).toBeVisible();
      await expect(markAppliedBtn).toBeEnabled();
    },
  );

  // US-COMP-004: localStorage persistence of tailor results
  // This test CAN run because it seeds data directly via page.evaluate().
  test("localStorage persists jsp-tailor-results across reload", async ({
    page,
  }) => {
    await loginAsGuest(page);

    const mockTailorResults = [
      {
        jobId: "mock-001",
        title: "Senior Software Engineer",
        company: "Acme Corp",
        resume: "Tailored resume content for Acme Corp position.",
        coverLetter: "Dear Hiring Manager, I am excited to apply...",
        status: "ready",
      },
      {
        jobId: "mock-002",
        title: "Full Stack Developer",
        company: "TechStart Inc",
        resume: null,
        coverLetter: null,
        status: "pending",
      },
    ];

    // Seed localStorage with tailor results
    await page.evaluate((data) => {
      localStorage.setItem("jsp-tailor-results", JSON.stringify(data));
    }, mockTailorResults);

    // Reload the page
    await page.reload();
    await dismissBanners(page);

    // Verify data persisted
    const persisted = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem("jsp-tailor-results") || "null");
    });

    expect(persisted).not.toBeNull();
    expect(persisted).toHaveLength(2);
    expect(persisted[0].jobId).toBe("mock-001");
    expect(persisted[0].status).toBe("ready");
    expect(persisted[0].resume).toContain("Acme Corp");
    expect(persisted[1].status).toBe("pending");
  });

  // US-COMP-004: localStorage persistence of applied jobs
  test("localStorage persists jsp-applied-jobs across reload", async ({
    page,
  }) => {
    await loginAsGuest(page);

    const mockAppliedJobs = [
      {
        jobId: "mock-001",
        title: "Senior Software Engineer",
        company: "Acme Corp",
        appliedAt: "2026-04-10T14:30:00.000Z",
      },
      {
        jobId: "mock-002",
        title: "Full Stack Developer",
        company: "TechStart Inc",
        appliedAt: "2026-04-11T09:15:00.000Z",
      },
    ];

    // Seed localStorage with applied jobs
    await page.evaluate((data) => {
      localStorage.setItem("jsp-applied-jobs", JSON.stringify(data));
    }, mockAppliedJobs);

    // Reload the page
    await page.reload();
    await dismissBanners(page);

    // Verify data persisted across reload
    const persisted = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem("jsp-applied-jobs") || "null");
    });

    expect(persisted).not.toBeNull();
    expect(persisted).toHaveLength(2);
    expect(persisted[0].jobId).toBe("mock-001");
    expect(persisted[0].company).toBe("Acme Corp");
    expect(persisted[1].jobId).toBe("mock-002");
    expect(persisted[1].appliedAt).toBe("2026-04-11T09:15:00.000Z");
  });

  // US-COMP-004: localStorage clear removes applied jobs
  test("clearing jsp-applied-jobs from localStorage removes all data", async ({
    page,
  }) => {
    await loginAsGuest(page);

    const mockAppliedJobs = [
      {
        jobId: "mock-001",
        title: "Senior Software Engineer",
        company: "Acme Corp",
        appliedAt: "2026-04-10T14:30:00.000Z",
      },
    ];

    await page.evaluate((data) => {
      localStorage.setItem("jsp-applied-jobs", JSON.stringify(data));
    }, mockAppliedJobs);

    const beforeClear = await page.evaluate(() => {
      return localStorage.getItem("jsp-applied-jobs");
    });
    expect(beforeClear).not.toBeNull();

    await page.evaluate(() => {
      localStorage.removeItem("jsp-applied-jobs");
    });

    const afterClear = await page.evaluate(() => {
      return localStorage.getItem("jsp-applied-jobs");
    });
    expect(afterClear).toBeNull();

    await page.reload();
    await dismissBanners(page);

    const afterReload = await page.evaluate(() => {
      const raw = localStorage.getItem("jsp-applied-jobs");
      return raw ? JSON.parse(raw) : [];
    });
    expect(afterReload).toEqual([]);
  });

  // US-COMP-005: Applied chip shows on jobs marked as applied
  test.fixme(
    "applied chip displays on jobs that have been marked as applied",
    async ({ page }) => {
      await loginAsGuest(page);
      await waitForPhase(page, "Complete");

      const markAppliedBtn = page.getByText(/Mark Applied/i).first();
      await markAppliedBtn.click();

      const appliedChip = page.locator(
        ".applied-chip, [data-testid='applied-chip'], .chip:has-text('Applied')",
      );
      await expect(appliedChip.first()).toBeVisible({ timeout: 5_000 });
    },
  );

  // US-COMP-005: "New Search" button resets the pipeline to Scout phase
  test.fixme(
    "New Search button resets pipeline to Scout phase",
    async ({ page }) => {
      await loginAsGuest(page);
      await waitForPhase(page, "Complete");

      const newSearchBtn = page.getByText(/New Search/i);
      await expect(newSearchBtn).toBeVisible();
      await newSearchBtn.click();

      await waitForPhase(page, "Scout");

      const uploadBtn = page.getByText("Upload Resume", { exact: false });
      await expect(uploadBtn).toBeVisible();
    },
  );

  // Mid-run failure on one job does not affect others
  test.fixme(
    "mid-run failure on one job does not affect other job cards",
    async ({ page }) => {
      // Requires: multiple approved jobs in Complete phase.
      await loginAsGuest(page);
      await waitForPhase(page, "Complete");

      let callCount = 0;
      await page.route("**/api.anthropic.com/v1/messages", (route) => {
        callCount++;
        if (callCount === 2) {
          route.fulfill({ status: 500, body: "Internal Server Error" });
        } else {
          route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              id: `msg_mock_${callCount}`,
              type: "message",
              role: "assistant",
              model: "claude-sonnet-4-6",
              content: [{ type: "text", text: "Generated content here." }],
              stop_reason: "end_turn",
              stop_sequence: null,
              usage: { input_tokens: 50, output_tokens: 30 },
            }),
          });
        }
      });

      const cards = page.locator(".card");
      const firstCard = cards.first();
      const secondCard = cards.nth(1);

      await firstCard.getByText(/Create Resume/i).click();
      await secondCard.getByText(/Create Resume/i).click();

      // First card should succeed
      await expect(
        firstCard.locator(".status-chip, [data-testid='status-chip']"),
      ).toContainText(/Ready/i, { timeout: 30_000 });

      // Second card should show error but not crash
      await expect(
        secondCard.locator(".status-chip, [data-testid='status-chip'], .error"),
      ).toBeVisible({ timeout: 30_000 });
    },
  );
});
