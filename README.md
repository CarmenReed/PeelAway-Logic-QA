# PeelAway Logic - QA Environment

**Quality Assurance (QA)** environment for the PeelAway Logic application. This is where new features are developed, bugs are fixed, and changes are validated before being promoted to production.

## Purpose

This folder serves as the staging ground for all iterative work on PeelAway Logic. Each development cycle, new features and bug fixes are implemented and tested here first. Changes are only promoted to `PeelAway Logic` after passing QA validation.

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

This is the QA copy of the AI-powered job search automation tool built with React and the Anthropic Claude API. It runs a full PeelAway Logic in five phases:

1. **Scout** - Upload your resume (PDF or TXT) or paste text. The app extracts skills, experience level, location, and generates search queries automatically via regex-based profile extraction. Configure search filters (work type, date posted, employment type, US zip code + radius) then run three independent search layers:
   - **Layer 1:** Job boards (Adzuna + JSearch) - aggregator APIs searched in parallel, US-only
   - **Layer 2:** RSS feeds (WeWorkRemotely, Remotive, RemoteOK, Himalayas, Jobicy)
   - **Layer 3:** ATS boards (Greenhouse, Lever, Workday) via AI-driven web search, US-only
   - **Quick Score:** Score a specific job by pasting a URL or job description text (integrated into Step 3)
   - Each layer runs independently with disable flow (one at a time, completed layers stay disabled until Start Over).
   - When ready, click "Score & Review" to deduplicate, pre-filter, score, fetch full JDs, and re-score.

2. **Review** - Discovered roles organized into tiers (Strong Match 8-10, Possible 6-7, Weak 3-5, Rejected 0-2). Sort by score, date posted (newest first), or company. Fresh postings (within 7 days) display a green date badge; stale or unverifiable dates show an orange warning.

3. **Human Gate** - Select which roles to move forward with. No tailoring API calls are made until you explicitly approve.

4. **Tailor** - Each approved role displays as a card with two independent buttons: "Create Resume" and "Create Cover Letter." Each document is one click, one API call. Nothing generates automatically. Download, copy, or regenerate any document individually.

5. **Complete** - Download or copy your tailored documents per role. Mark jobs as applied. Applied jobs are tracked across sessions and automatically excluded from future scout runs.

## Tech Stack

- React 18 (Create React App)
- Anthropic Claude API (`claude-sonnet-4-6` for tailoring, `claude-haiku-4-5` for scoring) with `web_search_20250305` tool
- PDF.js v3.11.174 (CDN, pinned) for resume text extraction
- Google Fonts (Fredoka for brand header)
- localStorage for applied job tracking across sessions

## Features

- Regex-based profile extraction from uploaded resume (skills, experience level, titles, location, search queries)
- Editable extracted profile UI (add/remove skills, toggle target levels, edit search queries)
- User-configurable search filters (work type, date posted, employment type, US zip code + radius)
- Zip code + radius filter active only for hybrid/on-site/any work types
- All searches hard-coded to United States only
- 3 independent search layers with per-layer abort controllers, disable flow, and status tracking
- Cross-source duplicate detection using normalized company+title matching (catches "Sr. Software Eng" at "Acme Inc" and "Senior Software Engineer" at "Acme" as the same listing)
- Quick Score (paste URL or JD text) integrated into Step 3 for scoring individual jobs
- Dynamic keyword pre-filter driven by extracted profile (level-based and location-based)
- Full job description fetch and re-score after initial discovery
- 7-day freshness enforcement with date-posted sorting
- Anti-hallucination resume generation: only draws from your actual profile, enforced at the prompt layer
- Separate resume and cover letter generation (one API call each, on demand)
- ATS-proof output formatting
- Applied jobs tracker with persistent storage
- Mobile-responsive layout
- Graceful cancellation at any phase
- 425 unit and component tests across 15 suites

## Setup

### Prerequisites

- Node.js 18+
- An Anthropic API key with web search enabled ([console.anthropic.com](https://console.anthropic.com))

### Local Development

```bash
git clone https://github.com/CarmenReed/PeelAway-Logic-QA.git
cd PeelAway-Logic-QA
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

All tests live in the QA environment only. Tests are not included in the production folder.

```bash
npm test
```

425 tests across 15 suites:
- **pipelineUtils.test.js** - Unit tests for pure utility functions (JSON extraction, deduplication, title normalization, pre-filtering, prompt builders)
- **utilsKeywordPreFilter.test.js** - Dynamic keyword pre-filter tests with profile-driven level and location filtering
- **profileExtractor.test.js** - Resume parsing tests (name, skills, experience, levels, location, search queries)
- **scoutPhase.test.jsx** - Scout phase render tests (filters, buttons, extracted profile display)
- **componentUnits.test.jsx** - Individual component render tests (Header, GuideBar, Spinner, JobCard, ProgressStepper)
- **components.test.jsx** - Pipeline layout and integration tests
- **manualJobInput.test.jsx** - Quick Score component tests (tab switching, scoring flow, add to queue)
- **reviewPhase.test.jsx** - Review phase tier display and selection tests
- **completePhase.test.jsx** - Complete phase download and apply tracking tests
- **progressStepper.test.jsx** - Phase navigation stepper tests
- **tailorPhase.test.js** - Tailor phase component tests
- **tailorPersistence.test.js** - Persistence layer tests for tailor phase data
- **api.test.js** - API wrapper and retry logic tests
- **storage.test.js** - localStorage wrapper tests
- **hooks.test.js** - Custom hook tests

## Usage Notes

- Upload your resume as a PDF or TXT, or paste text directly. The app auto-extracts skills, experience, and generates search queries.
- Review and edit extracted profile (skills, target levels, search queries) before searching
- Configure search filters: work type (remote/hybrid/on-site/any), date posted, employment type, and zip code + radius for non-remote searches
- Run search layers one at a time. Each layer takes 30 seconds to 2 minutes depending on API response times.
- Use Quick Score (Step 3) to paste a specific job URL or description for immediate scoring
- "Score & Review" handles deduplication, pre-filtering, scoring, JD fetching, and re-scoring in one pass
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
