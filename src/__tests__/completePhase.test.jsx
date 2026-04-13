import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CompletePhase from "../phases/CompletePhase";
import { saveTailorResult } from "../storage";

// ============================================================
// Test fixtures
// ============================================================

const APPROVED_JOB = {
  title: "Senior Engineer",
  company: "Acme",
  url: "https://acme.com/job/1",
  location: "Remote",
  key_tech_stack: ["React"],
  reasoning: "good fit",
  jd_text: "Build things",
  total_score: 9,
};

const APPROVED_JOB_NO_URL = {
  title: "Staff Architect",
  company: "Globex",
  url: "",
  location: "Remote",
  key_tech_stack: ["Azure"],
  reasoning: "good fit",
  jd_text: "Design systems",
  total_score: 8,
};

const APPLIED_JOB = {
  title: "Senior Engineer",
  company: "Acme",
  url: "https://acme.com/job/1",
  appliedDate: "2026-04-01",
};

function renderComplete({
  approvedJobs = [APPROVED_JOB],
  appliedList = [],
  onAddApplied = jest.fn(),
  onRemoveApplied = jest.fn(),
  onClearApplied = jest.fn(),
  onRunAgain = jest.fn(),
} = {}) {
  return {
    onAddApplied, onRemoveApplied, onClearApplied, onRunAgain,
    ...render(
      <CompletePhase
        approvedJobs={approvedJobs}
        profileText="test profile"
        extractedProfile={null}
        appliedList={appliedList}
        onAddApplied={onAddApplied}
        onRemoveApplied={onRemoveApplied}
        onClearApplied={onClearApplied}
        onRunAgain={onRunAgain}
      />
    ),
  };
}

beforeEach(() => {
  localStorage.clear();
  // Mock URL.createObjectURL for download tests
  global.URL.createObjectURL = jest.fn(() => "blob:mock");
  global.URL.revokeObjectURL = jest.fn();
});

// ============================================================
// Initial render (no documents generated yet)
// ============================================================

describe("CompletePhase — initial render", () => {
  it("renders the guide banner", () => {
    renderComplete();
    expect(screen.getByText(/Generate tailored documents/i)).toBeInTheDocument();
  });

  it("renders the job card with job title and company", () => {
    renderComplete();
    expect(screen.getByText("Senior Engineer")).toBeInTheDocument();
    expect(screen.getByText("Acme")).toBeInTheDocument();
  });

  it("renders Create Resume button for jobs without documents", () => {
    renderComplete();
    expect(screen.getByText(/Create Resume/i)).toBeInTheDocument();
  });

  it("renders Create Cover Letter button for jobs without documents", () => {
    renderComplete();
    expect(screen.getByText(/Create Cover Letter/i)).toBeInTheDocument();
  });

  it("does not render Mark Applied when no documents generated", () => {
    renderComplete();
    expect(screen.queryByText("Mark Applied")).not.toBeInTheDocument();
  });

  it("does not render New Search button (use Start Over instead)", () => {
    renderComplete();
    expect(screen.queryByText(/New Search/i)).not.toBeInTheDocument();
  });

  it("renders download format selector", () => {
    renderComplete();
    const select = screen.getByRole("combobox");
    expect(select).toBeInTheDocument();
  });

  it("renders View Posting link when url is present", () => {
    renderComplete();
    expect(screen.getByText("View Posting")).toBeInTheDocument();
  });

  it("does not render View Posting link when url is empty", () => {
    renderComplete({ approvedJobs: [APPROVED_JOB_NO_URL] });
    expect(screen.queryByText("View Posting")).not.toBeInTheDocument();
  });
});

// ============================================================
// With restored documents (from localStorage)
// ============================================================

describe("CompletePhase — with restored documents", () => {
  beforeEach(() => {
    saveTailorResult({
      job_title: "Senior Engineer",
      company: "Acme",
      url: "https://acme.com/job/1",
      resume: "RESUME TEXT for Senior Engineer at Acme",
      cover_letter: "COVER LETTER TEXT for Senior Engineer at Acme",
    });
  });

  it("renders download buttons when documents are restored", () => {
    renderComplete();
    // Should not show Create buttons
    expect(screen.queryByText(/Create Resume/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Create Cover Letter/i)).not.toBeInTheDocument();
    // Should show download Resume and Cover Letter buttons
    const resumeBtn = screen.getAllByRole("button").filter(b => b.textContent.includes("Resume") && !b.textContent.includes("Cover"));
    expect(resumeBtn.length).toBeGreaterThanOrEqual(1);
  });

  it("renders Mark Applied button when both documents are ready", () => {
    renderComplete();
    expect(screen.getByText("Mark Applied")).toBeInTheDocument();
  });
});

