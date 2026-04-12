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

function renderScout({ profileText = "", setProfileText = jest.fn(), extractedProfile = null, setExtractedProfile = jest.fn(), appliedList = [], onComplete = jest.fn() } = {}) {
  return render(
    <ScoutPhase
      profileText={profileText}
      setProfileText={setProfileText}
      extractedProfile={extractedProfile}
      setExtractedProfile={setExtractedProfile}
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

  it("renders the Quick Score section inside Step 3", () => {
    renderScout();
    expect(screen.getByText(/Quick Score a Job/i)).toBeInTheDocument();
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
    expect(screen.getByText(/Run at least one search layer/i)).toBeInTheDocument();
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

// ============================================================
// Search filters
// ============================================================

describe("ScoutPhase — search filters", () => {
  it("renders Work Type filter with default 'Remote'", () => {
    renderScout();
    const select = screen.getByDisplayValue("Remote");
    expect(select).toBeInTheDocument();
  });

  it("renders Posted Within filter with default 'Last Week'", () => {
    renderScout();
    const select = screen.getByDisplayValue("Last Week");
    expect(select).toBeInTheDocument();
  });

  it("renders Employment filter with default 'Full-Time'", () => {
    renderScout();
    const select = screen.getByDisplayValue("Full-Time");
    expect(select).toBeInTheDocument();
  });

  it("renders Zip Code input", () => {
    renderScout();
    expect(screen.getByPlaceholderText("e.g. 33602")).toBeInTheDocument();
  });

  it("renders Radius filter with default '25 miles'", () => {
    renderScout();
    const select = screen.getByDisplayValue("25 miles");
    expect(select).toBeInTheDocument();
  });

  it("disables Zip Code and Radius when work type is Remote", () => {
    renderScout();
    expect(screen.getByPlaceholderText("e.g. 33602")).toBeDisabled();
    expect(screen.getByDisplayValue("25 miles")).toBeDisabled();
  });
});

// ============================================================
// Extracted profile display
// ============================================================

describe("ScoutPhase — extracted profile", () => {
  const mockProfile = {
    name: "Jane Doe",
    skills: ["React", "Node.js", "Python"],
    yearsExperience: 10,
    targetLevel: ["Senior", "Lead"],
    location: ["remote"],
    searchQueries: {
      adzuna: ["Senior React Developer"],
      jsearch: ["Senior React Developer remote"],
    },
  };

  it("does not show extracted profile when no profile is set", () => {
    renderScout({ profileText: LONG_PROFILE });
    expect(screen.queryByText(/Review Extracted Skills/i)).not.toBeInTheDocument();
  });

  it("shows extracted profile when profile is set and has profile text", () => {
    renderScout({ profileText: LONG_PROFILE, extractedProfile: mockProfile });
    expect(screen.getByText(/Review Extracted Skills and Keywords/i)).toBeInTheDocument();
  });

  it("displays extracted name", () => {
    renderScout({ profileText: LONG_PROFILE, extractedProfile: mockProfile });
    expect(screen.getByDisplayValue("Jane Doe")).toBeInTheDocument();
  });

  it("displays extracted skills as tags", () => {
    renderScout({ profileText: LONG_PROFILE, extractedProfile: mockProfile });
    expect(screen.getByText("React")).toBeInTheDocument();
    expect(screen.getByText("Node.js")).toBeInTheDocument();
    expect(screen.getByText("Python")).toBeInTheDocument();
  });

  it("displays target level checkboxes with correct checked state", () => {
    renderScout({ profileText: LONG_PROFILE, extractedProfile: mockProfile });
    const seniorCheckbox = screen.getByRole("checkbox", { name: "Senior" });
    const leadCheckbox = screen.getByRole("checkbox", { name: "Lead" });
    const juniorCheckbox = screen.getByRole("checkbox", { name: "Junior" });
    expect(seniorCheckbox).toBeChecked();
    expect(leadCheckbox).toBeChecked();
    expect(juniorCheckbox).not.toBeChecked();
  });

  it("displays search queries", () => {
    renderScout({ profileText: LONG_PROFILE, extractedProfile: mockProfile });
    expect(screen.getByDisplayValue("Senior React Developer remote")).toBeInTheDocument();
  });
});
