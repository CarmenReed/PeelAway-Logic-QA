# Landing — User Stories

## US-LAND-001: Start as Guest

**As a** first-time visitor
**I want to** click "Start as Guest" on the landing screen
**So that** I can begin the job search pipeline without any account setup

### Acceptance Criteria
- [ ] AC1: The LandingScreen renders a "Start as Guest" button that is visible and enabled on load
- [ ] AC2: Clicking "Start as Guest" transitions the app to the Scout phase (phase 0) and the ProgressStepper shows Scout as the active step
- [ ] AC3: No authentication token or Dropbox connection is required to proceed
- [ ] AC4: The GuideBar displays contextual onboarding text after advancing to Scout

### Test Coverage
- E2E: e2e/01-landing.spec.ts
- Unit: src/__tests__/components.test.jsx

---

## US-LAND-002: Launch Pipeline with Dropbox Connected

**As a** returning user with Dropbox connected
**I want to** see a "Launch Pipeline" button on the landing screen
**So that** I can skip the manual upload step and import my resume directly from Dropbox

### Acceptance Criteria
- [ ] AC1: When a valid Dropbox connection is detected, the landing screen shows "Launch Pipeline" instead of (or alongside) "Start as Guest"
- [ ] AC2: Clicking "Launch Pipeline" transitions to Scout phase with the Dropbox import tab active
- [ ] AC3: If Dropbox connection is not present, only "Start as Guest" is shown

### Test Coverage
- E2E: e2e/01-landing.spec.ts
- Unit: src/__tests__/components.test.jsx

---

## US-LAND-003: Connect Your Workspace

**As a** user on the landing screen
**I want to** click "Connect Your Workspace" to link my Dropbox account
**So that** I can import resumes and export tailored documents to my cloud storage

### Acceptance Criteria
- [ ] AC1: A "Connect Your Workspace" button is visible on the LandingScreen
- [ ] AC2: Clicking the button initiates the Dropbox OAuth flow (or shows the connection dialog)
- [ ] AC3: After successful connection, the landing screen updates to show "Launch Pipeline" without requiring a page refresh

### Test Coverage
- E2E: e2e/01-landing.spec.ts
- Unit: src/__tests__/hooks.test.js

---

## US-LAND-004: Landing Screen Branding

**As a** visitor
**I want to** see the PeelAway Logic logo, brand name, and tagline on the landing screen
**So that** I know I am on the correct application and understand its purpose

### Acceptance Criteria
- [ ] AC1: The Header component renders the logo image, "PeelAway Logic" brand text, and a tagline
- [ ] AC2: The logo image loads without a broken-image placeholder
- [ ] AC3: On mobile viewports (below 640px), the header and landing content remain fully visible without horizontal scroll

### Test Coverage
- E2E: e2e/01-landing.spec.ts
- Unit: src/__tests__/componentUnits.test.jsx
