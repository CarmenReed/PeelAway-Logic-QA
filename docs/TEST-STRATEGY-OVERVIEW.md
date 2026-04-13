# PeelAway Logic - Test Strategy Overview

## Approach

Two-tier testing (unit + E2E) with user story traceability. Every requirement is defined as a user story with acceptance criteria, mapped to both Playwright E2E specs and Jest unit tests.

## Architecture

- **Requirements** defined as user stories with acceptance criteria across 6 phases
- **Unit tests** (Jest + React Testing Library) validate individual functions and component rendering: 436 tests across 16 suites
- **E2E tests** (Playwright + Chromium) validate complete user workflows through the 4-phase pipeline: 52 tests across 6 spec files (32 passing, 20 pending via `test.fixme()`)
- **All external APIs mocked** in E2E tests: Anthropic Claude, Adzuna, JSearch, and RSS feeds intercepted via `page.route()` in `e2e/fixtures/test-helpers.ts`
- **Tests are deterministic, fast, and free to run** with zero API costs

## Coverage by Phase

| Phase | User Stories | Acceptance Criteria | E2E Tests | E2E Status |
|-------|-------------|--------------------:|----------:|------------|
| Landing | 4 | 13 | 6 | All passing |
| Scout & Search | 8 | 28 | 10 | All passing |
| Review | 4 | 16 | 8 | 3 passing, 5 pending |
| Human Gate | 5 | 17 | 6 | 6 pending |
| Complete | 7 | n/a | 14 | 3 passing, 11 pending |
| Cross-cutting | 5 | 16 | 8 | All passing |
| **Total** | **n/a** | **n/a** | **52** | **32 passing, 20 pending** |

**Unit test coverage (Jest):** 436 tests across 16 suites covering utilities, profile extraction, API wrappers, storage, hooks, and all phase components. All passing.

**Pending E2E tests:** Tests marked `test.fixme()` require scored job data from the Search phase, which involves full pipeline traversal with realistic mock data seeding. These tests are fully written with clear descriptions of what they verify and are ready to activate once the mock data pipeline is extended.

## Key Design Decisions

- **Microsoft Playwright** chosen for E2E: cross-browser support, fast execution, excellent developer experience, built-in HTML reporting
- **API mocking via `page.route()`**: no test doubles leak into production code; mocks are self-contained in `e2e/fixtures/test-helpers.ts`
- **Human-gated pipeline tested for explicit intent enforcement**: tests verify that no API calls fire without user action (US-GATE-004)
- **`data-testid` attributes** for reliable selectors (invisible to users), following the pattern `data-testid="phase-element-descriptor"`
- **QA-only test suite**: production repo ships clean artifacts; all test infrastructure lives exclusively in this QA environment
- **`test.fixme()` over `test.skip()`**: pending tests remain visible in reports and are documented with what they verify, preventing them from being forgotten

## CI/CD Integration

GitHub Actions (`deploy.yml`) runs both test tiers on every push to main:

1. **Unit tests:** `CI=true npm test` runs all 436 Jest tests
2. **Browser install:** `npx playwright install --with-deps chromium`
3. **E2E tests:** `npm start` + `wait-on http://localhost:3000` + `npx playwright test --reporter=github`
4. **Gate:** Failed tests block the build and deployment to GitHub Pages
5. **Report:** Playwright HTML report generated as build artifact

## Tech Stack

| Tool | Purpose |
|------|---------|
| Jest | Unit/component test runner |
| React Testing Library | Component rendering and interaction |
| @playwright/test | E2E browser automation (Chromium) |
| wait-on | CI server readiness check before E2E run |
| page.route() | Network-level API mocking (Playwright) |

All mocks are self-contained. No external mock server, no test database, no API keys needed to run the full test suite.

## Running Tests

```bash
# Jest (unit/component)
npm test                        # Interactive watch mode
CI=true npm test                # Headless CI mode

# Playwright (E2E)
npm run test:e2e                # Headless
npm run test:e2e:ui             # Interactive UI mode
npm run test:e2e:headed         # Headed browser
npx playwright test --reporter=html   # Generate HTML report
npx playwright show-report            # View HTML report
```

## File Structure

```
e2e/
  fixtures/
    test-helpers.ts               Shared helpers, API mocks (page.route)
  01-landing.spec.ts              Landing page (6 tests)
  02-scout.spec.ts                Scout + Search phases (10 tests)
  03-review.spec.ts               Review phase (8 tests, 5 pending)
  04-human-gate.spec.ts           Human Gate (6 tests, 6 pending)
  05-complete.spec.ts             Complete phase: doc generation, persistence, applied tracking (14 tests, 11 pending)
  07-navigation.spec.ts           Navigation + responsive (8 tests)
docs/
  user-stories/
    01-landing.md                 4 stories, 13 AC
    02-scout.md                   8 stories, 28 AC
    03-review.md                  4 stories, 16 AC
    04-human-gate.md              5 stories, 17 AC
    05-complete.md                7 stories
    06-cross-cutting.md           5 stories, 16 AC
src/__tests__/                    16 Jest test suites (436 tests)
playwright.config.ts              E2E config (chromium, localhost:3000)
playwright-report/                HTML report (gitignored)
```
