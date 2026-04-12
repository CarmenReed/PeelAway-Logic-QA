# Documentation Governance

## Standards
All documentation in this repository must meet these standards before merge.

### Required: Architecture Decision Records
Every significant architectural choice requires an ADR in docs/architecture/decisions/.
ADR files must include: Context, Decision, Consequences, and Azure Migration Path sections.
Use kebab-case filenames: ADR-00X-short-description.md

### Required: No Em-Dashes
Use commas, colons, or restructure sentences instead of em-dashes.
Rationale: Accessibility. Screen readers handle em-dashes inconsistently.

### Required: Link Integrity
All relative links in .md files must resolve to existing files.
Run node scripts/doc-lint.js before committing documentation changes.

### Enforcement
doc-quality.yml runs on every push and PR. PRs with lint failures will not merge.

## File Size Limits
| Location | Limit |
|---|---|
| Individual .md files | 50 KB |
| Diagram files (.mermaid) | 10 KB |

## Rationale
Documentation is a first-class deliverable. A Principal engineer's documentation
should demonstrate the same rigor as production code.
