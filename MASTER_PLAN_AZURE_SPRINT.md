# PeelAway Logic - Azure Integration Master Sprint Plan

> **Author:** Carmen Reed, Solutions Architect
> **Date:** April 12, 2026
> **Sprint Window:** Sunday April 12 (full day) + Monday April 13 (full day, PTO)
> **Deadline:** UAT-ready by end of day Monday; Tuesday AM for final polish only

---

## Assessment Areas

Everything built during this sprint maps to at least one of three core assessment areas:

| # | Assessment Area | What to Demonstrate | How PeelAway Proves It |
|---|----------------|------------------------|----------------------|
| 1 | **Architectural Design Decisions** | "Explain why or why not to a feature" | ADRs with trade-off analysis, alternatives considered |
| 2 | **System Thinking** | Systems-level reasoning, coaching ability | Architecture diagrams, pipeline data flow, evolution narrative |
| 3 | **AI Experience** | Hands-on AI knowledge, production use | SK demo, Azure AI Search, human-gated RAG pipeline, anti-hallucination |

---

## Sprint Phases (14-16 hrs)

### Phase 0: Azure Account Setup (20 min) - Carmen Manual
- [ ] Create Azure free account (personal MS account)
- [ ] Create resource group: `peelaway-portfolio-rg` (East US)
- [ ] Create Azure AI Search (F0 free tier): `peelaway-search`
- [ ] Collect credentials (endpoint, admin key, query key)
- [ ] Verify Python 3.9+ installed

### Phase 1: Track 1 - Azure AI Search Integration (45 min) - Claude Code
Per existing AZURE_INTEGRATION_PLAN.md Track 1 directive. No changes needed.

**Assessment Mapping:** Areas 1 + 3 (architectural decision to use REST over SDK, AI platform fluency)

### Phase 2: Track 2 - Semantic Kernel Demo (30 min) - Claude Code
Per existing AZURE_INTEGRATION_PLAN.md Track 2 directive. No changes needed.

**Assessment Mapping:** Areas 2 + 3 (same pipeline logic at enterprise scale, Microsoft AI orchestration)

### Phase 3: Architecture Decision Records (2 hrs) - Claude Code
**NEW - Not in original plan. This is what separates a Senior from a Principal.**

Create `docs/architecture/decisions/` with formal ADRs:

| ADR | Title | Area |
|-----|-------|-----------|
| ADR-001 | Why Anthropic Claude over Azure OpenAI (with swap-ready design) | 1 |
| ADR-002 | Why client-side REST over Azure SDK | 1 |
| ADR-003 | Human-gated pipeline vs fully autonomous agents | 1, 3 |
| ADR-004 | Project evolution: Gemini Gems to agentic architecture | 2 |
| ADR-005 | Why GitHub Pages over Azure Static Web Apps (cost/time trade-off) | 1, 2 |
| ADR-006 | Anti-hallucination prompt engineering strategy | 3 |

**ADR Format (standard):**
```
# ADR-NNN: Title
Status: Accepted
Date: YYYY-MM-DD
Deciders: Carmen Reed

## Context
What is the issue that we are seeing that is motivating this decision?

## Decision
What is the change that we are proposing and/or doing?

## Alternatives Considered
| Option | Pros | Cons |
|--------|------|------|
| ... | ... | ... |

## Consequences
What becomes easier or more difficult because of this change?

## Azure Migration Path
If this were built at Microsoft with full Azure access, what would change?
```

**The "Azure Migration Path" section is the secret weapon.** It shows you know the "right" enterprise answer AND why you made pragmatic trade-offs for a personal project. This directly addresses the "why or why not" assessment.

### Phase 4: Architecture Diagrams (1.5 hrs) - Claude Code
Create `docs/architecture/diagrams/` with Mermaid diagrams:

1. **System Context (C4 Level 1)** - PeelAway in its ecosystem (user, APIs, Azure services)
2. **Container Diagram (C4 Level 2)** - React app, services, external integrations
3. **Pipeline Data Flow** - Scout > Search > Review > Tailor > Complete with data shapes
4. **Azure Integration Architecture** - How Azure AI Search and SK demo fit
5. **Evolution Timeline** - Gemini Gems > Claude Code > Current Architecture (this tells YOUR story)

Each diagram rendered as `.mermaid` files + embedded in a `ARCHITECTURE.md` overview doc.

