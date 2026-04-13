# Claude Code Entry Point: PeelAway Logic QA Environment

A developer guide for using Claude Code with this repository. Read this first before making any changes.

---

## 1. Project Overview

**PeelAway Logic** is a QA environment for an AI-powered job search automation pipeline. It reduces executive function friction in the job search by automating the scout-to-apply workflow.

The app is a React 18 single-page application. It calls the Anthropic API directly from the browser (no backend server). Job data is persisted in localStorage between sessions.

### Pipeline Phases

| Phase | Name | What Happens |
|-------|------|-------------|
| 0 | Scout | Upload resume, run 3 search layers, score all jobs with Haiku |
| 1 | Review | Browse jobs by tier, select which ones to pursue (Human Gate) |
| 2 | Complete | Generate tailored resume and cover letter per approved job, download documents, mark jobs as applied, track history |

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18.3.1, Create React App |
| LLM (scoring) | `claude-haiku-4-5-20251001` |
| LLM (tailoring, ATS search) | `claude-sonnet-4-6` |
| PDF extraction | pdf.js 3.11.174 (loaded from CDN at runtime) |
| Persistence | localStorage (4 keys, all prefixed `jsp-`) |
| Styling | Plain CSS in `src/App.css`, Google Fonts (Fredoka for brand header) |
| Testing (Unit) | Jest + @testing-library/react,  tests across  suites |
| Testing (E2E) | @playwright/test, 52 tests across 6 specs (Chromium) |
| Accessibility (Unit) | jest-axe, vision impaired rules (alt, button/link/label names, ARIA, SVG) |
| Accessibility (E2E) | @axe-core/playwright, color contrast (WCAG 1.4.3), focus, landmarks |
| HCI Governance | `scripts/hci-audit.js`, skill at `.claude/skills/hci-audit/`, flags at `docs/hci-audit/flags/` |

### One Rule That Applies Everywhere

No em-dashes. Not in code, prompts, comments, UI copy, or this file. Use a comma or restructure the sentence instead.

---

## 2. Opening the Project in Claude Code

### Prerequisites

- Node.js 18 or higher
- Claude Code CLI or desktop app installed
- A `.env` file in the project root (see Section 5)

### From the Terminal

```bash
cd "C:\Users\CarmenReed\Downloads\ClaudeProjects\PeelAway-Logic-QA"
claude
```

When Claude Code prompts to trust the workspace, choose **Trust**. This allows file reads and shell commands without per-action approval.

### From the Desktop App

Open the Claude Code desktop app, click **Open Project**, and navigate to:

```
C:\Users\CarmenReed\Downloads\ClaudeProjects\PeelAway-Logic-QA
```

### From an IDE Extension

In VS Code or JetBrains, open the project folder, then launch Claude Code from the sidebar or command palette.

---

## 3. Recommended Memory Edits and Context Setup

When starting a new Claude Code session in this repo, prime the session with these facts so Claude does not have to rediscover them.

### What to Add to CLAUDE.md (or paste at session start)

```
Project: PeelAway Logic QA, React 18 job search pipeline app.
Phases: Scout (0), Review (1), Complete (2).
Models: claude-sonnet-4-6 for tailoring + ATS web search, claude-haiku-4-5-20251001 for scoring.
All config values live in src/constants.js (model names, delays, batch sizes, storage keys, API URL).
API wrappers (withRetry, callAnthropic, callAnthropicWithLoop) are all in src/api.js.
Prompt builders for tailoring are all in src/prompts.js.
Pure utility functions (extractJson, deduplicateJobs, reTierJobs) are in src/utils.js.
localStorage keys: jsp-applied-jobs, jsp-last-scout, jsp-tailor-results, jsp-dismissed-jobs.
Tailoring API calls do NOT fire until the user explicitly approves jobs in Review (Human Gate).
No em-dashes anywhere: not in code, prompts, comments, or UI copy.
Anthropic API key must have web_search_20250305 tool enabled for Layer 3 and JD re-scoring to work.
```

### Key Session Priming Steps

1. Read `src/constants.js` first. It contains every magic number, model ID, delay value, and storage key in one place.
2. Read `src/api.js` to understand the retry wrapper and agentic loop before touching any API call.
3. Check `src/prompts.js` before editing any prompt. All tailor prompts are there. Scoring and ATS prompts are inline in `ScoutPhase.jsx`.

