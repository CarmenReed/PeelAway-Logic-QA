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
| - | - | No active items |

> Items will be added to this table as each iteration begins. Completed items are promoted to production and cleared from this list.

## What It Does

This is the QA copy of the AI-powered job search automation tool built with React and the Anthropic Claude API. It runs a full PeelAway Logic in four phases:

1. **Scout** - Upload your resume (PDF or TXT) or paste text. The app extracts skills, experience level, location, and generates search queries automatically via regex-based profile extraction. Configure search filters (work type, date posted, employment type, US zip code + radius) then run three independent search layers:
   - **Layer 1:** Job boards (Adzuna + JSearch) - aggregator APIs searched in parallel, US-only
   - **Layer 2:** RSS feeds (WeWorkRemotely, Remotive, RemoteOK, Himalayas, Jobicy)
   - **Layer 3:** ATS boards (Greenhouse, Lever, Workday) via AI-driven web search, US-only
   - **Quick Score:** Score a specific job by pasting a URL or job description text (integrated into Step 3)
   - Each layer runs independently with disable flow (one at a time, completed layers stay disabled until Start Over).
   - When ready, click "Score & Review" to deduplicate, pre-filter, score, fetch full JDs, and re-score.

2. **Review** - Discovered roles organized into tiers (Strong Match 8-10, Possible 6-7, Weak 3-5, Rejected 0-2). Sort by score, date posted (newest first), or company. Fresh postings (within 7 days) display a green date badge; stale or unverifiable dates show an orange warning. Select which roles to move forward with via the Human Gate - no document generation API calls are made until you explicitly approve.

3. **Complete** - Each approved role displays as a card with a clickable link to the original job posting and two independent buttons: "Create Resume" and "Create Cover Letter." Each document is one click, one API call. Nothing generates automatically. Download, copy, or regenerate any document individually. Mark jobs as applied. Applied jobs are tracked across sessions and automatically excluded from future scout runs.

## Testing & Quality

### Testing Strategy

PeelAway Logic uses a two-tier testing approach driven by user stories with acceptance criteria:

- **Unit/Component tests:** Jest + React Testing Library validate individual functions, components, and integration points. 451 tests across 16 suites, all passing.
- **E2E tests:** Microsoft Playwright validates complete user workflows through the 4-phase pipeline in a real Chromium browser. 62 tests across 7 spec files (42 passing, 20 pending via `test.fixme()` awaiting full pipeline data seeding).
- **All external APIs mocked:** Tests are deterministic and free to run. E2E tests mock Anthropic, Adzuna, JSearch, and RSS feeds via `page.route()`. Jest tests use standard mocks. Zero API costs.
- **User stories with acceptance criteria** in `docs/user-stories/` drive test coverage across both E2E and unit tests.

### Test Coverage

| Layer | Framework | Files | Tests | Status |
|-------|-----------|-------|-------|--------|
| Unit/Component | Jest + RTL | 16 | 451 | All passing |
| E2E | Playwright | 7 | 42 passing, 20 pending | Active |
| User Stories | -- | 7 | Acceptance criteria | Documented |

### Running Tests

```bash
npm test                        # Jest interactive watch mode
CI=true npm test                # Jest headless (CI)
npm run test:e2e                # Playwright headless
npm run test:e2e:ui             # Playwright interactive UI mode
npm run test:e2e:headed         # Playwright headed browser
npx playwright show-report      # View HTML test report
```

### User Story Traceability

Requirements are defined as user stories with acceptance criteria in [`docs/user-stories/`](docs/user-stories/). Each story maps to specific E2E specs and unit test files, providing full traceability from requirement to test.

### Environment Strategy

All tests live in the QA environment only. The production repo ships clean artifacts, and QA validates before promotion.

## Tech Stack

- React 18 (Create React App)
- Anthropic Claude API (`claude-sonnet-4-6` for tailoring, `claude-haiku-4-5` for scoring) with `web_search_20250305` tool
- PDF.js v3.11.174 (CDN, pinned) for resume text extraction
- Google Fonts (Fredoka for brand header)
- localStorage for applied job tracking across sessions
- @playwright/test (E2E browser testing, Microsoft)
- wait-on (CI server readiness check)

## Azure Integration

PeelAway Logic includes a portfolio-quality Azure integration layer demonstrating enterprise AI search and orchestration patterns.

**Azure AI Search** (`src/services/azureSearchService.js`): A REST client for the `peelaway-search` Azure AI Search instance (East US, F0 free tier). Demonstrates index creation with a typed schema, batch document indexing in 50-job chunks, full-text search with OData `$filter` support, and index deletion. All operations return structured result objects and never throw, matching the error-handling pattern used in the main app.

**Semantic Kernel Demo** (`semantic-kernel-demo/`): A Python orchestration demo that mirrors the five PeelAway pipeline phases using Microsoft Semantic Kernel. Implements `JobScoringPlugin` and `ResumeParserPlugin` as native SK plugins and wires them into a kernel. The demo is Azure OpenAI swap-ready: `AzureChatCompletion` is included as a commented-in alternative to `OpenAIChatCompletion`, so switching providers requires a single line change and environment variable updates.

