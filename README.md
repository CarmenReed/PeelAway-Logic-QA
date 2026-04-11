# Job Search Pipeline V4 - UAT Environment

**User Acceptance Testing (UAT)** environment for the Job Search Pipeline V4 application. This is where new features are developed, bugs are fixed, and changes are validated before being promoted to production.

## Purpose

This folder serves as the staging ground for all iterative work on PeelAway Logic. Each development cycle, new features and bug fixes are implemented and tested here first. Changes are only promoted to `PeelAway Logic` after passing UAT validation.

### What Gets Tracked Here

- New feature development and integration
- Bug fixes and regression corrections
- UI/UX improvements
- API and performance optimizations
- Test coverage expansion

## Current Iteration

| Item | Type | Status |
|------|------|--------|
| — | — | No active items |

> Items will be added to this table as each iteration begins. Completed items are promoted to production and cleared from this list.

## What It Does

This is the UAT copy of the AI-powered job search automation tool built with React and the Anthropic Claude API. It runs a full job search pipeline in five phases:

1. **Scout** - Upload your resume, then run three independent search layers with individual controls:
   - **Layer 1:** Job boards (Adzuna + JSearch) - aggregator APIs searched in parallel
   - **Layer 2:** RSS feeds (WeWorkRemotely, Remotive, RemoteOK, Stack Overflow)
   - **Layer 3:** ATS boards (Greenhouse, Lever, Workday) via AI-driven web search
   - **Manual input:** Score a specific job by pasting a URL or job description text
   - Each layer runs independently. Run one, two, or all three. Cancel any layer without affecting others.
   - When ready, click "Score and Review Results" to deduplicate, pre-filter, score, fetch full JDs, and re-score.

2. **Review** - Discovered roles organized into tiers (Strong Match 8-10, Possible 6-7, Weak 3-5, Rejected 0-2). Sort by score, date posted (newest first), or company. Fresh postings (within 7 days) display a green date badge; stale or unverifiable dates show an orange warning.

3. **Human Gate** - Select which roles to move forward with. No tailoring API calls are made until you explicitly approve.

4. **Tailor** - Each approved role displays as a card with two independent buttons: "Create Resume" and "Create Cover Letter." Each document is one click, one API call. Nothing generates automatically. Download, copy, or regenerate any document individually.

5. **Complete** - Download or copy your tailored documents per role. Mark jobs as applied. Applied jobs are tracked across sessions and automatically excluded from future scout runs.

## Tech Stack

- React 18 (Create React App)
- Anthropic Claude API (`claude-sonnet-4-6` for tailoring, `claude-haiku-4-5` for scoring) with `web_search_20250305` tool
- PDF.js v3.11.174 (CDN, pinned) for resume text extraction
- localStorage for applied job tracking across sessions

## Features

- 3 independent search layers with per-layer abort controllers and status tracking
- Cross-source duplicate detection using normalized company+title matching (catches "Sr. Software Eng" at "Acme Inc" and "Senior Software Engineer" at "Acme" as the same listing)
- Manual job URL/paste scorer for evaluating specific postings outside the automated search
- Full job description fetch and re-score after initial discovery
- 7-day freshness enforcement with date-posted sorting
- Anti-hallucination resume generation: only draws from your actual profile, enforced at the prompt layer
- Separate resume and cover letter generation (one API call each, on demand)
- ATS-proof output formatting
- Applied jobs tracker with persistent storage
- Mobile-responsive layout
- Graceful cancellation at any phase
- 132 unit and component tests

## Setup

### Prerequisites

- Node.js 18+
- An Anthropic API key with web search enabled ([console.anthropic.com](https://console.anthropic.com))

### Local Development

```bash
git clone https://github.com/CarmenReed/AI-Agentic-Solutions-Architecture.git
cd AI-Agentic-Solutions-Architecture/PeelAway-Logic-QA
npm install
```

Create a `.env` file in the project root:

```
REACT_APP_ANTHROPIC_API_KEY=sk-ant-api03-yourkey
```

```bash
npm start
```

### Running Tests

All tests live in the UAT environment only. Tests are not included in the production folder.

```bash
npm test
```

132 tests across four suites:
- **pipelineUtils.test.js** - Unit tests for all pure utility functions (JSON extraction, job deduplication, title normalization, keyword pre-filtering, prompt builders)
- **components.test.jsx** - React component render tests (pipeline layout, scout phase layer buttons, manual job input)
- **tailorPhase.test.js** - Tailor phase component tests
- **tailorPersistence.test.js** - Persistence layer tests for tailor phase data

## Usage Notes

- Upload your resume as a PDF or TXT, or paste text directly
- Run any combination of search layers. Each layer takes 30 seconds to 2 minutes depending on API response times.
- "Score and Review Results" handles deduplication, pre-filtering, scoring, JD fetching, and re-scoring in one pass
- Only Strong Match (8-10) and Possible (6-7) roles advance to the Human Gate
- In the Tailor phase, generate resume and cover letter independently per role
- Previously applied roles are automatically excluded from future scout runs

## Project Background

Built as a suite of AI-powered tools designed to support neurodivergent job seekers by reducing executive function friction in the job search process.

## Author

**Carmen Reed**
Solutions Architect | AI Integration Specialist
[linkedin.com/in/carmenreed](https://linkedin.com/in/carmenreed) | carmen.v.reed@gmail.com

Architected and built by Carmen Reed as part of the PeelAway Logic initiative. Carmen has decades of experience in enterprise software architecture, full-stack .NET development, and generative AI integration. This tool reflects her applied approach to agentic workflow design and AI-augmented productivity tooling.