---

## 4. Key Files to Understand First

Read these in order. Each one depends on the previous.

### 1. `src/constants.js`

All configuration in one file. No magic numbers anywhere else. Key exports:

```js
MODEL                  // "claude-sonnet-4-6" (tailoring + ATS)
SCORING_MODEL          // "claude-haiku-4-5-20251001" (batch scoring)
SCORING_BATCH_SIZE     // 8 (jobs per Haiku batch)
SCORING_BATCH_DELAY_MS // 15000 (ms between batches)
TAILOR_DELAY_MS        // 8000 (ms between tailor API calls)
API_URL                // "https://api.anthropic.com/v1/messages"
MOBILE_BP              // 640 (responsive breakpoint px)
TAILOR_SYSTEM          // Anti-hallucination system prompt for tailoring
```

Storage keys are also here: `STORAGE_APPLIED`, `STORAGE_SCOUT`, `STORAGE_TAILOR`, `STORAGE_DISMISSED`.

### 2. `src/JobSearchPipeline.jsx`

Root component. Owns all top-level state and routes between phases. Key state:

```js
phase          // 0-3, controls which phase renders
profileText    // Extracted resume text, passed down to all phases
scoutResults   // { found, summary, tiers, notes } from Scout
approvedJobs   // Jobs approved in Review, passed to Complete
tailorResults  // Generated docs (restored from localStorage on mount)
appliedJobs    // Applied job entries (restored from localStorage on mount)
maxVisited     // Highest phase reached, unlocks phase nav tabs
```

### 3. `src/api.js`

All Anthropic API wrappers. Three functions you will use everywhere:

- `withRetry(fn, maxAttempts)`: Wraps any async function. Retries up to 3x with exponential backoff (2s, 4s, 8s). Waits 20s on 429. Rethrows AbortError immediately.
- `callAnthropic(options)`: Single non-streaming API call. Returns parsed response object.
- `callAnthropicWithLoop(options)`: Agentic tool-use loop. Handles tool_use / tool_result turns automatically. Max turns configurable per call site.

Also contains:
- `loadPdfJs()`: Loads pdf.js from CDN, returns the library object
- `extractTextFromPdf(file)`: Reads a File object, extracts text, detects garbling
- `detectWebSearchSupport(apiKey)`: Probes whether the key has web_search_20250305 enabled

### 4. `src/prompts.js`

Three exported functions:

```js
buildTailorPrompt(profileText, job, candidateName)       // Returns both resume + cover letter
buildResumeOnlyPrompt(profileText, job)                  // Resume only (used for regen)
buildCoverLetterOnlyPrompt(profileText, job, candidateName) // Cover letter only (used for regen)
```

These are the only place to edit tailor prompt content. The system prompt (anti-hallucination rules) lives in `TAILOR_SYSTEM` in `constants.js`.

### 5. `src/utils.js`

Pure utility functions with no side effects. Fully unit-tested. Key functions:

```js
extractJson(text)                // Tries 3 strategies to parse JSON from LLM response
deduplicateJobs(jobs)            // URL-based + normalized company|title dedup
mergeRawJobs(existing, incoming) // Merge new jobs into accumulated list, deduplicated
keywordPreFilter(jobs, profile)  // Dynamic pre-filter using profile's targetLevel and location
reTierJobs(jobs)                 // Sort jobs into tier buckets by score
normalizeTitle(title)            // Lowercase, expand abbreviations, collapse spaces
```

### 6. `src/storage.js`

Thin wrappers around localStorage. All reads return safe defaults (empty arrays, null).

```js
loadAppliedJobs() / saveAppliedJobs(list)
loadLastScoutResults() / saveLastScoutResults(results)
loadTailorResults() / saveTailorResult(entry)
loadDismissedJobs() / saveDismissedJob(job) / isDismissed(job)
```

### 7. `src/profileExtractor.js`

Regex-based resume parser with no dependencies. Contains a ~200-entry `SKILLS_DICTIONARY` across 9 categories. Exports `extractProfile(resumeText)` which returns `{ name, skills, yearsExperience, targetLevel, location, titles, searchQueries: { adzuna, jsearch } }`. Used by ScoutPhase to auto-populate the editable extracted profile UI.