For architecture diagrams and component context, see [docs/architecture/ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md).

For design decisions behind the Azure integration, see the ADRs in [docs/architecture/decisions/](docs/architecture/decisions/).

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
- Demo Mode toggle on the Landing page for streamlined live demos (1 result per search, scores floored at 80%)
- Clickable header logo to return to Landing from any phase
- Mobile-responsive layout
- Graceful cancellation at any phase
-  unit and component tests across  suites (Jest + React Testing Library)
- 62 E2E tests across 7 Playwright specs validating full user workflows

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

**Jest (Unit/Component):** 451 tests across 16 suites

```bash
npm test                        # Interactive watch mode
CI=true npm test                # Headless (CI)
```

- **pipelineUtils.test.js** - Unit tests for pure utility functions (JSON extraction, deduplication, title normalization, pre-filtering, prompt builders)
- **utilsKeywordPreFilter.test.js** - Dynamic keyword pre-filter tests with profile-driven level and location filtering
- **profileExtractor.test.js** - Resume parsing tests (name, skills, experience, levels, location, search queries)
- **scoutPhase.test.jsx** - Scout phase render tests (filters, buttons, extracted profile display)
- **componentUnits.test.jsx** - Individual component render tests (Header, GuideBar, Spinner, JobCard, ProgressStepper)
- **components.test.jsx** - Pipeline layout and integration tests
- **manualJobInput.test.jsx** - Quick Score component tests (tab switching, scoring flow, add to queue)
- **reviewPhase.test.jsx** - Review phase tier display and selection tests
- **completePhase.test.jsx** - Complete phase render, document generation, download, and apply tracking tests
- **progressStepper.test.jsx** - Phase navigation stepper tests (4 phases)
- **tailorPhase.test.js** - Document generation component tests (session restore, persistence, cancel, error handling)
- **tailorPersistence.test.js** - Persistence layer tests for document generation data
- **api.test.js** - API wrapper and retry logic tests
- **storage.test.js** - localStorage wrapper tests
- **hooks.test.js** - Custom hook tests
- **azureSearchService.test.js** - Azure AI Search REST client tests

**Playwright (E2E):** 62 tests across 7 spec files

```bash
npm run test:e2e                # Headless
npm run test:e2e:ui             # Interactive UI mode
npm run test:e2e:headed         # Headed browser
npx playwright show-report      # View HTML report
```

- **01-landing.spec.ts** (8 tests) - Landing page branding, guest entry, navigation to Scout, demo mode toggle
- **02-scout.spec.ts** (10 tests) - Resume upload/paste, profile extraction, search layer UI, Quick Score
- **03-review.spec.ts** (8 tests) - Tier tabs, sort controls, structural checks (5 pending scored data)
- **04-human-gate.spec.ts** (6 tests) - Job selection, advance controls, human intent enforcement (6 pending scored data)
- **05-complete.spec.ts** (14 tests) - Document generation, status tracking, downloads, applied tracking, localStorage persistence (11 pending pipeline data)
- **07-navigation.spec.ts** (9 tests) - ProgressStepper (4 phases), Header, GuideBar, responsive layout, phase guards, logo navigation
- **08-demo-mode.spec.ts** (7 tests) - Demo Mode toggle, hint text, logo-click-to-Landing navigation

### CI/CD Integration

GitHub Actions (`deploy.yml`) runs both test tiers on every push to main:

1. `CI=true npm test` runs all 425 Jest tests
2. `npx playwright install --with-deps chromium` installs browser binaries
3. `npm start` + `wait-on` + `npx playwright test` runs all E2E tests
4. Failed tests block the build and deployment

## Usage Notes

- Upload your resume as a PDF or TXT, or paste text directly. The app auto-extracts skills, experience, and generates search queries.
- Review and edit extracted profile (skills, target levels, search queries) before searching
- Configure search filters: work type (remote/hybrid/on-site/any), date posted, employment type, and zip code + radius for non-remote searches
- Run search layers one at a time. Each layer takes 30 seconds to 2 minutes depending on API response times.
- Use Quick Score (Step 3) to paste a specific job URL or description for immediate scoring
- "Score & Review" handles deduplication, pre-filtering, scoring, JD fetching, and re-scoring in one pass
- Only Strong Match (8-10) and Possible (6-7) roles advance to the Human Gate
- In the Complete phase, generate resume and cover letter independently per role
- Previously applied roles are automatically excluded from future scout runs

## Project Background

Built as a suite of AI-powered tools designed to reduce executive function friction in the job search process.

## Author

**Carmen Reed**
Solutions Architect | AI Integration Specialist
[linkedin.com/in/carmenreed](https://linkedin.com/in/carmenreed) | carmen.v.reed@gmail.com

Architected and built by Carmen Reed as part of the PeelAway Logic initiative. Carmen has decades of experience in enterprise software architecture, full-stack .NET development, and generative AI integration. This tool reflects her applied approach to agentic workflow design and AI-augmented productivity tooling.
