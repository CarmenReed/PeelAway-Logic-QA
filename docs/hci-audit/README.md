# HCI Governance

This directory holds the HCI (human computer interaction) governance process
for PeelAway Logic. The goal is simple: catch changes that are significant
enough to warrant a new round of UAT (User Acceptance Testing) before they
are promoted to PROD.

## Why this exists

Automated tests verify that the code is correct. They do not verify that the
user experience is still correct. A refactor can keep every test green while
quietly rewiring how a real user moves through the Scout, Review, Human Gate,
and Complete phases. Larger teams solve this with visual regression suites,
launch reviews, and formal change impact analysis. For a solo portfolio
project we approximate the same idea with a lightweight, deterministic
audit script.

## Components

- `scripts/hci-audit.js`: the analyzer. Scans the diff between `origin/main`
  and the working tree, classifies every changed file into a tier, looks for
  HCI impact signals (routing changes, new interactive elements, copy edits,
  CSS rule changes, accessibility regressions), and emits a verdict.
- `.claude/skills/hci-audit/SKILL.md`: the Claude Code skill that wraps the
  script. Claude runs it automatically after tests pass and before committing
  any UI touching work, and it is also user invocable as `/hci-audit`.
- `docs/hci-audit/flags/`: the audit log. Each YELLOW or RED verdict writes
  one timestamped Markdown file here. These files are the durable record
  that governance happened.

## Verdict tiers

The script emits one of three verdicts per run:

| Verdict | Meaning | Artifact | Action |
| :--- | :--- | :--- | :--- |
| GREEN | No HCI relevant changes | none | Commit as normal |
| YELLOW | Minor HCI impact, spot check recommended | flag file written | Commit, then spot check before promotion |
| RED | Significant HCI impact, UAT cycle warranted | flag file written | Run the UAT scenarios, record sign off, then promote |

Important: the gate is non blocking. RED warns loudly but the script still
exits `0`. The developer is trusted to act on the warning.

## File tiers

Each changed file is classified into one of five tiers. The classification
rules live in `scripts/hci-audit.js` under `TIER_RULES`; this table is the
human summary.

| Tier | What it covers | Examples |
| :--- | :--- | :--- |
| Tier 1 journey | Phase orchestrators, top level routing, the progress stepper, landing screen, header | `src/phases/*.jsx`, `src/App.jsx`, `src/JobSearchPipelineV4.jsx`, `src/components/ProgressStepper.jsx`, `src/components/LandingScreen.jsx`, `src/components/Header.jsx` |
| Tier 2 interaction | Other user facing React components and user visible copy sources | `src/components/CloudConnector.jsx`, `src/components/JobCard.jsx`, `src/prompts.js`, `public/index.html` |
| Tier 3 visual | CSS and front end assets that change the look and feel | `src/App.css`, images under `public/` |
| Tier 4 copy | User story documents, which encode expected behavior and acceptance criteria | `docs/user-stories/*.md` |
| Non HCI | Everything else (tests, scripts, config, non user story docs) | `src/__tests__/**`, `e2e/**`, `scripts/**`, `.promotion.json` |

## Scoring rules (conservative)

Thresholds are intentionally high sensitivity so governance is noisy rather
than silent.

- Any Tier 1 file touched triggers **RED**.
- Any Tier 4 file (user story) touched triggers **RED** because acceptance
  criteria may have drifted.
- Any routing or orchestration symbol (`setPhase`, `currentPhase`,
  `useNavigate`, `handlePhaseChange`, `advancePhase`) hit in any diff line
  triggers **RED**.
- One or more Tier 2 or Tier 3 files touched triggers **YELLOW**. Combined
  with any other signal, those also escalate to RED.
- An accessibility regression (removal of `aria-*`, `role=`, `tabIndex`,
  `alt=`, `onKeyDown`, `onFocus`, or `<label>`) bumps the verdict one step
  toward RED.

If you want to tune these, edit `score()` in `scripts/hci-audit.js` directly.
There is no config file on purpose; the rules live with the code.

## Flag file anatomy

Each flag file contains:

1. Verdict and timestamp
2. Reasons (which rules fired)
3. A file tier summary table
4. Per file breakdown with signal counts
5. The affected user stories (cross referenced by filename mentions)
6. Suggested UAT scenarios to re run
7. A sign off checklist

## Clearing a flag

To clear a flag before promotion:

1. Run the suggested UAT scenarios listed in the flag file.
2. Edit the flag file in place: check the sign off boxes and fill in the
   "Cleared by" line.
3. Commit the edit. The flag file stays in the repo as an audit trail.

Flags are never promoted to PROD. They are excluded in `.promotion.json`.

## Accessibility test coverage

The HCI audit's accessibility signal (ARIA removals, alt text drops,
keyboard handler removals) is a static heuristic. It is paired with two
dynamic test suites that actually render the app and run axe core against
it:

- **Unit level (`src/__tests__/accessibility.test.jsx`)** uses `jest-axe`
  inside jsdom. It covers the full component surface for rule categories
  that do not need layout: image alt text, button names, link names, form
  labels, ARIA validity, SVG labeling, and list structure. Every component
  on the Scout to Complete journey is expected to pass.
- **Browser level (`e2e/09-accessibility.spec.ts`)** uses
  `@axe-core/playwright` inside a real Chromium instance. It covers rules
  that require layout: color contrast (WCAG 1.4.3), focus visibility,
  landmark regions, heading order, and keyboard reachability. It also
  asserts that `aria-current="step"` is exposed on the active pipeline
  step.

Vision impaired users are the primary target of both suites. Color
contrast specifically is only checkable in the Playwright suite because
jsdom has no layout engine.

If the HCI audit reports an accessibility regression in its flag file,
the regression should be reproducible in one of these two suites. If it
is not, either the heuristic is too lax (extend `A11Y_MARKERS` in
`scripts/hci-audit.js`) or the test suite is missing coverage (add a new
case to the relevant spec).

## Running the audit manually

```bash
npm run hci-audit
```

This works at any time. If there are no pending changes against `origin/main`
the script prints a GREEN notice and exits. If `origin/main` cannot be
resolved (offline, detached HEAD) the script falls back to comparing against
`HEAD`, which captures uncommitted changes only.