### 8. `src/phases/ScoutPhase.jsx`

Most complex file. Contains three independent search layers plus Quick Score (ManualJobInput), deduplication, pre-filtering, batch scoring, JD fetching, and re-scoring. Features user-configurable search filters (work type, date posted, employment type, US zip code + radius) and an editable extracted profile section. All searches are hard-coded to US only. Two inline prompts live here:

- Search for `"You are a job scoring AI"` to find the Haiku scoring prompt
- Search for `web_search_20250305` to find the ATS web search prompt

### 9. `src/phases/ReviewPhase.jsx`

Tier tabs (Strong, Possible, Weak) plus job selection. Weak tab is read-only. Selecting jobs and clicking Approve writes to `approvedJobs` state in the parent and writes dismissed jobs to localStorage.

### 10. `src/phases/CompletePhase.jsx`

Per-job document generation, downloads, Mark Applied, Applied Tracker. Key behaviors:
- `jobState` object keyed by `job_title|company` stores status and generated text per job
- `abortRefs` useRef holds one AbortController per job document (keyed `jobKey_resume`, `jobKey_cover`)
- `lastCallTime` useRef enforces the 8-second delay between API calls
- Restored from `jsp-tailor-results` on mount, so reloading the page preserves all work
- "Clear All" wipes `jsp-applied-jobs` and `jsp-last-scout` but intentionally leaves `jsp-tailor-results` so generated documents survive a new search.

---

## 5. Environment Variables and Config

### `.env` File (create in project root, gitignored)

```bash
# Required: Anthropic API key with web_search_20250305 tool enabled
REACT_APP_ANTHROPIC_API_KEY=sk-ant-api03-...

# Optional: Adzuna job board API (Layer 1 only; app warns but continues without these)
REACT_APP_ADZUNA_APP_ID=your-app-id
REACT_APP_ADZUNA_APP_KEY=your-app-key

# Optional: JSearch via RapidAPI (Layer 1 only; app warns but continues without this)
REACT_APP_RAPIDAPI_KEY=your-rapidapi-key
```

Missing optional keys: Layer 1 (Adzuna + JSearch) will show a warning and skip. Layer 2 (RSS) and Layer 3 (ATS web search) still run.

Missing Anthropic key: the app will throw immediately on any API call. Check `src/api.js` for the key validation error message.

### Web Search Requirement

The Anthropic key must have `web_search_20250305` enabled. This is required for:
- Layer 3 (ATS board discovery via Greenhouse, Lever, Workday)
- JD fetching for top 5 strong matches before re-scoring
- Manual Job Input when a URL is pasted instead of raw text

To verify: `detectWebSearchSupport(apiKey)` in `src/api.js` makes a probe call. The app calls this during Scout initialization and disables Layer 3 if it fails.

### Constants (no .env needed)

Edit `src/constants.js` directly to change:

| Constant | Default | When to Change |
|----------|---------|----------------|
| `SCORING_BATCH_SIZE` | 8 | Reduce to 4 when hitting Haiku rate limits |
| `SCORING_BATCH_DELAY_MS` | 15000 | Increase if scoring batches fail with 429 |
| `TAILOR_DELAY_MS` | 8000 | Increase to 12000 if tailoring gets rate-limited |
| `MODEL` | `claude-sonnet-4-6` | Update when new Sonnet version releases |
| `SCORING_MODEL` | `claude-haiku-4-5-20251001` | Update when new Haiku version releases |

---

## 6. Running the App Locally

```bash
# Install dependencies (first time only)
npm install

# Start dev server (hot reload, localhost:3000)
npm start

# Run all 436 Jest tests (interactive watch mode)
npm test

# Run Jest headless (CI mode)
CI=true npm test

# Build production bundle (output to build/)
npm run build

# Run HCI governance audit (pre-commit, after tests pass)
npm run hci-audit
```

The dev server reads `.env` automatically via CRA's dotenv integration. No manual sourcing needed.

### HCI Governance Audit

