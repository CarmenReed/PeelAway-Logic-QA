# Human Gate - User Stories

## US-GATE-001: Select Individual Jobs for Document Generation

**As a** job seeker in the Review phase
**I want to** check individual job cards in the Strong and Possible tiers
**So that** only the jobs I explicitly choose move forward to the Complete phase

### Acceptance Criteria
- [ ] AC1: Checkboxes are visible on each JobCard in the Strong and Possible tier tabs
- [ ] AC2: Checking a box adds the job to the selected set; unchecking removes it
- [ ] AC3: The Weak tier does not display checkboxes (jobs cannot be directly selected from Weak)
- [ ] AC4: The selected count is reflected in the "Advance to Complete" button label

### Test Coverage
- E2E: e2e/04-human-gate.spec.ts
- Unit: src/__tests__/reviewPhase.test.jsx

---

## US-GATE-002: Select All Strong Tier Jobs

**As a** job seeker who trusts the scoring
**I want to** click "Select All" on the Strong tier
**So that** I can quickly approve all top-scoring jobs without clicking each one

### Acceptance Criteria
- [ ] AC1: A "Select All" control is visible on the Strong tier tab
- [ ] AC2: Clicking "Select All" checks every job card in the Strong tier
- [ ] AC3: Clicking "Select All" again (or a "Deselect All" toggle) unchecks all Strong tier jobs
- [ ] AC4: Manually unchecking one job after "Select All" leaves the rest selected

### Test Coverage
- E2E: e2e/04-human-gate.spec.ts
- Unit: src/__tests__/reviewPhase.test.jsx

---

## US-GATE-003: Advance to Complete with Selected Jobs

**As a** job seeker who has selected jobs
**I want to** click "Advance to Complete" to move only my selected jobs into the Complete phase
**So that** no document generation happens on jobs I did not approve

### Acceptance Criteria
- [ ] AC1: The "Advance to Complete" button is disabled when zero jobs are selected
- [ ] AC2: Clicking the button with selections advances the app to the Complete phase carrying only the selected jobs
- [ ] AC3: Jobs that were not selected remain in the Review phase and do not appear in Complete

### Test Coverage
- E2E: e2e/04-human-gate.spec.ts
- Unit: src/__tests__/reviewPhase.test.jsx, src/__tests__/pipelineUtils.test.js

---

## US-GATE-004: Nothing Fires Without Human Intent

**As a** job seeker
**I want to** be sure that no API calls for resume generation or cover letter generation happen until I explicitly click the relevant button
**So that** I am always in control of when AI-generated content is produced

### Acceptance Criteria
- [ ] AC1: Arriving at the Complete phase does not trigger any automatic API calls for resume or cover letter generation
- [ ] AC2: Each job card in the Complete phase requires an explicit "Create Resume" or "Create Cover Letter" button click before any generation begins
- [ ] AC3: No network requests to the generation API are made between phase transitions without user action

### Test Coverage
- E2E: e2e/04-human-gate.spec.ts
- Unit: src/__tests__/tailorPhase.test.js, src/__tests__/api.test.js

---

## US-GATE-005: Deselect Jobs Before Advancing

**As a** job seeker who changed my mind about a selected job
**I want to** uncheck a previously selected job before clicking "Advance to Complete"
**So that** I can refine my selection without restarting the review

### Acceptance Criteria
- [ ] AC1: Unchecking a selected job decrements the count on the "Advance to Complete" button
- [ ] AC2: If all jobs are deselected, the "Advance to Complete" button becomes disabled
- [ ] AC3: Switching between tier tabs preserves the selection state of previously checked jobs

### Test Coverage
- E2E: e2e/04-human-gate.spec.ts
- Unit: src/__tests__/reviewPhase.test.jsx
