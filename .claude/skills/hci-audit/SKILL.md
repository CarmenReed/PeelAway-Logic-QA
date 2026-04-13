---
name: hci-audit
description: Run an HCI governance audit on pending changes to decide whether a UAT re-test cycle is required. Invoke this skill after all tests pass and just before creating a commit that touches user-facing surface. Also use it when asked "is this change UAT-worthy?" or "/hci-audit".
---

# HCI Governance Audit

This skill wraps `scripts/hci-audit.js`, a conservative change-impact analyzer
that scans the diff between `origin/main` and the working tree and classifies
every changed file by its HCI (human-computer interaction) impact tier.

## When to use

Run this skill:

1. **Automatically**, as part of your commit workflow, after `npm test` (and
   `npm run test:e2e` if relevant) has passed green and you are preparing to
   stage and commit changes.
2. **On demand**, when the user types `/hci-audit` or asks something like "is
   this change UAT-worthy", "should we re-test this", or "audit the diff".

Do **not** run it on a clean working tree "just to see". It is a decision
gate, not a linter.

## How to run it

From the repo root:

```bash
npm run hci-audit
```

Or directly:

```bash
node scripts/hci-audit.js
```

The script always exits `0` unless it hits an internal error. Verdicts are
communicated via stdout and via a flag file.

## Verdicts

- **GREEN**: no UAT flag needed. Safe to commit. No artifact is written.
- **YELLOW**: minor HCI impact (for example, a single component tweak or a
  CSS-only change). A flag file is written at
  `docs/hci-audit/flags/<timestamp>-<branch>.md` recommending a spot check.
  Still safe to commit; surface the flag path to the user in your commit
  summary.
- **RED**: significant HCI impact. A flag file is written and the script
  prints a prominent warning. This means a UAT re-test cycle is warranted.

## What to do with the result

After the script runs:

1. **Always** read the console output and tell the user the verdict.
2. On **YELLOW** or **RED**, read the generated flag file, summarize the
   reasons and the affected user stories for the user, and include the flag
   file path in the staged changes for the upcoming commit. Ask the user
   whether they want to proceed with the commit, run the suggested UAT
   scenarios first, or clear the flag via a sign-off edit to the flag file.
3. On **GREEN**, proceed to commit as normal.

Important: the gate is "warn loudly, do not block". Never refuse to commit on
the user's behalf. Always present the flag and let them decide.

## Tier reference

See `docs/hci-audit/README.md` for tier definitions, threshold rationale, and
the sign-off workflow. Do not re-implement the tier rules in prose. If the
user wants to change the rules, edit `scripts/hci-audit.js` (the TIER_RULES
and score() function are the single source of truth).

## Accessibility sub-check

The audit specifically watches for removals of `aria-*`, `role=`, `tabIndex`,
`alt=`, `onKeyDown`, `onFocus`, and `<label>` wiring. Any such removal is
reported as an accessibility regression and bumps the verdict one tier toward
RED. If you see an accessibility regression in the flag, call it out to the
user explicitly before committing.
