import { render, screen } from "@testing-library/react";
import ScoutPhase from "../phases/ScoutPhase";

// Mock constants so ANTHROPIC_API_KEY resolves to a test value
jest.mock("../constants", () => ({
  ANTHROPIC_API_KEY: "test-key-123",
  SCORING_MODEL: "claude-haiku-4-5-20251001",
  SCORING_BATCH_SIZE: 8,
  SCORING_BATCH_DELAY_MS: 0,
  ADZUNA_APP_ID: "",
  ADZUNA_APP_KEY: "",
  RAPIDAPI_KEY: "",
}));

// Mock all API functions — no network calls
jest.mock("../api", () => ({
  withRetry: jest.fn((fn) => fn()),
  callAnthropic: jest.fn(),
  callAnthropicWithLoop: jest.fn(),
  extractTextFromPdf: jest.fn(),
}));

// Mock storage — no side effects
jest.mock("../storage", () => ({
  saveLastScoutResults: jest.fn(),
  loadDismissedJobs: jest.fn(() => []),
  isDismissed: jest.fn(() => false),
}));

// Suppress fetch — ScoutPhase does not fetch during render
beforeEach(() => {
  global.fetch = jest.fn();
  localStorage.clear();
});

const LONG_PROFILE = "A".repeat(60); // > 50 chars

function renderScout({ profileText = "", setProfileText = jest.fn(), appliedList = [], onComplete = jest.fn() } = {}) {
  return render(
    <ScoutPhase
      profileText={profileText}
      setProfileText={setProfileText}
      appliedList={appliedList}
      onComplete={onComplete}
    />
  );
}

// ============================================================
// Initial render
// ============================================================

describe("ScoutPhase — initial render", () => {
  it("renders the upload resume button", () => {
    renderScout();
    expect(screen.getByText("Upload Resume (PDF or TXT)")).toBeInTheDocument();
  });

  it("renders the guide banner", () => {
    renderScout();
    expect(screen.getByText(/Upload your resume/i)).toBeInTheDocument();
  });

  it("renders all 3 search layer buttons", () => {
    renderScout();
    expect(screen.getByText("Job Boards")).toBeInTheDocument();
    expect(screen.getByText("RSS Feeds")).toBeInTheDocument();
    expect(screen.getByText("ATS Boards")).toBeInTheDocument();
  });

  it("renders the Quick Score section", () => {
    renderScout();
    expect(screen.getByText(/Quick Score/i)).toBeInTheDocument();
  });

  it("renders Score & Review button", () => {
    renderScout();
    expect(screen.getByText(/Score & Review/i)).toBeInTheDocument();
  });
});

// ============================================================
// Layer button disabled state based on profileText
// ============================================================

describe("ScoutPhase — layer button disabled state", () => {
  it("Job Boards button is disabled when no profileText", () => {
    renderScout({ profileText: "" });
    // Find the search-btn containing "Job Boards"
    const layerSection = screen.getByText("Job Boards").closest("button");
    expect(layerSection).toBeDisabled();
  });

  it("RSS Feeds button is disabled when no profileText", () => {
    renderScout({ profileText: "" });
    const layerSection = screen.getByText("RSS Feeds").closest("button");
    expect(layerSection).toBeDisabled();
  });

  it("ATS Boards button is disabled when no profileText", () => {
    renderScout({ profileText: "" });
    const layerSection = screen.getByText("ATS Boards").closest("button");
    expect(layerSection).toBeDisabled();
  });

  it("Job Boards button is enabled when profileText has > 50 chars", () => {
    renderScout({ profileText: LONG_PROFILE });
    const layerSection = screen.getByText("Job Boards").closest("button");
    expect(layerSection).not.toBeDisabled();
  });

  it("RSS Feeds button is enabled when profileText has > 50 chars", () => {
    renderScout({ profileText: LONG_PROFILE });
    const layerSection = screen.getByText("RSS Feeds").closest("button");
    expect(layerSection).not.toBeDisabled();
  });

  it("ATS Boards button is enabled when profileText has > 50 chars", () => {
    renderScout({ profileText: LONG_PROFILE });
    const layerSection = screen.getByText("ATS Boards").closest("button");
    expect(layerSection).not.toBeDisabled();
  });
});

// ============================================================
// Score & Review button state
// ============================================================

describe("ScoutPhase — Score & Review button", () => {
  it("Score & Review button is disabled with 0 raw jobs (no layers run)", () => {
    renderScout();
    const btn = screen.getByText(/Score & Review/i);
    expect(btn).toBeDisabled();
  });

  it("shows hint text when no layers have run", () => {
    renderScout();
    expect(screen.getByText(/Run at least one search layer before scoring/i)).toBeInTheDocument();
  });
});

// ============================================================
// Tab toggle — upload vs paste
// ============================================================

describe("ScoutPhase — resume input tabs", () => {
  it("shows Upload PDF/TXT tab by default", () => {
    renderScout();
    expect(screen.getByText("Upload PDF/TXT")).toBeInTheDocument();
  });

  it("shows Paste Resume Text tab", () => {
    renderScout();
    expect(screen.getByText("Paste Resume Text")).toBeInTheDocument();
  });
});
