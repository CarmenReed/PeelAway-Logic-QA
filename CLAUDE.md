# PeelAway Logic - QA Repo Guidelines

## Identity

This is the **QA/development** repository. It deploys to `carmenreed.github.io/PeelAway-Logic-QA` via GitHub Pages. The production counterpart lives at `../PeelAway-Logic`. Carmen Reed is a Solutions Architect building this as a portfolio project for interviews. Changes here are promoted to PROD via a discovery-based script, not via git merge.

## Promotion to PROD

Changes are promoted using the script in the PROD repo:

```powershell
# Run from the PROD repo directory
.\scripts\promote-qa-to-prod.ps1 -QAPath "..\PeelAway-Logic-QA"
```

The script reads `.promotion.json` in THIS repo for all rules. **When you add new directories, files, or QA-specific patterns, update `.promotion.json`** -- not the promotion script.

### What gets promoted
Everything except items listed in `.promotion.json` under `neverPromote`. The script discovers the repo structure dynamically -- new directories and files are automatically included.

### What does NOT get promoted
See `neverPromote` in `.promotion.json` for the full exclusion list (dirs, files, and root file extensions).

### PROD-preserved files
Files listed in `preserveProdVersions` in `.promotion.json` will NOT be overwritten during promotion. PROD maintains its own version.

### Environment replacements
After copying, the promotion script replaces QA-specific text across all file types listed in `envReplacementFileTypes` in `.promotion.json`. Patterns are defined in `envReplacements`. If you introduce a new QA-specific term that would be wrong in PROD, add it to both `envReplacements` and `envAuditPatterns`.

## Documentation Rules

- **Never use em-dashes** (U+2014, `--`, `---` outside YAML frontmatter/code blocks/table separators). Use commas, semicolons, or restructure sentences. `doc-lint.js` enforces this.
- Run `node scripts/doc-lint.js` after any documentation changes.
- `update-docs.yml` CI workflow auto-updates test counts in README after source changes.

## HCI Governance

Before committing any change that touches user facing surface, run the HCI
audit after tests pass:

```bash
npm run hci-audit
```

The script scans the diff against `origin/main`, classifies each changed
file by HCI impact tier, and emits a GREEN, YELLOW, or RED verdict. YELLOW
and RED verdicts write a flag file under `docs/hci-audit/flags/` listing
the affected user stories and recommended UAT scenarios. The gate warns
loudly but never blocks; surface the flag to the user and let them decide
whether to proceed, spot check, or run a full UAT cycle before committing.

See `docs/hci-audit/README.md` for tier definitions and the sign off
workflow. The skill definition lives at `.claude/skills/hci-audit/SKILL.md`
and is also invocable as `/hci-audit`.

## Testing

- Jest tests (unit + component) in `src/__tests__/`, Playwright E2E tests in `e2e/`
- Get current counts: `CI=true npx react-scripts test --watchAll=false 2>&1 | tail -3`
- All tests must pass before promotion: `CI=true npm test`
- E2E tests: `npm run test:e2e`
- Tests are deterministic; all external APIs mocked. Zero API costs.
- User stories with acceptance criteria live in `docs/user-stories/`.

## Architecture

- React 18 (Create React App), single-page app
- 4-phase pipeline: Scout, Review (with Human Gate), Complete (with document generation)
- Phase orchestration in `JobSearchPipeline.jsx`, step locking enforced
- `JobSearchPipelineV4.jsx` is a legacy monolith -- do not add features to it
- Anthropic Claude API; model IDs are in `src/constants.js` (single source of truth for all magic numbers, timing values)
- All API calls go through `src/api.js` with retry logic
- All prompts in `src/prompts.js`; anti-hallucination enforced at prompt layer

## QA-Specific Files (Do Not Promote)

Files and directories excluded from promotion are listed in `.promotion.json` under `neverPromote`. When adding new QA-only files, add them there (and to `.gitignore` if they shouldn't be tracked).

## Package.json

- `homepage` must be `https://carmenreed.github.io/PeelAway-Logic-QA` in this repo.
- During promotion, the PROD script preserves PROD's `homepage` value. Do not worry about it here.
- E2E scripts (`test:e2e`, `test:e2e:ui`, `test:e2e:headed`) and Playwright devDependencies are QA additions that get promoted.

## File Sensitivity

- `.env` contains live API keys. Never committed (in `.gitignore`).
- GitHub Secrets mirror `.env` values for CI builds.
- `semantic-kernel-demo/.env` also excluded.

## Key Conventions

- CSS is plain CSS in `src/App.css`. No preprocessor, no CSS-in-JS, no Tailwind.
- No custom Jest config. CRA defaults.
- No custom Webpack config.
- Google Fonts loaded via CDN in `public/index.html` (Quicksand).
- localStorage used for persistence (applied jobs, scout data, tailor results, dismissed jobs).
