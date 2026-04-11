# PeelAway Logic Job Search Pipeline: Post-Reskin Decomposition Plan

**For: Claude Code / Cowork execution**
**Version: 1.0 | April 2026**
**Author: Carmen Reed (PeelAway Logic)**
**Execute AFTER: UI Reskin is complete and verified working**

---

## 1. OBJECTIVE

The UI reskin has already been applied to `JobSearchPipelineV4.jsx`, making it an even larger single file (~3000+ lines). This plan decomposes that reskinned monolith into a clean multi-file React architecture.

This is a **structural refactor only**. No visual changes, no new features, no behavior changes. The app must look and function identically before and after.

---

## 2. TARGET FILE STRUCTURE

```
src/
  App.jsx                        (root, imports Pipeline + CSS)
  App.css                        (all styles, already reskinned)
  constants.js                   (all consts, API config, storage keys)
  utils.js                       (pure utility functions)
  prompts.js                     (all LLM prompt builders)
  storage.js                     (localStorage read/write helpers)
  api.js                         (Anthropic API call wrappers, withRetry, loadPdfJs)
  hooks/
    useWindowWidth.js             (window resize hook)
  components/
    LandingScreen.jsx             (new from reskin: guest entry screen)
    Header.jsx                    (new from reskin: sticky logo + brand bar)
    ProgressStepper.jsx           (new from reskin: horizontal dot+line stepper)
    GuideBar.jsx                  (new from reskin: emoji + text banner)
    Spinner.jsx                   (loading spinner)
    JobCard.jsx                   (single job display card)
    ManualJobInput.jsx            (paste URL / JD text scorer)
    AppliedTracker.jsx            (applied jobs list + controls)
  phases/
    ScoutPhase.jsx                (phase 1: resume + search layers)
    ReviewPhase.jsx               (phase 2: tier tabs + job selection)
    TailorPhase.jsx               (phase 3: resume/cover letter gen)
    CompletePhase.jsx             (phase 4: downloads + tracking)
  JobSearchPipeline.jsx           (main orchestrator: state, phase routing)
```

---

## 3. EXTRACTION MAP

This tells you exactly what to pull from the reskinned `JobSearchPipelineV4.jsx` and where it goes. Line numbers are approximate since the reskin changed them. **Find functions by name, not by line number.**

### 3.1 `constants.js`

Extract all top-level `const` declarations (these were unchanged by the reskin):

```
MODEL, SCORING_MODEL, SCORING_BATCH_SIZE, SCORING_BATCH_DELAY_MS,
API_URL, API_HEADERS_BASE, ANTHROPIC_API_KEY, STORAGE_KEY,
SCOUT_STORAGE_KEY, TAILOR_RESULTS_KEY, TAILOR_DELAY_MS,
DISMISSED_KEY, MOBILE_BP, ADZUNA_APP_ID, ADZUNA_APP_KEY, RAPIDAPI_KEY
```

Export all as named exports.

### 3.2 `utils.js`

Extract these pure functions (no API calls, no localStorage, no React):

| Function | Purpose |
|----------|---------|
| `stripCodeFences` | Remove markdown code fences |
| `extractOutermostJson` | Find JSON in messy text |
| `extractJson` | Try multiple JSON parse strategies |
| `extractTextFromBlocks` | Pull text from API content blocks |
| `normalizeTitle` | Normalize job titles for comparison |
| `companyTitleKey` | Generate dedup key |
| `jobKey` | Generate unique job key |
| `isAppliedMatch` | Check if job matches applied entry |
| `deduplicateJobs` | Remove duplicate jobs |
| `mergeRawJobs` | Merge incoming jobs with existing |
| `mergeScoutResults` | Merge scout result sets |
| `reTierJobs` | Re-sort jobs into score tiers |
| `filterAppliedFromTiers` | Remove applied jobs from tiers |
| `keywordPreFilter` | Filter jobs by keyword relevance |

Export all as named exports.

### 3.3 `storage.js`

Extract all localStorage helper functions:

| Function | Purpose |
|----------|---------|
| `loadAppliedJobs` | Read applied jobs from localStorage |
| `saveAppliedJobs` | Write applied jobs to localStorage |
| `loadLastScoutResults` | Read cached scout results |
| `saveLastScoutResults` | Write scout results cache |
| `loadTailorResults` | Read cached tailor outputs |
| `saveTailorResult` | Write single tailor result |
| `clearTailorResults` | Wipe tailor cache |
| `loadDismissedJobs` | Read dismissed job list |
| `saveDismissedJob` | Add job to dismissed list |
| `clearDismissedJobs` | Wipe dismissed list |
| `isDismissed` | Check if job is dismissed |