After `npm test` passes and before committing any change that touches user
facing surface, run `npm run hci-audit`. The script scans the diff against
`origin/main`, classifies each changed file by HCI impact tier, and emits a
GREEN, YELLOW, or RED verdict. YELLOW and RED write a flag file at
`docs/hci-audit/flags/` listing affected user stories and suggested UAT
scenarios. The gate warns loudly but never blocks. See
`docs/hci-audit/README.md` for tier definitions and the sign off workflow,
and `.claude/skills/hci-audit/SKILL.md` for the Claude Code skill that wraps
it.

### Accessibility Tests

Vision impaired accessibility is covered by two suites:

- `src/__tests__/accessibility.test.jsx` runs `jest-axe` at the component
  level (image alt, button/link/label names, ARIA validity, SVG labeling,
  dialog semantics, aria-current on the pipeline stepper)
- `e2e/09-accessibility.spec.ts` runs `@axe-core/playwright` in a real
  browser for color contrast, focus order, landmark regions, and keyboard
  reachability

Both suites run as part of `npm test` and `npm run test:e2e`. If the HCI
audit reports an accessibility regression, the failing behavior should be
reproducible in one of these suites.

### E2E Tests (Playwright)

```bash
# Run all 52 E2E tests headless
npm run test:e2e

# Interactive UI mode (best for debugging)
npm run test:e2e:ui

# Headed browser (watch tests run)
npm run test:e2e:headed

# Generate and view HTML report
npx playwright test --reporter=html
npx playwright show-report
```

**E2E directory structure:**
- `e2e/` contains 8 Playwright spec files covering all pipeline phases plus accessibility
- `e2e/09-accessibility.spec.ts` runs axe core in Chromium for WCAG 2.1 AA coverage including color contrast
- `e2e/fixtures/test-helpers.ts` has shared helpers: `loginAsGuest()`, `waitForPhase()`, `mockAnthropicApi()`, `mockSearchApis()`, `goToLanding()`, `dismissBanners()`, `getMockJobResults()`
- All external APIs (Anthropic Claude, Adzuna, JSearch, RSS feeds) are mocked via `page.route()` in test-helpers.ts, so tests run offline with deterministic data and zero API costs

**User stories:** `docs/user-stories/` contains user stories with acceptance criteria across 7 files, providing requirements traceability from story to E2E spec to unit test. `06-cross-cutting.md` includes `US-NAV-006: Vision Impaired Accessibility` which is the traceability anchor for both a11y test suites and the HCI audit's a11y regression signal.

**API mocking pattern:** E2E tests intercept network requests using Playwright's `page.route()` API. Mocks live in `e2e/fixtures/test-helpers.ts` and cover:
- `**/api.anthropic.com/v1/messages` (Anthropic Claude API)
- `**/api.adzuna.com/**` (Adzuna job search)
- `**/jsearch.p.rapidapi.com/**` (JSearch via RapidAPI)
- RSS feeds (WeWorkRemotely, Remotive, RemoteOK, Himalayas, Jobicy)

**data-testid convention:** Use the pattern `data-testid="phase-element-descriptor"`, e.g. `data-testid="tailor-card"`, `data-testid="progress-stepper-mobile"`, `data-testid="env-banner-close"`.

**Test-writing rule:** Any new feature or bug fix should include both a Jest unit test AND a corresponding Playwright E2E test where applicable. Tests that require full pipeline data but cannot yet seed it should use `test.fixme()` with a clear comment explaining what they verify.

---

## 7. Testing Workflow Per Phase

### Phase 0: Scout

**Goal:** Confirm all three layers fetch, deduplicate, pre-filter, and score correctly.

1. Click through the landing screen ("Get Started" button)
2. Upload a PDF or TXT resume, or paste resume text into the text area
3. Click **Start Scout** to run all three layers
4. Watch the per-layer status badges update in real time
5. Layer 1 requires Adzuna and RapidAPI keys; it will display a warning and skip gracefully if missing
6. Layer 2 (RSS) needs no keys; watch the console for per-feed proxy fallback messages
7. Layer 3 requires the Anthropic key with web search; watch the `progressMsg` display for turn-by-turn updates
8. After layers finish, click **Score and Advance**
9. Open DevTools > Console: verify batch logs showing 8 jobs per batch with 15-second gaps
10. Verify tier counts are reasonable (not all Strong, not all Weak)

