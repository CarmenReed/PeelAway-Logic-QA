#!/usr/bin/env node
/**
 * promote.js - Diff-first QA-to-PROD promotion
 *
 * Unlike the legacy bulk-copy approach (promote-qa-to-prod.ps1), this script:
 *   1. Computes what actually changed between QA and PROD
 *   2. Classifies each change by impact category
 *   3. Shows a human-readable manifest BEFORE copying anything
 *   4. Copies only changed/new files (deletes removed files)
 *   5. Applies env replacements only on touched files
 *   6. Reconciles PROD docs against what changed
 *   7. Validates PROD (tests + doc-lint)
 *
 * Usage:
 *   node scripts/promote.js                          # preview (no changes)
 *   node scripts/promote.js --apply                  # copy + validate
 *   node scripts/promote.js --apply --commit         # + commit in PROD
 *   node scripts/promote.js --apply --commit --push  # + push PROD to GitHub
 *   npm run promote:ship                             # shortcut for all of the above
 *
 * Run from EITHER repo. The script auto-detects which repo it's in
 * and resolves the other one.
 */

const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

// ── CLI args ─────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const APPLY    = args.includes('--apply');
const COMMIT   = args.includes('--commit');
const PUSH     = args.includes('--push');
const VERBOSE  = args.includes('--verbose');
const prodFlag = args.find(a => a.startsWith('--prod-path='));
const qaFlag   = args.find(a => a.startsWith('--qa-path='));

// ── Colors ───────────────────────────────────────────────────────────────
const RED    = '\x1b[31m';
const GREEN  = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN   = '\x1b[36m';
const DIM    = '\x1b[2m';
const BOLD   = '\x1b[1m';
const RESET  = '\x1b[0m';

function heading(msg) { console.log(`\n${BOLD}${CYAN}=== ${msg} ===${RESET}\n`); }
function info(msg)    { console.log(`  ${msg}`); }
function warn(msg)    { console.log(`  ${YELLOW}!${RESET} ${msg}`); }
function good(msg)    { console.log(`  ${GREEN}OK${RESET} ${msg}`); }
function err(msg)     { console.log(`  ${RED}ERROR${RESET} ${msg}`); }
function dim(msg)     { console.log(`  ${DIM}${msg}${RESET}`); }

// ── Path resolution ──────────────────────────────────────────────────────
// Auto-detect: if cwd has homepage containing "-QA", we're in QA
const SCRIPT_DIR = __dirname;
const REPO_ROOT  = path.resolve(SCRIPT_DIR, '..');

function detectRepos() {
  const pkgPath = path.join(REPO_ROOT, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    err('No package.json found. Run from a PeelAway repo root or scripts/ dir.');
    process.exit(1);
  }
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const isQA = (pkg.homepage || '').includes('-QA');

  let qaRoot, prodRoot;
  if (isQA) {
    qaRoot = REPO_ROOT;
    prodRoot = prodFlag
      ? prodFlag.split('=')[1]
      : path.resolve(REPO_ROOT, '..', 'PeelAway-Logic');
  } else {
    prodRoot = REPO_ROOT;
    qaRoot = qaFlag
      ? qaFlag.split('=')[1]
      : path.resolve(REPO_ROOT, '..', 'PeelAway-Logic-QA');
  }
  return { qaRoot: path.resolve(qaRoot), prodRoot: path.resolve(prodRoot) };
}

const { qaRoot, prodRoot } = detectRepos();

// ── Load config ──────────────────────────────────────────────────────────
const configPath = path.join(qaRoot, '.promotion.json');
if (!fs.existsSync(configPath)) {
  err(`.promotion.json not found in QA repo: ${qaRoot}`);
  process.exit(1);
}
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

heading('PeelAway Logic - Diff-First Promotion');
info(`QA repo:   ${qaRoot}`);
info(`PROD repo: ${prodRoot}`);
info(`Mode:      ${APPLY ? `${RED}APPLY${RESET} (will write files)` : `${YELLOW}PREVIEW${RESET} (read-only)`}`);

if (!fs.existsSync(prodRoot)) {
  err(`PROD repo not found: ${prodRoot}`);
  process.exit(1);
}

// ── Build exclusion rules from config ────────────────────────────────────
const neverDirs  = new Set(config.neverPromote.dirs || []);
const neverFiles = config.neverPromote.files || [];
const neverExts  = new Set(config.neverPromote.rootFileExtensions || []);
const excludePat = config.alwaysExcludeFromCopy?.filePatterns || [];
const alwaysPromotePaths = config.alwaysPromote?.paths || [];
const preserveProd = new Set(config.preserveProdVersions || []);
const envReplacements = config.envReplacements || {};
const envFileTypes = config.envReplacementFileTypes || ['*.md'];
const pkgPreserve = config.packageJson?.preserveFromProd || [];

