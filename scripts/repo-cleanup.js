#!/usr/bin/env node

/**
 * Repository Cleanup Script
 * Identifies and optionally removes unnecessary files from the repo
 * for presentation readiness.
 *
 * Usage:
 *   node scripts/repo-cleanup.js          # Dry run (report only)
 *   node scripts/repo-cleanup.js --apply  # Actually delete/move files
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DRY_RUN = !process.argv.includes('--apply');

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

let removeCount = 0;
let moveCount = 0;
let skipCount = 0;

function log(color, icon, msg) {
  console.log(`${color}${icon}${RESET} ${msg}`);
}

function fileExists(filePath) {
  return fs.existsSync(path.join(ROOT, filePath));
}

function removeFile(filePath, reason) {
  const full = path.join(ROOT, filePath);
  if (!fs.existsSync(full)) {
    skipCount++;
    return;
  }
  const size = fs.statSync(full).size;
  const sizeStr = size > 1024 ? `${(size / 1024).toFixed(1)} KB` : `${size} B`;
  if (DRY_RUN) {
    log(RED, '[REMOVE]', `${filePath} (${sizeStr}) - ${reason}`);
  } else {
    fs.unlinkSync(full);
    log(GREEN, '[REMOVED]', `${filePath} (${sizeStr}) - ${reason}`);
  }
  removeCount++;
}

function removeDir(dirPath, reason) {
  const full = path.join(ROOT, dirPath);
  if (!fs.existsSync(full)) {
    skipCount++;
    return;
  }
  if (DRY_RUN) {
    log(RED, '[REMOVE DIR]', `${dirPath}/ - ${reason}`);
  } else {
    fs.rmSync(full, { recursive: true, force: true });
    log(GREEN, '[REMOVED DIR]', `${dirPath}/ - ${reason}`);
  }
  removeCount++;
}

function moveFile(from, to, reason) {
  const fullFrom = path.join(ROOT, from);
  const fullTo = path.join(ROOT, to);
  if (!fs.existsSync(fullFrom)) {
    skipCount++;
    return;
  }
  if (DRY_RUN) {
    log(CYAN, '[MOVE]', `${from} -> ${to} - ${reason}`);
  } else {
    const toDir = path.dirname(fullTo);
    if (!fs.existsSync(toDir)) {
      fs.mkdirSync(toDir, { recursive: true });
    }
    fs.renameSync(fullFrom, fullTo);
    log(GREEN, '[MOVED]', `${from} -> ${to} - ${reason}`);
  }
  moveCount++;
}

function checkGitignore() {
  const gitignorePath = path.join(ROOT, '.gitignore');
  if (!fs.existsSync(gitignorePath)) return;

  const content = fs.readFileSync(gitignorePath, 'utf8');
  const missing = [];

  const shouldHave = ['*.bak', '*.tmp', '*.orig', '*.old', '.DS_Store', 'Thumbs.db'];
  for (const entry of shouldHave) {
    if (!content.includes(entry)) {
      missing.push(entry);
    }
  }

  if (missing.length > 0) {
    if (DRY_RUN) {
      log(YELLOW, '[GITIGNORE]', `Missing entries: ${missing.join(', ')}`);
    } else {
      const additions = '\n# Cleanup additions\n' + missing.join('\n') + '\n';
      fs.appendFileSync(gitignorePath, additions);
      log(GREEN, '[GITIGNORE]', `Added: ${missing.join(', ')}`);
    }
  }
}

function checkSecrets() {
  console.log(`\n${CYAN}--- Secret Scan ---${RESET}`);
  try {
    const result = execSync('git log --all -- .env 2>/dev/null', { cwd: ROOT, encoding: 'utf8' });
    if (result.trim().length > 0) {
      log(RED, '[WARNING]', '.env found in git history! Rotate keys and scrub with BFG.');
    } else {
      log(GREEN, '[OK]', '.env not in git history');
    }
  } catch {
    log(GREEN, '[OK]', '.env not in git history');
  }

  try {
    const result = execSync('git grep -i "sk-ant\\|REACT_APP_.*KEY.*=" -- ":(exclude).env*" ":(exclude)*.example" 2>/dev/null', {
      cwd: ROOT,
      encoding: 'utf8'
    });
    if (result.trim().length > 0) {
      log(RED, '[WARNING]', 'Potential API keys found in committed files:');
      result.trim().split('\n').slice(0, 5).forEach(line => {
        log(RED, '  ', line.substring(0, 120));
      });
    } else {
      log(GREEN, '[OK]', 'No API keys found in committed files');
    }
  } catch {
    log(GREEN, '[OK]', 'No API keys found in committed files');
  }
}

// --- Main ---
console.log(`\n${CYAN}=== PeelAway Logic - Repository Cleanup ===${RESET}`);
console.log(`Mode: ${DRY_RUN ? `${YELLOW}DRY RUN${RESET} (use --apply to execute)` : `${RED}APPLYING CHANGES${RESET}`}\n`);

console.log(`${CYAN}--- Files to Remove ---${RESET}`);
removeFile('_.gitignore', 'Empty duplicate of .gitignore');
removeFile('peelaway-mockups-v2.html', 'Dev mockup artifact (128 KB), not part of app');
removeFile('fix-failing-tests.ps1', 'One-off task script, already applied');
removeFile('prod-update-docs.yml', 'Duplicate/draft workflow at repo root');

console.log(`\n${CYAN}--- Directories to Remove ---${RESET}`);
removeDir('build', 'Build artifact, regenerates on npm run build');
removeDir('PeelAway Logic', 'Empty stray directory');

console.log(`\n${CYAN}--- Files to Relocate ---${RESET}`);
moveFile(
  'POST_RESKIN_DECOMPOSITION_PLAN.md',
  'docs/architecture/DECOMPOSITION_PLAN.md',
  'Better organization under docs/architecture/'
);

console.log(`\n${CYAN}--- .gitignore Improvements ---${RESET}`);
checkGitignore();

checkSecrets();

// Summary
console.log(`\n${CYAN}=== Summary ===${RESET}`);
console.log(`  Files to remove: ${removeCount}`);
console.log(`  Files to move:   ${moveCount}`);
console.log(`  Already clean:   ${skipCount}`);

if (DRY_RUN && (removeCount > 0 || moveCount > 0)) {
  console.log(`\n${YELLOW}Run with --apply to execute these changes.${RESET}`);
  console.log(`${YELLOW}PowerShell: node scripts/repo-cleanup.js --apply${RESET}\n`);
} else if (!DRY_RUN) {
  console.log(`\n${GREEN}Cleanup complete! Run 'git status' to review changes before committing.${RESET}\n`);
}