**Isolation tests:**
- Disable Layer 1 and 3 by omitting their API keys. Run with only RSS feeds to test Layer 2 in isolation.
- Use **Manual Job Input** (Quick Score) to paste a single job description and score it immediately, bypassing all three layers.
- Click the Cancel button mid-run. Verify that the AbortController fires and the spinner stops.

### Phase 1: Review

**Goal:** Confirm tier display, sorting, selection, and Human Gate all work correctly.

1. Verify the three tier tabs appear: Strong Match (8-10), Possible (6-7), Weak (3-5)
2. Check that each job card shows: title, company, location, score, freshness badge, tech stack chips
3. Test all three sort options: By Score, By Date, By Company
4. Select checkboxes in Strong and Possible tabs only; verify Weak tab has no checkboxes
5. Confirm freshness badge colors: green for jobs posted under 14 days, orange for stale or unverified
6. Click **Approve Selected**
7. Open React DevTools, find `JobSearchPipeline`, verify `approvedJobs` state has the selected entries
8. Open DevTools > Application > Local Storage > check `jsp-dismissed-jobs` has entries for non-selected Strong/Possible jobs

### Phase 2: Complete

**Goal:** Confirm per-job generation, rate limiting, persistence, downloads, apply tracking, and reset behavior.

1. Verify the page loads without triggering any network requests (Human Gate: no API calls until user clicks)
2. Click **Create Resume** on the first job; watch the status change from idle to generating (spinner) to ready (checkmark)
3. Click **Create Resume** on the second job immediately; confirm it waits approximately 8 seconds before firing
4. Click **Create Cover Letter** on the first job after resume is ready
5. Click the **redo** button on a completed resume; confirm it re-fires the API call and overwrites the stored text
6. Switch the download format dropdown between txt, md, and pdf; confirm each download triggers the correct behavior (txt/md = file download, pdf = print dialog)
7. Refresh the page; verify all completed resumes and cover letters are restored from localStorage
8. Open DevTools > Application > Local Storage > check `jsp-tailor-results` has entries with `resume` and `cover_letter` text
9. Verify every approved job appears with its title, company, job URL (clickable), and download buttons
10. Click **Mark Applied** on a job; confirm it moves to the Applied Tracker section with a timestamp
11. Expand the Applied Tracker; verify the entry shows title, company, and applied date
12. Click **Remove** on an applied entry; verify it disappears from the tracker
13. Click **New Search**; verify the app resets to Phase 0 with a blank resume upload
14. Click **Clear All**; verify `jsp-applied-jobs` and `jsp-last-scout` are cleared in localStorage, but `jsp-tailor-results` is not

---

## 8. Common Debugging Scenarios

### API Hangs

**Symptom:** Spinner runs indefinitely, no error message, no console output after a certain point.

**Scout ATS Layer (Layer 3):** The `callAnthropicWithLoop` function in `src/api.js` runs up to 8 tool-use turns. If the web search returns no useful results, the model may loop and exhaust all turns before returning. Watch `progressMsg` in the UI for the last-known turn status. If progress stalls at "Searching ATS boards..." for over 90 seconds, the loop is likely stuck.

Debug step: Add a `console.log` at the start of each turn inside `callAnthropicWithLoop` to see which turn the loop is on.

**JD Fetch Re-score:** The `fetchJdText` function in `ScoutPhase.jsx` also uses the agentic loop, capped at 5 turns. If it finds no usable text after 5 turns, it returns `null` and the job is not re-scored. This is expected and safe; the job keeps its original score.

**Document Generation (Complete phase):** Each job has its own `AbortController` stored in `abortRefs.current[jobKey + "_resume"]` and `abortRefs.current[jobKey + "_cover"]`. If a generation hangs, use the cancel button rendered per job. If no cancel button is visible, check that `jobState[jobKey].resumeStatus === "generating"` is true; the cancel button renders conditionally on that status.

**`withRetry` total wait time:** On a 429 response, `withRetry` waits 20 seconds before retrying. With 3 attempts, total wall time before an error surfaces can be 60 seconds or more. This is not a hang; it is expected retry behavior.

Debug step: Set `SCORING_BATCH_DELAY_MS` to 2000 in `constants.js` temporarily to speed up testing.

### JSON Parse Errors

**Symptom:** Console shows "Could not find valid JSON in the response" or the scoring phase shows an error state.