Import storage keys from `./constants`. Export all as named exports.

### 3.4 `prompts.js`

Extract all prompt-building functions:

| Function | Purpose |
|----------|---------|
| `buildTailorPrompt` | Full resume + cover letter prompt |
| `buildResumeOnlyPrompt` | Resume-only regeneration prompt |
| `buildCoverLetterOnlyPrompt` | Cover letter only prompt |

Pure string builders. Take `profileText` and `job` object, return a string. Export as named exports.

### 3.5 `api.js`

Extract shared API interaction helpers:

| Function | Purpose |
|----------|---------|
| `withRetry` | Retry wrapper with exponential backoff + 429 handling |
| `loadPdfJs` | PDF.js CDN loader + text extraction |

Import from `./constants` as needed. Export as named exports.

**Note**: Phase-specific API calls (Scout search layers, Tailor generation calls) stay in their phase files since they contain phase-specific request/response logic.

### 3.6 `hooks/useWindowWidth.js`

Extract the `useWindowWidth` custom hook.

```javascript
import { useState, useEffect } from "react";
import { MOBILE_BP } from "../constants";

export default function useWindowWidth() {
  // ... existing implementation unchanged
}
```

### 3.7 Components (from reskin)

These were added or rewritten during the reskin. Each becomes its own file:

| Component | File | Notes |
|-----------|------|-------|
| `LandingScreen` | `components/LandingScreen.jsx` | New from reskin. References `PeelAwayLogicLogoText.png` |
| `Header` | `components/Header.jsx` | New from reskin. References `PeelAwayLogicLogo.png` |
| `ProgressStepper` | `components/ProgressStepper.jsx` | New from reskin. Replaced old StepTracker |
| `GuideBar` | `components/GuideBar.jsx` | New from reskin. Emoji + text banner |
| `Spinner` | `components/Spinner.jsx` | Existing, restyled |
| `JobCard` | `components/JobCard.jsx` | Existing, restructured markup + percentage scores |
| `ManualJobInput` | `components/ManualJobInput.jsx` | Existing, restyled. Has its own state + API calls |
| `AppliedTracker` | `components/AppliedTracker.jsx` | Existing, restyled |

Each gets a default export. Import from `../constants`, `../utils`, `../api` as needed.

### 3.8 Phase Components

Each phase is a substantial component with its own state and effects:

| Component | File | Key Imports |
|-----------|------|-------------|
| `ScoutPhase` | `phases/ScoutPhase.jsx` | constants, utils, storage, api, Spinner, ManualJobInput, JobCard, GuideBar |
| `ReviewPhase` | `phases/ReviewPhase.jsx` | utils, JobCard, GuideBar |
| `TailorPhase` | `phases/TailorPhase.jsx` | constants, utils, storage, prompts, api, Spinner, GuideBar |
| `CompletePhase` | `phases/CompletePhase.jsx` | storage, AppliedTracker, GuideBar |

Each gets a default export. Props stay exactly as they are now (passed from the orchestrator).

### 3.9 `JobSearchPipeline.jsx` (the orchestrator)

What remains after all extractions:
- The `started` state (from reskin Landing screen logic)
- All top-level `useState` declarations (phase, scoutResults, approvedJobs, tailorResults, appliedList, profileText, etc.)
- Phase routing logic
- Callbacks passed to child phases (onComplete, onAdvance, etc.)
- Renders: `LandingScreen` (when not started) OR `Header` + `ProgressStepper` + active phase

Import all phases and shared components. Export as default.

### 3.10 `App.jsx`

Update import path:

```javascript
import JobSearchPipeline from "./JobSearchPipeline";
import "./App.css";

export default function App() {
  return <JobSearchPipeline />;
}
```

### 3.11 `App.css`

**No changes.** Already reskinned. Leave as-is.

---

## 4. IMPORT/EXPORT RULES

1. **Named exports** for everything in `constants.js`, `utils.js`, `storage.js`, `prompts.js`, `api.js`
2. **Default exports** for all React components (one component per file)
3. **Import only what you use** in each file. No wildcard imports.
4. **Relative paths**: `./constants`, `../utils`, `../components/JobCard`, etc.

---

## 5. IMPLEMENTATION ORDER

Execute in this exact sequence. **After each step, the app must still compile and run identically.**

### Step 1: Create `constants.js`
- Cut all top-level constants from `JobSearchPipelineV4.jsx`
- Paste into `src/constants.js` with named exports
- Add `import { MODEL, SCORING_MODEL, ... } from "./constants"` to `JobSearchPipelineV4.jsx`
- **Verify app runs, looks identical**

