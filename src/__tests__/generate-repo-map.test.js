// generate-repo-map.test.js
// Tests for the REPO_MAP.md generator script

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

describe('generate-repo-map script', () => {
  const repoMapPath = path.join(process.cwd(), 'REPO_MAP.md');

  afterEach(() => {
    // Clean up generated file
    if (fs.existsSync(repoMapPath)) {
      fs.unlinkSync(repoMapPath);
    }
  });

  it('creates REPO_MAP.md at the project root', () => {
    execSync('node scripts/generate-repo-map.js', { stdio: 'ignore' });
    expect(fs.existsSync(repoMapPath)).toBe(true);
  });

  it('contains a timestamp header in ISO format', () => {
    execSync('node scripts/generate-repo-map.js', { stdio: 'ignore' });
    const content = fs.readFileSync(repoMapPath, 'utf-8');
    expect(content).toMatch(/^# REPO MAP — \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('excludes node_modules from the output', () => {
    execSync('node scripts/generate-repo-map.js', { stdio: 'ignore' });
    const content = fs.readFileSync(repoMapPath, 'utf-8');
    expect(content).not.toContain('node_modules');
  });

  it('excludes .git directory from the output', () => {
    execSync('node scripts/generate-repo-map.js', { stdio: 'ignore' });
    const content = fs.readFileSync(repoMapPath, 'utf-8');
    expect(content).not.toMatch(/📁 \.git\b/);
  });

  it('includes common project directories', () => {
    execSync('node scripts/generate-repo-map.js', { stdio: 'ignore' });
    const content = fs.readFileSync(repoMapPath, 'utf-8');
    expect(content).toMatch(/📁 src/);
    expect(content).toMatch(/📁 public/);
  });

  it('uses emoji indicators for directories and files', () => {
    execSync('node scripts/generate-repo-map.js', { stdio: 'ignore' });
    const content = fs.readFileSync(repoMapPath, 'utf-8');
    expect(content).toMatch(/📁/); // Directory emoji
    expect(content).toMatch(/📄/); // File emoji
  });
});