**Root cause:** Haiku sometimes returns the JSON wrapped in markdown code fences, or returns an explanation sentence before the JSON, or the response is truncated.

**How `extractJson` works** (`src/utils.js`): It tries three strategies in order:
1. `JSON.parse(text)` directly
2. Strip code fences with `stripCodeFences()`, then parse
3. Find the outermost `{` and `}`, extract that substring, then parse

If all three fail, it throws "Could not find valid JSON in the response."

**Debug steps:**

1. Add this line in `ScoutPhase.jsx` just before calling `extractJson`:
   ```js
   console.log("RAW RESPONSE:", response.content[0].text);
   ```
2. Look at the raw text in the console. If the model returned an explanation before the JSON, the third strategy (outermost `{}`) should catch it. If it did not, the JSON itself is malformed.
3. If malformed JSON appears frequently, add `"Return valid JSON only. Do not explain. Do not wrap in markdown."` as the last line of the scoring user message in `ScoutPhase.jsx`.
4. Reduce `SCORING_BATCH_SIZE` in `constants.js` from 8 to 4. Smaller batches reduce the chance of a truncated response.

### `.map()` Crashes

**Symptom:** React error boundary triggers, blank white screen, console shows "Cannot read properties of undefined (reading 'map')".

**Known safe locations:** The following guards are already in place in the codebase:
- `JobCard.jsx`: `Array.isArray(key_tech_stack) && key_tech_stack.length > 0` before rendering tech stack chips
- `ReviewPhase.jsx` and `ScoutPhase.jsx`: `tiers[tier] ?? []` before mapping over tier arrays

**If a new crash appears:** The most likely cause is that Haiku returned a job object missing an expected field, and that field reached a render path without a guard.

Debug steps:

1. Check the console for the component name in the stack trace. Look at what it was mapping over.
2. Add a `console.log(job)` inside the scoring result handler in `ScoutPhase.jsx` to inspect the raw job shape before it enters `reTierJobs`.
3. The fix is usually a single normalization line after scoring, before tiering:
   ```js
   job.key_tech_stack = job.key_tech_stack ?? [];
   job.reasoning = job.reasoning ?? "";
   job.date_posted = job.date_posted ?? null;
   ```

### PDF Text Extraction Failures

**Symptom:** A warning banner appears: "PDF text appears garbled (font encoding issue)." The resume text area shows question marks or unreadable characters.

**Root cause:** The PDF uses a custom or embedded font where glyph-to-character mapping is not standard. pdf.js cannot decode it.

**Where it happens:** `extractTextFromPdf()` in `src/api.js`. It checks for garbling by looking at the ratio of non-ASCII characters to total characters.

**Fix options:**
1. Ask the user to re-save the PDF using Word's "Save as PDF/A" option, which embeds standard font encoding.
2. Ask the user to paste their resume text directly into the text area instead of uploading a file. This bypasses pdf.js entirely.
3. If the garbling check is too aggressive (flagging valid PDFs with accented characters), adjust the threshold in `extractTextFromPdf`.

### localStorage State Desync

**Symptom:** Old dismissed jobs reappear, or a previous session's tailor results show up unexpectedly, or "New Search" does not fully reset the view.

**All localStorage keys:**

| Key | Contents | Cleared By |
|-----|----------|-----------|
| `jsp-applied-jobs` | Applied jobs list | "Clear All" in CompletePhase |
| `jsp-last-scout` | Full Scout results cache | "Clear All" in CompletePhase |
| `jsp-tailor-results` | Generated resume + cover letter text | Never auto-cleared (intentional) |
| `jsp-dismissed-jobs` | Jobs dismissed in Review | Never auto-cleared (intentional) |

**Manual clear:** DevTools > Application > Local Storage > select each `jsp-*` key > Delete.

**If `jsp-tailor-results` grows too large:** localStorage has a 5MB limit per origin. Tailor results are plain text and should stay small, but after many sessions they can accumulate. Clear manually if the app throws a storage quota error.

### Rate Limit Errors (429)

**Symptom:** Console shows a 429 response, `withRetry` logs "Rate limited, waiting 20 seconds," and the spinner pauses for 20 seconds before continuing.