**Assessment Mapping:** Area 2 (system thinking, visual communication, coaching artifacts)

### Phase 5: Project Evolution Narrative (1 hr) - Claude Code
Create `docs/PROJECT_EVOLUTION.md` - a technical narrative document that tells the story:

1. **Genesis:** Gemini Gems for job search (individual AI tools, no orchestration)
2. **Problem:** Manual copy-paste between Gems, no pipeline, no quality gates
3. **Pivot:** Claude Code + agentic architecture, human-gated multi-phase pipeline
4. **Growth:** 346 tests, 15 test files, CI/CD, cloud sync, production deployment
5. **Azure Integration:** Adding Microsoft AI proof points (this sprint)
6. **Recursive Refinement:** Using Claude/Cowork to audit and improve the plan itself (meta-level, THIS conversation)
7. **Enterprise Vision:** What this becomes with full Azure (Cosmos DB, ADF, Azure OpenAI, Bicep IaC)

**This is your "explain the thought process" artifact.** It directly addresses showcasing WHY you made decisions with time constraints, and how recursive AI-assisted iteration produces better results.

**Assessment Mapping:** All three areas

### Phase 6: Governance and Doc Quality (1.5 hrs) - Claude Code
Create automated quality gates:

1. **`scripts/doc-lint.js`** - Node.js script that checks ALL .md files for:
   - Em-dash violations (your existing rule)
   - Stale version numbers (cross-reference package.json)
   - Broken internal links
   - Missing sections in required docs
   - Typo patterns (common misspellings list)

2. **`.github/workflows/doc-quality.yml`** - CI workflow that runs doc-lint on push
   - Fails the build if em-dashes detected
   - Warns on stale info
   - Reports broken links

3. **`docs/GOVERNANCE.md`** - Documentation standards document:
   - Writing style rules (no em-dashes, consistent terminology)
   - Required sections for each doc type
   - Review checklist
   - How automated checks enforce quality

4. **Update `.claude/commands/update-docs.md`** - Add doc-lint to the update flow

**Assessment Mapping:** Area 2 (engineering discipline, reusable guidance, amplifying impact through others)

### Phase 7: Update All Project Docs (1 hr) - Claude Code
After all implementation is done:

- [ ] README.md - Add Azure integration section, architecture docs links
- [ ] claude-code-entry-point.md - Add new files, Azure service references
- [ ] docs/GITHUB-KNOWLEDGE-BASE.md - Add Azure services, new directories, updated test counts
- [ ] Run doc-lint and fix any violations

### Phase 8: IaC Awareness Artifact (30 min) - Claude Code
**NEW - Addresses IaC gap.**

Create `docs/architecture/azure-resources.bicep` - a Bicep template that DOCUMENTS (not deploys) the Azure resources PeelAway would use at enterprise scale:

```bicep
// This template documents the Azure resources PeelAway Logic would
// provision in an enterprise deployment. Currently deployed manually
// on Azure Free Tier for portfolio demonstration.
```

Resources to include:
- Azure AI Search (already using)
- Azure Static Web Apps (migration target from GitHub Pages)
- Azure OpenAI (swap-ready, documented in ADR-001)
- Cosmos DB (future: replace localStorage job persistence)
- Azure Data Factory (future: scheduled job ingestion pipeline)
- Application Insights (monitoring)

**This is NOT for deployment.** It is a documentation artifact that shows understanding of Bicep/IaC and can articulate the full Azure architecture, even though the MVP was built on free tier. Directly addresses the IaC gap.

### Phase 9: Search Layer Caps + Performance (1 hr) - Claude Code
**Reduces scoring time from 4-6 min to ~30 seconds. Cuts API cost per search by ~60%.**

**The Problem:** Layers currently return uncapped results (Layer 2 RSS alone can return 350 items across 7 feeds). Scoring 100+ jobs at 8 per batch with 15s delays = 3+ minutes of waiting.

**The Fix:** Cap each layer at 10 matches post-dedup. Total max ~30 JDs per session.

**Why This Works:** Applied + dismissed job tracking already exists cross-session (`jsp-applied-jobs`, `jsp-dismissed-jobs`). Users process ~30 jobs, promote some to Tailor, dismiss the rest, and start a fresh search for the next 30. Old results never reappear.

