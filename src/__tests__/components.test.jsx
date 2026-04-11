import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import JobSearchPipelineV4 from "../JobSearchPipelineV4";

// Mock environment variables
const originalEnv = process.env;

beforeEach(() => {
  process.env = { ...originalEnv, REACT_APP_ANTHROPIC_API_KEY: "test-key-123" };
});

afterEach(() => {
  process.env = originalEnv;
});

// ============================================================
// Main Pipeline Component
// ============================================================

describe("JobSearchPipelineV4", () => {
  it("renders the landing screen with logo and start button", () => {
    render(<JobSearchPipelineV4 />);
    expect(screen.getByText("Start as Guest", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("AI-powered job search pipeline for busy professionals.")).toBeInTheDocument();
  });

  it("navigates to Scout phase when Start as Guest is clicked", async () => {
    const user = userEvent.setup();
    render(<JobSearchPipelineV4 />);
    await user.click(screen.getByText("Start as Guest", { exact: false }));
    expect(screen.getByText("Job Search Pipeline")).toBeInTheDocument();
    expect(screen.getByText("Upload Resume (PDF or TXT)")).toBeInTheDocument();
  });

  it("renders the progress stepper with all 4 phases after starting", async () => {
    const user = userEvent.setup();
    render(<JobSearchPipelineV4 />);
    await user.click(screen.getByText("Start as Guest", { exact: false }));
    expect(screen.getAllByText(/Scout/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Review/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Tailor/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Complete")).toBeInTheDocument();
  });
});

// ============================================================
// Scout Phase - Layer Buttons
// ============================================================

describe("Scout Phase UI", () => {
  async function startPipeline() {
    const user = userEvent.setup();
    render(<JobSearchPipelineV4 />);
    await user.click(screen.getByText("Start as Guest", { exact: false }));
    return user;
  }

  it("renders the upload resume button", async () => {
    await startPipeline();
    expect(screen.getByText("Upload Resume (PDF or TXT)")).toBeInTheDocument();
  });

  it("renders all three search layer buttons", async () => {
    await startPipeline();
    expect(screen.getByText("Job Boards")).toBeInTheDocument();
    expect(screen.getByText("RSS Feeds")).toBeInTheDocument();
    expect(screen.getByText("ATS Boards")).toBeInTheDocument();
  });

  it("renders the Score & Review button (disabled initially)", async () => {
    await startPipeline();
    const scoreBtn = screen.getByText(/Score & Review/);
    expect(scoreBtn).toBeInTheDocument();
    expect(scoreBtn).toBeDisabled();
  });

  it("shows hint about running a search layer first", async () => {
    await startPipeline();
    expect(screen.getByText("Run at least one search layer before scoring.")).toBeInTheDocument();
  });

  it("renders the Quick Score section", async () => {
    await startPipeline();
    expect(screen.getByText("Quick Score")).toBeInTheDocument();
  });

  it("shows Paste URL and Paste JD Text toggle buttons", async () => {
    await startPipeline();
    expect(screen.getByText("Paste URL")).toBeInTheDocument();
    expect(screen.getByText("Paste JD Text")).toBeInTheDocument();
  });

  it("renders URL input by default in ManualJobInput", async () => {
    await startPipeline();
    expect(screen.getByPlaceholderText("https://jobs.lever.co/company/job-id")).toBeInTheDocument();
  });

  it("switches to textarea when Paste JD Text is clicked", async () => {
    const user = await startPipeline();
    await user.click(screen.getByText("Paste JD Text"));
    expect(screen.getByPlaceholderText("Paste the full job description here...")).toBeInTheDocument();
  });

  it("renders the Score This Job button", async () => {
    await startPipeline();
    expect(screen.getByText("Score This Job")).toBeInTheDocument();
  });

  it("disables layer buttons when no profile is loaded", async () => {
    await startPipeline();
    const layerBtn = screen.getByText("Job Boards").closest("button");
    expect(layerBtn).toBeDisabled();
  });

  it("renders the guide banner for Scout phase", async () => {
    await startPipeline();
    expect(screen.getByText("Upload your resume, then run one or more search layers to find matching jobs.")).toBeInTheDocument();
  });
});
