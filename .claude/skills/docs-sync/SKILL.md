---
name: docs-sync
description: Sync README.md and claude-code-entry-point.md with the actual test file inventory. Run this skill after adding, renaming, or removing files in src/__tests__/ or e2e/, and again before committing any change that touches those directories. Also invocable as /docs-sync.
---

# Documentation Sync

This skill wraps `scripts/docs-sync.js`, a deterministic offline analyzer
that scans the test directories and rewrites the file lists, structural
counts, and per spec test counts in `README.md` and
`claude-code-entry-point.md` so they never drift from reality.

## Why it exists

The repo already has `.github/workflows/update-docs.yml`, which runs Jest
on every push to `main` and sed-replaces a couple of numeric totals. That
workflow cannot:

- discover new test files and add them to the README's lists
- remove entries when a test file is deleted
- update per spec test counts in the Playwright list
- update the file count columns in the Test Coverage table
- update the "e2e/ contains NN spec files" line in the entry point doc

`docs-sync` fills those gaps. The two automations are complementary: this
skill keeps the structural shape of the docs aligned with the source tree,
and the `update-docs.yml` workflow keeps the numeric grand total honest by
running the real Jest suite.

## When to use

Run this skill:

1. **Automatically**, after adding, renaming, or removing any file under
   `src/__tests__/` or `e2e/`. Do this before staging the commit so the
   doc updates ship together with the test change.
2. **On demand**, when the user types `/docs-sync` or asks "are the docs
   in sync", "update the README test list", or "the test count in the
   README is wrong".
3. **In CI**, as a step inside `.github/workflows/update-docs.yml`. The
   workflow runs `node scripts/docs-sync.js` before its Jest count step,
   so structural drift is caught even when developers forget.

## How to run it

```bash
npm run docs-sync
```

Or directly:

```bash
node scripts/docs-sync.js
```

The script writes changes in place. Exit codes:

- `0` - docs were already in sync. Nothing was written.
- `1` - docs were updated. Review the diff and commit.
- `2` - internal error (missing repo root, unreadable file, etc.).

It always prints an inventory header (Jest file count, Playwright file
count, approximate test totals) and a list of new or removed files since
the last run, so you can see at a glance what changed.

## What to do with the result

After the script runs:

1. **On exit `0`**: nothing to do. Tell the user "docs are already in
   sync" and proceed.
2. **On exit `1`**: read the diff with `git diff README.md
   claude-code-entry-point.md`. Verify the changes look reasonable
   (descriptions for newly added files default to `TODO: add description`
   if no leading comment was found - prompt the user to fill those in).
   Then stage the edits and include them in the same commit as the test
   change that triggered the sync.
3. **On exit `2`**: surface the error message to the user. Do not retry
   blindly; investigate.

## What gets preserved vs rewritten

- **Preserved**: hand written descriptions on existing entries. The
  parser reads each `- **filename** - description` line and reuses the
  description verbatim if the file is still present.
- **Rewritten**: per spec test counts (e.g. `(8 tests)`), file order
  (alphabetical), and the structural counts in the Test Coverage table
  and section headers.
- **Added**: brand new entries for any file in `src/__tests__/` or `e2e/`
  that did not previously appear in the README list. Description is
  pulled from the first meaningful comment line in the file, or set to
  `TODO: add description` if none is found.
- **Removed**: entries whose underlying file no longer exists.

## Limits

- Test totals are approximate. They sum `test()`, `it()`, `test.fixme()`,
  `test.skip()`, `test.only()`, and `.each()` calls via regex. Tests
  generated dynamically (for example by `describe.each([...])` over a
  large array) will undercount. The authoritative grand total still
  comes from `update-docs.yml` running real Jest in CI.
- Description extraction handles `// line comments`, `/* block */`, and
  JSDoc `/** ... */`. It skips the filename header line if present. If
  your test file has no leading comment, the description will be
  `TODO: add description` and you should fill it in by hand.
- The script only updates `README.md` and `claude-code-entry-point.md`.
  If you add a third doc that lists test files, extend the script to
  cover it instead of running it twice.

See also: `docs/hci-audit/README.md` for the parallel HCI governance
process.
