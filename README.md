# PeelAway Logic - QA Environment

QA environment for the PeelAway Logic application. Features are developed, tested, and validated here before each release.

## What It Does

PeelAway Logic is an AI-powered job search automation tool built with React and the Anthropic Claude API. It runs a four-phase pipeline:

1. **Scout** - Upload your resume (PDF or TXT), paste text, or import from Dropbox. The app extracts skills, experience level, location, and generates search queries automatically via regex-based profile extraction. Configure search filters (work type, date posted, employment type, US zip code + radius) then run three independent search layers:
   - **Layer 1:** Job boards (Adzuna + JSearch), aggregator APIs searched in parallel, US-only
   - **Layer 2:** RSS feeds (WeWorkRemotely, Remotive, RemoteOK, Himalayas, Jobicy)
   - **Layer 3:** ATS boards (Greenhouse, Lever, Workday) via AI-driven web search, US-only
   - **Quick Score:** Score a specific job by pasting a URL or job description text (integrated into Step 3)
   - Each layer runs independently with disable flow (one at a time, completed layers stay disabled until Start Over).
   - When ready, click "Score & Review" to deduplicate, pre-filter, score, fetch full JDs, and re-score.

2. **Review** - Discovered roles organized into tiers (Strong Match 8-10, Possible 6-7, Weak 3-5, Rejected 0-2). Sort by score, date posted (newest first), or company. Fresh postings (within 7 days) display a green date badge; stale or unverifiable dates show an orange warning. Strong Match and Possible tiers are selectable; Weak and Rejected are visible for reference but cannot advance. Select which roles to move forward with via the Human Gate; no document generation API calls are made until you explicitly approve.

3. **Complete** - Each approved role displays as a card with a clickable link to the original job posting and two independent buttons: "Create Resume" and "Create Cover Letter." Each document is one click, one API call. Nothing generates automatically. Download as TXT, Markdown, or PDF; copy to clipboard; or regenerate any document individually. Save generated documents to Dropbox when connected. Mark jobs as applied. Applied jobs are tracked across sessions and automatically excluded from future scout runs.

## Dropbox Integration

PeelAway Logic supports optional Dropbox workspace connection via OAuth 2.0:

- **Connect/disconnect** from the Landing page ("Connect Your Workspace" button)
- **Import resume** from Dropbox in the Scout phase via the Dropbox Chooser widget
- **Save generated documents** (resumes and cover letters) to Dropbox in the Complete phase
- **Auto-sync** applied jobs, tailor results, scout data, and dismissed jobs to `/PeelAway Logic/peelaway-sync-data.json` in the user's Dropbox (5-second debounce)
- **Cross-device continuity** via cloud-synced state with intelligent merge logic

Dropbox is fully optional. The app works as a guest without connecting.

## Testing & Quality

### Testing Strategy

PeelAway Logic uses a two-tier testing approach driven by user stories with acceptance criteria:

- **Unit/Component tests:** Jest + React Testing Library validate individual functions, components, and integration points. 451 tests across 18 suites, all passing.
- **E2E tests:** Microsoft Playwright validates complete user workflows through the 4-phase pipeline in a real Chromium browser. 70 tests across 8 spec files (42 passing, 20 pending via `test.fixme()` awaiting full pipeline data seeding).
- **Accessibility tests:** `jest-axe` covers vision impaired rules (image alt, button/link/label names, ARIA validity, SVG labeling, list structure) at the unit level. `@axe-core/playwright` covers color contrast and focus/landmark rules that need a real browser. See `docs/hci-audit/README.md` for the governance process.
- **All external APIs mocked:** Tests are deterministic and free to run. E2E tests mock Anthropic, Adzuna, JSearch, and RSS feeds via `page.route()`. Jest tests use standard mocks. Zero API costs.
- **User stories with acceptance criteria** in `docs/user-stories/` drive test coverage across both E2E and unit tests.

### Test Coverage

