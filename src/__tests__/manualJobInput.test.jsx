import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ManualJobInput from "../components/ManualJobInput";

// Mock the api module — ManualJobInput calls callAnthropicWithLoop directly for URL mode
jest.mock("../api", () => ({
  callAnthropicWithLoop: jest.fn(),
}));

import { callAnthropicWithLoop } from "../api";

const MOCK_PROFILE = "A".repeat(60); // >50 chars so apiKey guard passes

const MOCK_SCORE_RESULT = [{
  title: "Senior Engineer",
  company: "Acme",
  location: "Remote",
  url: "https://acme.com/job/1",
  total_score: 8,
  skills_fit: 4,
  level_fit: 4,
  reasoning: "Strong match",
  key_tech_stack: ["React", "Node"],
}];

const mockScoreRawJobs = jest.fn();
const mockOnJobScored = jest.fn();

const MOCK_EXTRACTED_PROFILE = {
  name: "Test User",
  skills: ["React", "Node.js"],
  yearsExperience: 5,
  targetLevel: ["Senior"],
  location: ["remote"],
  searchQueries: { adzuna: ["Senior React Developer"], jsearch: ["Senior React Developer remote"] },
};

function renderComponent({ apiKey = "test-key", profileText = MOCK_PROFILE, extractedProfile = MOCK_EXTRACTED_PROFILE } = {}) {
  return render(
    <ManualJobInput
      profileText={profileText}
      extractedProfile={extractedProfile}
      apiKey={apiKey}
      onJobScored={mockOnJobScored}
      scoreRawJobs={mockScoreRawJobs}
    />
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
});

// ============================================================
// Tab switching
// ============================================================

describe("ManualJobInput — tab switching", () => {
  it("defaults to URL tab with url input visible", () => {
    renderComponent();
    expect(screen.getByText("Paste URL")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/https:\/\/jobs\.lever/i)).toBeInTheDocument();
  });

  it("switching to Paste JD Text shows textarea", async () => {
    const user = userEvent.setup();
    renderComponent();
    await user.click(screen.getByText("Paste JD Text"));
    expect(screen.getByPlaceholderText(/Paste the full job description/i)).toBeInTheDocument();
  });

  it("switching back to Paste URL shows url input", async () => {
    const user = userEvent.setup();
    renderComponent();
    await user.click(screen.getByText("Paste JD Text"));
    await user.click(screen.getByText("Paste URL"));
    expect(screen.getByPlaceholderText(/https:\/\/jobs\.lever/i)).toBeInTheDocument();
  });
});

// ============================================================
// Button disabled states
// ============================================================

describe("ManualJobInput — button disabled state", () => {
  it("Score button is disabled when URL input is empty", () => {
    renderComponent();
    expect(screen.getByText("Score This Job")).toBeDisabled();
  });

  it("Score button is enabled when URL input has text", async () => {
    const user = userEvent.setup();
    renderComponent();
    await user.type(screen.getByPlaceholderText(/https:\/\/jobs\.lever/i), "https://example.com/job");
    expect(screen.getByText("Score This Job")).not.toBeDisabled();
  });

  it("Score button is disabled when JD textarea is empty", async () => {
    const user = userEvent.setup();
    renderComponent();
    await user.click(screen.getByText("Paste JD Text"));
    expect(screen.getByText("Score This Job")).toBeDisabled();
  });

  it("Score button is enabled when JD textarea has text", async () => {
    const user = userEvent.setup();
    renderComponent();
    await user.click(screen.getByText("Paste JD Text"));
    await user.type(screen.getByPlaceholderText(/Paste the full job description/i), "Some job description text here");
    expect(screen.getByText("Score This Job")).not.toBeDisabled();
  });
});

// ============================================================
// API key guard
// ============================================================

