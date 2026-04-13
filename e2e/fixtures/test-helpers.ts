import { Page, expect } from "@playwright/test";

/**
 * Click the "Start as Guest" button on the landing screen to begin
 * the pipeline as an unauthenticated user.
 */
export async function loginAsGuest(page: Page): Promise<void> {
  const btn = page.getByText("Start as Guest", { exact: false });
  await expect(btn).toBeVisible({ timeout: 15_000 });
  await btn.click();
}

/**
 * Wait until a given phase name (e.g. "Scout", "Search", "Review",
 * "Complete") is visible and marked as the current step
 * in the progress stepper.
 */
export async function waitForPhase(
  page: Page,
  phaseName: string,
): Promise<void> {
  const label = page.locator(".step-label.current-label", {
    hasText: phaseName,
  });
  await expect(label).toBeVisible({ timeout: 15_000 });
}

/**
 * Intercept calls to the Anthropic Messages API and return a canned
 * successful response so tests never hit the real API.
 */
export async function mockAnthropicApi(page: Page): Promise<void> {
  await page.route("**/api.anthropic.com/v1/messages", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "msg_mock_001",
        type: "message",
        role: "assistant",
        model: "claude-sonnet-4-6",
        content: [
          {
            type: "text",
            text: '{"queries":["software engineer remote","senior developer"]}',
          },
        ],
        stop_reason: "end_turn",
        stop_sequence: null,
        usage: { input_tokens: 50, output_tokens: 30 },
      }),
    });
  });
}

/**
 * Intercept calls to Adzuna, JSearch (RapidAPI), and common RSS job
 * feeds so tests run offline with deterministic data.
 */
export async function mockSearchApis(page: Page): Promise<void> {
  // Adzuna
  await page.route("**/api.adzuna.com/**", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        results: [
          {
            id: "adzuna-001",
            title: "Senior Software Engineer",
            company: { display_name: "Acme Corp" },
            location: { display_name: "Remote" },
            description: "Build scalable distributed systems.",
            redirect_url: "https://example.com/job/adzuna-001",
            created: new Date().toISOString(),
            salary_min: 120000,
            salary_max: 160000,
          },
        ],
      }),
    });
  });

  // JSearch via RapidAPI
  await page.route("**/jsearch.p.rapidapi.com/**", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: "OK",
        data: [
          {
            job_id: "jsearch-001",
            job_title: "Full Stack Developer",
            employer_name: "TechStart Inc",
            job_city: "Remote",
            job_state: "US",
            job_description: "Work on React and Node.js applications.",
            job_apply_link: "https://example.com/job/jsearch-001",
            job_posted_at_datetime_utc: new Date().toISOString(),
            job_min_salary: 110000,
            job_max_salary: 150000,
          },
        ],
      }),
    });
  });

  // RSS feeds (WeWorkRemotely, Remotive, RemoteOK, Himalayas, Jobicy)
  const rssBody = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Mock Remote Jobs</title>
    <item>
      <title>Backend Engineer (Remote)</title>
      <link>https://example.com/job/rss-001</link>
      <description>Design and maintain APIs and microservices.</description>
      <pubDate>${new Date().toUTCString()}</pubDate>
    </item>
  </channel>
</rss>`;

  await page.route("**/weworkremotely.com/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/rss+xml", body: rssBody }),
  );
  await page.route("**/remotive.com/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/rss+xml", body: rssBody }),
  );
  await page.route("**/remoteok.com/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/rss+xml", body: rssBody }),
  );
  await page.route("**/himalayas.app/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/rss+xml", body: rssBody }),
  );
  await page.route("**/jobicy.com/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/rss+xml", body: rssBody }),
  );
}

/** Tier labels used in scout results. */
type Tier = "Great Match" | "Good Match" | "Worth a Look";

interface MockJob {
  id: string;
  title: string;
  company: string;
  location: string;
  url: string;
  score: number;
  tier: Tier;
  source: string;
  snippet: string;
}

interface MockScoutResults {
  jobs: MockJob[];
  tiers: Record<Tier, MockJob[]>;
}

/**
 * Return a realistic mock scout-results data structure with tiered
 * jobs, suitable for seeding the Review or Complete phases in tests.
 */
export function getMockJobResults(): MockScoutResults {
  const jobs: MockJob[] = [
    {
      id: "mock-001",
      title: "Senior Software Engineer",
      company: "Acme Corp",
      location: "Remote",
      url: "https://example.com/job/mock-001",
      score: 92,
      tier: "Great Match",
      source: "adzuna",
      snippet: "Build scalable distributed systems with React and Node.js.",
    },
    {
      id: "mock-002",
      title: "Full Stack Developer",
      company: "TechStart Inc",
      location: "Remote",
      url: "https://example.com/job/mock-002",
      score: 78,
      tier: "Good Match",
      source: "jsearch",
      snippet: "Work on modern web applications using TypeScript.",
    },
    {
      id: "mock-003",
      title: "Backend Engineer",
      company: "DataFlow LLC",
      location: "New York, NY",
      url: "https://example.com/job/mock-003",
      score: 61,
      tier: "Worth a Look",
      source: "weworkremotely",
      snippet: "Design and maintain APIs and microservices.",
    },
  ];

  const tiers: Record<Tier, MockJob[]> = {
    "Great Match": jobs.filter((j) => j.tier === "Great Match"),
    "Good Match": jobs.filter((j) => j.tier === "Good Match"),
    "Worth a Look": jobs.filter((j) => j.tier === "Worth a Look"),
  };

  return { jobs, tiers };
}

/**
 * Navigate to the app root and wait for the landing page to be ready.
 */
export async function goToLanding(page: Page): Promise<void> {
  await page.goto("/");
  await expect(
    page.getByText("Start as Guest", { exact: false }),
  ).toBeVisible({ timeout: 15_000 });
}

/**
 * Dismiss any environment banners (e.g. QA banner) that might overlay
 * interactive elements.
 */
export async function dismissBanners(page: Page): Promise<void> {
  const banner = page.locator("[data-testid='env-banner-close']");
  if (await banner.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await banner.click();
  }
}
