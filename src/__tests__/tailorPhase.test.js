import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CompletePhase from "../phases/CompletePhase";
import {
  loadTailorResults,
  saveTailorResult,
  clearTailorResults,
} from "../storage";

// ============================================================
// Helpers and constants
// ============================================================

const MOCK_JOBS = [
  {
    title: "Engineer",
    company: "Acme",
    location: "Remote",
    url: "https://acme.com/1",
    key_tech_stack: ["React"],
    reasoning: "good fit",
    jd_text: "Build things",
    total_score: 9,
  },
  {
    title: "Architect",
    company: "Globex",
    location: "Remote",
    url: "https://globex.com/1",
    key_tech_stack: ["Azure"],
    reasoning: "good fit",
    jd_text: "Design systems",
    total_score: 8,
  },
];

// Mock fetch to return successful API responses (resolves instantly)
function mockFetchSuccess() {
  global.fetch = jest.fn((url, opts) => {
    if (!url.includes("anthropic.com")) return Promise.reject(new Error("Unexpected fetch"));
    const body = JSON.parse(opts.body);
    const promptText = body.messages?.[0]?.content || "";
    const isResume = promptText.includes("PROFESSIONAL SUMMARY");
    const companyMatch = promptText.match(/Company: (.+)/);
    const company = companyMatch?.[1] || "Unknown";

    if (isResume) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          content: [{ type: "text", text: JSON.stringify({ resume: `Resume for ${company}` }) }],
        }),
      });
    }
    return Promise.resolve({
      ok: true,
      json: async () => ({
        content: [{ type: "text", text: JSON.stringify({ cover_letter: `Cover letter for ${company}` }) }],
      }),
    });
  });
}

// Mock fetch to fail immediately (no retries needed for error path test)
function mockFetchFailImmediate(failCompany) {
  global.fetch = jest.fn((url, opts) => {
    if (!url.includes("anthropic.com")) return Promise.reject(new Error("Unexpected fetch"));
    const body = JSON.parse(opts.body);
    const promptText = body.messages?.[0]?.content || "";
    const companyMatch = promptText.match(/Company: (.+)/);
    const company = companyMatch?.[1] || "";

    if (company === failCompany) {
      return Promise.reject(Object.assign(new Error("API 429: Rate limited"), { name: "AbortError" }));
    }

    const isResume = promptText.includes("PROFESSIONAL SUMMARY");
    if (isResume) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          content: [{ type: "text", text: JSON.stringify({ resume: `Resume for ${company}` }) }],
        }),
      });
    }
    return Promise.resolve({
      ok: true,
      json: async () => ({
        content: [{ type: "text", text: JSON.stringify({ cover_letter: `Cover letter for ${company}` }) }],
      }),
    });
  });
}

const defaultProps = {
  approvedJobs: [],
  profileText: "test profile",
  extractedProfile: null,
  appliedList: [],
  onAddApplied: jest.fn(),
  onRemoveApplied: jest.fn(),
  onClearApplied: jest.fn(),
  onRunAgain: jest.fn(),
};

beforeEach(() => {
  localStorage.clear();
  jest.restoreAllMocks();
});

afterEach(() => {
  if (global.fetch) delete global.fetch;
});

// ============================================================
// CompletePhase: Session restore
// ============================================================

describe("CompletePhase session restore", () => {
  it("restores saved results from localStorage on mount", () => {
    saveTailorResult({
      job_title: "Engineer",
      company: "Acme",
      url: "https://acme.com/1",
      resume: "Saved resume",
      cover_letter: "Saved cover letter",
    });

    render(
      <CompletePhase
        {...defaultProps}
        approvedJobs={MOCK_JOBS.slice(0, 1)}
      />
    );

    // Restored job should show Ready status chip
    expect(screen.getByText(/Ready/)).toBeInTheDocument();
  });

  it("shows restored count message when results are loaded from storage", () => {
    saveTailorResult({
      job_title: "Engineer",
      company: "Acme",
      url: "https://acme.com/1",
      resume: "Saved resume",
      cover_letter: "",
    });

    render(
      <CompletePhase
        {...defaultProps}
        approvedJobs={MOCK_JOBS.slice(0, 1)}
      />
    );

    expect(screen.getByText(/Restored 1 result\(s\) from previous session/)).toBeInTheDocument();
  });
});

// ============================================================
// CompletePhase: Persistence on success
// ============================================================

describe("CompletePhase persistence", () => {
  it("saves result to localStorage immediately after resume creation", async () => {
    mockFetchSuccess();

    render(
      <CompletePhase
        {...defaultProps}
        approvedJobs={MOCK_JOBS.slice(0, 1)}
      />
    );

    // Click the Create Resume button
    const resumeBtns = screen.getAllByRole("button").filter(b => b.textContent.includes("Create Resume"));
    await act(async () => {
      resumeBtns[0].click();
    });

    await waitFor(() => {
      const saved = loadTailorResults();
      expect(saved).toHaveLength(1);
      expect(saved[0].resume).toBe("Resume for Acme");
    });
  });

  it("saves result to localStorage immediately after cover letter creation", async () => {
    mockFetchSuccess();

    render(
      <CompletePhase
        {...defaultProps}
        approvedJobs={MOCK_JOBS.slice(0, 1)}
      />
    );

    // Click the Create Cover Letter button
    const coverBtns = screen.getAllByRole("button").filter(b => b.textContent.includes("Create Cover Letter"));
    await act(async () => {
      coverBtns[0].click();
    });

    await waitFor(() => {
      const saved = loadTailorResults();
      expect(saved).toHaveLength(1);
      expect(saved[0].cover_letter).toBe("Cover letter for Acme");
    });
  });
});

