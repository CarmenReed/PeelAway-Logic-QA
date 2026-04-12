Review the most recent git changes and update all project documentation (README.md, claude-code-entry-point.md, and any other .md files in the repo root) to reflect the current state of the project.

## What to check and update

1. **Run `git log --oneline -10`** to see recent commits
2. **Run `npx react-scripts test --watchAll=false --no-coverage 2>&1 | tail -5`** to get current test counts
3. **Read the current README.md and claude-code-entry-point.md**
4. **Scan the codebase** for changes that affect documented information:
   - Test file count and total test number
   - Test suite names and descriptions
   - Feature list (new features added, old ones removed)
   - File map (new files, renamed files, deleted files)
   - Tech stack changes (new dependencies, fonts, APIs)
   - Function signatures that changed
   - Search filter options
   - Pipeline phase descriptions
   - Setup instructions
   - Environment variables
   - Prompt locations
   - Component props

## Rules

- Only update sections where information has actually changed. Do not rewrite unchanged sections.
- Do not add em-dashes anywhere. Use commas or restructure.
- Keep the existing structure and formatting style of each document.
- Update numeric counts (test counts, suite counts) to match current reality.
- If a new source file was added (e.g. profileExtractor.js), add it to the file map.
- If a function signature changed (e.g. keywordPreFilter now takes a profile param), update the quick reference.
- If a UI feature changed (e.g. Country dropdown replaced with Zip Code + Radius), update the feature list and usage notes.
- After making changes, show a summary of what was updated and why.
