import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ReviewPhase from "../phases/ReviewPhase";

// Mock storage to suppress dismissed job writes
jest.mock("../storage", () => ({
  saveDismissedJob: jest.fn(),
}));

// ============================================================
// Test fixtures
// ============================================================

function makeJob(overrides = {}) {
  return {
    title: "Senior Engineer",
    company: "Acme",
    location: "Remote",
    url: "https://acme.com/job/1",
    total_score: 9,
    skills_fit: 4,
    level_fit: 4,
    reasoning: "Good fit",
    key_tech_stack: ["React"],
    status: "active",
    ...overrides,
  };
}

const STRONG_JOB = makeJob({ title: "Senior Engineer", company: "Acme", url: "https://acme.com/1", total_score: 9 });
const POSSIBLE_JOB = makeJob({ title: "Mid Engineer", company: "Globex", url: "https://globex.com/1", total_score: 7 });
const WEAK_JOB = makeJob({ title: "Junior Engineer", company: "Initech", url: "https://initech.com/1", total_score: 4 });

const SCOUT_RESULTS = {
  summary: "Found 3 jobs",
  tiers: {
    strong_match: [STRONG_JOB],
    possible: [POSSIBLE_JOB],
    weak: [WEAK_JOB],
    rejected: [],
  },
};

const EMPTY_SCOUT_RESULTS = {
  summary: "Found 0 jobs",
  tiers: { strong_match: [], possible: [], weak: [], rejected: [] },
};

function renderReview({ scoutResults = SCOUT_RESULTS, appliedList = [], onAdvance = jest.fn(), demoMode = false } = {}) {
  return render(
    <ReviewPhase
      scoutResults={scoutResults}
      appliedList={appliedList}
      demoMode={demoMode}
      onAdvance={onAdvance}
    />
  );
}

beforeEach(() => {
  localStorage.clear();
});

// ============================================================
// Tier tabs render
// ============================================================

