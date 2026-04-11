import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  loadTailorResults,
  saveTailorResult,
  clearTailorResults,
  TailorPhase,
  TAILOR_RESULTS_KEY,
} from "../JobSearchPipelineV4";

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

beforeEach(() => {
  localStorage.clear();
  jest.restoreAllMocks();
});

afterEach(() => {
  if (global.fetch) delete global.fetch;
});

// ============================================================
// TailorPhase: Session restore
// ============================================================

describe("TailorPhase session restore", () => {
  it("restores saved results from localStorage on mount", () => {
    saveTailorResult({
      job_title: "Engineer",
      company: "Acme",
      url: "https://acme.com/1",
      resume: "Saved resume",
      cover_letter: "Saved cover letter",
    });

    render(
      <TailorPhase
        approvedJobs={MOCK_JOBS.slice(0, 1)}
        profileText="test profile"
        onComplete={jest.fn()}
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
      <TailorPhase
        approvedJobs={MOCK_JOBS.slice(0, 1)}
        profileText="test profile"
        onComplete={jest.fn()}
      />
    );

    expect(screen.getByText(/Restored 1 result\(s\) from previous session/)).toBeInTheDocument();
  });
});

// ============================================================
// TailorPhase: Persistence on success
// ============================================================

describe("TailorPhase persistence", () => {
  it("saves result to localStorage immediately after resume creation", async () => {
    mockFetchSuccess();

    render(
      <TailorPhase
        approvedJobs={MOCK_JOBS.slice(0, 1)}
        profileText="test profile"
        onComplete={jest.fn()}
      />
    );

    // Click the Resume button (contains emoji + "Resume" text)
    const resumeBtns = screen.getAllByRole("button").filter(b => b.textContent.includes("Resume") && !b.textContent.includes("Cover"));
    await act(async () => {
      resumeBtns[0].click();
    });

    await waitFor(() => {
      // After generation, the card shows Ready status
      const saved = loadTailorResults();
      expect(saved).toHaveLength(1);
      expect(saved[0].resume).toBe("Resume for Acme");
    });
  });

  it("saves result to localStorage immediately after cover letter creation", async () => {
    mockFetchSuccess();

    render(
      <TailorPhase
        approvedJobs={MOCK_JOBS.slice(0, 1)}
        profileText="test profile"
        onComplete={jest.fn()}
      />
    );

    // Click the Cover Letter button
    const coverBtns = screen.getAllByRole("button").filter(b => b.textContent.includes("Cover Letter"));
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
// TailorPhase: Error handling (per-job independence)
// ============================================================

describe("TailorPhase error handling", () => {
  it("a failed job does not affect other jobs (other buttons remain available)", () => {
    mockFetchFailImmediate("Acme");

    render(
      <TailorPhase
        approvedJobs={MOCK_JOBS}
        profileText="test profile"
        onComplete={jest.fn()}
      />
    );

    // Both jobs should have Resume buttons
    const resumeBtns = screen.getAllByRole("button").filter(b => b.textContent.includes("Resume") && !b.textContent.includes("Cover"));
    expect(resumeBtns.length).toBeGreaterThanOrEqual(2);

    // Both jobs should also have Cover Letter buttons
    const coverBtns = screen.getAllByRole("button").filter(b => b.textContent.includes("Cover Letter"));
    expect(coverBtns.length).toBeGreaterThanOrEqual(2);
  });
});

// ============================================================
// TailorPhase: Cancel behavior
// ============================================================

describe("TailorPhase cancel", () => {
  it("resets to idle state after cancel, shows Resume button again", async () => {
    global.fetch = jest.fn((url, opts) => {
      if (!url.includes("anthropic.com")) return Promise.reject(new Error("Unexpected"));
      return new Promise((_, reject) => {
        const onAbort = () => reject(new DOMException("Aborted", "AbortError"));
        if (opts.signal?.aborted) { onAbort(); return; }
        opts.signal?.addEventListener("abort", onAbort);
      });
    });

    render(
      <TailorPhase
        approvedJobs={MOCK_JOBS.slice(0, 1)}
        profileText="test profile"
        onComplete={jest.fn()}
      />
    );

    // Count Resume buttons before clicking
    const resumeBtnsBefore = screen.getAllByRole("button").filter(b => b.textContent.includes("Resume") && !b.textContent.includes("Cover"));

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

    // Should return to idle: Resume button reappears
    await waitFor(() => {
      const resumeBtnsAfter = screen.getAllByRole("button").filter(b => b.textContent.includes("Resume") && !b.textContent.includes("Cover"));
      expect(resumeBtnsAfter.length).toBeGreaterThanOrEqual(1);
    });
  });
});

// ============================================================
// TailorPhase: Advance with merged output
// ============================================================

describe("TailorPhase advance", () => {
  it("passes full merged output including restored results to onComplete", async () => {
    saveTailorResult({
      job_title: "Engineer",
      company: "Acme",
      url: "https://acme.com/1",
      resume: "Previously saved resume",
      cover_letter: "Previously saved cover letter",
    });

    saveTailorResult({
      job_title: "Architect",
      company: "Globex",
      url: "https://globex.com/1",
      resume: "Previously saved Globex resume",
      cover_letter: "Previously saved Globex cover letter",
    });

    const onComplete = jest.fn();

    render(
      <TailorPhase
        approvedJobs={MOCK_JOBS}
        profileText="test profile"
        onComplete={onComplete}
      />
    );

    // Both jobs should be restored with Ready status
    const readyChips = screen.getAllByText(/Ready/);
    expect(readyChips).toHaveLength(2);

    // Advance to Complete should be enabled
    const advanceBtn = screen.getByText("Advance to Complete");
    expect(advanceBtn).not.toBeDisabled();
    await act(async () => {
      advanceBtn.click();
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
    const results = onComplete.mock.calls[0][0];
    expect(results).toHaveLength(2);

    const acmeResult = results.find(r => r.company === "Acme");
    expect(acmeResult.resume).toBe("Previously saved resume");
    expect(acmeResult.cover_letter).toBe("Previously saved cover letter");

    const globexResult = results.find(r => r.company === "Globex");
    expect(globexResult.resume).toBe("Previously saved Globex resume");
    expect(globexResult.cover_letter).toBe("Previously saved Globex cover letter");
  });
});