**This is handled automatically.** No action needed unless it happens repeatedly.

**If 429 errors are frequent during scoring:**
- Reduce `SCORING_BATCH_SIZE` in `constants.js` from 8 to 4
- Increase `SCORING_BATCH_DELAY_MS` from 15000 to 20000

**If 429 errors are frequent during tailoring:**
- Increase `TAILOR_DELAY_MS` in `constants.js` from 8000 to 12000

**If 429 errors persist after adjustments:** Check the Anthropic console for your account's rate limit tier. Free and Build tiers have lower token-per-minute limits than Scale tier.

---

## 9. Prompt Iteration Tips

### Where Prompts Live

| Prompt | Location | How to Edit |
|--------|----------|-------------|
| Tailor resume prompt | `src/prompts.js`, `buildResumeOnlyPrompt()` | Edit function body, reload app |
| Tailor cover letter prompt | `src/prompts.js`, `buildCoverLetterOnlyPrompt()` | Edit function body, reload app |
| Tailor system prompt (anti-hallucination rules) | `src/constants.js`, `TAILOR_SYSTEM` | Edit constant, reload app |
| Haiku job scoring prompt | `src/phases/ScoutPhase.jsx`, search `"You are a job scoring AI"` | Edit inline, reload app |
| ATS web search prompt | `src/phases/ScoutPhase.jsx`, search `web_search_20250305` | Edit inline, reload app |

### Testing a Single Prompt Change Without Running the Full Pipeline

**For scoring prompt changes:**

Use Manual Job Input (Quick Score) in the Scout phase. Paste a single job description into the text field and click Score. This fires one Haiku scoring call immediately without running Adzuna, JSearch, or RSS layers. Much faster than a full Scout run.

**For tailor prompt changes:**

1. Complete Scout and Review with a small set (one or two approved jobs)
2. In Complete phase, click Create Resume or Create Cover Letter on a single job
3. After it completes, click the **redo** button to re-fire the call with your updated prompt
4. Compare the new output against the previous one

The redo button is the fastest way to iterate on tailor prompts without re-running the full pipeline.

### Prompt Constraints to Always Respect

1. No em-dashes in any prompt text. Use commas or restructure the sentence.
2. The anti-hallucination rules in `TAILOR_SYSTEM` are non-negotiable. Do not remove or weaken them. The app is used by real job seekers submitting real applications.
3. The scoring system prompt must instruct the model to return JSON only. If you add explanation or context to the prompt, add a final line: `"Return valid JSON only. No explanation. No markdown."`
4. The ATS search prompt targets only Greenhouse, Lever, and Workday. Do not expand it to all ATS boards without also verifying the parsing logic handles the new formats.

### Checking Prompt Output Quality

After a scoring run, open DevTools > Console and look for the batch scoring log. Each batch logs the raw model response before JSON extraction. Review a sample of the returned job objects to confirm:

- `total_score` is between 0 and 10
- `skills_fit` and `level_fit` are each between 0 and 5
- `key_tech_stack` is an array (may be empty but must not be null)
- `reasoning` is a non-empty string

After a tailor run, download the resume as a `.txt` file and scan for:

- No invented job titles, degrees, or certifications
- No fabricated metrics (percentages, dollar amounts, headcounts)
- No em-dashes in the output text
- Skills listed match what was in the original resume profile

---

## 10. Quick Reference

### File Map

