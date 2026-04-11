# Claude Code Entry Point: PeelAway Logic QA Environment

A developer guide for using Claude Code with this repository. Read this first before making any changes.

---

## 1. Project Overview

**PeelAway Logic** is a QA environment for an AI-powered job search automation pipeline. It reduces executive function friction for neurodivergent job seekers by automating the scout-to-apply workflow.

The app is a React 18 single-page application. It calls the Anthropic API directly from the browser (no backend server). Job data is persisted in localStorage between sessions.

### Pipeline Phases

| Phase | Name | What Happens |
|-------|------|-------------|
| 0 | Scout | Upload resume, run 3 search layers, score all jobs with Haiku |
| 1 | Review | Browse jobs by tier, select which ones to pursue (Human Gate) |
| 2 | Tailor | Generate tailored resume and cover letter per approved job |
| 3 | Complete | Download documents, mark jobs as applied, track history |

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18.3.1, Create React App |
| LLM (scoring) | `claude-haiku-4-5-20251001` |
| LLM (tailoring, ATS search) | `claude-sonnet-4-6` |
| PDF extraction | pdf.js 3.11.174 (loaded from CDN at runtime) |
| Persistence | localStorage (4 keys, all prefixed `jsp-`) |
| Styling | Plain CSS in `src/App.css`, Google Fonts (Quicksand) |
| Testing | @testing-library/react, 132 tests across 4 suites |

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
Phases: Scout (0), Review (1), Tailor (2), Complete (3).
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
approvedJobs   // Jobs approved in Review, passed to Tailor
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
buildTailorPrompt(profileText, job)       // Returns both resume + cover letter
buildResumeOnlyPrompt(profileText, job)   // Resume only (used for regen)
buildCoverLetterOnlyPrompt(profileText, job) // Cover letter only (used for regen)
```

These are the only place to edit tailor prompt content. The system prompt (anti-hallucination rules) lives in `TAILOR_SYSTEM` in `constants.js`.

### 5. `src/utils.js`

Pure utility functions with no side effects. Fully unit-tested. Key functions:

```js
extractJson(text)                // Tries 3 strategies to parse JSON from LLM response
deduplicateJobs(jobs)            // URL-based + normalized company|title dedup
mergeRawJobs(existing, incoming) // Merge new jobs into accumulated list, deduplicated
keywordPreFilter(job)            // Reject juniors, interns, wrong locations before scoring
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

### 7. `src/phases/ScoutPhase.jsx`

Most complex file. Contains three independent search layers plus manual input, deduplication, pre-filtering, batch scoring, JD fetching, and re-scoring. Two inline prompts live here:

- Search for `"You are a job scoring AI"` to find the Haiku scoring prompt
- Search for `web_search_20250305` to find the ATS web search prompt

### 8. `src/phases/TailorPhase.jsx`

Per-job document generation. Key behaviors:
- `jobState` object keyed by `job_title|company` stores status and generated text per job
- `abortRefs` useRef holds one AbortController per job document (keyed `jobKey_resume`, `jobKey_cover`)
- `lastCallTime` useRef enforces the 8-second delay between API calls
- Restored from `jsp-tailor-results` on mount, so reloading the page preserves all work

### 9. `src/phases/ReviewPhase.jsx`

Tier tabs (Strong, Possible, Weak) plus job selection. Weak tab is read-only. Selecting jobs and clicking Approve writes to `approvedJobs` state in the parent and writes dismissed jobs to localStorage.

### 10. `src/phases/CompletePhase.jsx`

Downloads, Mark Applied, Applied Tracker. "Clear All" wipes `jsp-applied-jobs` and `jsp-last-scout` but intentionally leaves `jsp-tailor-results` so generated documents survive a new search.

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

# Run all 132 tests
npm test