/** Glob-style match (supports * and ? only, no ** needed at single-name level) */
function globMatch(name, pattern) {
  const re = new RegExp(
    '^' + pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&')
                 .replace(/\*/g, '.*')
                 .replace(/\?/g, '.') + '$',
    'i'
  );
  return re.test(name);
}

function isExcluded(relPath) {
  const parts = relPath.split('/');
  const fileName = parts[parts.length - 1];
  const ext = path.extname(fileName);

  // Check alwaysPromote override first
  if (alwaysPromotePaths.includes(relPath)) return false;

  // Never-promote directories: any segment in the path
  for (const part of parts.slice(0, -1)) {
    if (neverDirs.has(part)) return true;
  }

  // Never-promote file patterns
  for (const pat of neverFiles) {
    if (globMatch(fileName, pat)) return true;
  }

  // Root-level extension exclusions
  if (parts.length === 1 && neverExts.has(ext)) return true;

  // Always-exclude file patterns (*.pyc, *.bak, etc.)
  for (const pat of excludePat) {
    if (globMatch(fileName, pat)) return true;
  }

  // Skip .promotion.json itself (copied explicitly)
  if (relPath === '.promotion.json') return false;

  return false;
}

// ── Phase 1: Discover & Diff ─────────────────────────────────────────────
heading('Phase 1: Discover & Diff');

/** Recursively list all files in a directory, returning relative paths. */
function walkDir(root, rel = '') {
  const results = [];
  const fullDir = rel ? path.join(root, rel) : root;
  if (!fs.existsSync(fullDir)) return results;

  for (const entry of fs.readdirSync(fullDir, { withFileTypes: true })) {
    const relPath = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      // Skip excluded directories early for performance
      if (neverDirs.has(entry.name)) continue;
      results.push(...walkDir(root, relPath));
    } else if (entry.isFile()) {
      results.push(relPath);
    }
  }
  return results;
}

/** Hash file contents for comparison. */
function fileHash(filePath) {
  try {
    const content = fs.readFileSync(filePath);
    return crypto.createHash('md5').update(content).digest('hex');
  } catch {
    return null;
  }
}

info('Scanning QA repo...');
const qaFiles = walkDir(qaRoot).filter(f => !isExcluded(f));
info(`  ${qaFiles.length} promotable files`);

info('Scanning PROD repo...');
const prodFiles = walkDir(prodRoot).filter(f => !isExcluded(f));
info(`  ${prodFiles.length} existing PROD files`);

const qaSet = new Set(qaFiles);
const prodSet = new Set(prodFiles);

// Categorize changes
const added    = []; // in QA but not PROD
const removed  = []; // in PROD but not QA
const modified = []; // in both but different content
const unchanged = []; // in both and identical

for (const f of qaFiles) {
  if (preserveProd.has(f)) continue; // skip PROD-preserved files
  if (!prodSet.has(f)) {
    added.push(f);
  } else {
    const qaHash   = fileHash(path.join(qaRoot, f));
    const prodHash = fileHash(path.join(prodRoot, f));
    if (qaHash !== prodHash) {
      modified.push(f);
    } else {
      unchanged.push(f);
    }
  }
}

for (const f of prodFiles) {
  if (preserveProd.has(f)) continue;
  if (!qaSet.has(f) && !isExcluded(f)) {
    removed.push(f);
  }
}

const totalChanges = added.length + modified.length + removed.length;

info(`\n  ${GREEN}+${added.length}${RESET} added  ${YELLOW}~${modified.length}${RESET} modified  ${RED}-${removed.length}${RESET} removed  ${DIM}${unchanged.length} unchanged${RESET}`);

if (totalChanges === 0) {
  good('QA and PROD are already in sync. Nothing to promote.');
  process.exit(0);
}

// ── Phase 2: Impact Classification ───────────────────────────────────────
heading('Phase 2: Impact Classification');

const CATEGORIES = {
  'App Core':      /^src\/(App\.|index\.|JobSearchPipeline|constants|api|prompts)/,
  'Components':    /^src\/(components|phases)\//,
  'Services':      /^src\/services\//,
  'Styles':        /^src\/App\.css$/,
  'Public Assets': /^public\//,
  'E2E Tests':     /^e2e\//,
  'Unit Tests':    /^src\/__tests__\//,
  'Docs':          /\.(md|txt)$/,
  'CI/CD':         /^\.github\//,
  'Scripts':       /^scripts\//,
  'Config':        /^(package\.json|package-lock\.json|playwright\.config|\.promotion\.json|\.gitignore)$/,
  'Other':         /./,
};

