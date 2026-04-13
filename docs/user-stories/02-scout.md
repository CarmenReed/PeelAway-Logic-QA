# Scout & Search - User Stories

## US-SCOUT-001: Upload Resume via PDF or TXT

**As a** job seeker in the Scout phase
**I want to** upload my resume as a PDF or TXT file
**So that** the app can extract my professional profile automatically

### Acceptance Criteria
- [ ] AC1: The ScoutPhase renders a file input that accepts .pdf and .txt files
- [ ] AC2: After selecting a valid file, the extracted profile (name, years experience, skills, target levels, locations, search queries) is displayed in editable fields
- [ ] AC3: Uploading an unsupported file type shows a validation error without crashing the app
- [ ] AC4: The GuideBar updates to reflect the upload-in-progress or completed state

### Test Coverage
- E2E: e2e/02-scout.spec.ts
- Unit: src/__tests__/scoutPhase.test.jsx, src/__tests__/profileExtractor.test.js

---

## US-SCOUT-002: Paste Resume Text

**As a** job seeker who does not have a resume file handy
**I want to** paste my resume text directly into a text area
**So that** I can still extract a profile without uploading a file

### Acceptance Criteria
- [ ] AC1: The ScoutPhase provides a text area for pasting resume content
- [ ] AC2: After pasting text and triggering extraction, the profile fields populate with extracted data
- [ ] AC3: Empty paste submission is prevented or shows a validation message

### Test Coverage
- E2E: e2e/02-scout.spec.ts
- Unit: src/__tests__/scoutPhase.test.jsx, src/__tests__/profileExtractor.test.js

---

## US-SCOUT-003: Import Resume from Dropbox

**As a** user with a connected Dropbox account
**I want to** import my resume directly from Dropbox
**So that** I do not need to download and re-upload the file manually

### Acceptance Criteria
- [ ] AC1: When Dropbox is connected, the Dropbox tab is the first and active tab in the upload section
- [ ] AC2: Selecting a file from Dropbox triggers profile extraction identical to a local file upload
- [ ] AC3: If Dropbox is not connected, the Dropbox tab is either hidden or shows a connect prompt

### Test Coverage
- E2E: e2e/02-scout.spec.ts
- Unit: src/__tests__/scoutPhase.test.jsx

---

## US-SCOUT-004: Edit Extracted Profile

**As a** job seeker viewing my extracted profile
**I want to** edit any extracted field (name, years experience, skills, target levels, locations, search queries)
**So that** I can correct extraction errors before running the search

### Acceptance Criteria
- [ ] AC1: All extracted profile fields are rendered as editable inputs or tag editors
- [ ] AC2: Modifying a field and clicking "Continue to Search" carries the edited values forward into the search phase
- [ ] AC3: Skills tags can be added and removed individually
- [ ] AC4: Search queries can be edited or rewritten before proceeding

### Test Coverage
- E2E: e2e/02-scout.spec.ts
- Unit: src/__tests__/scoutPhase.test.jsx, src/__tests__/componentUnits.test.jsx

---

## US-SCOUT-005: Run Search Layers with Abort

**As a** job seeker in the Search phase
**I want to** run 3 independent search layers (Job Boards, RSS Feeds, ATS Boards) and abort any of them individually
**So that** I can control which sources contribute results without waiting for slow sources

### Acceptance Criteria
- [ ] AC1: The SearchPhase displays 3 search layer cards (Job Boards=Adzuna+JSearch, RSS Feeds, ATS Boards) each with a run/abort control
- [ ] AC2: Each layer can be aborted independently without affecting the other layers
- [ ] AC3: Progress indicators show the status of each running layer (loading, complete, aborted, error)
- [ ] AC4: Results from completed layers are retained even if another layer is aborted

### Test Coverage
- E2E: e2e/02-scout.spec.ts
- Unit: src/__tests__/api.test.js, src/__tests__/hooks.test.js

---

## US-SCOUT-006: Manual Job Input (Quick Score)

**As a** job seeker who found a job posting outside the automated search
**I want to** paste a job URL or job description for manual scoring
**So that** I can include it in my pipeline alongside the auto-discovered jobs

### Acceptance Criteria
- [ ] AC1: The SearchPhase provides a Quick Score input area accepting a URL or pasted job description text
- [ ] AC2: Submitting a valid URL or JD text triggers scoring and adds the job to the results
- [ ] AC3: Invalid or empty input shows a validation error message

### Test Coverage
- E2E: e2e/02-scout.spec.ts
- Unit: src/__tests__/manualJobInput.test.jsx

---

## US-SCOUT-007: Search Filters

**As a** job seeker configuring my search
**I want to** filter by work type, date posted, employment type, and zip code + radius
**So that** I only see relevant results from my search layers

### Acceptance Criteria
- [ ] AC1: Filter controls for work type, date posted, employment type, and zip code + radius are visible in the SearchPhase
- [ ] AC2: Applying filters restricts the results returned by the search layers
- [ ] AC3: Clearing all filters restores the full unfiltered result set

### Test Coverage
- E2E: e2e/02-scout.spec.ts
- Unit: src/__tests__/pipelineUtils.test.js

---

## US-SCOUT-008: Score & Review Pipeline (Dedup + Pre-filter + Scoring)

**As a** job seeker with search results gathered
**I want to** click "Score & Review" to deduplicate, pre-filter, and score all results
**So that** I get a ranked, clean set of jobs to review

### Acceptance Criteria
- [ ] AC1: Clicking "Score & Review" triggers the dedup, keyword pre-filter, and scoring pipeline in sequence
- [ ] AC2: Duplicate jobs (same URL or title+company) are collapsed into a single entry
- [ ] AC3: After the pipeline completes, the app transitions to the Review phase with scored results
- [ ] AC4: A progress indicator is visible while the pipeline is running

### Test Coverage
- E2E: e2e/02-scout.spec.ts
- Unit: src/__tests__/pipelineUtils.test.js, src/__tests__/utilsKeywordPreFilter.test.js
