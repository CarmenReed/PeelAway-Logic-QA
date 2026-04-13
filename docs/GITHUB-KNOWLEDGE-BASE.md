# PeelAway Logic - GitHub Knowledge Base

> Generated: 2026-04-13
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
├── .env                                  <- Local API keys (never committed)
├── .github/
│   └── workflows/
│       ├── deploy.yml                    <- GitHub Actions CI/CD (test + build + deploy to Pages)
│       └── update-docs.yml              <- Auto-update test counts in README on push to main
├── .gitignore
├── .promotion.json                       <- QA-to-PROD promotion rules (neverPromote, preserveProdVersions, envReplacements)
├── .claude/
│   ├── commands/                         <- Custom Claude Code slash commands
│   │   ├── fix-qa-public-references.md
│   │   └── update-docs.md
│   ├── skills/
│   │   ├── docs-sync/SKILL.md            <- /docs-sync skill definition
│   │   └── hci-audit/SKILL.md            <- /hci-audit skill definition
│   └── launch.json                       <- Claude Code session config
├── CLAUDE.md                             <- Project instructions for Claude Code sessions
├── claude-code-entry-point.md            <- QA-only developer guide for Claude Code
├── MASTER_PLAN_AZURE_SPRINT.md           <- Azure AI integration sprint plan
├── POST_RESKIN_DECOMPOSITION_PLAN.md     <- Refactor roadmap (96K monolith into modules)
├── README.md
├── package.json
├── package-lock.json
├── playwright.config.ts                  <- Playwright E2E test configuration
├── fix-failing-tests.ps1                 <- PowerShell helper for local test debugging
├── prod-update-docs.yml                  <- Production doc-update workflow template
├── scripts/
│   ├── doc-lint.js                       <- Documentation quality linter (em-dashes, env-audit, broken links)
│   ├── docs-sync.js                      <- Sync README/entry-point with actual test file inventory
│   ├── hci-audit.js                      <- HCI governance audit (UAT re-test gating, GREEN/YELLOW/RED verdict)
│   └── repo-cleanup.js                   <- Repo maintenance utilities
├── semantic-kernel-demo/                 <- Python SK orchestration demo (mirrors 4 pipeline phases, Azure OpenAI swap-ready)
│   ├── job_pipeline_sk.py
│   ├── plugins/
│   │   ├── job_scoring_plugin.py
│   │   └── resume_parser_plugin.py
│   ├── requirements.txt
│   └── README.md
├── docs/
│   ├── GITHUB-KNOWLEDGE-BASE.md          <- This file
│   ├── AI_SKILLS_INVENTORY.md            <- AI skills and techniques demonstrated in the project
│   ├── GOVERNANCE.md                     <- Contributing and versioning guidelines
│   ├── PROJECT_EVOLUTION.md              <- Project history and milestone log
│   ├── TEST-STRATEGY-OVERVIEW.md         <- Testing philosophy and coverage overview
│   ├── hci-audit/
│   │   ├── README.md                     <- HCI tier definitions and sign-off workflow
│   │   └── flags/                        <- YELLOW/RED audit flag files written by hci-audit.js
│   ├── user-stories/
│   │   ├── 01-landing.md
│   │   ├── 02-scout.md
│   │   ├── 03-review.md
│   │   ├── 04-human-gate.md
│   │   ├── 05-complete.md
│   │   ├── 06-cross-cutting.md
│   │   └── 07-demo-mode.md
│   └── architecture/
│       ├── ARCHITECTURE.md               <- System context, component overview, data flow narrative
│       ├── azure-resources.bicep         <- IaC template for 7 Azure resources
│       ├── decisions/                    <- Architecture Decision Records (ADR-001 through ADR-006)
│       └── diagrams/                     <- Mermaid source files (system context, container, pipeline, Azure integration, evolution timeline)
├── e2e/                                  <- Playwright E2E test suite
│   ├── 01-landing.spec.ts
│   ├── 02-scout.spec.ts
│   ├── 03-review.spec.ts
│   ├── 04-human-gate.spec.ts
│   ├── 05-complete.spec.ts
│   ├── 07-navigation.spec.ts
│   ├── 08-demo-mode.spec.ts
│   ├── 09-accessibility.spec.ts          <- Playwright a11y checks (color contrast, real browser)
│   └── fixtures/
│       └── test-helpers.ts
├── public/
│   ├── index.html
│   ├── PeelAwayLogicLogo.png
│   └── PeelAwayLogicLogoText.png
└── src/
    ├── App.css                           <- All styles (plain CSS, no preprocessor)
    ├── App.jsx                           <- Root component, mounts pipeline
    ├── index.js                          <- React entry point (ReactDOM.render)
    ├── setupTests.js                     <- QA-only: imports @testing-library/jest-dom
    ├── JobSearchPipeline.jsx             <- Active orchestrator (phase router + step locking)
    ├── JobSearchPipelineV4.jsx           <- 96K monolith - target for decomposition (do not add features)
    ├── api.js                            <- All API wrappers + PDF.js loader
    ├── constants.js                      <- All magic numbers, keys, model IDs
    ├── profileExtractor.js               <- Regex-based resume parser (16K)
    ├── prompts.js                        <- All LLM prompt builder functions
    ├── storage.js                        <- localStorage read/write helpers
    ├── utils.js                          <- Pure utility functions (dedup, scoring, etc.)
    ├── cloudStorage.js                   <- Cloud storage wrapper (Dropbox)
    ├── cloudSync.js                      <- Cloud sync logic (local <-> cloud)
    ├── components/
    │   ├── AppliedTracker.jsx
    │   ├── CloudConnector.jsx            <- Cloud sync settings UI
    │   ├── GuideBar.jsx
    │   ├── Header.jsx
    │   ├── JobCard.jsx
    │   ├── LandingScreen.jsx
    │   ├── ManualJobInput.jsx
    │   ├── ProgressStepper.jsx
    │   └── Spinner.jsx
    ├── hooks/
    │   └── useWindowWidth.js             <- Responsive breakpoint hook
    ├── phases/
    │   ├── ScoutPhase.jsx                <- Phase 1: Resume upload, profile display, search filters, layer buttons
    │   ├── SearchPhase.jsx               <- Phase 1b: 3-layer search execution (35K - heavy lifting)
    │   ├── ReviewPhase.jsx               <- Phase 2: Job tier display + sorting
    │   └── CompletePhase.jsx             <- Phase 3: Resume/cover letter generation + download + applied tracker
    ├── services/
    │   └── azureSearchService.js         <- Azure AI Search REST client (index, batch index, search, delete)
    └── __tests__/                        <- QA-only Jest test suite (453 tests, 17 files)
        ├── pipelineUtils.test.js
        ├── profileExtractor.test.js
        ├── utilsKeywordPreFilter.test.js
        ├── api.test.js
        ├── storage.test.js
        ├── hooks.test.js
        ├── components.test.jsx
        ├── componentUnits.test.jsx
        ├── manualJobInput.test.jsx
        ├── progressStepper.test.jsx
        ├── scoutPhase.test.jsx
        ├── reviewPhase.test.jsx
        ├── completePhase.test.jsx
        ├── tailorPhase.test.js
        ├── tailorPersistence.test.js
        ├── azureSearchService.test.js
        └── accessibility.test.jsx        <- jest-axe WCAG automated a11y checks
