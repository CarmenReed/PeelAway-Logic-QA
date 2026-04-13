# Demo Mode - User Stories

## US-DEMO-001: Demo Mode Toggle

**As a** user preparing a live demo
**I want to** toggle Demo Mode on the Landing page
**So that** the pipeline runs fast with minimal data while still showcasing every phase

### Acceptance Criteria
- [ ] AC1: A "Demo Mode" toggle (checkbox) is visible on the Landing page
- [ ] AC2: The toggle defaults to OFF (unchecked)
- [ ] AC3: When toggled ON, a hint displays: "Demo: 1 result per search, scores floored at 80%"
- [ ] AC4: When toggled OFF, the hint disappears and the app behaves normally

### Test Coverage
- E2E: e2e/08-demo-mode.spec.ts, e2e/01-landing.spec.ts
- Unit: src/__tests__/componentUnits.test.jsx, src/__tests__/components.test.jsx

---

## US-DEMO-002: Demo Mode Search Limiting

**As a** user running the pipeline in Demo Mode
**I want to** receive a maximum of 1 result per search source
**So that** the Scout and Search phases complete quickly during a live demo

### Acceptance Criteria
- [ ] AC1: With Demo Mode ON, each search source (Adzuna, JSearch, RSS, ATS) returns at most 1 result
- [ ] AC2: Multiple sources still run independently (e.g., 1 from Adzuna + 1 from JSearch = 2 total)
- [ ] AC3: With Demo Mode OFF, search behavior is completely unchanged

### Test Coverage
- Unit: src/__tests__/components.test.jsx (integration)
- Manual: Toggle ON, run Scout layers, verify 1 result per source

---

## US-DEMO-003: Demo Mode Score Flooring

**As a** user running the pipeline in Demo Mode
**I want to** see all job scores at 80% or above in the Review phase
**So that** every job appears in the Strong Match tier for a clean demo presentation

### Acceptance Criteria
- [ ] AC1: With Demo Mode ON, any job with total_score < 8 (on 10-point scale) is overridden to 8
- [ ] AC2: Jobs with total_score >= 8 are displayed as-is
- [ ] AC3: With Demo Mode OFF, all scores are displayed as-is regardless of value
- [ ] AC4: Floored scores appear identically to real scores in the UI

### Test Coverage
- Unit: src/__tests__/reviewPhase.test.jsx
- E2E: e2e/08-demo-mode.spec.ts

---

## US-DEMO-004: Logo Navigation to Landing

**As a** user at any phase in the pipeline
**I want to** click the PeelAway Logic logo in the header to return to the Landing page
**So that** I can toggle Demo Mode on/off between pipeline runs

### Acceptance Criteria
- [ ] AC1: The header logo is clickable with a pointer cursor
- [ ] AC2: Clicking the logo shows a confirmation dialog: "Return to start? Progress will be lost."
- [ ] AC3: Confirming resets all pipeline state and returns to the Landing page
- [ ] AC4: Cancelling keeps the user on the current phase with no state change
- [ ] AC5: This behavior works in both Demo Mode and normal mode

### Test Coverage
- E2E: e2e/08-demo-mode.spec.ts, e2e/07-navigation.spec.ts
- Unit: src/__tests__/componentUnits.test.jsx, src/__tests__/components.test.jsx
