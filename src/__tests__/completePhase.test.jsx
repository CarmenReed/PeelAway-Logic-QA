import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CompletePhase from "../phases/CompletePhase";

// ============================================================
// Test fixtures
// ============================================================

const TAILOR_RESULT = {
  job_title: "Senior Engineer",
  company: "Acme",
  url: "https://acme.com/job/1",
  resume: "RESUME TEXT for Senior Engineer at Acme",
  cover_letter: "COVER LETTER TEXT for Senior Engineer at Acme",
};

const TAILOR_RESULT_NO_URL = {
  job_title: "Staff Architect",
  company: "Globex",
  url: "",
  resume: "RESUME TEXT for Staff Architect at Globex",
  cover_letter: "COVER LETTER TEXT for Staff Architect at Globex",
};

const APPLIED_JOB = {
  title: "Senior Engineer",
  company: "Acme",
  url: "https://acme.com/job/1",
  appliedDate: "2026-04-01",
};

function renderComplete({
  tailorResults = [TAILOR_RESULT],
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
        tailorResults={tailorResults}
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
// Initial render
// ============================================================

describe("CompletePhase — initial render", () => {
  it("renders the guide banner", () => {
    renderComplete();
    expect(screen.getByText(/Your tailored documents are ready/i)).toBeInTheDocument();
  });

  it("renders the tailored job card with job title and company", () => {
    renderComplete();
    expect(screen.getByText("Senior Engineer")).toBeInTheDocument();
    expect(screen.getByText("Acme")).toBeInTheDocument();
  });

  it("renders resume download button", () => {
    renderComplete();
    expect(screen.getByText(/Resume/i, { selector: "button" })).toBeInTheDocument();
  });

  it("renders cover letter download button", () => {
    renderComplete();
    expect(screen.getByText(/Cover Letter/i, { selector: "button" })).toBeInTheDocument();
  });

  it("renders Mark Applied button when job is not applied", () => {
    renderComplete();
    expect(screen.getByText("Mark Applied")).toBeInTheDocument();
  });

  it("renders New Search button", () => {
    renderComplete();
    expect(screen.getByText(/New Search/i)).toBeInTheDocument();
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
    renderComplete({ tailorResults: [TAILOR_RESULT_NO_URL] });
    expect(screen.queryByText("View Posting")).not.toBeInTheDocument();
  });
});

// ============================================================
// Applied state
// ============================================================

describe("CompletePhase — applied state", () => {
  it("does not show Mark Applied button for already-applied jobs", () => {
    renderComplete({ tailorResults: [TAILOR_RESULT], appliedList: [APPLIED_JOB] });
    expect(screen.queryByText("Mark Applied")).not.toBeInTheDocument();
  });

  it("shows Applied chip for already-applied jobs", () => {
    const { container } = renderComplete({ tailorResults: [TAILOR_RESULT], appliedList: [APPLIED_JOB] });
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
  it("renders a card for each tailor result", () => {
    renderComplete({ tailorResults: [TAILOR_RESULT, TAILOR_RESULT_NO_URL] });
    expect(screen.getByText("Senior Engineer")).toBeInTheDocument();
    expect(screen.getByText("Staff Architect")).toBeInTheDocument();
  });
});

// ============================================================
// New Search button
// ============================================================

describe("CompletePhase — navigation", () => {
  it("calls onRunAgain when New Search is clicked", async () => {
    const user = userEvent.setup();
    const { onRunAgain } = renderComplete();
    await user.click(screen.getByText(/New Search/i));
    expect(onRunAgain).toHaveBeenCalledTimes(1);
  });
});

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
    // Title shows in the tracker row
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

  it("clicking Resume button triggers download (creates anchor)", async () => {
    const user = userEvent.setup();
    // Spy on createElement to capture the anchor click
    const clickSpy = jest.fn();
    const origCreate = document.createElement.bind(document);
    jest.spyOn(document, "createElement").mockImplementation((tag) => {
      const el = origCreate(tag);
      if (tag === "a") { el.click = clickSpy; }
      return el;
    });

    renderComplete();
    const resumeBtn = screen.getByText(/Resume/i, { selector: "button" });
    await user.click(resumeBtn);
    expect(clickSpy).toHaveBeenCalledTimes(1);

    document.createElement.mockRestore();
  });
});