**Current State vs Proposed:**

| Layer | Current Limit | Proposed Limit |
|-------|--------------|---------------|
| Layer 1 - Adzuna | 10 per query, multi-query | 10 total (stop after 10 unique matches) |
| Layer 1 - JSearch | 1 page per query, multi-query | 10 total (stop after 10 unique matches) |
| Layer 2 - RSS | ~50 per feed x 7 feeds (up to 350) | 10 total (stop parsing feeds after 10 unique matches) |
| Layer 3 - ATS | 5-10 via web search prompt | 10 total (already close) |
| **Total pre-scoring** | **100-400+** | **~30 max** |
| **Scoring batches** | **13-50 batches (3-10 min)** | **4 batches (~45 sec)** |

**Cost Impact:**

| Step | Before (100 jobs) | After (30 jobs) | Savings |
|------|-------------------|-----------------|---------|
| Scoring (Haiku) | $0.05-0.10 | $0.02-0.03 | ~60% |
| JD fetch (Sonnet) | $0.30-0.50 | $0.30-0.50 | Same (still top 5) |
| Re-score (Sonnet) | $0.10-0.15 | $0.10-0.15 | Same (still top 5) |
| **Per search total** | **~$1.00-1.55** | **~$0.60-0.90** | **~40%** |

**Claude Code Directive:**
```
Read src/constants.js, src/phases/SearchPhase.jsx, src/utils.js, and src/storage.js.

Add a new constant to src/constants.js:
  export const MAX_RESULTS_PER_LAYER = 10;

Modify SearchPhase.jsx layer functions to enforce the cap:

1. Layer 1 (Adzuna + JSearch):
   - After each query's results come back, merge into accumulated array using mergeRawJobs()
   - After merge, check if accumulated.length >= MAX_RESULTS_PER_LAYER
   - If yes, stop processing remaining queries for that API
   - Slice to MAX_RESULTS_PER_LAYER if over

2. Layer 2 (RSS feeds):
   - After each feed is parsed, merge into accumulated array
   - After merge, check count against MAX_RESULTS_PER_LAYER
   - If hit, stop fetching remaining feeds
   - This is the biggest win: cuts 350 potential items to 10

3. Layer 3 (ATS web search):
   - Update the prompt from "Find 5 to 10" to "Find up to 10"
   - Slice results to MAX_RESULTS_PER_LAYER after parsing

4. In handleScoreAndAdvance():
   - After all layers complete and final dedup runs, the total should be ~30
   - No changes needed to the scoring logic itself (batch size stays at 8)

5. Add a brief UI indicator showing "10/10 Layer 1 | 8/10 Layer 2 | 10/10 Layer 3" 
   so the user sees the caps in action

After changes, update the existing tests:
  - Update any tests that assume uncapped result counts
  - Add a test verifying MAX_RESULTS_PER_LAYER is enforced per layer

Run: CI=true npm test
Fix any failures before finishing.
```

**Assessment Mapping:** Area 1 (intentional design constraint with clear reasoning), Area 2 (system thinking about cost/performance trade-offs)

### Phase 10: QA Repository Cleanup (1 hr) - Claude Code
**Clean the repo for presentation.**

#### Files to REMOVE (committed, no longer needed)
- [ ] `_.gitignore` - Empty duplicate of .gitignore (artifact/accident)
- [ ] `peelaway-mockups-v2.html` (128 KB) - Dev mockup, not part of the app
- [ ] `fix-failing-tests.ps1` (6.5 KB) - One-off task script, already applied
- [ ] `prod-update-docs.yml` (5.1 KB) - Duplicate/draft workflow file at repo root

#### Files to RELOCATE (better organization)
- [ ] `POST_RESKIN_DECOMPOSITION_PLAN.md` -> `docs/architecture/DECOMPOSITION_PLAN.md`
- [ ] `MASTER_PLAN_AZURE_SPRINT.md` -> move to `.claude/` or remove from git (personal sprint plan, not a codebase doc)

#### Local-only cleanup (not committed, safe to delete)
- [ ] `build/` directory (908 KB) - regenerates on `npm run build`
- [ ] `PeelAway Logic/` empty stray directory

#### .gitignore improvements
Add these to prevent future clutter:
```
*.bak
*.tmp
*.orig
*.old
.DS_Store
Thumbs.db
```