function classify(filePath) {
  for (const [cat, re] of Object.entries(CATEGORIES)) {
    if (re.test(filePath)) return cat;
  }
  return 'Other';
}

// Build category breakdown
const changeset = [...added.map(f => ({ file: f, action: 'added' })),
                   ...modified.map(f => ({ file: f, action: 'modified' })),
                   ...removed.map(f => ({ file: f, action: 'removed' }))];

const byCategory = {};
for (const c of changeset) {
  const cat = classify(c.file);
  if (!byCategory[cat]) byCategory[cat] = [];
  byCategory[cat].push(c);
}

// Display categorized manifest
for (const [cat, items] of Object.entries(byCategory)) {
  const icon = items.some(i => i.action === 'removed') ? RED :
               items.some(i => i.action === 'added') ? GREEN : YELLOW;
  console.log(`\n  ${BOLD}${cat}${RESET} (${items.length} change${items.length === 1 ? '' : 's'})`);
  for (const item of items) {
    const actionIcon = item.action === 'added' ? `${GREEN}+` :
                       item.action === 'removed' ? `${RED}-` : `${YELLOW}~`;
    info(`  ${actionIcon}${RESET} ${item.file}`);
  }
}

// ── Phase 3: Env Replacement Impact Preview ──────────────────────────────
heading('Phase 3: Env Replacement Preview');

/** Check if a file matches the env replacement file type patterns. */
function matchesEnvFileType(filePath) {
  const ext = path.extname(filePath);
  for (const pattern of envFileTypes) {
    const patExt = pattern.startsWith('*') ? pattern.slice(1) : pattern;
    if (ext === patExt) return true;
  }
  return false;
}

/** Files that legitimately discuss QA/PROD; excluded from replacement AND audit. */
const envExclusions = new Set(config.envReplacementExclusions || []);
function isEnvExcluded(relPath) {
  return envExclusions.has(relPath) || envExclusions.has(path.basename(relPath));
}

// Preview which files will get env replacements applied
const filesToReplace = [...added, ...modified].filter(f => matchesEnvFileType(f) && !isEnvExcluded(f));
const envPreview = [];

