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
- `.env`, `.claude/`, `node_modules/`, `build/`, `playwright-report/`, `test-results/`
- `claude-code-entry-point.md`, `POST_RESKIN_DECOMPOSITION_PLAN.md`
- `fix-failing-tests.ps1`, `prod-update-docs.yml`, `MASTER_PLAN_*`, `*sprint-plan*`
- Root `.ps1` files

### PROD-preserved files
Files listed in `preserveProdVersions` in `.promotion.json` will NOT be overwritten during promotion. PROD maintains its own version. Currently: `docs/GITHUB-KNOWLEDGE-BASE.md`.

### Environment replacements
After copying, the promotion script replaces QA-specific text across all configured file types (`.md`, `.js`, `.jsx`, `.json`, `.yml`, `.html`). Patterns are defined in `envReplacements` in `.promotion.json`. If you introduce a new QA-specific term that would be wrong in PROD, add it to both `envReplacements` and `envAuditPatterns`.

## Documentation Rules

- **Never use em-dashes** (U+2014, `--`, `---` outside YAML frontmatter/code blocks/table separators). Use commas, semicolons, or restructure sentences. `doc-lint.js` enforces this.
- Run `node scripts/doc-lint.js` after any documentation changes.
- The `/update-docs` custom command (`.claude/commands/update-docs.md`) has rules for when and how to update docs. Follow its tiered approach.

## Testing

- 451 Jest tests (unit + component) in `src/__tests__/`
- 62 Playwright E2E tests in `e2e/` (42 passing, 20 pending via `test.fixme()`)
- All tests must pass before promotion: `CI=true npm test`
- E2E tests: `npm run test:e2e`
- Tests are deterministic -- all external APIs mocked. Zero API costs.
- User stories with acceptance criteria live in `docs/user-stories/`.

## Architecture

- React 18 (Create React App), single-page app
- 4-phase pipeline: Scout, Review (with Human Gate), Complete (with document generation)
- Phase orchestration in `JobSearchPipeline.jsx`, step locking enforced
- `JobSearchPipelineV4.jsx` is a legacy monolith -- do not add features to it
- Anthropic Claude API: `claude-sonnet-4-6` for tailoring, `claude-haiku-4-5` for scoring
- All API calls go through `src/api.js` with retry logic
- All prompts in `src/prompts.js` -- anti-hallucination enforced at prompt layer
- `src/constants.js` holds all magic numbers, model IDs, timing values

## QA-Specific Files (Do Not Promote)

- `claude-code-entry-point.md` -- Claude Code session primer, QA-only context
- `POST_RESKIN_DECOMPOSITION_PLAN.md` -- internal refactor roadmap
- `fix-failing-tests.ps1` -- one-off debug scripts
- `prod-update-docs.yml` -- workflow template draft

These are listed in `.promotion.json` under `neverPromote.files` and in `.gitignore`.

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