```

### 2.2 PROD GitHub Repo

PROD is structurally identical to QA **except** for the following differences:

| Present in QA | Present in PROD | Notes |
|---|---|---|
| `src/__tests__/` (17 files) | No | Test suite lives only in QA |
| `src/setupTests.js` | No | Test setup lives only in QA |
| `e2e/` (8 spec files + fixtures) | No | Playwright E2E lives only in QA |
| `playwright.config.ts` | No | Playwright config is QA-only |
| `claude-code-entry-point.md` | No | QA-only developer guide |
| `.env` | No | Secrets stay local; PROD uses GitHub Secrets |
| `prod-update-docs.yml` | No | Template file for syncing workflow to PROD |
| `fix-failing-tests.ps1` | No | QA-only debug helper |
| `.claude/skills/` | No | Claude Code skills live only in QA |
| `docs/hci-audit/` | No | HCI governance artifacts are QA-only |
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
| `jest-axe` | ^9.0.0 | axe-core bindings for Jest (WCAG a11y checks) |
| `@playwright/test` | ^1.59.1 | Playwright E2E test runner |
| `@axe-core/playwright` | ^4.10.0 | axe-core bindings for Playwright (color contrast, real browser a11y) |
| `wait-on` | ^9.0.5 | Wait for dev server before running E2E tests |
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
| **Azure AI Search** | Job index search (portfolio integration) | `peelaway-search` instance, East US, F0 free tier; REST client in `src/services/azureSearchService.js` |
| **Azure OpenAI** | Swap-ready alternative to Anthropic API | Configured in `semantic-kernel-demo/` via `AzureChatCompletion`; swap-in documented in ADR-001 |
| **Google Fonts** | Quicksand (wght 400-700) | CDN, loaded in `public/index.html` |

### 3.4 Build Toolchain

- **Bundler:** Webpack (via Create React App / react-scripts 5.0.1)
- **Transpiler:** Babel (via CRA)
- **Unit/Component test runner:** Jest (via CRA) + React Testing Library + jest-axe
- **E2E test runner:** Playwright (chromium only in CI)
- **No custom config files:** No `vite.config.js`, `jest.config.js`, `tailwind.config.js`, `cypress.config.js`, or `netlify.toml`
- **Node.js requirement:** >=18.0.0

---

## 4. Environment Differences: QA vs PROD

| Aspect | QA / DEV | PROD |
|---|---|---|
| **Run command** | `npm start` (CRA dev server, port 3000) | `npm run build` -> deployed artifact |
| **API keys source** | `.env` file (local, not committed) | GitHub Actions Secrets |
| **Unit/component tests** | 453 tests in `src/__tests__/` (17 files) | Not present |
| **E2E tests** | 8 Playwright spec files in `e2e/` | Not present |
| **Hot reload** | Yes (CRA HMR) | No (static build) |
| **Source maps** | Full (dev mode) | Optimized/minified |
| **Deploy trigger** | Manual (`npm start` locally) | `git push main` -> GitHub Actions |
| **Deploy target** | `carmenreed.github.io/PeelAway-Logic-QA` | `carmenreed.github.io/PeelAway-Logic` |
| **Developer guides** | `claude-code-entry-point.md` present | Not present |
| **HCI governance** | `scripts/hci-audit.js` + `docs/hci-audit/` | Not present |
| **Docs sync** | `scripts/docs-sync.js` + `/docs-sync` skill | Not present |
| **Refactor artifacts** | `POST_RESKIN_DECOMPOSITION_PLAN.md`, `JobSearchPipelineV4.jsx` | Same files present in PROD |
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

The app is a single-page React application that walks users through four sequential phases. Phase progression is managed by `JobSearchPipeline.jsx`, which enforces step locking - users cannot skip or revert to a previous phase mid-pipeline.

```
[LandingScreen] -> [Scout] -> [Review] -> [Human Gate] -> [Complete]
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