for (const f of filesToReplace) {
  const content = fs.readFileSync(path.join(qaRoot, f), 'utf8');
  const matches = [];
  for (const [qaText, prodText] of Object.entries(envReplacements)) {
    const count = (content.match(new RegExp(escapeRegex(qaText), 'g')) || []).length;
    if (count > 0) {
      matches.push({ from: qaText, to: prodText, count });
    }
  }
  if (matches.length > 0) {
    envPreview.push({ file: f, matches });
  }
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

if (envPreview.length === 0) {
  good('No QA-specific references found in changed files.');
} else {
  info(`${envPreview.length} file(s) contain QA references that will be replaced:`);
  for (const ep of envPreview) {
    info(`  ${ep.file}`);
    for (const m of ep.matches) {
      dim(`    "${m.from}" => "${m.to}" (${m.count}x)`);
    }
  }
}

// ── Phase 4: package.json Smart Merge Preview ────────────────────────────
heading('Phase 4: package.json Merge Preview');

const qaPackage = JSON.parse(fs.readFileSync(path.join(qaRoot, 'package.json'), 'utf8'));
const prodPackage = JSON.parse(fs.readFileSync(path.join(prodRoot, 'package.json'), 'utf8'));

const pkgChanges = [];

// Check scripts
for (const [name, cmd] of Object.entries(qaPackage.scripts || {})) {
  if (!prodPackage.scripts?.[name]) {
    pkgChanges.push({ field: `scripts.${name}`, action: 'added', value: cmd });
  } else if (prodPackage.scripts[name] !== cmd) {
    pkgChanges.push({ field: `scripts.${name}`, action: 'changed', from: prodPackage.scripts[name], to: cmd });
  }
}
for (const name of Object.keys(prodPackage.scripts || {})) {
  if (!qaPackage.scripts?.[name]) {
    pkgChanges.push({ field: `scripts.${name}`, action: 'removed' });
  }
}

// Check dependencies
for (const depType of ['dependencies', 'devDependencies']) {
  for (const [name, ver] of Object.entries(qaPackage[depType] || {})) {
    if (!prodPackage[depType]?.[name]) {
      pkgChanges.push({ field: `${depType}.${name}`, action: 'added', value: ver });
    } else if (prodPackage[depType][name] !== ver) {
      pkgChanges.push({ field: `${depType}.${name}`, action: 'changed', from: prodPackage[depType][name], to: ver });
    }
  }
}

// Show preserved fields
for (const field of pkgPreserve) {
  if (prodPackage[field]) {
    info(`${BOLD}Preserved from PROD:${RESET} ${field} = "${prodPackage[field]}"`);
  }
}

if (pkgChanges.length === 0) {
  good('No package.json differences.');
} else {
  info(`${pkgChanges.length} package.json change(s):`);
  for (const c of pkgChanges) {
    const icon = c.action === 'added' ? `${GREEN}+` : c.action === 'removed' ? `${RED}-` : `${YELLOW}~`;
    if (c.action === 'changed') {
      info(`  ${icon}${RESET} ${c.field}: "${c.from}" => "${c.to}"`);
    } else {
      info(`  ${icon}${RESET} ${c.field}${c.value ? `: "${c.value}"` : ''}`);
    }
  }
}

// ── Phase 5: Doc Reconciliation ──────────────────────────────────────────
heading('Phase 5: Doc Reconciliation');

// Analyze what app changes mean for PROD docs
const docReconciliation = [];

// Map categories to README sections that might need updates
const DOC_IMPACT_MAP = {
  'App Core': [
    { section: 'What It Does', reason: 'Core pipeline logic changed' },
    { section: 'Features', reason: 'App behavior may have changed' },
  ],
  'Components': [
    { section: 'What It Does', reason: 'UI components changed' },
    { section: 'Features', reason: 'User-facing features may have changed' },
    { section: 'Usage Notes', reason: 'User workflow may have changed' },
  ],
  'Services': [
    { section: 'Azure Integration', reason: 'Service layer changed' },
    { section: 'Dropbox Integration', reason: 'Service layer changed' },
    { section: 'Tech Stack', reason: 'Service dependencies may have changed' },
  ],
  'Styles': [
    { section: 'Features', reason: 'Visual changes may affect feature descriptions' },
  ],
  'E2E Tests': [
    { section: 'Testing & Quality', reason: 'E2E test inventory changed' },
    { section: 'Test Coverage', reason: 'Test counts may be stale' },
    { section: 'Playwright (E2E)', reason: 'E2E spec list may need updating' },
  ],
  'Unit Tests': [
    { section: 'Testing & Quality', reason: 'Unit test inventory changed' },
    { section: 'Test Coverage', reason: 'Test counts may be stale' },
    { section: 'Jest (Unit/Component)', reason: 'Test file list may need updating' },
  ],
  'CI/CD': [
    { section: 'CI/CD Integration', reason: 'Workflow files changed' },
  ],
  'Config': [
    { section: 'Tech Stack', reason: 'Dependencies or config changed' },
    { section: 'Setup', reason: 'Setup instructions may need updating' },
  ],
};

// Check what sections are impacted
const impactedSections = new Set();
for (const [cat] of Object.entries(byCategory)) {
  const impacts = DOC_IMPACT_MAP[cat] || [];
  for (const imp of impacts) {
    impactedSections.add(JSON.stringify(imp));
  }
}

// Read PROD README and find which sections exist
const prodReadmePath = path.join(prodRoot, 'README.md');
const prodReadme = fs.existsSync(prodReadmePath)
  ? fs.readFileSync(prodReadmePath, 'utf8')
  : '';

const readmeSections = [];
const sectionRegex = /^##\s+(.+)/gm;
let match;
while ((match = sectionRegex.exec(prodReadme)) !== null) {
  readmeSections.push(match[1].trim());
}

// Cross-reference impacted sections with actual README sections
const uniqueImpacts = [...impactedSections].map(s => JSON.parse(s));
const confirmedImpacts = [];
const possibleImpacts = [];

for (const imp of uniqueImpacts) {
  const found = readmeSections.some(s =>
    s.toLowerCase().includes(imp.section.toLowerCase()) ||
    imp.section.toLowerCase().includes(s.toLowerCase())
  );
  if (found) {
    confirmedImpacts.push(imp);
  } else {
    possibleImpacts.push(imp);
  }
}

// Specific checks: test counts in README vs actual files
const testFileChanges = changeset.filter(c => classify(c.file) === 'Unit Tests' || classify(c.file) === 'E2E Tests');
if (testFileChanges.length > 0) {
  // Count actual test files in QA
  const qaTestFiles = qaFiles.filter(f => /^src\/__tests__\/.*\.test\.(js|jsx|ts|tsx)$/.test(f));
  const qaE2eFiles = qaFiles.filter(f => /^e2e\/.*\.(spec|test)\.(js|ts)$/.test(f));

  // Check if README mentions specific counts
  const readmeTestSuiteMatch = prodReadme.match(/(\d+)\s+suites/);
  const readmeE2eSpecMatch = prodReadme.match(/(\d+)\s+spec\s+files/);

  if (readmeTestSuiteMatch) {
    const readmeCount = parseInt(readmeTestSuiteMatch[1], 10);
    if (readmeCount !== qaTestFiles.length) {
      docReconciliation.push({
        severity: 'STALE',
        section: 'Testing & Quality',
        detail: `README says ${readmeCount} test suites, but QA has ${qaTestFiles.length} test files`,
        action: `Update test suite count to ${qaTestFiles.length}`,
      });
    }
  }

  if (readmeE2eSpecMatch) {
    const readmeCount = parseInt(readmeE2eSpecMatch[1], 10);
    if (readmeCount !== qaE2eFiles.length) {
      docReconciliation.push({
        severity: 'STALE',
        section: 'Testing & Quality',
        detail: `README says ${readmeCount} E2E spec files, but QA has ${qaE2eFiles.length} spec files`,
        action: `Update E2E spec count to ${qaE2eFiles.length}`,
      });
    }
  }
}

// Check for new files that might represent new features not in README
const newSrcFiles = added.filter(f => f.startsWith('src/') && !f.startsWith('src/__tests__/'));
if (newSrcFiles.length > 0) {
  docReconciliation.push({
    severity: 'REVIEW',
    section: 'Features / What It Does',
    detail: `${newSrcFiles.length} new source file(s) added: ${newSrcFiles.slice(0, 5).join(', ')}${newSrcFiles.length > 5 ? '...' : ''}`,
    action: 'Check if new features need README documentation',
  });
}

// Check for removed src files that might mean features were dropped
const removedSrcFiles = removed.filter(f => f.startsWith('src/') && !f.startsWith('src/__tests__/'));
if (removedSrcFiles.length > 0) {
  docReconciliation.push({
    severity: 'REVIEW',
    section: 'Features / What It Does',
    detail: `${removedSrcFiles.length} source file(s) removed: ${removedSrcFiles.slice(0, 5).join(', ')}${removedSrcFiles.length > 5 ? '...' : ''}`,
    action: 'Check if removed features need to be pulled from README',
  });
}

// Check for changes to key pipeline files
const pipelineChanges = modified.filter(f =>
  /JobSearchPipeline|constants|prompts|api\.js/.test(f)
);
if (pipelineChanges.length > 0) {
  docReconciliation.push({
    severity: 'REVIEW',
    section: 'What It Does / Features',
    detail: `Core pipeline files changed: ${pipelineChanges.join(', ')}`,
    action: 'Verify README feature descriptions still match app behavior',
  });
}

// Display results
if (confirmedImpacts.length > 0) {
  info(`${BOLD}README sections likely affected by these changes:${RESET}`);
  for (const imp of confirmedImpacts) {
    info(`  ${YELLOW}>>>${RESET} ${BOLD}${imp.section}${RESET}: ${imp.reason}`);
  }
}

if (docReconciliation.length > 0) {
  console.log('');
  info(`${BOLD}Specific doc reconciliation items:${RESET}`);
  for (const rec of docReconciliation) {
    const icon = rec.severity === 'STALE' ? `${RED}STALE${RESET}` : `${YELLOW}REVIEW${RESET}`;
    info(`  [${icon}] ${BOLD}${rec.section}${RESET}`);
    info(`    ${rec.detail}`);
    info(`    ${CYAN}Action:${RESET} ${rec.action}`);
  }
}

if (confirmedImpacts.length === 0 && docReconciliation.length === 0) {
  good('No doc reconciliation items detected.');
}

// ── Phase 6: Env Audit (post-replacement check) ─────────────────────────
heading('Phase 6: Env Audit Preview');

const envAuditPatterns = (config.envAuditPatterns || []).map(p => ({
  regex: new RegExp(p.pattern, p.flags || 'i'),
  label: p.label,
}));
// Check that env replacements would clean all audit patterns in changed files
const auditWarnings = [];
for (const f of [...added, ...modified]) {
  if (!matchesEnvFileType(f)) continue;
  if (isEnvExcluded(f)) continue;
  let content = fs.readFileSync(path.join(qaRoot, f), 'utf8');

  // Simulate env replacements
  for (const [qaText, prodText] of Object.entries(envReplacements)) {
    content = content.replace(new RegExp(escapeRegex(qaText), 'g'), prodText);
  }

  // Check for remaining QA references
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    for (const pat of envAuditPatterns) {
      if (pat.regex.test(lines[i])) {
        auditWarnings.push({
          file: f,
          line: i + 1,
          label: pat.label,
          text: lines[i].trim().substring(0, 80),
        });
      }
    }
  }
}