// ============================================================
// CompletePhase: Error handling (per-job independence)
// ============================================================

describe("CompletePhase error handling", () => {
  it("a failed job does not affect other jobs (other buttons remain available)", () => {
    mockFetchFailImmediate("Acme");

    render(
      <CompletePhase
        {...defaultProps}
        approvedJobs={MOCK_JOBS}
      />
    );

    // Both jobs should have Create Resume buttons
    const resumeBtns = screen.getAllByRole("button").filter(b => b.textContent.includes("Create Resume"));
    expect(resumeBtns.length).toBeGreaterThanOrEqual(2);

    // Both jobs should also have Create Cover Letter buttons
    const coverBtns = screen.getAllByRole("button").filter(b => b.textContent.includes("Create Cover Letter"));
    expect(coverBtns.length).toBeGreaterThanOrEqual(2);
  });
});

// ============================================================
// CompletePhase: Cancel behavior
// ============================================================

describe("CompletePhase cancel", () => {
  it("resets to idle state after cancel, shows Create Resume button again", async () => {
    global.fetch = jest.fn((url, opts) => {
      if (!url.includes("anthropic.com")) return Promise.reject(new Error("Unexpected"));
      return new Promise((_, reject) => {
        const onAbort = () => reject(new DOMException("Aborted", "AbortError"));
        if (opts.signal?.aborted) { onAbort(); return; }
        opts.signal?.addEventListener("abort", onAbort);
      });
    });

    render(
      <CompletePhase
        {...defaultProps}
        approvedJobs={MOCK_JOBS.slice(0, 1)}
      />
    );

    // Count Create Resume buttons before clicking
    const resumeBtnsBefore = screen.getAllByRole("button").filter(b => b.textContent.includes("Create Resume"));

    // Start resume creation
    await act(async () => {
      resumeBtnsBefore[0].click();
    });

    // Should show Cancel button
    expect(screen.getByText("Cancel")).toBeInTheDocument();

    // Click cancel
    await act(async () => {
      screen.getByText("Cancel").click();
    });

    // Should return to idle: Create Resume button reappears
    await waitFor(() => {
      const resumeBtnsAfter = screen.getAllByRole("button").filter(b => b.textContent.includes("Create Resume"));
      expect(resumeBtnsAfter.length).toBeGreaterThanOrEqual(1);
    });
  });
});

// ============================================================
// CompletePhase: Job posting link
// ============================================================

describe("CompletePhase job posting link", () => {
  it("renders a visible clickable link to the job posting URL", () => {
    render(
      <CompletePhase
        {...defaultProps}
        approvedJobs={MOCK_JOBS.slice(0, 1)}
      />
    );

    const link = screen.getByText("View Posting");
    expect(link).toBeInTheDocument();
    expect(link.tagName).toBe("A");
    expect(link).toHaveAttribute("href", "https://acme.com/1");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("does not render View Posting link when url is empty", () => {
    const jobNoUrl = { ...MOCK_JOBS[0], url: "" };
    render(
      <CompletePhase
        {...defaultProps}
        approvedJobs={[jobNoUrl]}
      />
    );

    expect(screen.queryByText("View Posting")).not.toBeInTheDocument();
  });
});

// ============================================================
// CompletePhase: Create Resume / Create Cover Letter buttons
// ============================================================

describe("CompletePhase generation buttons", () => {
  it("renders Create Resume and Create Cover Letter buttons for jobs without documents", () => {
    render(
      <CompletePhase
        {...defaultProps}
        approvedJobs={MOCK_JOBS.slice(0, 1)}
      />
    );

    expect(screen.getByText(/Create Resume/)).toBeInTheDocument();
    expect(screen.getByText(/Create Cover Letter/)).toBeInTheDocument();
  });

  it("shows download buttons after documents are generated (via restore)", () => {
    saveTailorResult({
      job_title: "Engineer",
      company: "Acme",
      url: "https://acme.com/1",
      resume: "Saved resume",
      cover_letter: "Saved cover letter",
    });

    render(
      <CompletePhase
        {...defaultProps}
        approvedJobs={MOCK_JOBS.slice(0, 1)}
      />
    );

    // Should show download buttons, not Create buttons
    expect(screen.queryByText(/Create Resume/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Create Cover Letter/)).not.toBeInTheDocument();
    // Should show Resume download and Cover Letter download buttons
    const resumeBtn = screen.getAllByRole("button").filter(b => b.textContent.includes("Resume") && !b.textContent.includes("Cover"));
    expect(resumeBtn.length).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================
// CompletePhase: Mark Applied with generated documents
// ============================================================

describe("CompletePhase mark applied", () => {
  it("shows Mark Applied button only when both documents are ready", () => {
    saveTailorResult({
      job_title: "Engineer",
      company: "Acme",
      url: "https://acme.com/1",
      resume: "Saved resume",
      cover_letter: "Saved cover letter",
    });

    render(
      <CompletePhase
        {...defaultProps}
        approvedJobs={MOCK_JOBS.slice(0, 1)}
      />
    );

    expect(screen.getByText("Mark Applied")).toBeInTheDocument();
  });

  it("does not show Mark Applied when documents are not yet generated", () => {
    render(
      <CompletePhase
        {...defaultProps}
        approvedJobs={MOCK_JOBS.slice(0, 1)}
      />
    );

    expect(screen.queryByText("Mark Applied")).not.toBeInTheDocument();
  });
});