#### Verify nothing sensitive is tracked
- [ ] Confirm `.env` is NOT in git history (`git log --all -- .env`)
- [ ] Confirm no API keys in any committed file (`git grep -i "sk-ant\|api_key\|apikey"`)
- [ ] If found: rotate keys, use `git filter-branch` or BFG to scrub history

#### Claude Code Directive for Cleanup
```
Review the repository for unnecessary files and clean up:
1. Delete these files: _.gitignore, peelaway-mockups-v2.html, fix-failing-tests.ps1, prod-update-docs.yml
2. Move POST_RESKIN_DECOMPOSITION_PLAN.md to docs/architecture/DECOMPOSITION_PLAN.md
3. Update any internal links that referenced the old location
4. Add *.bak, *.tmp, *.orig, *.old, .DS_Store, Thumbs.db to .gitignore
5. Run: git log --all -- .env (verify no secrets in history)
6. Run: node scripts/doc-lint.js (verify no violations)
7. Commit with message: "chore: repo cleanup for presentation readiness"
```

### Phase 11: Verification and UAT (30 min)
- [ ] `CI=true npm test` - all tests pass (existing 346 + new Azure Search tests)
- [ ] `node scripts/doc-lint.js` - zero violations
- [ ] Manual review: open every new .md file, check for em-dashes, typos, stale info
- [ ] Verify Mermaid diagrams render (use Mermaid live editor or VS Code preview)
- [ ] Git commit and push
- [ ] Verify GitHub Pages deployment succeeds
- [ ] Spot-check live site for Azure Search UI
- [ ] Review GitHub repo: is it clean, professional, well-documented?

### Phase 12: PROD Repo Merge and Cleanup (1.5 hrs) - Claude Code
**The final showcase product. QA -> PROD with cleanup baked in.**

**PROD repo:** `carmenreed.github.io/PeelAway-Logic` (GitHub Pages)
**QA repo:** `carmenreed.github.io/PeelAway-Logic-QA` (GitHub Pages)

**Strategy:** Do NOT just merge QA into PROD blindly. The PROD repo should be the clean, showcase-ready version.

**Step 1: Audit PROD repo current state**
```powershell
cd C:\Users\CarmenReed\Downloads\ClaudeProjects\PeelAway-Logic
git log --oneline -10
dir
```
Identify any files in PROD that should not be there (old mockups, stale plans, test scripts).

**Step 2: Sync code from QA to PROD**
Only bring over files that belong in a showcase repo:
- [ ] `src/` - All source code (including new azureSearchService.js, updated SearchPhase.jsx)
- [ ] `src/__tests__/` - All tests
- [ ] `docs/` - Architecture docs, ADRs, diagrams, governance, AI skills inventory, knowledge base
- [ ] `scripts/doc-lint.js` - Quality enforcement
- [ ] `semantic-kernel-demo/` - SK Python demo
- [ ] `.github/workflows/` - All 3 workflows (deploy, update-docs, doc-quality)
- [ ] `package.json`, `package-lock.json` - Dependencies
- [ ] `public/` - Static assets
- [ ] `README.md` - Updated README
- [ ] `.gitignore` - Updated with cleanup entries

**Step 3: Do NOT bring over**
- [ ] `MASTER_PLAN_AZURE_SPRINT.md` - Personal sprint plan
- [ ] `AZURE_INTEGRATION_PLAN.md` - Integration plan (internal)
- [ ] `peelaway-mockups-v2.html` - Dev mockup
- [ ] `fix-failing-tests.ps1` - Task script
- [ ] `prod-update-docs.yml` - Draft file
- [ ] `_.gitignore` - Duplicate
- [ ] `POST_RESKIN_DECOMPOSITION_PLAN.md` - Internal refactoring notes (keep in QA only)
- [ ] `claude-code-entry-point.md` - Claude Code developer guide (keep in QA, not needed in showcase)
- [ ] Any `.env` files
- [ ] `build/` directory

**Step 4: PROD-specific cleanup**
- [ ] Remove any stale files already in PROD that predate the QA work
- [ ] Verify .gitignore in PROD matches QA's improved version
- [ ] Run `node scripts/doc-lint.js` in PROD repo
- [ ] Run `CI=true npm test` in PROD repo