if (auditWarnings.length === 0) {
  good('Env replacements will clean all QA references in changed files.');
} else {
  warn(`${auditWarnings.length} QA reference(s) would survive env replacement:`);
  for (const w of auditWarnings) {
    info(`  ${RED}[${w.label}]${RESET} ${w.file}:${w.line}`);
    dim(`    ${w.text}`);
  }
  info(`\n  These need manual fixes or new envReplacement rules in .promotion.json`);
}

// ── Summary ──────────────────────────────────────────────────────────────
heading('Promotion Summary');

const summaryLines = [
  ['Files to copy (added)', added.length, GREEN],
  ['Files to update (modified)', modified.length, YELLOW],
  ['Files to remove from PROD', removed.length, RED],
  ['Env replacements', envPreview.length, envPreview.length > 0 ? YELLOW : GREEN],
  ['package.json changes', pkgChanges.length, pkgChanges.length > 0 ? YELLOW : GREEN],
  ['Doc reconciliation items', docReconciliation.length, docReconciliation.length > 0 ? YELLOW : GREEN],
  ['Env audit warnings', auditWarnings.length, auditWarnings.length > 0 ? RED : GREEN],
  ['PROD-preserved files', preserveProd.size, CYAN],
];

console.log(`${BOLD}${CYAN}+----------------------------------------------------+${RESET}`);
console.log(`${BOLD}${CYAN}|  PROMOTION MANIFEST                                |${RESET}`);
console.log(`${BOLD}${CYAN}+----------------------------------------------------+${RESET}`);
for (const [label, count, color] of summaryLines) {
  const countStr = `${color}${count}${RESET}`;
  console.log(`${BOLD}${CYAN}|${RESET}  ${label.padEnd(38)} ${countStr}`);
}
console.log(`${BOLD}${CYAN}+----------------------------------------------------+${RESET}`);

