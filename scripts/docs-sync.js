#!/usr/bin/env node

/**
 * Docs Sync
 *
 * Keeps README.md and claude-code-entry-point.md in sync with the actual
 * test file inventory.
 *
 * Scans src/__tests__/ for Jest files and e2e/ for Playwright spec files,
 * then:
 *
 *   1. Adds any new test files to the README's Jest and Playwright lists
 *   2. Removes entries for files that no longer exist
 *   3. Counts tests per file (test(), it(), test.fixme(), test.skip(),
 *      test.only()) and updates per file counts in the Playwright list
 *   4. Updates "NN tests across MM suites" totals everywhere they appear
 *   5. Updates the Test Coverage table Files column
 *   6. Updates the "e2e/ contains NN Playwright spec files" line in
 *      claude-code-entry-point.md
 *
 * The script preserves hand written descriptions on existing entries. When
 * a new file is discovered, it tries to pull a description from the first
 * meaningful comment line in the file; if none is found, a TODO placeholder
 * is used so the gap is obvious.
 *
 * Test totals are computed by summing per-file counts. This is an
 * approximation; the authoritative total still comes from running Jest,
 * which the update-docs.yml workflow does on every push to main. Having
 * both is intentional: docs-sync handles the parts update-docs.yml cannot
 * (file lists, structural counts, per-spec counts), and update-docs.yml
 * refines the grand total.
 *
 * Deterministic and safe to run repeatedly.
 *
 * Exit codes:
 *   0 - docs are already in sync, nothing changed
 *   1 - docs were updated, callers should commit the changes
 *   2 - internal error
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = process.cwd();
const README = path.join(REPO_ROOT, 'README.md');
const ENTRY_POINT = path.join(REPO_ROOT, 'claude-code-entry-point.md');
const JEST_DIR = path.join(REPO_ROOT, 'src', '__tests__');
const E2E_DIR = path.join(REPO_ROOT, 'e2e');

// ---------- File discovery ----------

function listJestFiles() {
  if (!fs.existsSync(JEST_DIR)) return [];
  return fs
    .readdirSync(JEST_DIR)
    .filter((f) => /\.test\.(jsx?|tsx?)$/.test(f))
    .sort();
}

function listE2eSpecFiles() {
  if (!fs.existsSync(E2E_DIR)) return [];
  return fs
    .readdirSync(E2E_DIR)
    .filter((f) => /\.spec\.(jsx?|tsx?)$/.test(f))
    .sort();
}

// ---------- Test counting ----------

function countTests(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  // Strip single line comments to avoid counting examples inside comments.
  const stripped = content
    .split('\n')
    .map((line) => {
      const idx = line.indexOf('//');
      return idx === -1 ? line : line.slice(0, idx);
    })
    .join('\n');
  // Match test(, it(, and their chained variants with a preceding boundary
  // so we do not catch identifiers like "unitTest(".
  const re = /(?:^|[^A-Za-z_$])(?:test|it)(?:\.(?:fixme|skip|only|each))?\s*\(/g;
  const matches = stripped.match(re);
  return matches ? matches.length : 0;
}

// ---------- Description extraction ----------

function extractDescription(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n').slice(0, 40);
  const basename = path.basename(filePath);

  for (const raw of lines) {
    const trimmed = raw.trim();
    if (trimmed === '') continue;
    const isComment =
      trimmed.startsWith('//') ||
      trimmed.startsWith('*') ||
      trimmed.startsWith('/*');
    if (!isComment) break;

    const text = trimmed
      .replace(/^\/\*+\s?/, '')
      .replace(/\*+\/$/, '')
      .replace(/^\*\s?/, '')
      .replace(/^\/\/+\s?/, '')
      .trim();

    if (!text) continue;
    if (text === basename) continue;
    if (text.toLowerCase().startsWith(basename.toLowerCase())) continue;
    return text;
  }
  return 'TODO: add description';
}

// ---------- Record collection ----------

function collectJestRecords() {
  return listJestFiles().map((basename) => {
    const fullPath = path.join(JEST_DIR, basename);
    return { basename, fullPath, count: countTests(fullPath) };
  });
}

function collectE2eRecords() {
  return listE2eSpecFiles().map((basename) => {
    const fullPath = path.join(E2E_DIR, basename);
    return { basename, fullPath, count: countTests(fullPath) };
  });
}

// ---------- README list region helpers ----------

const JEST_SECTION_HEADER = /^\*\*Jest \(Unit\/Component\):\*\*/;
const PLAYWRIGHT_SECTION_HEADER = /^\*\*Playwright \(E2E\):\*\*/;
const CI_SECTION_HEADER = /^### CI\/CD Integration/;