| Layer | Framework | Files | Tests | Status |
|-------|-----------|-------|-------|--------|
| Unit/Component | Jest + RTL | 18 | 451 | All passing |
| Accessibility (unit) | jest-axe | 1 | Vision impaired rules | Active |
| E2E | Playwright | 8 | 42 passing, 20 pending | Active |
| Accessibility (E2E) | @axe-core/playwright | 1 | Color contrast, focus order, landmarks | Active |
| User Stories | n/a | 7 | Acceptance criteria | Documented |

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

Tests are validated before each release. The production repo ships clean, tested artifacts.

## Tech Stack

- React 18 (Create React App)
- Anthropic Claude API (`claude-sonnet-4-6` for tailoring, `claude-haiku-4-5` for scoring) with `web_search_20250305` tool
- Dropbox OAuth 2.0 (cloud sync, resume import, document export)
- PDF.js v3.11.174 (CDN, pinned) for resume text extraction
- Google Fonts (Fredoka for brand header, Quicksand for body)
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
- Full job description fetch, re-score, and re-tier after initial discovery
- 7-day freshness enforcement with date-posted sorting
- Anti-hallucination resume generation: only draws from your actual profile, enforced at the prompt layer
- Separate resume and cover letter generation (one API call each, on demand)
- Download generated documents as TXT, Markdown, or PDF; copy to clipboard
- Save generated documents to Dropbox when connected
- ATS-proof output formatting
- Applied jobs tracker with persistent storage and cross-device Dropbox sync
- Dismissed jobs tracking to exclude unwanted roles from future runs
- Demo Mode toggle on the Landing page for streamlined live demos (1 result per search, scores floored at 80%)
- Dropbox workspace connection with OAuth 2.0 (resume import, document export, auto-sync)
- Clickable header logo to return to Landing from any phase
- Mobile-responsive layout
- Graceful cancellation at any phase
- HCI governance audit: pre-commit impact analyzer that classifies changes by user facing tier and flags UAT re-test cycles (`npm run hci-audit`, skill at `.claude/skills/hci-audit/`)
- Accessibility test coverage for vision impaired users via `jest-axe` and `@axe-core/playwright` (alt text, ARIA, labels, color contrast)
- Documentation sync: `npm run docs-sync` keeps the README and entry point test file lists, per spec counts, and structural tables aligned with the actual `src/__tests__/` and `e2e/` inventory; same script also runs in CI via `.github/workflows/update-docs.yml`
-  unit and component tests across  suites (Jest + React Testing Library)
- 70 E2E tests across 8 Playwright specs validating full user workflows

## Setup

### Prerequisites