if (!APPLY) {
  console.log(`\n  ${YELLOW}PREVIEW MODE${RESET}: No files were modified.`);
  console.log(`  Run with ${BOLD}--apply${RESET} to execute the promotion.\n`);

  // Write manifest to a file for reference
  const manifestPath = path.join(qaRoot, 'docs', 'promotion-manifest.md');
  const manifestContent = generateManifestMarkdown({
    added, modified, removed, byCategory, envPreview,
    pkgChanges, confirmedImpacts, docReconciliation, auditWarnings,
  });

  // Ensure docs dir exists
  const docsDir = path.join(qaRoot, 'docs');
  if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });
  fs.writeFileSync(manifestPath, manifestContent, 'utf8');
  info(`Manifest written to: ${path.relative(qaRoot, manifestPath)}`);

  process.exit(0);
}

// ── APPLY MODE: Execute the promotion ────────────────────────────────────
heading('Applying Promotion');

// Step A: Run pre-promotion checks in QA
info('Running pre-promotion checks in QA...');
const preChecks = config.prePromotionChecks || [];
for (const check of preChecks) {
  info(`  Running: ${check}`);
  try {
    execSync(check, { cwd: qaRoot, stdio: 'inherit', env: { ...process.env, CI: 'true' } });
    good(`  ${check}`);
  } catch {
    err(`Pre-promotion check failed: ${check}`);
    process.exit(1);
  }
}

// Step B: Back up PROD-preserved files
info('\nBacking up PROD-preserved files...');
const backups = {};
for (const relFile of preserveProd) {
  const prodFile = path.join(prodRoot, relFile);
  if (fs.existsSync(prodFile)) {
    backups[relFile] = fs.readFileSync(prodFile);
    dim(`  Backed up: ${relFile}`);
  }
}

// Step C: Copy added and modified files (selective, not bulk)
info(`\nCopying ${added.length + modified.length} file(s)...`);
let copyCount = 0;
for (const f of [...added, ...modified]) {
  const src  = path.join(qaRoot, f);
  const dest = path.join(prodRoot, f);

  // Ensure destination directory exists
  const destDir = path.dirname(dest);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  fs.copyFileSync(src, dest);
  copyCount++;
  if (VERBOSE) dim(`  Copied: ${f}`);
}
good(`${copyCount} file(s) copied.`);

