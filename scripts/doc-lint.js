#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const docsDir = path.join(process.cwd(), 'docs');
const adrDir = path.join(docsDir, 'architecture', 'decisions');
const requiredAdrSections = ['## Context', '## Decision', '## Consequences', '## Azure Migration Path'];
const MAX_FILE_SIZE = 50 * 1024; // 50KB

const violations = [];

// Recursively collect .md files from a directory
function getMdFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...getMdFiles(full));
    } else if (entry.name.endsWith('.md')) {
      results.push(full);
    }
  }
  return results;
}

function relPath(filePath) {
  return path.relative(process.cwd(), filePath);
}

function report(filePath, line, message) {
  violations.push({ file: relPath(filePath), line, message });
}

// Check for em-dashes: --, ---, or U+2014
function checkEmDashes(filePath, lines) {
  let inFrontMatter = false;
  let frontMatterCount = 0;
  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Track YAML front matter delimiters (---)
    if (trimmed === '---' && !inCodeBlock) {
      if (frontMatterCount < 2) {
        frontMatterCount++;
        inFrontMatter = frontMatterCount === 1;
        if (frontMatterCount === 2) inFrontMatter = false;
      }
      continue;
    }

    if (inFrontMatter) continue;

    // Track fenced code blocks (``` or ~~~)
    if (/^```|^~~~/.test(trimmed)) {
      inCodeBlock = !inCodeBlock;
      continue;
    }

    if (inCodeBlock) continue;

    // Skip markdown table separator rows (e.g., |---|---|)
    if (/^\s*\|[\s|:-]+\|\s*$/.test(line)) continue;

    // Strip inline code spans before checking for em-dashes
    const stripped = line.replace(/`[^`]+`/g, '');

    // Check for Unicode em-dash
    if (stripped.includes('\u2014')) {
      report(filePath, i + 1, `Em-dash (U+2014) found: ${line.trim().substring(0, 80)}`);
    }

    // Check for double or triple hyphens used as em-dashes
    // Match -- or --- not part of a YAML delimiter, table separator, or HTML comment
    const dashMatch = stripped.match(/[^|:-]--(?:-)?[^|:->/]/);
    if (dashMatch) {
      report(filePath, i + 1, `Em-dash (-- or ---) found: ${line.trim().substring(0, 80)}`);
    }
  }
}

// Check ADR required sections
function checkAdrSections(filePath, content) {
  for (const section of requiredAdrSections) {
    if (!content.includes(section)) {
      report(filePath, 1, `Missing required ADR section: "${section}"`);
    }
  }
}

// Check broken relative links (./ or ../)
function checkBrokenLinks(filePath, lines) {
  const fileDir = path.dirname(filePath);
  const linkRegex = /\[([^\]]*)\]\((\.[^)]+)\)/g;

  for (let i = 0; i < lines.length; i++) {
    let match;
    while ((match = linkRegex.exec(lines[i])) !== null) {
      const linkPath = match[2].split('#')[0]; // strip anchor
      if (!linkPath) continue;
      const resolved = path.resolve(fileDir, linkPath);
      if (!fs.existsSync(resolved)) {
        report(filePath, i + 1, `Broken relative link: ${match[2]}`);
      }
    }
  }
}

// Check file size
function checkFileSize(filePath) {
  const stats = fs.statSync(filePath);
  if (stats.size > MAX_FILE_SIZE) {
    const kb = (stats.size / 1024).toFixed(1);
    report(filePath, 1, `File exceeds 50KB limit (${kb} KB)`);
  }
}

// Main
function main() {
  const mdFiles = getMdFiles(docsDir);

  if (mdFiles.length === 0) {
    console.log('doc-lint: no .md files found in docs/');
    process.exit(0);
  }

  for (const filePath of mdFiles) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    checkEmDashes(filePath, lines);
    checkBrokenLinks(filePath, lines);
    checkFileSize(filePath);

    // ADR section checks for files in docs/architecture/decisions/
    const normalized = path.normalize(filePath);
    if (normalized.startsWith(path.normalize(adrDir))) {
      checkAdrSections(filePath, content);
    }
  }

  if (violations.length > 0) {
    console.log(`doc-lint: ${mdFiles.length} files scanned, ${violations.length} violations\n`);
    for (const v of violations) {
      console.log(`  ${v.file}:${v.line} - ${v.message}`);
    }
    process.exit(1);
  }

  console.log(`doc-lint: ${mdFiles.length} files scanned, 0 violations`);
  process.exit(0);
}

main();