- Each layer has its own abort controller - cancelling one does not affect others
- Profile extraction (`profileExtractor.js`) uses regex to derive: name, skills by category, experience level (Junior/Mid/Senior), location, and dynamic search query strings
- After all desired layers run, "Score and Review Results" triggers: deduplication -> pre-filter -> batch scoring (haiku) -> full JD fetch -> re-score

### Phase 2 - Review (`src/phases/ReviewPhase.jsx`)

Jobs are bucketed into tiers by score:

| Tier | Score Range | Action |
|---|---|---|
| Strong Match | 8-10 | Shown, eligible for gate |
| Possible | 6-7 | Shown, eligible for gate |
| Weak | 3-5 | Shown, not forwarded |
| Rejected | 0-2 | Hidden by default |

- Sort options: score, date posted (newest first), company name
- Green badge = posted within 7 days; orange badge = stale / unverifiable date

### Phase 3 - Human Gate

User manually selects which roles to approve for tailoring. No API calls are made until explicit approval. Step locking prevents returning to Scout/Review once the gate is passed.

### Phase 4 - Complete (`src/phases/CompletePhase.jsx`)

Each approved role renders as a card with two independent on-demand buttons:

- **Create Resume** -> one API call -> `claude-sonnet-4-6`
- **Create Cover Letter** -> one API call -> `claude-sonnet-4-6`

Anti-hallucination enforcement: prompts (`src/prompts.js`) restrict output to content derivable from the uploaded resume only.