describe("ManualJobInput — API key guard", () => {
  it("shows error when scoring attempted with empty apiKey", async () => {
    const user = userEvent.setup();
    renderComponent({ apiKey: "" });
    await user.type(screen.getByPlaceholderText(/https:\/\/jobs\.lever/i), "https://example.com/job");
    await user.click(screen.getByText("Score This Job"));
    expect(screen.getByText("API key not set.")).toBeInTheDocument();
  });
});

// ============================================================
// Scoring flow — URL mode
// ============================================================

describe("ManualJobInput — scoring flow (URL mode)", () => {
  it("calls callAnthropicWithLoop and scoreRawJobs on Score click", async () => {
    callAnthropicWithLoop.mockResolvedValue({
      title: "Senior Engineer",
      company: "Acme",
      jd_text: "Build cool things",
    });
    mockScoreRawJobs.mockResolvedValue(MOCK_SCORE_RESULT);

    const user = userEvent.setup();
    renderComponent();
    await user.type(screen.getByPlaceholderText(/https:\/\/jobs\.lever/i), "https://acme.com/job/1");
    await user.click(screen.getByText("Score This Job"));

    await waitFor(() => {
      expect(callAnthropicWithLoop).toHaveBeenCalledTimes(1);
      expect(mockScoreRawJobs).toHaveBeenCalledTimes(1);
    });
  });

  it("renders result card with score after successful scoring", async () => {
    callAnthropicWithLoop.mockResolvedValue({
      title: "Senior Engineer",
      company: "Acme",
      jd_text: "Build cool things",
    });
    mockScoreRawJobs.mockResolvedValue(MOCK_SCORE_RESULT);

    const user = userEvent.setup();
    renderComponent();
    await user.type(screen.getByPlaceholderText(/https:\/\/jobs\.lever/i), "https://acme.com/job/1");
    await user.click(screen.getByText("Score This Job"));

    await waitFor(() => {
      expect(screen.getByText("Senior Engineer")).toBeInTheDocument();
      expect(screen.getByText("80%")).toBeInTheDocument();
    });
  });

  it("shows error message on API failure", async () => {
    callAnthropicWithLoop.mockRejectedValue(new Error("Network error"));

    const user = userEvent.setup();
    renderComponent();
    await user.type(screen.getByPlaceholderText(/https:\/\/jobs\.lever/i), "https://acme.com/job/1");
    await user.click(screen.getByText("Score This Job"));

    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeInTheDocument();
    });
  });
});

// ============================================================
// Scoring flow — paste JD mode
// ============================================================

describe("ManualJobInput — scoring flow (JD paste mode)", () => {
  it("scores pasted JD text without calling callAnthropicWithLoop", async () => {
    mockScoreRawJobs.mockResolvedValue(MOCK_SCORE_RESULT);

    const user = userEvent.setup();
    renderComponent();
    await user.click(screen.getByText("Paste JD Text"));
    await user.type(screen.getByPlaceholderText(/Paste the full job description/i), "Senior engineer needed for building great products");
    await user.click(screen.getByText("Score This Job"));

    await waitFor(() => {
      expect(callAnthropicWithLoop).not.toHaveBeenCalled();
      expect(mockScoreRawJobs).toHaveBeenCalledTimes(1);
    });
  });
});

// ============================================================
// Add to Queue
// ============================================================

describe("ManualJobInput — Add to Queue", () => {
  it("calls onJobScored when Add to Scout Queue is clicked", async () => {
    callAnthropicWithLoop.mockResolvedValue({
      title: "Senior Engineer",
      company: "Acme",
      jd_text: "Build cool things",
    });
    mockScoreRawJobs.mockResolvedValue(MOCK_SCORE_RESULT);

    const user = userEvent.setup();
    renderComponent();
    await user.type(screen.getByPlaceholderText(/https:\/\/jobs\.lever/i), "https://acme.com/job/1");
    await user.click(screen.getByText("Score This Job"));

    await waitFor(() => screen.getByText("Add to Scout Queue"));
    await user.click(screen.getByText("Add to Scout Queue"));

    expect(mockOnJobScored).toHaveBeenCalledTimes(1);
  });
});