```
src/
  constants.js          All config: models, delays, storage keys, API URL
  api.js                withRetry, callAnthropic, callAnthropicWithLoop, pdf extraction
  prompts.js            Tailor prompt builders (resume, cover letter, candidateName param)
  utils.js              extractJson, deduplicateJobs, keywordPreFilter(jobs, profile), reTierJobs
  profileExtractor.js   Regex-based resume parser (~200 skills, name/level/location extraction)
  storage.js            localStorage load/save wrappers
  JobSearchPipeline.jsx Root component, all top-level state, phase router
  phases/
    ScoutPhase.jsx      3 search layers + filters + profile extraction + scoring (most complex)
    ReviewPhase.jsx     Tier tabs, sort, job selection, Human Gate
    CompletePhase.jsx   Per-job doc generation, rate limiting, abort refs, persistence, downloads, Mark Applied, Applied Tracker
  components/
    JobCard.jsx         Single job display, tech stack chips, score badge
    ManualJobInput.jsx  Quick Score: paste URL or JD, integrated into Step 3
    AppliedTracker.jsx  Collapsible applied jobs list
    LandingScreen.jsx   Guest entry, "Get Started" button
    Header.jsx          Brand logo bar (Fredoka font + italic tagline)
    ProgressStepper.jsx Phase nav tabs (unlocked up to maxVisited)
    GuideBar.jsx        Emoji + instruction banner above each phase
    Spinner.jsx         Loading animation
  hooks/
    useWindowWidth.js   Responsive breakpoint hook (MOBILE_BP = 640)
  services/
    azureSearchService.js  Azure AI Search REST client (index, batch index, search, delete)
  __tests__/              tests across  suites
    pipelineUtils.test.js       Utility function tests (JSON, dedup, titles, prompts)
    utilsKeywordPreFilter.test.js Dynamic pre-filter tests (profile-driven)
    profileExtractor.test.js    Resume parser tests (skills, name, levels, queries)
    scoutPhase.test.jsx         Scout phase render + filter + profile display tests
    componentUnits.test.jsx     Individual component render tests
    components.test.jsx         Pipeline layout and integration tests
    manualJobInput.test.jsx     Quick Score component tests
    reviewPhase.test.jsx        Review phase tier and selection tests
    completePhase.test.jsx      Complete phase tests
    progressStepper.test.jsx    Phase nav stepper tests
    tailorPhase.test.js         Complete phase document generation tests
    tailorPersistence.test.js   localStorage persistence tests
    api.test.js                 API wrapper and retry logic tests
    storage.test.js             localStorage wrapper tests
    hooks.test.js               Custom hook tests
    azureSearchService.test.js  Azure AI Search REST client tests (index, batch, search, delete)
e2e/                             52 Playwright E2E tests across 6 specs
  fixtures/
    test-helpers.ts              Shared helpers, API mocks (page.route)
  01-landing.spec.ts             Landing page (6 tests)
  02-scout.spec.ts               Scout + Search phases (10 tests)
  03-review.spec.ts              Review phase + structural checks (8 tests)
  04-human-gate.spec.ts          Human Gate intent enforcement (6 tests)
  05-complete.spec.ts            Complete phase: doc generation, persistence, applied tracking (14 tests)
  07-navigation.spec.ts          Navigation, responsive layout (8 tests)
docs/
  user-stories/                  36 user stories, 127 acceptance criteria
    01-landing.md                Landing (4 stories, 13 AC)
    02-scout.md                  Scout & Search (8 stories, 28 AC)
    03-review.md                 Review (4 stories, 16 AC)
    04-human-gate.md             Human Gate (5 stories, 17 AC)
    05-complete.md               Complete (7 stories)
    06-cross-cutting.md          Cross-cutting (5 stories, 16 AC)
  TEST-STRATEGY-OVERVIEW.md      Interview-ready test strategy reference
playwright.config.ts             E2E config (chromium, localhost:3000, 60s timeout)
playwright-report/               HTML report (gitignored)
```

### Additional Directories

```
semantic-kernel-demo/           Python SK orchestration demo (mirrors pipeline phases, Azure OpenAI swap-ready)
docs/architecture/              Architecture docs, Mermaid diagrams, and ADRs
  ARCHITECTURE.md               System context, component overview, data flow narrative
  decisions/                    Architecture Decision Records (ADR-001 through ADR-006)
  diagrams/                     Mermaid source files for system context, container, and pipeline diagrams
scripts/
  doc-lint.js                   Documentation quality linter (em-dashes, broken links, file size, ADR sections)
```

### localStorage Quick Reference

```
jsp-applied-jobs     Array of { title, company, url, appliedDate }
jsp-last-scout       Full scout results { found, summary, tiers, notes }
jsp-tailor-results   Array of { job_title, company, url, resume, cover_letter }
jsp-dismissed-jobs   Array of { title, company, url }
```

### API Models Quick Reference

```
claude-haiku-4-5-20251001   Scoring (8 jobs per batch, 15s between batches)
claude-sonnet-4-6           Tailoring, ATS web search, JD fetch + re-score
web_search_20250305         Tool type (must be enabled on API key)
```