- Node.js 18+
- An Anthropic API key with web search enabled ([console.anthropic.com](https://console.anthropic.com))
- (Optional) A Dropbox app key for cloud sync ([dropbox.com/developers](https://www.dropbox.com/developers))

### Local Development

```bash
git clone https://github.com/CarmenReed/PeelAway-Logic-QA.git
cd PeelAway-Logic-QA
npm install
```

Create a `.env` file in the project root:

```
REACT_APP_ANTHROPIC_API_KEY=sk-ant-api03-yourkey
REACT_APP_DROPBOX_APP_KEY=your-dropbox-app-key
```

```bash
npm start
```

### Running Tests

Tests are validated before each release.

**Jest (Unit/Component):** 451 tests across 18 suites

```bash
npm test                        # Interactive watch mode
CI=true npm test                # Headless (CI)
```

- **accessibility.test.jsx** - Vision impaired accessibility tests via `jest-axe` (image alt, button/link/label names, ARIA validity, SVG labeling, dialog semantics, aria-current on pipeline stepper)
- **api.test.js** - API wrapper and retry logic tests
- **azureSearchService.test.js** - Azure AI Search REST client tests
- **completePhase.test.jsx** - Complete phase render, document generation, download, and apply tracking tests
- **componentUnits.test.jsx** - Individual component render tests (Header, GuideBar, Spinner, JobCard, ProgressStepper)
- **components.test.jsx** - Pipeline layout and integration tests
- **generate-repo-map.test.js** - Tests for the REPO_MAP.md generator script
- **hooks.test.js** - Custom hook tests
- **manualJobInput.test.jsx** - Quick Score component tests (tab switching, scoring flow, add to queue)
- **pipelineUtils.test.js** - Unit tests for pure utility functions (JSON extraction, deduplication, title normalization, pre-filtering, prompt builders)
- **profileExtractor.test.js** - Resume parsing tests (name, skills, experience, levels, location, search queries)
- **progressStepper.test.jsx** - Phase navigation stepper tests (4 phases)
- **reviewPhase.test.jsx** - Review phase tier display and selection tests
- **scoutPhase.test.jsx** - Scout phase render tests (filters, buttons, extracted profile display)
- **storage.test.js** - localStorage wrapper tests
- **tailorPersistence.test.js** - Persistence layer tests for document generation data
- **tailorPhase.test.js** - Document generation component tests (session restore, persistence, cancel, error handling)
- **utilsKeywordPreFilter.test.js** - Dynamic keyword pre-filter tests with profile-driven level and location filtering

**Playwright (E2E):** 70 tests across 8 spec files

```bash
npm run test:e2e                # Headless
npm run test:e2e:ui             # Interactive UI mode
npm run test:e2e:headed         # Headed browser
npx playwright show-report      # View HTML report
```

- **01-landing.spec.ts** (8 tests) - Landing page branding, guest entry, navigation to Scout, demo mode toggle
- **02-scout.spec.ts** (10 tests) - Resume upload/paste, profile extraction, search layer UI, Quick Score
- **03-review.spec.ts** (9 tests) - Tier tabs, sort controls, structural checks (5 pending scored data)
- **04-human-gate.spec.ts** (7 tests) - Job selection, advance controls, human intent enforcement (6 pending scored data)
- **05-complete.spec.ts** (13 tests) - Document generation, status tracking, downloads, applied tracking, localStorage persistence (11 pending pipeline data)
- **07-navigation.spec.ts** (11 tests) - ProgressStepper (4 phases), Header, GuideBar, responsive layout, phase guards, logo navigation
- **08-demo-mode.spec.ts** (7 tests) - Demo Mode toggle, hint text, logo-click-to-Landing navigation
- **09-accessibility.spec.ts** (5 tests) - Full-page axe scan, vision impaired critical rules, color contrast, `aria-current` verification, keyboard reachability

### CI/CD Integration

GitHub Actions (`deploy.yml`) runs both test tiers on every push to main:

1. `CI=true npm test` runs all 451 Jest tests
2. `npx playwright install --with-deps chromium` installs browser binaries
3. `npm start` + `wait-on` + `npx playwright test` runs all E2E tests
4. Failed tests block the build and deployment

## Usage Notes

- Upload your resume as a PDF or TXT, paste text directly, or import from Dropbox. The app auto-extracts skills, experience, and generates search queries.
- Review and edit extracted profile (skills, target levels, search queries) before searching
- Configure search filters: work type (remote/hybrid/on-site/any), date posted, employment type, and zip code + radius for non-remote searches
- Run search layers one at a time. Each layer takes 30 seconds to 2 minutes depending on API response times.
- Use Quick Score (Step 3) to paste a specific job URL or description for immediate scoring
- "Score & Review" handles deduplication, pre-filtering, scoring, JD fetching, re-scoring, and re-tiering in one pass
- All four tiers are visible in Review. Strong Match (8-10) and Possible (6-7) roles are selectable and can advance to the Human Gate. Weak (3-5) and Rejected (0-2) are shown for reference only.
- In the Complete phase, generate resume and cover letter independently per role. Download as TXT, Markdown, or PDF; copy to clipboard; or save to Dropbox.
- Previously applied roles are automatically excluded from future scout runs
- Connect Dropbox from the Landing page for cross-device sync of applied jobs, scout data, and generated documents

## Project Background

Built as a suite of AI-powered tools designed to reduce executive function friction in the job search process.

## Author

**Carmen Reed**
Solutions Architect | AI Integration Specialist
[linkedin.com/in/carmenreed](https://linkedin.com/in/carmenreed) | carmen.v.reed@gmail.com

Architected and built by Carmen Reed as part of the PeelAway Logic initiative. Carmen has decades of experience in enterprise software architecture, full-stack .NET development, and generative AI integration. This tool reflects her applied approach to agentic workflow design and AI-augmented productivity tooling.
