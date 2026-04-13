# Review - User Stories

## US-REV-001: Tier Bucket Display

**As a** job seeker in the Review phase
**I want to** see my scored jobs organized into tier tabs (Strong 8-10, Possible 6-7, Weak 3-5)
**So that** I can focus on the best-matched positions first

### Acceptance Criteria
- [ ] AC1: The ReviewPhase renders three tier tabs: Strong (scores 8-10), Possible (scores 6-7), and Weak (scores 3-5)
- [ ] AC2: No "Rejected" tab is shown in the UI
- [ ] AC3: Each tab displays the correct count of jobs in that tier
- [ ] AC4: Jobs are placed in the correct tier based on their overall score

### Test Coverage
- E2E: e2e/03-review.spec.ts
- Unit: src/__tests__/reviewPhase.test.jsx

---

## US-REV-002: Sort Jobs within a Tier

**As a** job seeker browsing a tier
**I want to** sort jobs by score, date posted, or company name
**So that** I can find the most relevant or newest jobs quickly

### Acceptance Criteria
- [ ] AC1: A sort control is visible within each tier tab offering at least score, date, and company options
- [ ] AC2: Selecting "score" sorts jobs from highest to lowest score
- [ ] AC3: Selecting "date" sorts jobs from newest to oldest posting date
- [ ] AC4: Selecting "company" sorts jobs alphabetically by company name

### Test Coverage
- E2E: e2e/03-review.spec.ts
- Unit: src/__tests__/reviewPhase.test.jsx

---

## US-REV-003: Job Card Detail Display

**As a** job seeker reviewing a job card
**I want to** see the title, company, location, overall score%, skills_fit/5, level_fit/5, reasoning text, tech stack badges, and date badges
**So that** I can make an informed decision about whether to advance the job

### Acceptance Criteria
- [ ] AC1: Each JobCard renders title, company, location, and an overall score expressed as a percentage
- [ ] AC2: skills_fit and level_fit are shown as values out of 5
- [ ] AC3: Tech stack items are displayed as badge elements
- [ ] AC4: Date badges use green for fresh postings and orange for stale postings
- [ ] AC5: A reasoning text section is visible on the card explaining the score

### Test Coverage
- E2E: e2e/03-review.spec.ts
- Unit: src/__tests__/reviewPhase.test.jsx, src/__tests__/componentUnits.test.jsx

---

## US-REV-004: Date Badge Freshness Indicators

**As a** job seeker
**I want to** see color-coded date badges on job cards (green for fresh, orange for stale)
**So that** I can prioritize recently posted jobs

### Acceptance Criteria
- [ ] AC1: Jobs posted within the "fresh" threshold display a green date badge
- [ ] AC2: Jobs posted beyond the "fresh" threshold but within the "stale" range display an orange date badge
- [ ] AC3: The badge text includes the relative or absolute posting date

### Test Coverage
- E2E: e2e/03-review.spec.ts
- Unit: src/__tests__/componentUnits.test.jsx