Additional functionality:
- Download or copy documents per role
- Mark jobs as applied
- Applied jobs persist in `localStorage` (`jsp-applied-jobs`) and are excluded from future Scout runs
- Cloud sync (if configured) pushes applied jobs and tailor results to Dropbox via `cloudSync.js`

### Demo Mode

A Demo Mode toggle is available on the LandingScreen for streamlined live demos. It bypasses API calls and uses pre-baked fixture data so the full pipeline can be shown without real credentials. User story: `docs/user-stories/07-demo-mode.md`.

---

## 7. GitHub Actions CI/CD

### 7.1 Deploy Workflow

**Workflow file:** `.github/workflows/deploy.yml`

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

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
          node-version: 20
      - name: Install dependencies
        run: npm install
      - name: Run unit tests
        run: CI=true npm test
      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium
      - name: Run E2E tests
        run: |
          npm start &
          npx wait-on http://localhost:3000 --timeout 30000
          npx playwright test --reporter=github
        env:
          CI: true
      - name: Build
        env:
          REACT_APP_ANTHROPIC_API_KEY: ${{ secrets.REACT_APP_ANTHROPIC_API_KEY }}
          REACT_APP_ADZUNA_APP_ID: ${{ secrets.REACT_APP_ADZUNA_APP_ID }}
          REACT_APP_ADZUNA_APP_KEY: ${{ secrets.REACT_APP_ADZUNA_APP_KEY }}
          REACT_APP_RAPIDAPI_KEY: ${{ secrets.REACT_APP_RAPIDAPI_KEY }}
          REACT_APP_DROPBOX_APP_KEY: ${{ secrets.REACT_APP_DROPBOX_APP_KEY }}
        run: npm run build
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: build
      - uses: actions/deploy-pages@v4
```

**Key behavior:**
- Triggers automatically on every push to `main`
- Runs all Jest unit/component tests before building (CI gate)
- Installs Playwright chromium and runs E2E tests against a live dev server before building
- Secrets injected at build time as `REACT_APP_*` env vars (baked into the static bundle)
- Deploys the `build/` directory to GitHub Pages using the official `deploy-pages` action
- `workflow_dispatch` allows manual re-deploy from the GitHub Actions UI

### 7.2 Auto-Update Docs Workflow

**Workflow file:** `.github/workflows/update-docs.yml`

**Trigger:** Push to `main` (ignores README, docs, and the workflow file itself)

**Steps:**
1. Run `scripts/docs-sync.js` to sync test file inventory in README and `claude-code-entry-point.md`
2. Run `npx react-scripts test --watchAll=false --no-coverage` to capture current test count
3. If test count or file structure changed -> update `README.md` and `claude-code-entry-point.md`
4. Auto-commit and push the updated docs back to `main`

**Purpose:** Keeps README test counts and source file listings automatically in sync after each push.

---

## 8. Deployment Setup

| Property | Value |
|---|---|
| **Platform** | GitHub Pages (native, no Netlify or Vercel) |
| **Deploy method** | GitHub Actions -> `actions/deploy-pages@v4` |
| **Build output** | `build/` directory (CRA production build) |
| **Live URL** | https://carmenreed.github.io/PeelAway-Logic |
| **QA URL** | https://carmenreed.github.io/PeelAway-Logic-QA |
| **Homepage field** | `"homepage": "https://carmenreed.github.io/PeelAway-Logic-QA"` in `package.json` |
| **Node version (CI)** | 20 |
| **Node version (local)** | >=18 |
| **`npm run deploy` script** | Defined (`gh-pages -d build`) but **not used** - CI handles deploys |
| **Config files** | None - no `netlify.toml`, `vercel.json`, or custom server config |

**Deploy flow:**

```
Local QA (main branch)
    -> git push origin main
            -> GitHub Actions: build-and-deploy job
                    |- npm install
                    |- CI=true npm test          (Jest unit/component gate)
                    |- playwright test           (E2E gate)
                    |- npm run build  (env vars injected from Secrets)
                    |- upload-pages-artifact
                    -> deploy-pages -> carmenreed.github.io/PeelAway-Logic-QA
