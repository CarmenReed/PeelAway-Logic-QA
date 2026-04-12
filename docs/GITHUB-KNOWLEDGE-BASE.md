# PeelAway Logic - GitHub Knowledge Base

> Generated: 2026-04-11
> Covers: QA/DEV local repo + GitHub production repo
> Author: Carmen Reed - Solutions Architect

---

## Table of Contents

1. [Repository Overview](#1-repository-overview)
2. [Folder & File Structure](#2-folder--file-structure)
3. [Tech Stack](#3-tech-stack)
4. [Environment Differences: QA vs PROD](#4-environment-differences-qa-vs-prod)
5. [Environment Variables & Config](#5-environment-variables--config)
6. [Application Pipeline Description](#6-application-pipeline-description)
7. [GitHub Actions CI/CD](#7-github-actions-cicd)
8. [Deployment Setup](#8-deployment-setup)
9. [Testing Setup](#9-testing-setup)
10. [Branch Strategy](#10-branch-strategy)
11. [Key Source Files Reference](#11-key-source-files-reference)

---

## 1. Repository Overview

| Property | QA / DEV (local) | PROD (GitHub) |
|---|---|---|
| **Path / URL** | https://github.com/CarmenReed/PeelAway-Logic-QA | https://github.com/CarmenReed/PeelAway-Logic |
| **Purpose** | Development & testing environment | Live production app |
| **Deployed URL** | https://carmenreed.github.io/PeelAway-Logic-QA | https://carmenreed.github.io/PeelAway-Logic |
| **Package version** | 4.0.0 | 4.0.0 |
| **Default branch** | `main` | `main` |
| **Remotes** | `origin → CarmenReed/PeelAway-Logic-QA` | N/A (is the origin) |

---

## 2. Folder & File Structure

### 2.1 QA/DEV Local Repo

```
PeelAway-Logic-QA/
├── .env                                  ← Local API keys (never committed)
├── .github/
│   └── workflows/
│       ├── deploy.yml                    ← GitHub Actions CI/CD (build + deploy to Pages)
│       └── update-docs.yml              ← Auto-update test counts in README on push to main
├── .gitignore
├── _.gitignore                           ← Duplicate / backup gitignore
├── claude-code-entry-point.md            ← QA-only developer guide for Claude Code
├── POST_RESKIN_DECOMPOSITION_PLAN.md     ← Refactor roadmap (96K monolith → modules)
├── README.md
├── package.json
├── package-lock.json
├── peelaway-mockups-v2.html              ← Static UI mockup reference
├── prod-update-docs.yml                  ← Production doc-update workflow template
├── PeelAway Logic/                       ← Metadata / assets folder
├── public/
│   ├── index.html
│   ├── PeelAwayLogicLogo.png
│   └── PeelAwayLogicLogoText.png
└── src/
    ├── App.css                           ← All styles (plain CSS, no preprocessor)
    ├── App.jsx                           ← Root component, mounts pipeline
    ├── index.js                          ← React entry point (ReactDOM.render)
    ├── setupTests.js                     ← QA-only: imports @testing-library/jest-dom
    ├── JobSearchPipeline.jsx             ← Active orchestrator (phase router + step locking)
    ├── JobSearchPipelineV4.jsx           ← 96K monolith - target for decomposition
    ├── api.js                            ← All API wrappers + PDF.js loader
    ├── constants.js                      ← All magic numbers, keys, model IDs
    ├── profileExtractor.js               ← Regex-based resume parser (16K)
    ├── prompts.js                        ← All LLM prompt builder functions
    ├── storage.js                        ← localStorage read/write helpers
    ├── utils.js                          ← Pure utility functions (dedup, scoring, etc.)
    ├── cloudStorage.js                   ← Cloud storage wrapper (Dropbox)
    ├── cloudSync.js                      ← Cloud sync logic (local ↔ cloud)
    ├── components/
    │   ├── AppliedTracker.jsx
    │   ├── CloudConnector.jsx            ← Cloud sync settings UI
    │   ├── GuideBar.jsx
    │   ├── Header.jsx
    │   ├── JobCard.jsx
    │   ├── LandingScreen.jsx
    │   ├── ManualJobInput.jsx
    │   ├── ProgressStepper.jsx
    │   └── Spinner.jsx
    ├── hooks/
    │   └── useWindowWidth.js             ← Responsive breakpoint hook
    ├── phases/
    │   ├── ScoutPhase.jsx                ← Phase 1: Resume upload, profile display, search filters, layer buttons
    │   ├── SearchPhase.jsx               ← Phase 1b: 3-layer search execution (35K - heavy lifting)
    │   ├── ReviewPhase.jsx               ← Phase 2: Job tier display + sorting
    │   ├── TailorPhase.jsx               ← Phase 4: Resume/cover letter generation cards
    │   └── CompletePhase.jsx             ← Phase 5: Download + applied tracker
    └── __tests__/                        ← QA-only test suite (346 tests, 15 files)
        ├── pipelineUtils.test.js         ← Utility unit tests (dedup, scoring, prompts)
        ├── profileExtractor.test.js      ← Resume parsing tests (name, skills, location, queries)
        ├── utilsKeywordPreFilter.test.js ← Dynamic pre-filtering tests (level + location matching)
        ├── api.test.js                   ← API layer tests (retry, fetch, loop, web search)
        ├── storage.test.js               ← ALL localStorage function tests
        ├── hooks.test.js                 ← useWindowWidth hook tests
        ├── components.test.jsx           ← Main pipeline component render tests
        ├── componentUnits.test.jsx       ← Individual component unit tests
        ├── manualJobInput.test.jsx       ← ManualJobInput tab, scoring, and queue tests
        ├── progressStepper.test.jsx      ← ProgressStepper desktop/mobile tests
        ├── scoutPhase.test.jsx           ← ScoutPhase render and layer button tests
        ├── reviewPhase.test.jsx          ← ReviewPhase tier tabs, selection, and advance tests
        ├── completePhase.test.jsx        ← CompletePhase download, applied, and tracker tests
        ├── tailorPhase.test.js           ← Tailor phase behavior tests
        └── tailorPersistence.test.js     ← Tailor localStorage persistence tests
```

### 2.2 PROD GitHub Repo

PROD is structurally identical to QA **except** for the following differences:

| Present in QA | Present in PROD | Notes |
|---|---|---|
| `src/__tests__/` (15 files) | No | Test suite lives only in QA |
| `src/setupTests.js` | No | Test setup lives only in QA |
| `claude-code-entry-point.md` | No | QA-only developer guide |
| `.env` | No | Secrets stay local; PROD uses GitHub Secrets |
| `prod-update-docs.yml` | No | Template file for syncing workflow to PROD |
| - | `.claude/launch.json` | PROD has Claude Code session config |
| - | `.claude/settings.local.json` | PROD has Claude Code local settings |

> **Note:** The PROD README contains a stale `git clone` URL pointing to `AI-Agentic-Solutions-Architecture` - the original monorepo this project was extracted from. The correct standalone repo is `CarmenReed/PeelAway-Logic`.

---

## 3. Tech Stack

### 3.1 Runtime Dependencies

| Package | Version | Purpose |
|---|---|---|
| `react` | ^18.3.1 | UI framework |
| `react-dom` | ^18.3.1 | DOM renderer |
| `react-scripts` | 5.0.1 | Create React App build toolchain |
| `lodash` | ^4.17.21 | Utility functions (dedup, normalization) |
| `core-js-pure` | ^3.37.1 | Polyfills |

### 3.2 Dev Dependencies (QA only)

| Package | Version | Purpose |
|---|---|---|
| `@testing-library/react` | ^16.3.2 | React component testing |
| `@testing-library/jest-dom` | ^6.9.1 | DOM assertion matchers |
| `@testing-library/user-event` | ^14.6.1 | User interaction simulation |
| `gh-pages` | ^6.3.0 | Legacy `npm run deploy` script (unused in CI) |

### 3.3 External Services / CDNs

| Service | Usage | Config |
|---|---|---|
| **Anthropic Claude API** | Tailoring, scoring, ATS web search | Direct browser fetch - `anthropic-dangerous-direct-browser-access: true` |
| **PDF.js** | Resume PDF text extraction | CDN, pinned at v3.11.174 |
| **Adzuna API** | Job board search (Layer 1) | Optional; `REACT_APP_ADZUNA_APP_ID` + `REACT_APP_ADZUNA_APP_KEY` |
| **JSearch (RapidAPI)** | Job board search (Layer 1) | Optional; `REACT_APP_RAPIDAPI_KEY` |
| **RSS feeds** | WeWorkRemotely, Remotive, RemoteOK, Stack Overflow (Layer 2) | No key required |
| **ATS web search** | Greenhouse, Lever, Workday via Claude `web_search_20250305` tool (Layer 3) | Requires Anthropic key with web search enabled |
| **Dropbox API** | Cloud sync of applied jobs / tailor results | Optional; `REACT_APP_DROPBOX_APP_KEY` |
| **Google Fonts** | Quicksand (wght 400–700) | CDN, loaded in `public/index.html` |

### 3.4 Build Toolchain

- **Bundler:** Webpack (via Create React App / react-scripts 5.0.1)
- **Transpiler:** Babel (via CRA)
- **Test runner:** Jest (via CRA)
- **No custom config files:** No `vite.config.js`, `jest.config.js`, `tailwind.config.js`, `cypress.config.js`, or `netlify.toml`
- **Node.js requirement:** ≥ 18.0.0

---

## 4. Environment Differences: QA vs PROD

| Aspect | QA / DEV | PROD |
|---|---|---|
| **Run command** | `npm start` (CRA dev server, port 3000) | `npm run build` → deployed artifact |
| **API keys source** | `.env` file (local, not committed) | GitHub Actions Secrets |
| **Test suite** | 346 tests in `src/__tests__/` (15 files) | Not present |
| **Hot reload** | Yes (CRA HMR) | No (static build) |
| **Source maps** | Full (dev mode) | Optimized/minified |
| **Deploy trigger** | Manual (`npm start` locally) | `git push main` → GitHub Actions |
| **Deploy target** | `carmenreed.github.io/PeelAway-Logic-QA` | `carmenreed.github.io/PeelAway-Logic` |
| **Developer guides** | `claude-code-entry-point.md` present | Not present |
| **Refactor artifacts** | `POST_RESKIN_DECOMPOSITION_PLAN.md`, `peelaway-mockups-v2.html`, `JobSearchPipelineV4.jsx` | Same files present in PROD |
| **`package.json` version** | Identical (4.0.0) | Identical (4.0.0) |
| **Workflow files** | `deploy.yml` + `update-docs.yml` | `deploy.yml` only (update-docs synced separately) |

---

## 5. Environment Variables & Config

### 5.1 Required Variables

| Variable | Required | Used By | Notes |
|---|---|---|---|
| `REACT_APP_ANTHROPIC_API_KEY` | **Yes** | Claude API (all AI features) | Must have web search enabled |

### 5.2 Optional Variables

| Variable | Required | Used By | Notes |
|---|---|---|---|
| `REACT_APP_ADZUNA_APP_ID` | No | Layer 1 - Adzuna job search | Layer 1 skipped if absent |
| `REACT_APP_ADZUNA_APP_KEY` | No | Layer 1 - Adzuna job search | Layer 1 skipped if absent |
| `REACT_APP_RAPIDAPI_KEY` | No | Layer 1 - JSearch job search | Layer 1 skipped if absent |
| `REACT_APP_DROPBOX_APP_KEY` | No | Cloud sync (cloudStorage.js) | Cloud sync disabled if absent |

### 5.3 Local `.env` Template (QA)

```env
REACT_APP_ANTHROPIC_API_KEY=sk-ant-api03-yourkey
REACT_APP_ADZUNA_APP_ID=your_adzuna_app_id
REACT_APP_ADZUNA_APP_KEY=your_adzuna_app_key
REACT_APP_RAPIDAPI_KEY=your_rapidapi_key
REACT_APP_DROPBOX_APP_KEY=your_dropbox_app_key
```

> No `.env.example` file exists in the repo. Use the template above when onboarding.

### 5.4 Constants (from `src/constants.js`)

```js
MODEL = "claude-sonnet-4-6"                   // tailoring + ATS search
SCORING_MODEL = "claude-haiku-4-5-20251001"    // batch job scoring
SCORING_BATCH_SIZE = 8                         // jobs per scoring batch
SCORING_BATCH_DELAY_MS = 15000                 // 15s delay between batches
TAILOR_DELAY_MS = 8000                         // 8s delay between tailor calls
API_URL = "https://api.anthropic.com/v1/messages"
MOBILE_BP = 640                                // responsive breakpoint (px)

// localStorage keys
STORAGE_KEY = "jsp-applied-jobs"
SCOUT_STORAGE_KEY = "jsp-last-scout"
TAILOR_RESULTS_KEY = "jsp-tailor-results"
DISMISSED_KEY = "jsp-dismissed-jobs"
```

---

## 6. Application Pipeline Description

The app is a single-page React application that walks users through five sequential phases. Phase progression is managed by `JobSearchPipeline.jsx`, which enforces step locking - users cannot skip or revert to a previous phase mid-pipeline.

```
[LandingScreen] → [Scout] → [Review] → [Human Gate] → [Tailor] → [Complete]
```

### Phase 1 - Scout (`src/phases/ScoutPhase.jsx` + `src/phases/SearchPhase.jsx`)

Scout was split into two tabs after the QA overhaul:

- **Scout tab (`ScoutPhase.jsx`):** Resume upload/paste, dynamic profile extraction display, search filters (work type, date range, employment type, zip + radius). Triggers the three search layers.
- **Search tab (`SearchPhase.jsx`):** Executes and displays search layer progress (35K - all dedup, pre-filtering, scoring, JD fetch, and re-score logic lives here).

| Layer | Source | API/Method | Key |
|---|---|---|---|
| Layer 1 | Job boards | Adzuna + JSearch (RapidAPI) in parallel | Optional |
| Layer 2 | RSS feeds | WeWorkRemotely, Remotive, RemoteOK, Stack Overflow | None |
| Layer 3 | ATS boards | Greenhouse, Lever, Workday via Claude `web_search_20250305` | Anthropic |
| Manual | URL / paste | User-supplied; scored on demand via Quick Score | Anthropic |

- Each layer has its own abort controller - cancelling one doesn't affect others
- Profile extraction (`profileExtractor.js`) uses regex to derive: name, skills by category, experience level (Junior/Mid/Senior), location, and dynamic search query strings
- After all desired layers run, "Score and Review Results" triggers: deduplication → pre-filter → batch scoring (haiku) → full JD fetch → re-score

### Phase 2 - Review (`src/phases/ReviewPhase.jsx`)

Jobs are bucketed into tiers by score:

| Tier | Score Range | Action |
|---|---|---|
| Strong Match | 8–10 | Shown, eligible for gate |
| Possible | 6–7 | Shown, eligible for gate |
| Weak | 3–5 | Shown, not forwarded |
| Rejected | 0–2 | Hidden by default |

- Sort options: score, date posted (newest first), company name
- Green badge = posted within 7 days; orange badge = stale / unverifiable date

### Phase 3 - Human Gate

User manually selects which roles to approve for tailoring. No API calls are made until explicit approval. Step locking prevents returning to Scout/Review once the gate is passed.

### Phase 4 - Tailor (`src/phases/TailorPhase.jsx`)

Each approved role renders as a card with two independent on-demand buttons:

- **Create Resume** → one API call → `claude-sonnet-4-6`
- **Create Cover Letter** → one API call → `claude-sonnet-4-6`

Anti-hallucination enforcement: prompts (`src/prompts.js`) restrict output to content derivable from the uploaded resume only.

### Phase 5 - Complete (`src/phases/CompletePhase.jsx`)

- Download or copy documents per role
- Mark jobs as applied
- Applied jobs persist in `localStorage` (`jsp-applied-jobs`) and are excluded from future Scout runs
- Cloud sync (if configured) pushes applied jobs and tailor results to Dropbox via `cloudSync.js`

---

## 7. GitHub Actions CI/CD

### 7.1 Deploy Workflow

**Workflow file:** `.github/workflows/deploy.yml`

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]       # Auto-deploy on push to main
  workflow_dispatch:        # Manual trigger available

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false  # In-flight deploys are not cancelled

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20           # Node 20 in CI (local requires ≥18)
      - name: Install dependencies
        run: npm install
      - name: Build
        env:
          REACT_APP_ANTHROPIC_API_KEY: ${{ secrets.REACT_APP_ANTHROPIC_API_KEY }}
          REACT_APP_ADZUNA_APP_ID: ${{ secrets.REACT_APP_ADZUNA_APP_ID }}
          REACT_APP_ADZUNA_APP_KEY: ${{ secrets.REACT_APP_ADZUNA_APP_KEY }}
          REACT_APP_RAPIDAPI_KEY: ${{ secrets.REACT_APP_RAPIDAPI_KEY }}
        run: npm run build
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: build
      - uses: actions/deploy-pages@v4
```

**Key behavior:**
- Triggers automatically on every push to `main`
- Secrets injected at build time as `REACT_APP_*` env vars (baked into the static bundle)
- Deploys the `build/` directory to GitHub Pages using the official `deploy-pages` action
- No test step in CI - tests run locally in QA only
- `workflow_dispatch` allows manual re-deploy from the GitHub Actions UI

### 7.2 Auto-Update Docs Workflow

**Workflow file:** `.github/workflows/update-docs.yml`

**Trigger:** Push to `main` that includes changes to `src/` (ignores README, docs, workflow files themselves)

**Steps:**
1. Run `npx react-scripts test --watchAll=false --no-coverage` to capture current test count
2. Identify changed `src/` files
3. If test count or source file list changed → update `README.md` and `claude-code-entry-point.md`
4. Auto-commit and push the updated docs back to `main`

**Purpose:** Keeps README test counts and source file listings automatically in sync after each push.

---

## 8. Deployment Setup

| Property | Value |
|---|---|
| **Platform** | GitHub Pages (native, no Netlify or Vercel) |
| **Deploy method** | GitHub Actions → `actions/deploy-pages@v4` |
| **Build output** | `build/` directory (CRA production build) |
| **Live URL** | https://carmenreed.github.io/PeelAway-Logic |
| **QA URL** | https://carmenreed.github.io/PeelAway-Logic-QA |
| **Homepage field** | `"homepage": "https://carmenreed.github.io/PeelAway-Logic-QA"` in `package.json` |
| **Node version (CI)** | 20 |
| **Node version (local)** | ≥ 18 |
| **`npm run deploy` script** | Defined (`gh-pages -d build`) but **not used** - CI handles deploys |
| **Config files** | None - no `netlify.toml`, `vercel.json`, or custom server config |

**Deploy flow:**

```
Local QA (main branch)
    └── git push origin main
            └── GitHub Actions: build-and-deploy job
                    ├── npm install
                    ├── npm run build  (env vars injected from Secrets)
                    ├── upload-pages-artifact
                    └── deploy-pages → carmenreed.github.io/PeelAway-Logic-QA
```

---

## 9. Testing Setup

**Framework:** Jest (bundled with Create React App) + React Testing Library

**Test runner:** `npm test` (interactive watch) or `CI=true npm test` (headless)

**Setup file:** `src/setupTests.js`
```js
import "@testing-library/jest-dom";
```

### 9.1 Test Suites

| File | Coverage Area | Tests | Methodology |
|---|---|---|---|
| `pipelineUtils.test.js` | Pure utility functions (dedup, scoring, normalization, filtering, prompts) | ~100 | Unit tests, boundary testing, integration chains |
| `profileExtractor.test.js` | Resume parsing: name, skills, experience level, location, search query generation | ~20 | Unit tests with varied resume text inputs |
| `utilsKeywordPreFilter.test.js` | Dynamic pre-filtering: level-based and location-based keyword matching | ~15 | Unit tests with extracted profile data |
| `api.test.js` | API layer: `withRetry`, `callAnthropic`, `callAnthropicWithLoop`, `detectWebSearchSupport` | ~30 | Unit tests with mocked `fetch`, abort signal testing |
| `storage.test.js` | ALL localStorage functions (applied, scout, tailor, dismissed) + `isDismissed` | ~30 | Unit tests against localStorage API, error handling |
| `hooks.test.js` | `useWindowWidth` hook: resize, debounce, cleanup | ~6 | `renderHook` with fake timers, event simulation |
| `components.test.jsx` | Main pipeline component rendering, Scout phase UI | ~12 | Component render tests with user interaction |
| `componentUnits.test.jsx` | Individual components: JobCard, AppliedTracker, LandingScreen, Header, GuideBar, Spinner | ~35 | Component render/interaction tests, prop validation |
| `manualJobInput.test.jsx` | ManualJobInput: tabs, button states, API key guard, scoring flow, add to queue | ~14 | Component render tests with mocked `callAnthropicWithLoop` |
| `progressStepper.test.jsx` | ProgressStepper: desktop dots/labels/classes/clicks, mobile text format | ~13 | Component tests with mocked `useWindowWidth` |
| `scoutPhase.test.jsx` | ScoutPhase: initial render, layer button disabled/enabled state, score button | ~14 | Render tests with mocked constants, api, and storage |
| `reviewPhase.test.jsx` | ReviewPhase: tier tabs, tab switching, selection, advance button, Select All, sort | ~19 | Component integration tests with mocked storage |
| `completePhase.test.jsx` | CompletePhase: render, applied state, tracker, download, navigation | ~21 | Component render/interaction tests with mocked URL API |
| `tailorPhase.test.js` | Tailor phase: session restore, persistence, error handling, cancel, advance | ~10 | Component integration tests with mocked `fetch` |
| `tailorPersistence.test.js` | localStorage persistence for tailor results (read/write/clear) | ~8 | Unit tests against localStorage API |
| **Total** | | **346** | |

### 9.2 Test Methodologies

**Unit Testing (utils, storage, constants):**
Tests isolate individual pure functions with known inputs/outputs. Covers happy paths, edge cases (empty/null/undefined), boundary values, and error handling. Uses Jest matchers (`toBe`, `toEqual`, `toThrow`, `toHaveLength`).

**Component Render Testing (components, phases):**
Uses `@testing-library/react`'s `render()` + `screen` queries to verify DOM output. Tests component props, conditional rendering, CSS classes, ARIA labels, and user interactions via `userEvent.setup()`. Follows Testing Library best practices: query by role/text/label, not implementation details.

**Integration Testing (pipelineUtils end-to-end chain):**
Tests multi-function pipelines (e.g., `extractTextFromBlocks` → `extractJson`, `mergeRawJobs` → `deduplicateJobs`, `reTierJobs` → `filterAppliedFromTiers`) to verify functions compose correctly.

**API Mocking (api.test.js, tailorPhase.test.js):**
`global.fetch` is replaced with `jest.fn()` to simulate API responses, errors, rate limits, and abort signals without network calls. Tests verify request body construction, header injection, retry logic, and multi-turn conversation loops.

**Timer Mocking (hooks.test.js, withRetry):**
Uses `jest.useFakeTimers()` + `jest.advanceTimersByTime()` for debounce and delay testing. The `withRetry` tests use a `setTimeout` override to avoid timing issues with Promise-based retry delays.

**localStorage Testing (storage.test.js, tailorPersistence.test.js):**
`localStorage.clear()` in `beforeEach` ensures isolation. Tests cover: empty state, corrupted JSON recovery, upsert behavior, quota exceeded errors (via `Storage.prototype.setItem` mock), and cross-function data flow.

### 9.3 Coverage by Source Module

| Module | Functions | Tested | Coverage |
|---|---|---|---|
| `utils.js` | 14 | 14 | 100% |
| `profileExtractor.js` | ~12 | ~12 | ~95% |
| `prompts.js` | 3 builders + 1 constant | 3 | ~95% |
| `api.js` | 5 (withRetry, callAnthropic, callAnthropicWithLoop, detectWebSearchSupport, loadPdfJs/extractTextFromPdf) | 4 | ~80% (PDF functions require browser CDN) |
| `storage.js` | 11 | 11 | 100% |
| `constants.js` | 16 exports | Indirectly tested | N/A (config values) |
| `components/` | 9 components | 9 | 100% |
| `hooks/` | 1 | 1 | 100% |
| `phases/` | 5 | 5 | 100% |

### 9.4 Known Test Issues

None. All 346 tests pass.

### 9.5 Running Tests

```bash
# Interactive watch mode (default)
npm test

# CI mode (headless, exits after run)
CI=true npm test

# Single test file
CI=true npm test -- --testPathPattern="api.test"

# With coverage report
CI=true npm test -- --coverage
```

**No CI test step** - tests are not run in the GitHub Actions workflow. All testing is manual in the local QA environment before pushing.

**No config overrides** - Jest runs with CRA defaults (no `jest.config.js`). No Cypress, Playwright, or other E2E framework is present.

---

## 10. Branch Strategy

| Aspect | Detail |
|---|---|
| **Active branches** | `main` only |
| **Feature branches** | None currently |
| **Remote** | `origin → CarmenReed/PeelAway-Logic-QA` (single remote) |
| **Deploy trigger** | Push to `main` auto-deploys to GitHub Pages |
| **QA → PROD flow** | Develop and test locally in QA repo → push `main` to GitHub → CI builds and deploys |
| **No branch protection** | `main` accepts direct pushes (no PR requirement observed) |
| **No staging environment** | Local QA = staging; GitHub Pages = production |

**Effective workflow:**

```
[Local QA dev server]  →  test passes  →  git push origin main  →  GitHub Actions  →  GitHub Pages (PROD)
```

---

## 11. Key Source Files Reference

| File | Role | Notes |
|---|---|---|
| `src/App.jsx` | Root component | Thin wrapper; mounts `JobSearchPipeline` |
| `src/JobSearchPipeline.jsx` | Phase orchestrator | Routes Scout → Review → Gate → Tailor → Complete; enforces step locking |
| `src/JobSearchPipelineV4.jsx` | Legacy monolith (96K) | Reskinned UI; being decomposed per `POST_RESKIN_DECOMPOSITION_PLAN.md` |
| `src/constants.js` | All config / magic numbers | Model IDs, API URLs, localStorage keys, timing values |
| `src/api.js` | External API wrappers | Adzuna, JSearch, Anthropic messages, PDF.js loader |
| `src/profileExtractor.js` | Resume parser | Regex-based extraction of name, skills, experience level, location, search queries |
| `src/prompts.js` | LLM prompt builders | Resume, cover letter, scoring, ATS search prompts |
| `src/storage.js` | Persistence helpers | localStorage get/set/clear for all 4 storage keys |
| `src/utils.js` | Pure utility functions | Deduplication, normalization, date parsing, scoring logic |
| `src/cloudStorage.js` | Cloud storage wrapper | Dropbox integration interface |
| `src/cloudSync.js` | Cloud sync logic | Handles sync between localStorage and Dropbox |
| `src/phases/ScoutPhase.jsx` | Phase 1 UI | Resume upload, profile display, search filters, layer trigger buttons |
| `src/phases/SearchPhase.jsx` | Phase 1b - Search execution | 3 search layers, abort controllers, dedup, pre-filter, scoring, re-score (35K) |
| `src/phases/ReviewPhase.jsx` | Phase 2 UI | Tier buckets, sorting, date badges |
| `src/phases/TailorPhase.jsx` | Phase 4 UI + logic | Per-role resume/cover letter generation cards |
| `src/phases/CompletePhase.jsx` | Phase 5 UI | Download, copy, applied job tracking |
| `src/components/CloudConnector.jsx` | Cloud sync UI | Settings panel for Dropbox connection and sync status |
| `src/hooks/useWindowWidth.js` | Responsive hook | Returns current window width; used for mobile layout |
| `public/index.html` | HTML shell | Loads Google Fonts (Quicksand), sets meta tags |
| `POST_RESKIN_DECOMPOSITION_PLAN.md` | Refactor roadmap | 10-step plan to extract `JobSearchPipelineV4.jsx` into modules |
| `claude-code-entry-point.md` | QA developer guide | Context for Claude Code sessions (QA only, not in PROD) |
| `peelaway-mockups-v2.html` | UI mockup | Static visual reference for the reskin |