**Step 5: Commit and deploy**
```powershell
cd C:\Users\CarmenReed\Downloads\ClaudeProjects\PeelAway-Logic
git add -A
git status  # VERIFY no .env, no secrets, no junk
git commit -m "feat: Azure AI Search, Semantic Kernel, architecture docs, search performance optimization

  - Azure AI Search integration (F0 free tier, REST client)
  - Semantic Kernel Python demo (pipeline orchestration)
  - 6 Architecture Decision Records with Azure migration paths
  - 5 C4/Mermaid architecture diagrams
  - Bicep IaC documentation template (7 Azure resources)
  - Search layer caps (10 per layer, ~30 total per session)
  - Documentation governance with CI enforcement
  - AI Skills Inventory tracking
  - Repository cleanup for presentation readiness"
git push origin main
```

**Step 6: Verify PROD deployment**
- [ ] Check GitHub Actions deploy workflow completes
- [ ] Visit https://carmenreed.github.io/PeelAway-Logic and verify site loads
- [ ] Click through Scout > Search > Review to verify search caps work
- [ ] Check Azure Search collapsible section renders
- [ ] Open GitHub repo page and verify it looks clean and professional

**Claude Code Directive for PROD Merge:**
```
I need to merge changes from the QA repo into PROD. The QA repo is at:
  C:\Users\CarmenReed\Downloads\ClaudeProjects\PeelAway-Logic-QA

The PROD repo is at:
  C:\Users\CarmenReed\Downloads\ClaudeProjects\PeelAway-Logic

Do NOT merge these files into PROD (they are QA-only or internal):
  - MASTER_PLAN_AZURE_SPRINT.md
  - AZURE_INTEGRATION_PLAN.md
  - peelaway-mockups-v2.html
  - fix-failing-tests.ps1
  - prod-update-docs.yml
  - _.gitignore
  - POST_RESKIN_DECOMPOSITION_PLAN.md
  - claude-code-entry-point.md
  - Any .env files

Steps:
1. First, list all files currently in PROD that should be removed (stale/old)
2. Copy updated src/, docs/, scripts/, semantic-kernel-demo/, .github/, public/ from QA
3. Copy updated package.json, package-lock.json, README.md, .gitignore from QA
4. Remove any PROD files not in the approved list above
5. Run: node scripts/doc-lint.js (fix any violations)
6. Run: CI=true npm test (all tests must pass)
7. Show me git status before committing
```

---

## Schedule: Two-Day Sprint

### Sunday April 12 (Full Day)

| Phase | Task | Est. Time | Cumulative |
|-------|------|-----------|-----------|
| 0 | Azure account setup (manual) | 20 min | 0:20 |
| 1 | Track 1: Azure AI Search | 45 min | 1:05 |
| 2 | Track 2: Semantic Kernel demo | 30 min | 1:35 |
| 3 | Architecture Decision Records (6 ADRs) | 2:00 | 3:35 |
| 4 | Architecture diagrams (5 Mermaid + overview) | 1:30 | 5:05 |
| 5 | Project evolution narrative | 1:00 | 6:05 |
| 6 | Governance and doc quality | 1:30 | 7:35 |
| -- | **Buffer for bugs, iteration, breaks** | **2:00** | **9:35** |

**Sunday goal: Core functionality + architecture docs DONE**

### Monday April 13 (Full Day - PTO)

| Phase | Task | Est. Time | Cumulative |
|-------|------|-----------|-----------|
| 7 | Update all project docs | 1:00 | 1:00 |
| 8 | IaC awareness (Bicep template) | 0:30 | 1:30 |
| 9 | Search layer caps + performance | 1:00 | 2:30 |
| 10 | QA repository cleanup | 1:00 | 3:30 |
| 11 | Verification and UAT | 0:30 | 4:00 |
| 12 | PROD repo merge and cleanup | 1:30 | 5:30 |
| 13 | Prep and dry run | 2:00 | 7:30 |
| 14 | UI polish and bug fixes | 1:30 | 9:00 |
| -- | **Buffer for iteration** | **1:00** | **10:00** |

**Monday goal: PROD deployed, clean, ready**

### Phase 13: Prep and Dry Run (2 hrs) - Monday
Practice answering the three assessment areas out loud using the ADRs and project as evidence:

**Mock questions to practice:**
1. "Walk me through a recent architectural decision and the trade-offs you considered."
2. "How would you redesign this system if you had full Azure access?"
3. "A junior engineer's React component is causing performance issues. How do you coach them?"
4. "Tell me about your experience building AI systems in production."
5. "Why did you choose this approach over [alternative]?"

**For each answer, structure as:**
- Situation (what was the problem)
- Decision (what you chose and why)
- Trade-offs (what you gave up, what you gained)
- Azure path (how this scales in an enterprise environment)

### Phase 14: UI Polish and Bug Fixes (1.5 hrs) - Monday
Dedicated time for:
- [ ] Any test failures found during UAT
- [ ] CSS tweaks for the Azure Search collapsible section
- [ ] Mobile responsiveness check for new UI elements
- [ ] Console error cleanup
- [ ] Loading state improvements

**Total estimated: ~14 hrs active work across 2 days + generous buffer**

---

## File Tree (New Files)

```
PeelAway-Logic-QA/
  docs/
    architecture/
      ARCHITECTURE.md              (overview with embedded diagrams)
      decisions/
        ADR-001-claude-over-azure-openai.md
        ADR-002-rest-over-sdk.md
        ADR-003-human-gated-pipeline.md
        ADR-004-project-evolution.md
        ADR-005-github-pages-hosting.md
        ADR-006-anti-hallucination.md
      diagrams/
        system-context.mermaid
        container-diagram.mermaid
        pipeline-data-flow.mermaid
        azure-integration.mermaid
        evolution-timeline.mermaid
      azure-resources.bicep
    PROJECT_EVOLUTION.md
    GOVERNANCE.md
  scripts/
    doc-lint.js
  src/
    services/
      azureSearchService.js
    __tests__/
      azureSearchService.test.js
  semantic-kernel-demo/
    requirements.txt
    .env.example
    README.md
    job_pipeline_sk.py
    plugins/
      job_scoring_plugin.py
      resume_parser_plugin.py
  .github/
    workflows/
      doc-quality.yml
```

---

## Talking Points Mapped to 3 Assessment Areas

### Area 1: Architectural Design ("why or why not")
- "I chose Anthropic Claude over Azure OpenAI because [ADR-001] - but I designed the SK demo to be swap-ready"
- "Client-side REST gives me zero-dependency deployment to GitHub Pages [ADR-002] - in an enterprise environment I would use the Azure SDK with managed identity"
- "Every ADR includes an Azure Migration Path section showing what changes at enterprise scale"

### Area 2: System Thinking
- "PeelAway started as disconnected Gemini Gems and evolved into an agentic pipeline through iterative architecture"
- "The pipeline uses human gates because I have trust issues with fully autonomous agents [ADR-003] - we evolved from hard gates to monitoring with flags"
- "I documented everything as coaching artifacts - ADRs, diagrams, governance docs - because the next person needs to understand WHY, not just WHAT"
- "I use the same Strangler Fig pattern at SpaceGenius to decompose a 15-year monolith"

### Area 3: AI Experience
- "346 tests with anti-hallucination prompt constraints - the tailor phase only uses content derivable from the uploaded resume"
- "Semantic Kernel demo shows the same pipeline logic working with Microsoft's AI orchestration framework"
- "PeelAway Logic is a production tool I use daily"
- "At SpaceGenius, 1.5 years of production AI: automated onboarding, PR review, backlog triage, retrospective synthesis"

---

## Priority Matrix

### MUST be done Sunday (blocks everything else)
- Phase 0: Azure account setup
- Phase 1: Azure AI Search integration
- Phase 2: Semantic Kernel demo
- Phase 3: ADRs (at least 001, 003, 006)

### MUST be done Monday (blocks readiness)
- Phase 9: Search layer caps (performance + cost, visible improvement)
- Phase 10: QA repo cleanup
- Phase 11: Verification and UAT
- Phase 12: PROD merge and cleanup (this IS the final deliverable)
- Phase 13: Dry run

### Should be done but non-blocking
- Phase 4: Diagrams (nice-to-have, shows extra effort)
- Phase 5: Evolution narrative (can reference verbally if needed)
- Phase 8: Bicep template (IaC gap mitigation)
- Phase 14: UI polish

### Can skip if time-crunched
- README badge additions (cosmetic)
- Additional test coverage for edge cases
- Mermaid diagram styling tweaks
