#!/usr/bin/env node

/**
 * HCI Governance Audit
 *
 * Scans pending changes (origin/main to working tree) and decides whether
 * enough user-facing surface has changed to warrant a UAT re-test cycle.
 *
 * Verdicts:
 *   GREEN  - safe to commit, no flag
 *   YELLOW - minor HCI impact, flag written for spot check
 *   RED    - significant HCI impact, flag written and warning printed
 *
 * Exits 0 always (warn, do not block). Non-zero exit only on internal error.
 *
 * See docs/hci-audit/README.md for the governance process.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REPO_ROOT = process.cwd();
const FLAGS_DIR = path.join(REPO_ROOT, 'docs', 'hci-audit', 'flags');
const USER_STORIES_DIR = path.join(REPO_ROOT, 'docs', 'user-stories');

// ---------- Tier classification ----------

const TIER = {
  JOURNEY: 'TIER_1_JOURNEY',
  INTERACTION: 'TIER_2_INTERACTION',
  VISUAL: 'TIER_3_VISUAL',
  COPY: 'TIER_4_COPY',
  NON_HCI: 'NON_HCI',
};

const TIER_RULES = [
  {
    tier: TIER.JOURNEY,
    patterns: [
      /^src\/phases\//,
      /^src\/JobSearchPipelineV4\.jsx$/,
      /^src\/JobSearchPipeline\.jsx$/,
      /^src\/App\.jsx$/,
      /^src\/components\/ProgressStepper\.jsx$/,
      /^src\/components\/LandingScreen\.jsx$/,
      /^src\/components\/Header\.jsx$/,
    ],
  },
  {
    tier: TIER.COPY,
    patterns: [/^docs\/user-stories\//],
  },
  {
    tier: TIER.INTERACTION,
    patterns: [
      /^src\/components\/.*\.jsx$/,
      /^src\/prompts\.js$/,
      /^public\/index\.html$/,
    ],
  },
  {
    tier: TIER.VISUAL,
    patterns: [
      /^src\/.*\.css$/,
      /^public\/.*\.(png|jpe?g|svg|gif|ico|webp)$/i,
    ],
  },
];

function classify(file) {
  for (const { tier, patterns } of TIER_RULES) {
    if (patterns.some((p) => p.test(file))) return tier;
  }
  return TIER.NON_HCI;
}

// ---------- Git diff collection ----------

function sh(cmd) {
  return execSync(cmd, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function getBaseRef() {
  // Prefer origin/main; fall back to HEAD so the script still works offline.
  try {
    sh('git rev-parse --verify origin/main');
    return 'origin/main';
  } catch (e) {
    return 'HEAD';
  }
}

function collectDiff(baseRef) {
  // Two-dot diff: compares base ref to working tree, covering committed,
  // staged, and unstaged changes in a single pass.
  let raw = '';
  try {
    raw = sh(`git diff --unified=0 ${baseRef}`);
  } catch (e) {
    raw = '';
  }
  return parseDiff(raw);
}

function parseDiff(raw) {
  const files = {};
  let current = null;
  const lines = raw.split('\n');

  for (const line of lines) {
    if (line.startsWith('diff --git ')) {
      const match = line.match(/^diff --git a\/(.+?) b\/(.+)$/);
      const p = match ? match[2] : null;
      if (p) {
        current = { path: p, added: [], removed: [], addedCount: 0, removedCount: 0 };
        files[p] = current;
      } else {
        current = null;
      }
      continue;
    }
    if (!current) continue;

    // Skip diff metadata lines.
    if (
      line.startsWith('+++') ||
      line.startsWith('---') ||
      line.startsWith('@@') ||
      line.startsWith('index ') ||
      line.startsWith('new file') ||
      line.startsWith('deleted file') ||
      line.startsWith('rename ') ||
      line.startsWith('similarity ') ||
      line.startsWith('Binary files')
    ) {
      continue;
    }

    if (line.startsWith('+')) {
      current.added.push(line.slice(1));
      current.addedCount++;
    } else if (line.startsWith('-')) {
      current.removed.push(line.slice(1));
      current.removedCount++;
    }
  }
  return files;
}

// ---------- Signal detection ----------

const ROUTING_SIGNALS = /\b(setPhase|setCurrentPhase|currentPhase|useNavigate|handlePhaseChange|advancePhase)\b/;
const JSX_INTERACTIVE = /<(button|input|form|select|textarea|dialog|nav|img|Button|Input|Form|LandingScreen|Header|ProgressStepper|JobCard|GuideBar|CloudConnector|ManualJobInput|AppliedTracker)\b/;
const COPY_LITERAL = /["'`][A-Z][A-Za-z0-9 ,.'!?\-]{20,}["'`]/;
const CSS_RULE_CHANGE = /([.#]?[A-Za-z][\w-]*\s*\{|\b(color|background|padding|margin|font|display|grid|flex|width|height|border|z-index|position|top|left|right|bottom|transition|animation)\s*:)/;

const A11Y_MARKERS = [
  { key: 'aria-*', re: /aria-[a-z]+=/ },
  { key: 'role=', re: /\brole\s*=/ },
  { key: 'tabIndex', re: /\btabIndex\b/ },
  { key: 'alt=', re: /\balt\s*=/ },
  { key: 'onKeyDown', re: /\bonKeyDown\b/ },
  { key: 'onFocus', re: /\bonFocus\b/ },
  { key: '<label>', re: /<label\b/ },
];

function detectSignals(filePath, file) {
  const ext = path.extname(filePath).toLowerCase();
  const isJs = ext === '.jsx' || ext === '.js' || ext === '.tsx' || ext === '.ts';
  const isCss = ext === '.css';

  const hits = {
    routing: 0,
    newInteractive: 0,
    copyChanges: 0,
    cssChanges: 0,
    a11yRegressions: [],
  };

  for (const line of file.added) {
    if (isJs) {
      if (ROUTING_SIGNALS.test(line)) hits.routing++;
      if (JSX_INTERACTIVE.test(line)) hits.newInteractive++;
      if (COPY_LITERAL.test(line)) hits.copyChanges++;
    }
    if (isCss && CSS_RULE_CHANGE.test(line)) hits.cssChanges++;
  }

  for (const line of file.removed) {
    if (isJs) {
      if (ROUTING_SIGNALS.test(line)) hits.routing++;
      if (COPY_LITERAL.test(line)) hits.copyChanges++;
      for (const marker of A11Y_MARKERS) {
        if (marker.re.test(line)) {
          const retained = file.added.some((a) => marker.re.test(a));
          if (!retained) {
            hits.a11yRegressions.push({
              key: marker.key,
              line: line.trim().slice(0, 120),
            });
          }
        }
      }
    }
  }
  return hits;
}

// ---------- Scoring ----------

function score(classified) {
  const tierCounts = {
    [TIER.JOURNEY]: 0,
    [TIER.INTERACTION]: 0,
    [TIER.VISUAL]: 0,
    [TIER.COPY]: 0,
    [TIER.NON_HCI]: 0,
  };

  let anyA11yRegression = false;
  let routingHits = 0;

  for (const entry of classified) {
    tierCounts[entry.tier]++;
    if (entry.signals.a11yRegressions.length > 0) anyA11yRegression = true;
    routingHits += entry.signals.routing;
  }

  let verdict = 'GREEN';
  const reasons = [];

  // Conservative / high sensitivity thresholds.
  if (tierCounts[TIER.JOURNEY] > 0) {
    verdict = 'RED';
    reasons.push(`${tierCounts[TIER.JOURNEY]} Tier 1 (user journey) file(s) touched`);
  }
  if (tierCounts[TIER.COPY] > 0) {
    verdict = 'RED';
    reasons.push(`${tierCounts[TIER.COPY]} user story file(s) touched (acceptance criteria may have drifted)`);
  }
  if (routingHits > 0) {
    verdict = 'RED';
    reasons.push(`${routingHits} routing/orchestration signal hit(s) detected`);
  }

  const mediumTouched = tierCounts[TIER.INTERACTION] + tierCounts[TIER.VISUAL];
  if (mediumTouched >= 2 && verdict === 'GREEN') {
    verdict = 'YELLOW';
    reasons.push(`${mediumTouched} Tier 2/3 (interaction/visual) file(s) touched`);
  } else if (mediumTouched === 1 && verdict === 'GREEN') {
    verdict = 'YELLOW';
    reasons.push('1 Tier 2/3 (interaction/visual) file touched');
  } else if (mediumTouched > 0 && verdict !== 'GREEN') {
    reasons.push(`${mediumTouched} Tier 2/3 (interaction/visual) file(s) also touched`);
  }

  if (anyA11yRegression) {
    if (verdict === 'GREEN') verdict = 'YELLOW';
    else if (verdict === 'YELLOW') verdict = 'RED';
    reasons.push('Accessibility regression detected (ARIA/alt/keyboard handler removed)');
  }

  return { verdict, reasons, tierCounts };
}

// ---------- User story cross-reference ----------

function loadUserStories() {
  if (!fs.existsSync(USER_STORIES_DIR)) return [];
  return fs
    .readdirSync(USER_STORIES_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const full = path.join(USER_STORIES_DIR, f);
      return { file: `docs/user-stories/${f}`, content: fs.readFileSync(full, 'utf8') };
    });
}

function findAffectedStories(changedFiles, stories) {
  const affected = new Set();
  for (const changed of changedFiles) {
    // A touched user story is itself affected.
    if (changed.startsWith('docs/user-stories/')) {
      affected.add(changed);
      continue;
    }
    const basename = path.basename(changed);
    const stem = basename.replace(/\.[^.]+$/, '');
    for (const story of stories) {
      if (
        story.content.includes(basename) ||
        story.content.includes(stem) ||
        story.content.includes(changed)
      ) {
        affected.add(story.file);
      }
    }
  }
  return [...affected].sort();
}

// ---------- Flag artifact ----------

function nowStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `-${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

function currentBranch() {
  try {
    return sh('git rev-parse --abbrev-ref HEAD').trim();
  } catch (e) {
    return 'detached';
  }
}

function writeFlag(verdict, scoreResult, classified, affectedStories) {
  if (!fs.existsSync(FLAGS_DIR)) {
    fs.mkdirSync(FLAGS_DIR, { recursive: true });
  }
  const branch = currentBranch().replace(/[^A-Za-z0-9._-]/g, '_');
  const stamp = nowStamp();
  const flagPath = path.join(FLAGS_DIR, `${stamp}-${branch}.md`);

  const out = [];
  out.push(`# HCI Audit Flag: ${verdict}`);
  out.push('');
  out.push(`- Timestamp (UTC): ${stamp}`);
  out.push(`- Branch: ${branch}`);
  out.push(`- Verdict: ${verdict}`);
  out.push('');
  out.push('## Reasons');
  out.push('');
  if (scoreResult.reasons.length === 0) {
    out.push('- (none)');
  } else {
    for (const r of scoreResult.reasons) out.push(`- ${r}`);
  }
  out.push('');
  out.push('## File Tier Summary');
  out.push('');
  out.push('| Tier | Count |');
  out.push('| :--- | ---: |');
  out.push(`| Tier 1 (journey) | ${scoreResult.tierCounts[TIER.JOURNEY]} |`);
  out.push(`| Tier 2 (interaction) | ${scoreResult.tierCounts[TIER.INTERACTION]} |`);
  out.push(`| Tier 3 (visual) | ${scoreResult.tierCounts[TIER.VISUAL]} |`);
  out.push(`| Tier 4 (copy/user stories) | ${scoreResult.tierCounts[TIER.COPY]} |`);
  out.push(`| Non HCI | ${scoreResult.tierCounts[TIER.NON_HCI]} |`);
  out.push('');
  out.push('## Changed Files');
  out.push('');
  for (const entry of classified) {
    if (entry.tier === TIER.NON_HCI) continue;
    out.push(`### \`${entry.path}\` (${entry.tier})`);
    out.push('');
    out.push(`- Added lines: ${entry.addedCount}`);
    out.push(`- Removed lines: ${entry.removedCount}`);
    const s = entry.signals;
    if (s.routing) out.push(`- Routing/orchestration signals: ${s.routing}`);
    if (s.newInteractive) out.push(`- Interactive element touches: ${s.newInteractive}`);
    if (s.copyChanges) out.push(`- Copy literal changes: ${s.copyChanges}`);
    if (s.cssChanges) out.push(`- CSS rule/property changes: ${s.cssChanges}`);
    if (s.a11yRegressions.length) {
      out.push('- Accessibility regressions:');
      for (const r of s.a11yRegressions) {
        out.push(`  - \`${r.key}\`: ${r.line.replace(/`/g, "'")}`);
      }
    }
    out.push('');
  }
  out.push('## Affected User Stories');
  out.push('');
  if (affectedStories.length === 0) {
    out.push('- (none detected by filename cross reference)');
  } else {
    for (const s of affectedStories) out.push(`- ${s}`);
  }
  out.push('');
  out.push('## Suggested UAT Scenarios to Re Run');
  out.push('');
  if (affectedStories.length === 0) {
    out.push('- Re run the full smoke journey: Landing to Scout to Review to Human Gate to Complete.');
  } else {
    for (const s of affectedStories) {
      out.push(`- Walk through acceptance criteria in \`${s}\``);
    }
    out.push('- Re run the full smoke journey to catch downstream regressions.');
  }
  out.push('');
  out.push('## Sign off');
  out.push('');
  out.push('- [ ] UAT scenarios above were manually exercised');
  out.push('- [ ] Any regressions were filed and addressed');
  out.push('- [ ] Cleared by: __________ on __________');
  out.push('');
  out.push('> This flag was generated by `scripts/hci-audit.js`. See `docs/hci-audit/README.md` for the governance process.');
  out.push('');

  fs.writeFileSync(flagPath, out.join('\n'));
  return flagPath;
}

// ---------- Main ----------

function main() {
  const baseRef = getBaseRef();
  const fileMap = collectDiff(baseRef);
  const allFiles = Object.keys(fileMap);

  if (allFiles.length === 0) {
    console.log(`[hci-audit] No pending changes against ${baseRef}. Verdict: GREEN.`);
    return 0;
  }

  const emptySignals = () => ({
    routing: 0,
    newInteractive: 0,
    copyChanges: 0,
    cssChanges: 0,
    a11yRegressions: [],
  });

  const classified = allFiles.map((p) => {
    const file = fileMap[p];
    const tier = classify(p);
    return {
      path: p,
      tier,
      addedCount: file.addedCount,
      removedCount: file.removedCount,
      // Only scan files that are actually user facing; otherwise self references
      // inside scripts and tests would trigger false positives.
      signals: tier === TIER.NON_HCI ? emptySignals() : detectSignals(p, file),
    };
  });

  const scoreResult = score(classified);
  const changedHciFiles = classified
    .filter((e) => e.tier !== TIER.NON_HCI)
    .map((e) => e.path);
  const affectedStories = findAffectedStories(changedHciFiles, loadUserStories());

  const banner = {
    GREEN: '\n[hci-audit] GREEN: no UAT flag needed.\n',
    YELLOW: '\n[hci-audit] YELLOW: minor HCI impact. Spot check recommended.\n',
    RED: '\n[hci-audit] RED: significant HCI impact. UAT FLAG CREATED.\n',
  }[scoreResult.verdict];
  console.log(banner);
  console.log(`Compared against: ${baseRef}`);
  console.log(`Changed files (HCI relevant): ${changedHciFiles.length}`);
  for (const r of scoreResult.reasons) console.log(`  - ${r}`);

  if (scoreResult.verdict === 'GREEN') {
    return 0;
  }

  const flagPath = writeFlag(scoreResult.verdict, scoreResult, classified, affectedStories);
  console.log(`\nFlag written to: ${path.relative(REPO_ROOT, flagPath)}`);
  if (scoreResult.verdict === 'RED') {
    console.log('Review the flag, run the suggested UAT scenarios, and commit the sign off before promoting to PROD.');
  }
  return 0;
}

try {
  process.exit(main());
} catch (err) {
  console.error('[hci-audit] Internal error:', err.message);
  process.exit(2);
}