function parseExistingList(content, sectionStart, sectionEnd) {
  const lines = content.split('\n');
  const headerIdx = lines.findIndex((l) => sectionStart.test(l));
  if (headerIdx === -1) return { entries: new Map(), headerIdx: -1 };
  const endIdx = lines.findIndex((l, i) => i > headerIdx && sectionEnd.test(l));
  const rangeEnd = endIdx === -1 ? lines.length : endIdx;

  const entries = new Map();
  const re = /^- \*\*([^*]+)\*\*\s*(?:\((\d+) tests?\))?\s*-\s*(.+)$/;
  for (let i = headerIdx + 1; i < rangeEnd; i++) {
    const m = lines[i].match(re);
    if (m) {
      entries.set(m[1].trim(), { description: m[3].trim(), originalIndex: i });
    }
  }
  return { entries, headerIdx, rangeEnd };
}

function buildListLines(records, existingDescriptions, includeCount) {
  return records.map((rec) => {
    const existing = existingDescriptions.get(rec.basename);
    const description = existing
      ? existing.description
      : extractDescription(rec.fullPath);
    const countSuffix = includeCount
      ? ` (${rec.count} test${rec.count === 1 ? '' : 's'})`
      : '';
    return `- **${rec.basename}**${countSuffix} - ${description}`;
  });
}