# Build production bundle (output to build/)
npm run build
```

The dev server reads `.env` automatically via CRA's dotenv integration. No manual sourcing needed.

To run tests without interactive watch mode:

```bash
CI=true npm test
```

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

### Phase 2: Tailor

**Goal:** Confirm per-job generation, rate limiting, persistence, and download formats.

1. Verify the page loads without triggering any network requests (Human Gate: no API calls until user clicks)
2. Click **Resume** on the first job; watch the status change from idle to generating (spinner) to ready (checkmark)
3. Click **Resume** on the second job immediately; confirm it waits approximately 8 seconds before firing
4. Click **Cover Letter** on the first job after resume is ready
5. Click the **redo** button on a completed resume; confirm it re-fires the API call and overwrites the stored text
6. Switch the download format dropdown between txt, md, and pdf; confirm each download triggers the correct behavior (txt/md = file download, pdf = print dialog)
7. Refresh the page; verify all completed resumes and cover letters are restored from localStorage
8. Open DevTools > Application > Local Storage > check `jsp-tailor-results` has entries with `resume` and `cover_letter` text

**Advance condition:** the Next button to Phase 3 is disabled until at least one job has both resume and cover letter completed.

### Phase 3: Complete

**Goal:** Confirm downloads, apply tracking, and reset behavior.

1. Verify every approved job appears with its title, company, job URL (clickable), and download buttons
2. Click **Mark Applied** on a job; confirm it moves to the Applied Tracker section with a timestamp
3. Expand the Applied Tracker; verify the entry shows title, company, and applied date
4. Click **Remove** on an applied entry; verify it disappears from the tracker
5. Click **New Search**; verify the app resets to Phase 0 with a blank resume upload
6. Return to Tailor phase (via nav tab); verify previously generated documents are still present
7. Click **Clear All**; verify `jsp-applied-jobs` and `jsp-last-scout` are cleared in localStorage, but `jsp-tailor-results` is not

---

## 8. Common Debugging Scenarios

### API Hangs

**Symptom:** Spinner runs indefinitely, no error message, no console output after a certain point.

**Scout ATS Layer (Layer 3):** The `callAnthropicWithLoop` function in `src/api.js` runs up to 8 tool-use turns. If the web search returns no useful results, the model may loop and exhaust all turns before returning. Watch `progressMsg` in the UI for the last-known turn status. If progress stalls at "Searching ATS boards..." for over 90 seconds, the loop is likely stuck.

Debug step: Add a `console.log` at the start of each turn inside `callAnthropicWithLoop` to see which turn the loop is on.

**JD Fetch Re-score:** The `fetchJdText` function in `ScoutPhase.jsx` also uses the agentic loop, capped at 5 turns. If it finds no usable text after 5 turns, it returns `null` and the job is not re-scored. This is expected and safe; the job keeps its original score.

**Tailor Generation:** Each job has its own `AbortController` stored in `abortRefs.current[jobKey + "_resume"]` and `abortRefs.current[jobKey + "_cover"]`. If a generation hangs, use the cancel button rendered per job. If no cancel button is visible, check that `jobState[jobKey].resumeStatus === "generating"` is true; the cancel button renders conditionally on that status.

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
2. In Tailor phase, click Resume or Cover Letter on a single job
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
  prompts.js            Tailor prompt builders (resume, cover letter)
  utils.js              extractJson, deduplicateJobs, keywordPreFilter, reTierJobs
  storage.js            localStorage load/save wrappers
  JobSearchPipeline.jsx Root component, all top-level state, phase router
  phases/
    ScoutPhase.jsx      3 search layers + scoring + JD fetch + re-score (most complex)
    ReviewPhase.jsx     Tier tabs, sort, job selection, Human Gate
    TailorPhase.jsx     Per-job doc generation, rate limiting, abort refs, persistence
    CompletePhase.jsx   Downloads, Mark Applied, Applied Tracker, Clear All
  components/
    JobCard.jsx         Single job display, tech stack chips, score badge
    ManualJobInput.jsx  Quick Score: paste URL or JD, score without full pipeline
    AppliedTracker.jsx  Collapsible applied jobs list
    LandingScreen.jsx   Guest entry, "Get Started" button
    Header.jsx          Sticky logo bar
    ProgressStepper.jsx Phase nav tabs (unlocked up to maxVisited)
    GuideBar.jsx        Emoji + instruction banner above each phase
    Spinner.jsx         Loading animation
  hooks/
    useWindowWidth.js   Responsive breakpoint hook (MOBILE_BP = 640)
  __tests__/
    pipelineUtils.test.js    132 utility function tests
    components.test.jsx      Component render tests
    tailorPhase.test.js      Tailor phase behavior tests
    tailorPersistence.test.js localStorage persistence tests
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