```

---

## 9. Testing Setup

### 9.1 Unit & Component Tests (Jest)

**Framework:** Jest (bundled with Create React App) + React Testing Library + jest-axe

**Test runner:** `npm test` (interactive watch) or `CI=true npm test` (headless)

**Setup file:** `src/setupTests.js`
```js
import "@testing-library/jest-dom";
```

#### 9.1.1 Test Suites

| File | Coverage Area | Tests |
|---|---|---|
| `pipelineUtils.test.js` | Pure utility functions (dedup, scoring, normalization, filtering, prompts) | 118 |
| `utilsKeywordPreFilter.test.js` | Dynamic pre-filtering: level-based and location-based keyword matching | 39 |
| `componentUnits.test.jsx` | Individual components: JobCard, AppliedTracker, LandingScreen, Header, GuideBar, Spinner | 53 |
| `profileExtractor.test.js` | Resume parsing: name, skills, experience level, location, search query generation | 32 |
| `api.test.js` | API layer: `withRetry`, `callAnthropic`, `callAnthropicWithLoop`, `detectWebSearchSupport` | 32 |
| `storage.test.js` | ALL localStorage functions (applied, scout, tailor, dismissed) + `isDismissed` | 35 |
| `reviewPhase.test.jsx` | ReviewPhase: tier tabs, tab switching, selection, advance button, Select All, sort | 20 |
| `completePhase.test.jsx` | CompletePhase: render, applied state, tracker, download, navigation | 24 |
| `accessibility.test.jsx` | jest-axe WCAG a11y checks (image-alt, button-name, label, ARIA) across all components | 18 |
| `progressStepper.test.jsx` | ProgressStepper: desktop dots/labels/classes/clicks, mobile text format | 17 |
| `scoutPhase.test.jsx` | ScoutPhase: initial render, layer button disabled/enabled state, score button | 16 |
| `components.test.jsx` | Main pipeline component rendering, Scout phase UI | 18 |
| `manualJobInput.test.jsx` | ManualJobInput: tabs, button states, API key guard, scoring flow, add to queue | 13 |
| `tailorPhase.test.js` | Complete phase document generation: session restore, persistence, error handling, cancel | 12 |
| `tailorPersistence.test.js` | localStorage persistence for document generation results (read/write/clear) | 9 |
| `azureSearchService.test.js` | Azure AI Search client: createJobIndex, indexJobs (batching), searchJobs, deleteIndex | 9 |
| `hooks.test.js` | `useWindowWidth` hook: resize, debounce, cleanup | 6 |
| **Total** | | **453** |

#### 9.1.2 Accessibility Test Coverage (`accessibility.test.jsx`)

Uses `jest-axe` (axe-core bindings) to catch WCAG violations in a jsdom environment:

- `image-alt` - every image has meaningful alt text or is marked decorative
- `button-name` - every button has an accessible name
- `link-name` - every link has an accessible name
- `label` - every form control has an associated label
- `aria-valid-attr` - ARIA attributes are spelled correctly
- `aria-required-attr` - required ARIA attributes are present
- `role-img-alt` - SVGs with `role="img"` have `aria-label` or `title`
- `list` - list items live inside proper list containers

> Color contrast (WCAG 1.4.3) requires a real layout engine and is therefore tested in `e2e/09-accessibility.spec.ts` via Playwright/axe instead.

#### 9.1.3 Running Unit Tests

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

### 9.2 E2E Tests (Playwright)

**Framework:** Playwright with `@axe-core/playwright`

**Config:** `playwright.config.ts` - chromium only, `baseURL: http://localhost:3000`, 60s timeout

**Test files:**

| File | Coverage Area |
|---|---|
| `01-landing.spec.ts` | Landing screen render, CTA, Demo Mode toggle |
| `02-scout.spec.ts` | Resume upload/paste, profile extraction, layer buttons |
| `03-review.spec.ts` | Tier tabs, sort, job card interactions |
| `04-human-gate.spec.ts` | Job selection, advance to Complete |
| `05-complete.spec.ts` | Document generation, download, applied marking |
| `07-navigation.spec.ts` | ProgressStepper, step locking, Start Over |
| `08-demo-mode.spec.ts` | Demo Mode full pipeline walkthrough |
| `09-accessibility.spec.ts` | axe-core color contrast + full a11y scan in real browser |

**Running E2E tests:**

```bash
# Headless (requires running dev server on :3000)
npm run test:e2e

# Interactive Playwright UI
npm run test:e2e:ui

# Headed (visible browser)
npm run test:e2e:headed
```

