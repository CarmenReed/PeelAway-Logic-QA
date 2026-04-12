import { render, screen } from "@testing-library/react";
import ScoutPhase from "../phases/ScoutPhase";

// Mock API — no network calls
jest.mock("../api", () => ({
  extractTextFromPdf: jest.fn(),
}));

beforeEach(() => {
  localStorage.clear();
});

const LONG_PROFILE = "A".repeat(60); // > 50 chars

function renderScout({ profileText = "", setProfileText = jest.fn(), extractedProfile = null, setExtractedProfile = jest.fn(), locked = false, onAdvance = jest.fn() } = {}) {
  return render(
    <ScoutPhase
      profileText={profileText}
      setProfileText={setProfileText}
      extractedProfile={extractedProfile}
      setExtractedProfile={setExtractedProfile}
      locked={locked}
      onAdvance={onAdvance}
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
    expect(screen.queryByText(/Review Extracted Profile/i)).not.toBeInTheDocument();
  });

  it("shows extracted profile when profile is set and has profile text", () => {
    renderScout({ profileText: LONG_PROFILE, extractedProfile: mockProfile });
    expect(screen.getByText(/Review Extracted Profile/i)).toBeInTheDocument();
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

  it("shows Continue to Search button when profile is loaded", () => {
    renderScout({ profileText: LONG_PROFILE, extractedProfile: mockProfile });
    expect(screen.getByText("Continue to Search")).toBeInTheDocument();
  });
});

// ============================================================
// Locked state
// ============================================================

describe("ScoutPhase — locked state", () => {
  const mockProfile = {
    name: "Jane Doe",
    skills: ["React", "Node.js"],
    yearsExperience: 10,
    targetLevel: ["Senior"],
    location: ["remote"],
    searchQueries: {
      adzuna: ["Senior React Developer"],
      jsearch: ["Senior React Developer remote"],
    },
  };

  it("hides upload tabs when locked", () => {
    renderScout({ profileText: LONG_PROFILE, extractedProfile: mockProfile, locked: true });
    expect(screen.queryByText("Upload PDF/TXT")).not.toBeInTheDocument();
    expect(screen.queryByText("Paste Resume Text")).not.toBeInTheDocument();
  });

  it("disables name input when locked", () => {
    renderScout({ profileText: LONG_PROFILE, extractedProfile: mockProfile, locked: true });
    expect(screen.getByDisplayValue("Jane Doe")).toBeDisabled();
  });

  it("disables level checkboxes when locked", () => {
    renderScout({ profileText: LONG_PROFILE, extractedProfile: mockProfile, locked: true });
    const seniorCheckbox = screen.getByRole("checkbox", { name: "Senior" });
    expect(seniorCheckbox).toBeDisabled();
  });

  it("hides Continue to Search button when locked", () => {
    renderScout({ profileText: LONG_PROFILE, extractedProfile: mockProfile, locked: true });
    expect(screen.queryByText("Continue to Search")).not.toBeInTheDocument();
  });

  it("hides skill remove buttons when locked", () => {
    renderScout({ profileText: LONG_PROFILE, extractedProfile: mockProfile, locked: true });
    const removeButtons = screen.queryAllByText("x");
    expect(removeButtons).toHaveLength(0);
  });
});