describe("ReviewPhase — tier tabs", () => {
  it("renders all 3 tier tab buttons", () => {
    renderReview();
    expect(screen.getByText(/Strong/i)).toBeInTheDocument();
    expect(screen.getByText(/Possible/i)).toBeInTheDocument();
    expect(screen.getByText(/Weak/i)).toBeInTheDocument();
  });

  it("shows job count in each tier tab", () => {
    renderReview();
    expect(screen.getByText(/Strong.*\(1\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Possible.*\(1\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Weak.*\(1\)/i)).toBeInTheDocument();
  });

  it("defaults to Strong Match tab (shows strong job)", () => {
    renderReview();
    expect(screen.getByText("Senior Engineer")).toBeInTheDocument();
    expect(screen.queryByText("Mid Engineer")).not.toBeInTheDocument();
  });

  it("shows summary text", () => {
    renderReview();
    expect(screen.getByText(/Found 3 jobs/)).toBeInTheDocument();
  });
});

// ============================================================
// Tab switching
// ============================================================

describe("ReviewPhase — tab switching", () => {
  it("clicking Possible tab shows possible jobs", async () => {
    const user = userEvent.setup();
    renderReview();
    await user.click(screen.getByText(/Possible/i));
    expect(screen.getByText("Mid Engineer")).toBeInTheDocument();
    expect(screen.queryByText("Senior Engineer")).not.toBeInTheDocument();
  });

  it("clicking Weak tab shows weak jobs", async () => {
    const user = userEvent.setup();
    renderReview();
    await user.click(screen.getByText(/Weak/i));
    expect(screen.getByText("Junior Engineer")).toBeInTheDocument();
  });

  it("switching back to Strong shows strong jobs again", async () => {
    const user = userEvent.setup();
    renderReview();
    await user.click(screen.getByText(/Possible/i));
    await user.click(screen.getByText(/Strong/i));
    expect(screen.getByText("Senior Engineer")).toBeInTheDocument();
  });
});

// ============================================================
// Empty tier
// ============================================================

describe("ReviewPhase — empty tier", () => {
  it("shows empty message when active tier has no jobs", async () => {
    const user = userEvent.setup();
    renderReview({ scoutResults: EMPTY_SCOUT_RESULTS });
    expect(screen.getByText(/No jobs in this tier/i)).toBeInTheDocument();
  });
});

// ============================================================
// Selection and Advance button
// ============================================================

describe("ReviewPhase — job selection", () => {
  it("Advance button is disabled when nothing selected", () => {
    renderReview();
    expect(screen.getByText(/Advance to Complete/i)).toBeDisabled();
  });

  it("Advance button is enabled after selecting a job", async () => {
    const user = userEvent.setup();
    renderReview();
    const checkbox = screen.getByRole("checkbox", { name: /Select Senior Engineer/i });
    await user.click(checkbox);
    expect(screen.getByText(/Advance to Complete \(1\)/i)).not.toBeDisabled();
  });

  it("Advance button shows selected count", async () => {
    const user = userEvent.setup();
    renderReview();
    const checkbox = screen.getByRole("checkbox", { name: /Select Senior Engineer/i });
    await user.click(checkbox);
    expect(screen.getByText(/Advance to Complete \(1\)/i)).toBeInTheDocument();
  });

  it("clicking Advance calls onAdvance with selected jobs", async () => {
    const user = userEvent.setup();
    const onAdvance = jest.fn();
    renderReview({ onAdvance });
    const checkbox = screen.getByRole("checkbox", { name: /Select Senior Engineer/i });
    await user.click(checkbox);
    await user.click(screen.getByText(/Advance to Complete/i));
    expect(onAdvance).toHaveBeenCalledWith([STRONG_JOB]);
  });

  it("unchecking a job removes it from selection", async () => {
    const user = userEvent.setup();
    renderReview();
    const checkbox = screen.getByRole("checkbox", { name: /Select Senior Engineer/i });
    await user.click(checkbox); // select
    await user.click(checkbox); // deselect
    expect(screen.getByText(/Advance to Complete \(0\)/i)).toBeDisabled();
  });
});

// ============================================================
// Select All
// ============================================================

describe("ReviewPhase — Select All", () => {
  it("shows Select All button on Strong Match tab", () => {
    renderReview();
    expect(screen.getByText(/Select All/i)).toBeInTheDocument();
  });

  it("Select All selects all strong match jobs", async () => {
    const user = userEvent.setup();
    const twoStrong = {
      ...SCOUT_RESULTS,
      tiers: {
        ...SCOUT_RESULTS.tiers,
        strong_match: [
          makeJob({ url: "https://a.com/1", title: "Job A" }),
          makeJob({ url: "https://b.com/1", title: "Job B" }),
        ],
      },
    };
    renderReview({ scoutResults: twoStrong });
    await user.click(screen.getByText(/Select All/i));
    expect(screen.getByText(/Advance to Complete \(2\)/i)).not.toBeDisabled();
  });
});

// ============================================================
// Sort dropdown
// ============================================================

describe("ReviewPhase — sort dropdown", () => {
  it("renders sort dropdown", () => {
    renderReview();
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("has Score, Date, and Company sort options", () => {
    renderReview();
    expect(screen.getByRole("option", { name: "Score" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Date Posted/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Company" })).toBeInTheDocument();
  });
});

// ============================================================
// Demo mode score flooring
// ============================================================

describe("ReviewPhase — demo mode score flooring", () => {
  const LOW_SCORE_JOB = makeJob({ title: "Low Score Dev", company: "TestCo", url: "https://test.com/1", total_score: 4 });
  const HIGH_SCORE_JOB = makeJob({ title: "High Score Dev", company: "HighCo", url: "https://high.com/1", total_score: 9 });

  const DEMO_SCOUT_RESULTS = {
    summary: "Found 2 jobs",
    tiers: {
      strong_match: [HIGH_SCORE_JOB],
      possible: [],
      weak: [LOW_SCORE_JOB],
      rejected: [],
    },
  };

  it("demo ON + score < 80%: score is floored to 8 (80%)", async () => {
    const user = userEvent.setup();
    renderReview({ scoutResults: DEMO_SCOUT_RESULTS, demoMode: true });
    // Switch to Weak tab to see the low-score job
    await user.click(screen.getByText(/Weak/i));
    // The job card should show 80% (floored from 40%)
    expect(screen.getByText("80%")).toBeInTheDocument();
  });

  it("demo ON + score >= 80%: score is unchanged", () => {
    renderReview({ scoutResults: DEMO_SCOUT_RESULTS, demoMode: true });
    // Strong tab is default, high score job should show 90%
    expect(screen.getByText("90%")).toBeInTheDocument();
  });

  it("demo OFF: all scores unchanged regardless of value", async () => {
    const user = userEvent.setup();
    renderReview({ scoutResults: DEMO_SCOUT_RESULTS, demoMode: false });
    // Strong tab shows 90%
    expect(screen.getByText("90%")).toBeInTheDocument();
    // Weak tab shows 40% (not floored)
    await user.click(screen.getByText(/Weak/i));
    expect(screen.getByText("40%")).toBeInTheDocument();
  });
});
