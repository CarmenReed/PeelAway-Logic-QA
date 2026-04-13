# Complete — User Stories

## US-COMP-001: Per-Job Document Generation

**As a** job seeker in the Complete phase
**I want to** see a separate card for each approved job with independent "Create Resume" and "Create Cover Letter" buttons
**So that** I can generate tailored documents one job at a time

### Acceptance Criteria
- [ ] AC1: Each approved job renders as a distinct card in the CompletePhase
- [ ] AC2: Each card has a "Create Resume" button and a "Create Cover Letter" button, operating independently
- [ ] AC3: Clicking "Create Resume" does not trigger "Create Cover Letter" and vice versa (one API call each)
- [ ] AC4: Status chips on each card show Pending, Generating..., or Ready for each document type independently
- [ ] AC5: Each card shows a visible "View Posting" link to the original job URL (opens in new tab)

### Test Coverage
- E2E: e2e/05-complete.spec.ts
- Unit: src/__tests__/tailorPhase.test.js, src/__tests__/completePhase.test.jsx

---

## US-COMP-002: Document Generation Status Tracking

**As a** job seeker who clicked "Create Resume" or "Create Cover Letter"
**I want to** see a status chip update from Pending to Generating... to Ready
**So that** I know when my document is available for download

### Acceptance Criteria
- [ ] AC1: Before any action, the status chip shows "Pending"
- [ ] AC2: After clicking a create button, the status chip changes to "Generating..."
- [ ] AC3: When generation completes successfully, the status chip changes to "Ready"
- [ ] AC4: If generation fails, an error state is shown and the user can retry

### Test Coverage
- E2E: e2e/05-complete.spec.ts
- Unit: src/__tests__/tailorPhase.test.js, src/__tests__/api.test.js

---

## US-COMP-003: Download Format Selection and Actions

**As a** job seeker with a Ready document
**I want to** choose a download format (txt, md, or pdf) and use Copy, Redo, Download, or Dropbox actions
**So that** I can get my tailored documents in the format and location I need

### Acceptance Criteria
- [ ] AC1: A format selector offering txt, md, and pdf options is visible
- [ ] AC2: Clicking a download button saves the document in the selected format
- [ ] AC3: Clicking "Copy" copies the document content to the clipboard
- [ ] AC4: Clicking "Redo" clears the current document and allows re-generation
- [ ] AC5: Clicking "Dropbox" (when connected) uploads the document to the user's Dropbox

### Test Coverage
- E2E: e2e/05-complete.spec.ts
- Unit: src/__tests__/completePhase.test.jsx

---

## US-COMP-004: Mid-Run Persistence via localStorage

**As a** job seeker who accidentally closed the browser or refreshed mid-generation
**I want to** resume where I left off with previously generated documents intact
**So that** I do not lose completed work

### Acceptance Criteria
- [ ] AC1: Results are persisted to localStorage under the key "jsp-tailor-results" after each document completes
- [ ] AC2: On page reload, previously completed documents are restored with Ready status
- [ ] AC3: Documents still in Generating... state at reload time revert to Pending (not stuck in generating)

### Test Coverage
- E2E: e2e/05-complete.spec.ts
- Unit: src/__tests__/tailorPersistence.test.js, src/__tests__/storage.test.js

---

## US-COMP-005: Mark Job as Applied

**As a** job seeker who has submitted an application
**I want to** click "Mark Applied" on a job card (after both documents are generated)
**So that** I can track which jobs I have already applied to

### Acceptance Criteria
- [ ] AC1: The "Mark Applied" button appears only when both resume and cover letter are in Ready status
- [ ] AC2: Clicking "Mark Applied" moves the job into the applied tracker section
- [ ] AC3: The applied job is persisted in localStorage under the key "jsp-applied-jobs"
- [ ] AC4: Applied jobs are excluded from future scout/search runs

### Test Coverage
- E2E: e2e/05-complete.spec.ts
- Unit: src/__tests__/completePhase.test.jsx, src/__tests__/storage.test.js

---

## US-COMP-006: Applied Tracker Persistence and Management

**As a** returning user
**I want to** see my previously applied jobs in the tracker and be able to remove or clear them
**So that** I maintain an accurate record of my applications across sessions

### Acceptance Criteria
- [ ] AC1: On page load, the applied tracker is populated from localStorage ("jsp-applied-jobs")
- [ ] AC2: Each applied job has a "Remove" button that deletes it from the tracker and localStorage
- [ ] AC3: A "Clear All" action removes all applied jobs from the tracker and localStorage
- [ ] AC4: Removed jobs are no longer excluded from future scout runs

### Test Coverage
- E2E: e2e/05-complete.spec.ts
- Unit: src/__tests__/completePhase.test.jsx, src/__tests__/storage.test.js

---

## US-COMP-007: Start a New Search

**As a** job seeker who has completed a round of applications
**I want to** click "New Search" to restart the pipeline from the Scout phase
**So that** I can search for additional jobs without losing my applied history

### Acceptance Criteria
- [ ] AC1: A "New Search" button is visible in the CompletePhase
- [ ] AC2: Clicking "New Search" resets the pipeline to the Scout phase (phase 0)
- [ ] AC3: The applied jobs tracker and localStorage persist through the reset
- [ ] AC4: Previously applied jobs are excluded from the new search results

### Test Coverage
- E2E: e2e/05-complete.spec.ts
- Unit: src/__tests__/completePhase.test.jsx, src/__tests__/pipelineUtils.test.js