// Step D: Remove files that no longer exist in QA
if (removed.length > 0) {
  info(`\nRemoving ${removed.length} file(s) no longer in QA...`);
  for (const f of removed) {
    const dest = path.join(prodRoot, f);
    if (fs.existsSync(dest)) {
      fs.unlinkSync(dest);
      if (VERBOSE) dim(`  Removed: ${f}`);
    }
  }
  good(`${removed.length} file(s) removed.`);
}

// Step E: Apply env replacements (only on changed files, respecting exclusions)
info('\nApplying env replacements on copied files...');
let replaceCount = 0;
for (const f of [...added, ...modified]) {
  if (!matchesEnvFileType(f)) continue;
  if (isEnvExcluded(f)) continue;
  const filePath = path.join(prodRoot, f);
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;

  for (const [qaText, prodText] of Object.entries(envReplacements)) {
    content = content.replace(new RegExp(escapeRegex(qaText), 'g'), prodText);
  }

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    replaceCount++;
    if (VERBOSE) dim(`  Cleaned: ${f}`);
  }
}
good(`${replaceCount} file(s) cleaned of QA references.`);

// Step F: Smart-merge package.json
info('\nMerging package.json...');
const mergedPkg = JSON.parse(fs.readFileSync(path.join(qaRoot, 'package.json'), 'utf8'));

// Apply env replacements to package.json string values
let mergedStr = JSON.stringify(mergedPkg, null, 2);
for (const [qaText, prodText] of Object.entries(envReplacements)) {
  mergedStr = mergedStr.replace(new RegExp(escapeRegex(qaText), 'g'), prodText);
}
const mergedPkgClean = JSON.parse(mergedStr);

// Preserve PROD fields
for (const field of pkgPreserve) {
  if (prodPackage[field] !== undefined) {
    mergedPkgClean[field] = prodPackage[field];
    dim(`  Preserved: ${field} = "${prodPackage[field]}"`);
  }
}

fs.writeFileSync(
  path.join(prodRoot, 'package.json'),
  JSON.stringify(mergedPkgClean, null, 2) + '\n',
  'utf8'
);
good('package.json merged.');

// Step G: Restore PROD-preserved files
info('\nRestoring PROD-preserved files...');
for (const [relFile, content] of Object.entries(backups)) {
  fs.writeFileSync(path.join(prodRoot, relFile), content);
  dim(`  Restored: ${relFile}`);
}

// Step H: Copy .promotion.json
fs.copyFileSync(configPath, path.join(prodRoot, '.promotion.json'));
dim('  Copied: .promotion.json');

// Step I: Run docs-sync in PROD to update test counts
info('\nRunning docs-sync in PROD...');
const docsSyncPath = path.join(prodRoot, 'scripts', 'docs-sync.js');
if (fs.existsSync(docsSyncPath)) {
  try {
    execSync('node scripts/docs-sync.js', { cwd: prodRoot, stdio: 'inherit' });
    good('Docs synced in PROD.');
  } catch {
    warn('docs-sync had changes or warnings. Review PROD README.');
  }
} else {
  dim('  No docs-sync.js in PROD, skipping.');
}

// Step J: Install dependencies
info('\nInstalling PROD dependencies...');
try {
  execSync('npm install', { cwd: prodRoot, stdio: 'inherit' });
  good('Dependencies installed.');
} catch {
  err('npm install failed in PROD. Check package.json.');
  process.exit(1);
}

// Step K: Run PROD validation
info('\nRunning PROD tests...');
try {
  execSync('npm test', { cwd: prodRoot, stdio: 'inherit', env: { ...process.env, CI: 'true' } });
  good('PROD tests passed.');
} catch {
  err('PROD tests failed. Review changes before committing.');
  process.exit(1);
}

info('\nRunning PROD doc-lint...');
try {
  execSync('node scripts/doc-lint.js', { cwd: prodRoot, stdio: 'inherit' });
  good('PROD doc-lint clean.');
} catch {
  err('PROD doc-lint failed. Fix violations before committing.');
  process.exit(1);
}

// Step L: Stage and report
heading('Promotion Complete');

info('Staging changes in PROD...');
execSync('git add -A', { cwd: prodRoot, stdio: 'inherit' });

// Show doc reconciliation reminders
if (docReconciliation.length > 0) {
  console.log(`\n  ${YELLOW}${BOLD}Doc reconciliation reminders:${RESET}`);
  for (const rec of docReconciliation) {
    console.log(`    ${rec.severity === 'STALE' ? RED : YELLOW}[${rec.severity}]${RESET} ${rec.section}: ${rec.action}`);
  }
  console.log('');
}