### Step 2: Create `utils.js`
- Cut all pure utility functions listed in 3.2
- Paste into `src/utils.js` with named exports
- Add imports to `JobSearchPipelineV4.jsx`
- **Verify app runs, looks identical**

### Step 3: Create `storage.js`
- Cut all localStorage helpers listed in 3.3
- Paste into `src/storage.js`, import keys from `./constants`
- Add imports to `JobSearchPipelineV4.jsx`
- **Verify app runs, looks identical**

### Step 4: Create `prompts.js`
- Cut prompt builder functions listed in 3.4
- Paste into `src/prompts.js` with named exports
- Add imports to `JobSearchPipelineV4.jsx`
- **Verify app runs, looks identical**

### Step 5: Create `api.js`
- Cut `withRetry` and `loadPdfJs`
- Paste into `src/api.js`, import from `./constants`
- Add imports to `JobSearchPipelineV4.jsx`
- **Verify app runs, looks identical**

### Step 6: Create `hooks/useWindowWidth.js`
- Create `src/hooks/` directory
- Cut the hook, paste with default export
- Import `MOBILE_BP` from `../constants`
- Add import to `JobSearchPipelineV4.jsx`
- **Verify app runs, looks identical**

### Step 7: Extract small components
- Create `src/components/` directory
- Cut and create files one at a time: `Spinner.jsx`, `GuideBar.jsx`, `Header.jsx`, `LandingScreen.jsx`, `ProgressStepper.jsx`, `JobCard.jsx`, `AppliedTracker.jsx`
- Each gets a default export and necessary imports from `../constants`, `../utils`, etc.
- Update `JobSearchPipelineV4.jsx` to import each from `./components/`
- **Verify after each component extraction**

### Step 8: Extract `ManualJobInput.jsx`
- This is larger with its own state and API calls
- Cut into `src/components/ManualJobInput.jsx`
- Wire up imports from `../constants`, `../utils`, `../api`
- Update `JobSearchPipelineV4.jsx` import
- **Verify app runs, looks identical**

### Step 9: Extract phase components (one at a time)
Do these one by one. After each, verify the app runs.

- **9a**: Cut `ScoutPhase` into `src/phases/ScoutPhase.jsx`. Wire imports. **Verify.**
- **9b**: Cut `ReviewPhase` into `src/phases/ReviewPhase.jsx`. Wire imports. **Verify.**
- **9c**: Cut `TailorPhase` into `src/phases/TailorPhase.jsx`. Wire imports. **Verify.**
- **9d**: Cut `CompletePhase` into `src/phases/CompletePhase.jsx`. Wire imports. **Verify.**

### Step 10: Rename and clean up
- Rename the remaining `JobSearchPipelineV4.jsx` to `JobSearchPipeline.jsx`
- Update `App.jsx` to `import JobSearchPipeline from "./JobSearchPipeline"`
- Delete the old file if a copy remains
- Confirm `src/` directory matches the target structure in Section 2
- **Verify app runs, looks identical**

---

## 6. DO NOT CHANGE

- **Zero logic changes.** No refactoring of algorithms, API calls, state management, or scoring.
- **Zero visual changes.** The reskinned app must look pixel-identical before and after.
- **No renaming of functions or variables** (except the main component filename).
- **No dependency additions.** Same React, same imports, same PDF.js CDN.
- **`App.css` stays untouched.** It was already reskinned.
- **No em-dashes** anywhere in code or comments.
- **Props and callbacks stay identical.** Each phase component receives the same props it does now.

---

## 7. VERIFICATION CHECKLIST

After the full decomposition:

1. `npm start` compiles with zero errors and zero new warnings
2. Landing screen loads with PeelAway Logic logo, "Start as Guest" works
3. Header with icon logo + brand text appears on all pipeline screens
4. Horizontal progress stepper renders correctly across all phases
5. Guide banners appear at top of each phase
6. Scout: resume upload, all search layers, manual job input all work
7. Review: tier tabs, checkboxes, percentage scores, "Advance" button work
8. Tailor: status chips update, resume/cover letter generation works
9. Complete: downloads, "Mark Applied", applied tracker, "New Search" work
10. localStorage persistence works across page refreshes
11. All cards, buttons, inputs match the reskinned mockup styling
12. Quicksand font renders throughout
13. No inline `style={{}}` props (except dynamic runtime values)
14. `src/` directory matches the target structure in Section 2 exactly
