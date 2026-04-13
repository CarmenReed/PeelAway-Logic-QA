# Cross-Cutting - User Stories

## US-NAV-001: ProgressStepper Navigation

**As a** user at any phase in the pipeline
**I want to** see a 4-step progress indicator (Scout, Search, Review, Complete) and click on previously visited phases
**So that** I can navigate back to review earlier work without losing progress

### Acceptance Criteria
- [ ] AC1: The ProgressStepper renders 4 dots with labels: Scout, Search, Review, Complete
- [ ] AC2: Only previously visited phases are clickable; future phases are visually disabled
- [ ] AC3: Clicking a visited phase dot navigates back to that phase with its state intact
- [ ] AC4: The current phase dot is visually distinguished (active state)

### Test Coverage
- E2E: e2e/07-navigation.spec.ts
- Unit: src/__tests__/progressStepper.test.jsx

---

## US-NAV-002: Mobile ProgressStepper

**As a** user on a mobile device (viewport below 640px)
**I want to** see a compact stepper showing "Step X of 4: [Phase Name]"
**So that** I can track my progress without the dots taking up too much screen space

### Acceptance Criteria
- [ ] AC1: At viewport widths below MOBILE_BP (640px), the stepper switches to the compact text format "Step X of 4: [Name]"
- [ ] AC2: At viewport widths at or above 640px, the full dot-and-label stepper is shown
- [ ] AC3: The compact stepper still indicates which step is active and allows navigation to visited steps

### Test Coverage
- E2E: e2e/07-navigation.spec.ts
- Unit: src/__tests__/progressStepper.test.jsx, src/__tests__/componentUnits.test.jsx

---

## US-NAV-003: GuideBar Contextual Help and Start Over

**As a** user at any phase
**I want to** see contextual guidance text in the GuideBar with an emoji indicator and an optional "Start Over" button
**So that** I always know what to do next and can reset if needed

### Acceptance Criteria
- [ ] AC1: The GuideBar renders an emoji and contextual help text that changes based on the current phase
- [ ] AC2: On the Search, Review, and Complete phases, a "Start Over" button is visible in the GuideBar
- [ ] AC3: Clicking "Start Over" resets the pipeline to the Landing screen, clearing in-progress (but not applied) data

### Test Coverage
- E2E: e2e/07-navigation.spec.ts
- Unit: src/__tests__/components.test.jsx

---

## US-NAV-004: Responsive Layout at 640px Breakpoint

**As a** user on a mobile device
**I want to** have a fully usable layout at viewport widths down to 320px
**So that** I can complete the entire pipeline on my phone

### Acceptance Criteria
- [ ] AC1: At 640px viewport width, no horizontal scrollbar appears on any phase
- [ ] AC2: Job cards, filter controls, and buttons stack vertically on narrow viewports
- [ ] AC3: All interactive elements (buttons, checkboxes, inputs) remain tappable with a minimum 44x44px touch target

### Test Coverage
- E2E: e2e/07-navigation.spec.ts
- Unit: src/__tests__/componentUnits.test.jsx

---

## US-NAV-005: Error Handling and Loading States

**As a** user interacting with the pipeline
**I want to** see clear loading indicators during async operations and meaningful error messages when something fails
**So that** I am never left wondering whether the app is working or broken

### Acceptance Criteria
- [ ] AC1: All API calls (search layers, scoring, document generation) show a loading spinner or skeleton while in progress
- [ ] AC2: Network errors display a user-friendly error message with a retry option where applicable
- [ ] AC3: Errors do not crash the app or leave it in an unrecoverable state; the user can always navigate back or retry

### Test Coverage
- E2E: e2e/07-navigation.spec.ts
- Unit: src/__tests__/api.test.js, src/__tests__/hooks.test.js

---

## US-NAV-006: Vision Impaired Accessibility

**As a** user who relies on a screen reader, keyboard navigation, or high
contrast settings
**I want to** use every phase of the pipeline without a pointer and hear
meaningful labels for every control
**So that** I can complete the full Scout to Complete workflow using assistive
technology

### Acceptance Criteria
- [ ] AC1: Every image has meaningful alt text or is explicitly marked
  decorative; SVG icons used as content have `role="img"` and an `aria-label`
- [ ] AC2: Every button and link has an accessible name, either from visible
  text or an `aria-label`
- [ ] AC3: Every form control (inputs, textareas, checkboxes) has a label or
  `aria-label` that identifies its purpose
- [ ] AC4: The ProgressStepper exposes the active step via `aria-current="step"`
  and each clickable dot is a native `<button>` with a descriptive label
- [ ] AC5: The workspace connection modal exposes `role="dialog"`,
  `aria-modal="true"`, and `aria-labelledby` pointing at its heading; Escape
  closes it
- [ ] AC6: All interactive elements are reachable by keyboard in a logical
  order; focus is visible; no element traps focus
- [ ] AC7: Text passes WCAG 1.4.3 contrast ratio (4.5:1 for normal text, 3:1
  for large text) against its background
- [ ] AC8: Removing any of the above (ARIA, alt, label, keyboard handler)
  must be flagged by `scripts/hci-audit.js` as an accessibility regression

### Test Coverage
- Unit: src/__tests__/accessibility.test.jsx (jest-axe, covers AC1 through AC5 at the component level)
- E2E: e2e/09-accessibility.spec.ts (@axe-core/playwright, covers AC6 and AC7 in a real browser)
- Static: scripts/hci-audit.js (AC8, regex scan of removed lines)
- Governance: docs/hci-audit/README.md