function replaceListRegion(content, sectionStart, sectionEnd, newListLines) {
  const lines = content.split('\n');
  const headerIdx = lines.findIndex((l) => sectionStart.test(l));
  if (headerIdx === -1) return { content, replaced: false };
  const endIdx = lines.findIndex((l, i) => i > headerIdx && sectionEnd.test(l));
  const rangeEnd = endIdx === -1 ? lines.length : endIdx;

  let firstList = -1;
  let lastList = -1;
  for (let i = headerIdx + 1; i < rangeEnd; i++) {
    if (/^- \*\*/.test(lines[i])) {
      if (firstList === -1) firstList = i;
      lastList = i;
    }
  }

  if (firstList === -1) {
    // No existing list to replace. Insert after the first blank line that
    // follows the section header's code block, if one exists.
    let insertAt = headerIdx + 1;
    let inCode = false;
    for (let i = headerIdx + 1; i < rangeEnd; i++) {
      if (/^```/.test(lines[i])) {
        inCode = !inCode;
        continue;
      }
      if (!inCode && lines[i].trim() === '') {
        insertAt = i + 1;
      } else if (!inCode) {
        break;
      }
    }
    const newLines = [
      ...lines.slice(0, insertAt),
      ...newListLines,
      '',
      ...lines.slice(insertAt),
    ];
    return { content: newLines.join('\n'), replaced: true };
  }

  const newLines = [
    ...lines.slice(0, firstList),
    ...newListLines,
    ...lines.slice(lastList + 1),
  ];
  return { content: newLines.join('\n'), replaced: true };
}

// ---------- Numeric and structural updates ----------

function substitute(content, re, replacer) {
  return content.replace(re, replacer);
}

function updateReadmeCounts(content, jestTotal, jestFiles, e2eTotal, e2eFiles) {
  let out = content;

  // Testing Strategy paragraph.
  out = substitute(
    out,
    /(\d+) tests across (\d+) suites, all passing\./,
    () => `${jestTotal} tests across ${jestFiles} suites, all passing.`
  );
  out = substitute(
    out,
    /(\d+) tests across (\d+) spec files \(/,
    () => `${e2eTotal} tests across ${e2eFiles} spec files (`
  );

  // Test Coverage table rows.
  out = substitute(
    out,
    /\| Unit\/Component \| Jest \+ RTL \| \d+ \| \d+ \|/,
    () => `| Unit/Component | Jest + RTL | ${jestFiles} | ${jestTotal} |`
  );
  out = substitute(
    out,
    /\| E2E \| Playwright \| \d+ \|/,
    () => `| E2E | Playwright | ${e2eFiles} |`
  );

  // Section headers above the lists.
  out = substitute(
    out,
    /\*\*Jest \(Unit\/Component\):\*\* \d+ tests across \d+ suites/,
    () => `**Jest (Unit/Component):** ${jestTotal} tests across ${jestFiles} suites`
  );
  out = substitute(
    out,
    /\*\*Playwright \(E2E\):\*\* \d+ tests across \d+ spec files/,
    () => `**Playwright (E2E):** ${e2eTotal} tests across ${e2eFiles} spec files`
  );

  // Feature bullet list.
  out = substitute(
    out,
    /(\d+) E2E tests across (\d+) Playwright specs/,
    () => `${e2eTotal} E2E tests across ${e2eFiles} Playwright specs`
  );

  // CI/CD Integration "all NN Jest tests" line.
  out = substitute(
    out,
    /all \d+ Jest tests/,
    () => `all ${jestTotal} Jest tests`
  );

  // Legacy feature bullet that may have empty count slots
  // ("- unit and component tests across suites"). Match both blank and
  // filled-in forms so idempotent reruns are stable.
  out = substitute(
    out,
    /^-\s*\d*\s*unit and component tests across\s*\d*\s*suites/m,
    () => `- ${jestTotal} unit and component tests across ${jestFiles} suites`
  );

  return out;
}

function updateEntryPointCounts(content, jestTotal, jestFiles, e2eTotal, e2eFiles) {
  let out = content;

  // Tech stack table rows.
  out = substitute(
    out,
    /Jest \+ @testing-library\/react,\s*\d*\s*tests across\s*\d*\s*suites/,
    () => `Jest + @testing-library/react, ${jestTotal} tests across ${jestFiles} suites`
  );
  out = substitute(
    out,
    /@playwright\/test, \d+ tests across \d+ specs \(Chromium\)/,
    () => `@playwright/test, ${e2eTotal} tests across ${e2eFiles} specs (Chromium)`
  );

  // "Run all NN Jest tests" line.
  out = substitute(
    out,
    /# Run all \d+ Jest tests/,
    () => `# Run all ${jestTotal} Jest tests`
  );

  // "Run all NN E2E tests" line.
  out = substitute(
    out,
    /# Run all \d+ E2E tests/,
    () => `# Run all ${e2eTotal} E2E tests`
  );

  // Trailing "NN tests across NN suites" line at the very end of the tech
  // stack table row (the update-docs.yml sed pattern uses $ anchor, which we
  // also want to cover here for completeness).
  out = substitute(
    out,
    /^(\d+) tests across (\d+) suites$/m,
    () => `${jestTotal} tests across ${jestFiles} suites`
  );

  // E2E directory structure line.
  out = substitute(
    out,
    /`e2e\/` contains \d+ Playwright spec files/,
    () => `\`e2e/\` contains ${e2eFiles} Playwright spec files`
  );

  return out;
}

// ---------- Main ----------

function main() {
  const jestRecords = collectJestRecords();
  const e2eRecords = collectE2eRecords();

  if (jestRecords.length === 0 && e2eRecords.length === 0) {
    console.error('[docs-sync] No test files discovered. Are you in the repo root?');
    return 2;
  }

  const jestTotal = jestRecords.reduce((sum, r) => sum + r.count, 0);
  const e2eTotal = e2eRecords.reduce((sum, r) => sum + r.count, 0);

  console.log('[docs-sync] Inventory:');
  console.log(`  Jest files: ${jestRecords.length} (~${jestTotal} tests)`);
  console.log(`  Playwright spec files: ${e2eRecords.length} (~${e2eTotal} tests)`);

  // ----- README -----
  const originalReadme = fs.readFileSync(README, 'utf8');

  const { entries: jestEntries } = parseExistingList(
    originalReadme,
    JEST_SECTION_HEADER,
    PLAYWRIGHT_SECTION_HEADER
  );
  const { entries: e2eEntries } = parseExistingList(
    originalReadme,
    PLAYWRIGHT_SECTION_HEADER,
    CI_SECTION_HEADER
  );

  // Flag new or missing files so the developer sees what changed.
  const currentJestNames = new Set(jestRecords.map((r) => r.basename));
  const currentE2eNames = new Set(e2eRecords.map((r) => r.basename));

  const newJest = jestRecords
    .filter((r) => !jestEntries.has(r.basename))
    .map((r) => r.basename);
  const removedJest = [...jestEntries.keys()].filter(
    (name) => !currentJestNames.has(name)
  );
  const newE2e = e2eRecords
    .filter((r) => !e2eEntries.has(r.basename))
    .map((r) => r.basename);
  const removedE2e = [...e2eEntries.keys()].filter(
    (name) => !currentE2eNames.has(name)
  );

  if (newJest.length) console.log(`  New Jest files: ${newJest.join(', ')}`);
  if (removedJest.length) console.log(`  Removed Jest files: ${removedJest.join(', ')}`);
  if (newE2e.length) console.log(`  New Playwright files: ${newE2e.join(', ')}`);
  if (removedE2e.length) console.log(`  Removed Playwright files: ${removedE2e.join(', ')}`);

  let updatedReadme = originalReadme;

  const jestListLines = buildListLines(jestRecords, jestEntries, false);
  const e2eListLines = buildListLines(e2eRecords, e2eEntries, true);

  updatedReadme = replaceListRegion(
    updatedReadme,
    JEST_SECTION_HEADER,
    PLAYWRIGHT_SECTION_HEADER,
    jestListLines
  ).content;
  updatedReadme = replaceListRegion(
    updatedReadme,
    PLAYWRIGHT_SECTION_HEADER,
    CI_SECTION_HEADER,
    e2eListLines
  ).content;

  updatedReadme = updateReadmeCounts(
    updatedReadme,
    jestTotal,
    jestRecords.length,
    e2eTotal,
    e2eRecords.length
  );

  // ----- claude-code-entry-point.md -----
  let updatedEntry = '';
  let entryChanged = false;
  if (fs.existsSync(ENTRY_POINT)) {
    const originalEntry = fs.readFileSync(ENTRY_POINT, 'utf8');
    updatedEntry = updateEntryPointCounts(
      originalEntry,
      jestTotal,
      jestRecords.length,
      e2eTotal,
      e2eRecords.length
    );
    entryChanged = updatedEntry !== originalEntry;
  }

  // ----- Write -----
  const readmeChanged = updatedReadme !== originalReadme;

  if (readmeChanged) {
    fs.writeFileSync(README, updatedReadme);
    console.log('[docs-sync] Updated README.md');
  }
  if (entryChanged) {
    fs.writeFileSync(ENTRY_POINT, updatedEntry);
    console.log('[docs-sync] Updated claude-code-entry-point.md');
  }

  if (!readmeChanged && !entryChanged) {
    console.log('[docs-sync] Already in sync.');
    return 0;
  }

  console.log('[docs-sync] Done. Review the diff and commit.');
  return 1;
}

try {
  process.exit(main());
} catch (err) {
  console.error('[docs-sync] Internal error:', err.message);
  console.error(err.stack);
  process.exit(2);
}