// ============================================================
// Applied state
// ============================================================

describe("CompletePhase — applied state", () => {
  beforeEach(() => {
    saveTailorResult({
      job_title: "Senior Engineer",
      company: "Acme",
      url: "https://acme.com/job/1",
      resume: "RESUME TEXT",
      cover_letter: "COVER LETTER TEXT",
    });
  });

  it("does not show Mark Applied button for already-applied jobs", () => {
    renderComplete({ appliedList: [APPLIED_JOB] });
    expect(screen.queryByText("Mark Applied")).not.toBeInTheDocument();
  });

  it("shows Applied chip for already-applied jobs", () => {
    const { container } = renderComplete({ appliedList: [APPLIED_JOB] });
    expect(container.querySelector(".applied-chip")).toBeInTheDocument();
  });

  it("calls onAddApplied when Mark Applied is clicked", async () => {
    const user = userEvent.setup();
    const { onAddApplied } = renderComplete();
    await user.click(screen.getByText("Mark Applied"));
    expect(onAddApplied).toHaveBeenCalledTimes(1);
    expect(onAddApplied).toHaveBeenCalledWith(expect.objectContaining({
      title: "Senior Engineer",
      company: "Acme",
      url: "https://acme.com/job/1",
    }));
  });
});

// ============================================================
// Multiple results
// ============================================================

describe("CompletePhase — multiple results", () => {
  it("renders a card for each approved job", () => {
    renderComplete({ approvedJobs: [APPROVED_JOB, APPROVED_JOB_NO_URL] });
    expect(screen.getByText("Senior Engineer")).toBeInTheDocument();
    expect(screen.getByText("Staff Architect")).toBeInTheDocument();
  });
});

// ============================================================
// Navigation (New Search removed; Start Over in GuideBar is the path)
// ============================================================

// ============================================================
// AppliedTracker integration
// ============================================================

describe("CompletePhase — AppliedTracker", () => {
  it("renders Applied Tracker section", () => {
    renderComplete();
    expect(screen.getByText(/Applied Tracker/i)).toBeInTheDocument();
  });

  it("shows 'No applications tracked yet' when appliedList is empty", () => {
    renderComplete({ appliedList: [] });
    expect(screen.getByText(/No applications tracked yet/i)).toBeInTheDocument();
  });

  it("renders applied job entries in tracker", () => {
    renderComplete({ appliedList: [APPLIED_JOB] });
    expect(screen.getAllByText(/Senior Engineer/i).length).toBeGreaterThanOrEqual(1);
  });

  it("calls onRemoveApplied when Remove is clicked in tracker", async () => {
    const user = userEvent.setup();
    const { onRemoveApplied } = renderComplete({ appliedList: [APPLIED_JOB] });
    await user.click(screen.getByText("Remove"));
    expect(onRemoveApplied).toHaveBeenCalledWith(0);
  });

  it("calls onClearApplied when Clear All is clicked in tracker", async () => {
    const user = userEvent.setup();
    const { onClearApplied } = renderComplete({ appliedList: [APPLIED_JOB] });
    await user.click(screen.getByText("Clear All"));
    expect(onClearApplied).toHaveBeenCalledTimes(1);
  });
});

// ============================================================
// Download
// ============================================================

describe("CompletePhase — download", () => {
  it("download format selector defaults to Plain Text", () => {
    renderComplete();
    const select = screen.getByRole("combobox");
    expect(select.value).toBe("txt");
  });
});

// ============================================================
// Phase progression: Review -> Complete (no Tailor phase)
// ============================================================

describe("CompletePhase — phase progression", () => {
  it("shows Pending status for jobs without documents", () => {
    renderComplete();
    expect(screen.getByText("Pending")).toBeInTheDocument();
  });

  it("shows Ready status for jobs with both documents restored", () => {
    saveTailorResult({
      job_title: "Senior Engineer",
      company: "Acme",
      url: "https://acme.com/job/1",
      resume: "Resume text",
      cover_letter: "Cover letter text",
    });
    renderComplete();
    expect(screen.getByText(/Ready/)).toBeInTheDocument();
  });
});