// Step M: Commit in PROD (if requested)
if (COMMIT) {
  info('Committing in PROD...');
  const now = new Date().toISOString().split('T')[0];
  const commitMsg = `chore: promote QA to PROD (${now})\n\n` +
    `+${added.length} added, ~${modified.length} modified, -${removed.length} removed\n` +
    `Categories: ${Object.keys(byCategory).join(', ')}`;
  try {
    execSync(`git commit -m "${commitMsg.replace(/"/g, '\\"')}"`, { cwd: prodRoot, stdio: 'inherit' });
    good('PROD commit created.');
  } catch {
    err('Git commit failed in PROD. Review manually.');
    process.exit(1);
  }
} else {
  console.log(`\n  ${GREEN}${BOLD}Promotion applied and staged.${RESET}`);
  console.log(`  To finish manually:\n`);
  console.log(`    cd ${prodRoot}`);
  console.log(`    git diff --cached --stat`);
  console.log(`    git commit -m "chore: promote QA to PROD"`);
  console.log(`    git push origin main\n`);
}

// Step N: Push PROD to GitHub (if requested)
if (COMMIT && PUSH) {
  info('Pushing PROD to GitHub...');
  try {
    execSync('git push origin main', { cwd: prodRoot, stdio: 'inherit' });
    good('PROD pushed to GitHub.');
  } catch {
    err('Git push failed. Push manually from PROD.');
    process.exit(1);
  }
  console.log(`\n  ${GREEN}${BOLD}Promotion complete. PROD is live.${RESET}\n`);
} else if (COMMIT) {
  console.log(`\n  ${GREEN}${BOLD}Committed but not pushed.${RESET}`);
  console.log(`  To push: cd ${prodRoot} && git push origin main\n`);
}

// ── Manifest generator ───────────────────────────────────────────────────
function generateManifestMarkdown({ added, modified, removed, byCategory, envPreview, pkgChanges, confirmedImpacts, docReconciliation, auditWarnings }) {
  const now = new Date().toISOString().split('T')[0];
  let md = `# Promotion Manifest - ${now}\n\n`;
  md += `Generated by \`promote.js\` in preview mode.\n\n`;

  md += `## Change Summary\n\n`;
  md += `| Action | Count |\n|--------|-------|\n`;
  md += `| Added | ${added.length} |\n`;
  md += `| Modified | ${modified.length} |\n`;
  md += `| Removed | ${removed.length} |\n`;
  md += `| **Total** | **${added.length + modified.length + removed.length}** |\n\n`;

  md += `## Changes by Category\n\n`;
  for (const [cat, items] of Object.entries(byCategory)) {
    md += `### ${cat} (${items.length})\n\n`;
    for (const item of items) {
      const icon = item.action === 'added' ? '+' : item.action === 'removed' ? '-' : '~';
      md += `- \`${icon}\` ${item.file}\n`;
    }
    md += '\n';
  }

  if (envPreview.length > 0) {
    md += `## Env Replacements\n\n`;
    for (const ep of envPreview) {
      md += `- **${ep.file}**: ${ep.matches.map(m => `"${m.from}" (${m.count}x)`).join(', ')}\n`;
    }
    md += '\n';
  }

  if (pkgChanges.length > 0) {
    md += `## package.json Changes\n\n`;
    for (const c of pkgChanges) {
      md += `- \`${c.action}\` ${c.field}${c.value ? `: \`${c.value}\`` : ''}\n`;
    }
    md += '\n';
  }

  if (confirmedImpacts.length > 0 || docReconciliation.length > 0) {
    md += `## Doc Reconciliation\n\n`;
    if (confirmedImpacts.length > 0) {
      md += `### README Sections Affected\n\n`;
      for (const imp of confirmedImpacts) {
        md += `- **${imp.section}**: ${imp.reason}\n`;
      }
      md += '\n';
    }
    if (docReconciliation.length > 0) {
      md += `### Action Items\n\n`;
      for (const rec of docReconciliation) {
        md += `- [${rec.severity}] **${rec.section}**: ${rec.detail}. ${rec.action}\n`;
      }
      md += '\n';
    }
  }

  if (auditWarnings.length > 0) {
    md += `## Env Audit Warnings\n\n`;
    md += `These QA references would survive env replacement and need manual fixes:\n\n`;
    for (const w of auditWarnings) {
      md += `- **${w.file}:${w.line}** [${w.label}]: ${w.text}\n`;
    }
    md += '\n';
  }

  return md;
}
