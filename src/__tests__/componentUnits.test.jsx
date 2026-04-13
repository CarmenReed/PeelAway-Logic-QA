// componentUnits.test.jsx
// Unit tests for all individual React components

import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import JobCard from "../components/JobCard";
import AppliedTracker from "../components/AppliedTracker";
import LandingScreen from "../components/LandingScreen";
import Header from "../components/Header";
import GuideBar from "../components/GuideBar";
import Spinner from "../components/Spinner";

// ============================================================
// JobCard
// ============================================================

describe("JobCard", () => {
  const baseJob = {
    title: "Senior Engineer",
    company: "Acme Corp",
    location: "Remote",
    total_score: 9,
    skills_fit: 4,
    level_fit: 5,
    reasoning: "Strong cloud skills match",
    key_tech_stack: ["React", "Node.js", "Azure"],
    status: "Strong Match",
    salary_range: "$150k - $200k",
    url: "https://acme.com/jobs/123",
    jd_text: "Full stack role building cloud apps",
    date_posted: "2026-04-10",
    freshness_flag: "fresh",
  };

  it("renders job title, company, and location", () => {
    render(<JobCard job={baseJob} />);
    expect(screen.getByText("Senior Engineer")).toBeInTheDocument();
    expect(screen.getByText(/Acme Corp/)).toBeInTheDocument();
    expect(screen.getByText(/Remote/)).toBeInTheDocument();
  });

  it("renders score as percentage badge", () => {
    render(<JobCard job={baseJob} />);
    expect(screen.getByText("90%")).toBeInTheDocument();
  });

  it("renders salary range when provided", () => {
    render(<JobCard job={baseJob} />);
    expect(screen.getByText("$150k - $200k")).toBeInTheDocument();
  });

  it("does not render salary when not provided", () => {
    const job = { ...baseJob, salary_range: undefined };
    render(<JobCard job={job} />);
    expect(screen.queryByText("$150k")).not.toBeInTheDocument();
  });

  it("renders tech stack badges", () => {
    render(<JobCard job={baseJob} />);
    expect(screen.getByText("React")).toBeInTheDocument();
    expect(screen.getByText("Node.js")).toBeInTheDocument();
    expect(screen.getByText("Azure")).toBeInTheDocument();
  });

  it("does not render tech stack when empty array", () => {
    const job = { ...baseJob, key_tech_stack: [] };
    const { container } = render(<JobCard job={job} />);
    expect(container.querySelector(".tech-stack")).not.toBeInTheDocument();
  });

  it("does not render tech stack when not an array", () => {
    const job = { ...baseJob, key_tech_stack: "React, Node" };
    const { container } = render(<JobCard job={job} />);
    expect(container.querySelector(".tech-stack")).not.toBeInTheDocument();
  });

  it("renders title as link when URL provided", () => {
    render(<JobCard job={baseJob} />);
    const link = screen.getByText("Senior Engineer").closest("a");
    expect(link).toHaveAttribute("href", "https://acme.com/jobs/123");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("renders title as plain text when no URL", () => {
    const job = { ...baseJob, url: "" };
    render(<JobCard job={job} />);
    const title = screen.getByText("Senior Engineer");
    expect(title.closest("a")).not.toBeInTheDocument();
  });

  it("shows 'Full JD fetched' when jd_text is present", () => {
    render(<JobCard job={baseJob} />);
    expect(screen.getByText("Full JD fetched")).toBeInTheDocument();
  });

  it("does not show 'Full JD fetched' when jd_text is empty", () => {
    const job = { ...baseJob, jd_text: "" };
    render(<JobCard job={job} />);
    expect(screen.queryByText("Full JD fetched")).not.toBeInTheDocument();
  });

  it("shows fresh date when freshness_flag is 'fresh'", () => {
    render(<JobCard job={baseJob} />);
    expect(screen.getByText(/Posted: 2026-04-10/)).toBeInTheDocument();
  });

  it("shows stale warning when freshness_flag is 'stale'", () => {
    const job = { ...baseJob, freshness_flag: "stale" };
    render(<JobCard job={job} />);
    expect(screen.getByText("Date unverified or older than 14 days")).toBeInTheDocument();
  });

  it("renders reasoning text", () => {
    render(<JobCard job={baseJob} />);
    expect(screen.getByText("Strong cloud skills match")).toBeInTheDocument();
  });

  it("renders skills and level fit scores", () => {
    render(<JobCard job={baseJob} />);
    expect(screen.getByText(/Skills: 4\/5/)).toBeInTheDocument();
    expect(screen.getByText(/Level: 5\/5/)).toBeInTheDocument();
  });

  // Selectable mode
  it("renders checkbox when selectable=true", () => {
    render(<JobCard job={baseJob} selectable={true} selected={false} onToggle={jest.fn()} />);
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).not.toBeChecked();
  });

  it("renders checked checkbox when selected=true", () => {
    render(<JobCard job={baseJob} selectable={true} selected={true} onToggle={jest.fn()} />);
    expect(screen.getByRole("checkbox")).toBeChecked();
  });

  it("does not render checkbox when selectable is falsy", () => {
    render(<JobCard job={baseJob} />);
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("calls onToggle with job when checkbox is clicked", async () => {
    const onToggle = jest.fn();
    const user = userEvent.setup();
    render(<JobCard job={baseJob} selectable={true} selected={false} onToggle={onToggle} />);
    await user.click(screen.getByRole("checkbox"));
    expect(onToggle).toHaveBeenCalledWith(baseJob);
  });

  it("has correct aria-label on checkbox", () => {
    render(<JobCard job={baseJob} selectable={true} selected={false} onToggle={jest.fn()} />);
    expect(screen.getByLabelText("Select Senior Engineer at Acme Corp")).toBeInTheDocument();
  });

  it("adds 'selected' class when selected", () => {
    const { container } = render(<JobCard job={baseJob} selectable={true} selected={true} onToggle={jest.fn()} />);
    expect(container.firstChild).toHaveClass("selected");
  });

  it("rounds score correctly (e.g., 7.5 -> 75%)", () => {
    const job = { ...baseJob, total_score: 7.5 };
    render(<JobCard job={job} />);
    expect(screen.getByText("75%")).toBeInTheDocument();
  });
});

// ============================================================
// AppliedTracker
// ============================================================

describe("AppliedTracker", () => {
  const mockList = [
    { title: "Dev", company: "Acme", url: "https://acme.com/1", appliedDate: "2026-04-10T12:00:00Z" },
    { title: "Arch", company: "Globex", url: "", appliedDate: "2026-04-09T12:00:00Z" },
  ];

  it("renders header with count", () => {
    render(<AppliedTracker appliedList={mockList} onRemove={jest.fn()} onClear={jest.fn()} />);
    expect(screen.getByText(/Applied Tracker \(2\)/)).toBeInTheDocument();
  });

  it("renders all entries when expanded", () => {
    render(<AppliedTracker appliedList={mockList} onRemove={jest.fn()} onClear={jest.fn()} />);
    expect(screen.getByText(/Dev/)).toBeInTheDocument();
    expect(screen.getByText(/Arch/)).toBeInTheDocument();
  });

  it("shows empty state when no applications", () => {
    render(<AppliedTracker appliedList={[]} onRemove={jest.fn()} onClear={jest.fn()} />);
    expect(screen.getByText("No applications tracked yet.")).toBeInTheDocument();
  });

  it("collapses entries when header is clicked", async () => {
    const user = userEvent.setup();
    render(<AppliedTracker appliedList={mockList} onRemove={jest.fn()} onClear={jest.fn()} />);

    // Click header to collapse
    await user.click(screen.getByText(/Applied Tracker/));
    expect(screen.queryByText(/Dev/)).not.toBeInTheDocument();
  });

  it("re-expands when header is clicked again", async () => {
    const user = userEvent.setup();
    render(<AppliedTracker appliedList={mockList} onRemove={jest.fn()} onClear={jest.fn()} />);

    await user.click(screen.getByText(/Applied Tracker/));
    await user.click(screen.getByText(/Applied Tracker/));
    expect(screen.getByText(/Dev/)).toBeInTheDocument();
  });

  it("calls onRemove with index when Remove is clicked", async () => {
    const onRemove = jest.fn();
    const user = userEvent.setup();
    render(<AppliedTracker appliedList={mockList} onRemove={onRemove} onClear={jest.fn()} />);

    const removeButtons = screen.getAllByText("Remove");
    await user.click(removeButtons[0]);
    expect(onRemove).toHaveBeenCalledWith(0);
  });

  it("calls onClear when Clear All is clicked", async () => {
    const onClear = jest.fn();
    const user = userEvent.setup();
    render(<AppliedTracker appliedList={mockList} onRemove={jest.fn()} onClear={onClear} />);

    await user.click(screen.getByText("Clear All"));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it("renders View link only when entry has URL", () => {
    render(<AppliedTracker appliedList={mockList} onRemove={jest.fn()} onClear={jest.fn()} />);
    const links = screen.getAllByText("View");
    expect(links).toHaveLength(1); // Only first entry has URL
  });

  it("renders formatted dates", () => {
    render(<AppliedTracker appliedList={mockList} onRemove={jest.fn()} onClear={jest.fn()} />);
    // Apr 10 and Apr 9 should appear
    expect(screen.getByText("Apr 10")).toBeInTheDocument();
    expect(screen.getByText("Apr 9")).toBeInTheDocument();
  });
});

// ============================================================
// LandingScreen
// ============================================================

describe("LandingScreen", () => {
  it("renders tagline", () => {
    render(<LandingScreen onStart={jest.fn()} />);
    expect(screen.getByText("AI-powered job search pipeline for busy professionals.")).toBeInTheDocument();
  });

  it("renders Start as Guest button", () => {
    render(<LandingScreen onStart={jest.fn()} />);
    expect(screen.getByText(/Start as Guest/)).toBeInTheDocument();
  });

  it("renders privacy message", () => {
    render(<LandingScreen onStart={jest.fn()} />);
    expect(screen.getByText("Your data stays private. No account required to start.")).toBeInTheDocument();
  });

  it("calls onStart when button is clicked", async () => {
    const onStart = jest.fn();
    const user = userEvent.setup();
    render(<LandingScreen onStart={onStart} />);
    await user.click(screen.getByText(/Start as Guest/));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("renders logo image with alt text", () => {
    render(<LandingScreen onStart={jest.fn()} />);
    expect(screen.getByAltText("PeelAway Logic")).toBeInTheDocument();
  });

  it("renders Demo Mode toggle defaulting to OFF", () => {
    render(<LandingScreen onStart={jest.fn()} demoMode={false} onDemoModeChange={jest.fn()} />);
    const checkbox = screen.getByTestId("demo-toggle-checkbox");
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).not.toBeChecked();
  });

  it("renders Demo Mode toggle as ON when demoMode is true", () => {
    render(<LandingScreen onStart={jest.fn()} demoMode={true} onDemoModeChange={jest.fn()} />);
    const checkbox = screen.getByTestId("demo-toggle-checkbox");
    expect(checkbox).toBeChecked();
  });

  it("calls onDemoModeChange when toggle is clicked", async () => {
    const onDemoModeChange = jest.fn();
    const user = userEvent.setup();
    render(<LandingScreen onStart={jest.fn()} demoMode={false} onDemoModeChange={onDemoModeChange} />);
    await user.click(screen.getByTestId("demo-toggle-checkbox"));
    expect(onDemoModeChange).toHaveBeenCalledWith(true);
  });

  it("shows hint text when demo mode is ON", () => {
    render(<LandingScreen onStart={jest.fn()} demoMode={true} onDemoModeChange={jest.fn()} />);
    expect(screen.getByTestId("demo-toggle-hint")).toBeInTheDocument();
    expect(screen.getByText("Demo: 1 result per search, scores floored at 80%")).toBeInTheDocument();
  });

  it("does not show hint text when demo mode is OFF", () => {
    render(<LandingScreen onStart={jest.fn()} demoMode={false} onDemoModeChange={jest.fn()} />);
    expect(screen.queryByTestId("demo-toggle-hint")).not.toBeInTheDocument();
  });
});

// ============================================================
// Header
// ============================================================

describe("Header", () => {
  it("renders logo image", () => {
    render(<Header />);
    expect(screen.getByAltText("PeelAway Logic")).toBeInTheDocument();
  });

  it("renders brand name and tagline", () => {
    render(<Header />);
    expect(screen.getByText("PeelAway Logic")).toBeInTheDocument();
    expect(screen.getByText("Peel away the noise. Surface what matters.")).toBeInTheDocument();
  });

  it("has header class on container", () => {
    const { container } = render(<Header />);
    expect(container.firstChild).toHaveClass("header");
  });

  it("logo has pointer cursor when onLogoClick is provided", () => {
    render(<Header onLogoClick={jest.fn()} />);
    const logo = screen.getByTestId("header-logo");
    expect(logo).toHaveStyle({ cursor: "pointer" });
  });

  it("calls onLogoClick when logo is clicked", async () => {
    const onLogoClick = jest.fn();
    const user = userEvent.setup();
    render(<Header onLogoClick={onLogoClick} />);
    await user.click(screen.getByTestId("header-logo"));
    expect(onLogoClick).toHaveBeenCalledTimes(1);
  });

  it("logo does not have pointer cursor when no onLogoClick", () => {
    render(<Header />);
    const logo = screen.getByTestId("header-logo");
    expect(logo).not.toHaveStyle({ cursor: "pointer" });
  });
});

// ============================================================
// GuideBar
// ============================================================

describe("GuideBar", () => {
  it("renders emoji and text", () => {
    const { container } = render(<GuideBar emoji="X" text="Search for jobs" />);
    expect(container.querySelector(".guide-emoji")).toBeInTheDocument();
    expect(screen.getByText("Search for jobs")).toBeInTheDocument();
  });

  it("has guide class on container", () => {
    const { container } = render(<GuideBar emoji="!" text="test" />);
    expect(container.firstChild).toHaveClass("guide");
  });

  it("renders emoji prop in guide-emoji span", () => {
    const { container } = render(<GuideBar emoji="!" text="hello" />);
    const emojiSpan = container.querySelector(".guide-emoji");
    expect(emojiSpan).toBeInTheDocument();
    expect(emojiSpan.textContent).toBe("!");
  });

  it("renders text in guide-text div", () => {
    const { container } = render(<GuideBar emoji="!" text="guide text" />);
    expect(container.querySelector(".guide-text").textContent).toBe("guide text");
  });
});

// ============================================================
// Spinner
// ============================================================

describe("Spinner", () => {
  it("renders with jsp-spinner class", () => {
    const { container } = render(<Spinner />);
    expect(container.querySelector(".jsp-spinner")).toBeInTheDocument();
  });

  it("renders as a span element", () => {
    const { container } = render(<Spinner />);
    expect(container.querySelector("span.jsp-spinner")).toBeInTheDocument();
  });
});