### 9.3 HCI Governance Audit

**Script:** `scripts/hci-audit.js` (invoked via `npm run hci-audit` or `/hci-audit` skill)

Scans the diff against `origin/main`, classifies changed files by HCI impact tier, and emits a GREEN / YELLOW / RED verdict before committing any user-facing change. YELLOW and RED verdicts write a flag file under `docs/hci-audit/flags/`. See `docs/hci-audit/README.md` for tier definitions.

### 9.4 Coverage by Source Module

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
| `phases/` | 4 | 4 | 100% |
| `services/azureSearchService.js` | 4 | 4 | 100% |

---

## 10. Branch Strategy

| Aspect | Detail |
|---|---|
| **Active branches** | `main` only |
| **Feature branches** | Created by Claude Code for PRs; merged and deleted after merge |
| **Remote** | `origin -> CarmenReed/PeelAway-Logic-QA` (single remote) |
| **Deploy trigger** | Push to `main` auto-deploys to GitHub Pages |
| **QA -> PROD flow** | Develop and test in QA repo -> push `main` -> CI runs tests + E2E -> deploys QA Pages; then run `promote-qa-to-prod.ps1` from PROD repo to copy to PROD |
| **No branch protection** | `main` accepts direct pushes (no PR requirement) |
| **No staging environment** | Local dev server = staging; GitHub Pages = production |

**Effective workflow:**

```
[Local QA dev server]  ->  tests pass  ->  hci-audit  ->  git push origin main
  -> GitHub Actions (unit tests + E2E + build)  ->  GitHub Pages (QA)
  -> promote-qa-to-prod.ps1  ->  PeelAway-Logic repo  ->  GitHub Pages (PROD)
```

---

## 11. Key Source Files Reference

| File | Role | Notes |
|---|---|---|
| `src/App.jsx` | Root component | Thin wrapper; mounts `JobSearchPipeline` |
| `src/JobSearchPipeline.jsx` | Phase orchestrator | Routes Scout -> Review -> Gate -> Complete; enforces step locking |
| `src/JobSearchPipelineV4.jsx` | Legacy monolith (96K) | Reskinned UI; being decomposed per `POST_RESKIN_DECOMPOSITION_PLAN.md`; do not add features |
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
| `src/phases/CompletePhase.jsx` | Phase 4 UI + logic | Per-role resume/cover letter generation, download, copy, applied job tracking |
| `src/services/azureSearchService.js` | Azure AI Search REST client | createJobIndex, indexJobs (batching), searchJobs (filters), deleteIndex |
| `src/components/CloudConnector.jsx` | Cloud sync UI | Settings panel for Dropbox connection and sync status |
| `src/hooks/useWindowWidth.js` | Responsive hook | Returns current window width; used for mobile layout |
| `public/index.html` | HTML shell | Loads Google Fonts (Quicksand), sets meta tags |
| `scripts/doc-lint.js` | Doc quality linter | Enforces no em-dashes, env-audit patterns |
| `scripts/docs-sync.js` | Docs inventory sync | Rewrites test file lists and counts in README/entry-point; run via `npm run docs-sync` |
| `scripts/hci-audit.js` | HCI governance gate | Classifies diff by HCI tier, emits GREEN/YELLOW/RED verdict; run via `npm run hci-audit` |
| `playwright.config.ts` | Playwright config | chromium, baseURL :3000, 60s timeout, E2E in `e2e/` |
| `POST_RESKIN_DECOMPOSITION_PLAN.md` | Refactor roadmap | 10-step plan to extract `JobSearchPipelineV4.jsx` into modules |
| `MASTER_PLAN_AZURE_SPRINT.md` | Azure integration plan | Sprint plan for Azure AI Search, Semantic Kernel, and ADR work |
| `claude-code-entry-point.md` | QA developer guide | Context for Claude Code sessions (QA only, not in PROD) |
| `.promotion.json` | Promotion rules | Controls what gets copied/excluded/replaced during QA-to-PROD promotion |
| `docs/hci-audit/README.md` | HCI governance docs | Tier definitions, sign-off workflow, flag file format |
| `docs/architecture/decisions/` | ADR-001 to ADR-006 | Architecture Decision Records for all major tech choices |
