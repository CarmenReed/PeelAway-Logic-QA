# PeelAway Logic - Project Evolution
**Last Updated:** April 2026
**Author:** Carmen Reed
**Related:** [Architecture](architecture/ARCHITECTURE.md) | [ADRs](architecture/decisions/)

---

## Genesis: The Gemini Gems Era

The first version of PeelAway Logic wasn't a system at all. It was five separate Google Gemini Gems, one for each phase of the job search pipeline, running as disconnected conversations with no shared state between them.

The workflow went like this: paste a resume into one Gem, get a structured profile back, manually copy that output, open a different Gem, paste it in, get scored job matches, copy those results, open the tailoring Gem, paste the job description alongside the resume, and wait for a customized version. Repeat for cover letters. Every single application required this full circuit of copying, pasting, and context-switching between browser tabs.

It worked. Carmen used it daily. But each run was ephemeral; results vanished when the conversation ended. There was no version control, no test coverage, no way to compare outputs across runs. The Gems had no memory of what came before, so every session started from zero. For a single job application, this was tolerable. For a job search at scale, it was not.

## The Problem: Manual Friction at Scale

When you're applying to dozens of positions per week, fifteen minutes of copy-paste overhead per application isn't a minor inconvenience; it's a bottleneck that shapes your entire strategy. The manual workflow created three compounding problems.

First, errors propagated silently between phases. A missed skill in the resume parsing step wouldn't surface until the tailored output came back wrong, and by then the damage was done. There was no validation between phases, no way to catch a bad parse before it poisoned downstream output.

Second, results couldn't be compared across runs. Without persistence, there was no way to ask basic questions: did this job score higher than yesterday's batch? Has the tailoring quality changed since the prompt was adjusted? Every run was isolated, which made iteration feel like guessing.

Third, the cognitive load was unsustainable. The repetitive context-switching between Gems, hold this text in working memory, find the right tab, paste it in the right field, remember which version of the resume was current, was exactly the kind of executive-function tax that compounds into exhaustion. The tool was supposed to reduce friction in the job search. Instead, the tool itself had become the friction.

The Gems needed to stop being five disconnected conversations and start being a system.

## The Pivot: Claude Code and React

The decision to rebuild in React with Create React App, using Claude Code as the primary development tool and GitHub Copilot for inline questions and quick lookups, changed the trajectory of the project entirely.

The core architectural insight was that the five Gemini Gems mapped directly to a finite state machine. Scout extracts a candidate profile from a resume. Search discovers open positions. Review is a human gate; the applicant decides which jobs are worth pursuing. Complete generates customized resumes and cover letters for the approved positions, then packages everything for download. Each phase has defined inputs, defined outputs, and a clear transition to the next.

React made these phases into components. LocalStorage gave the pipeline cross-session persistence; close the browser, come back tomorrow, pick up where you left off. The Claude API replaced manual copy-paste with programmatic orchestration. What used to be five tabs and fifteen minutes became a single interface where the pipeline state flows forward automatically.

The human gate in the Review phase was a deliberate architectural choice, not a limitation. It prevents wasted API calls on low-quality matches and creates intentional friction that filters out desperation applications. This is documented in ADR-003 and has survived every refactor because it keeps working.

GitHub Pages provided zero-ops hosting. No backend servers to maintain, no infrastructure to monitor. The entire application runs client-side, which means credentials never leave the user's browser and there are no GDPR concerns about data residency. This was a constraint that became a feature.

## Growth: Tests, CI/CD, and Production Discipline

The test suite didn't start at 453 tests. It started at zero, and every test that exists was written because something broke or because something could break and the consequence was unacceptable.

Today, 453 unit and component tests span 16 test suites (Jest + React Testing Library), and 62 E2E tests run in Microsoft Playwright against a real Chromium browser, validating complete user workflows through all four pipeline phases. The tests aren't ceremonial; they enforce real invariants. Anti-hallucination regression tests verify that tailor output contains only content derivable from source material, because early versions of the pipeline would fabricate skills and embellish experience. When that's going on a real resume attached to a real application, fabrication isn't a quality issue; it's a professional and legal risk. ADR-006 documents the prompt engineering constraints that eliminated this, and the test suite ensures they stay eliminated.

GitHub Actions enforces CI on every push. Tests run, the build compiles, and nothing deploys to GitHub Pages unless the full suite passes. This isn't enterprise theater; it's the reason the pipeline has survived over fifty deployments with zero regressions. When you're using a tool daily for actual job applications, production discipline isn't optional. A broken deploy means a missed application window.

The pipeline evolved from "works on my machine" to a system with regression coverage, automated deployment, and the confidence to ship changes without holding your breath.

## Azure Integration: Enterprise Proof Points

The Azure sprint added two Microsoft AI proof points, and neither was bolted on as an afterthought. Both were architectured for swap-readiness from the start.

The first is Azure AI Search, integrated directly into the Review phase via a REST client in `azureSearchService.js`. Four operations (create index, batch index with automatic 50-document batching, full-text search with filter support, and delete), implemented as thin fetch wrappers against the Azure AI Search REST API. The decision to use direct REST calls instead of the `@azure/search-documents` SDK was deliberate: PeelAway Logic deploys to GitHub Pages, which is purely static hosting. The SDK assumes a Node.js server runtime. REST calls work from any JavaScript environment with zero dependency bloat. ADR-002 documents this decision and explicitly notes the migration path: when the application moves to a backend with Azure Functions, the swap to the SDK with managed identity is a straightforward refactor, not a rewrite.

The second is a Semantic Kernel orchestration demo in `semantic-kernel-demo/`. This reimplements the same pipeline logic — resume parsing, job scoring, tailoring — using Microsoft's production AI orchestration framework. The demo runs on OpenAI as an immediate fallback, but `AzureChatCompletion` is already coded and commented in, waiting for Azure OpenAI access approval. Custom Semantic Kernel plugins handle job scoring and resume parsing, mirroring the same phase boundaries as the React application. This wasn't a toy example grafted onto the repo for interview points. It's the same pipeline logic, proving the architecture translates to Microsoft's toolchain.

The F0 (free tier) Azure AI Search resource was chosen intentionally. It demonstrates real integration against a live Azure service without incurring cost, and the index schema, batching logic, and search operations are identical to what would run against a production S1 instance.

## Recursive Refinement: The Tool Improving Itself

There's a detail about this project that tends to land differently once you hear it: PeelAway Logic found the job it's preparing Carmen for.

The Microsoft Principal Software Engineer position was surfaced by the Scout phase during a routine search run. The Review phase scored it 9 out of 10. The Complete phase generated the customized resume. The same pipeline that Carmen built to solve her job search problem identified the specific role where the pipeline itself becomes the most relevant artifact on her resume.

This isn't a coincidence; it's a consequence of building a tool that actually works in production. When you use your own system daily, you find the edges. The anti-hallucination constraints exist because Carmen caught fabricated content in her own tailored resume. The human gate in Review exists because she caught herself applying to roles that were poor matches. The test suite exists because a broken deploy cost her a day of applications.

Decades of building software teaches you that the best systems are the ones their builders actually use. PeelAway Logic isn't a portfolio project that runs once for a demo. It runs every day. It has been refined by the person whose career depends on its output.

## Enterprise Vision: Where This Goes at Microsoft Scale

At enterprise scale, this architecture changes predictably because every architectural decision was made with the migration path in mind. The ADR directory documents these decisions explicitly, not as aspirational handwaving, but as concrete swap points with identified dependencies.

GitHub Pages becomes Azure Static Web Apps with Azure Entra ID authentication, adding identity management without changing the React application code. LocalStorage becomes Azure Cosmos DB, which shares the same document model. The shape of the data doesn't change, only where it lives, enabling multi-device access and persistent pipeline state across sessions. Client-side Claude API calls move behind Azure Functions with Azure OpenAI and managed identity, eliminating client-side credential handling entirely. The manual human gates in Review gain Azure Monitor observability and Logic Apps for async approval workflows, preserving the intentional friction while adding auditability. GitHub Actions migrates to Azure DevOps with policy enforcement and audit trails appropriate for enterprise governance.

None of these migrations require a rewrite. Each layer can be swapped independently because the boundaries between them were drawn with this migration in mind. The Bicep template in `docs/architecture/azure-resources.bicep` isn't aspirational; it's the infrastructure-as-code definition for the target deployment.

This is what decades of building systems teaches you. Not that you should over-engineer for a future that may never arrive, but that you should draw your boundaries in the places where change is most likely to occur. The change points in PeelAway Logic, storage, compute, identity, AI provider, CI/CD, are exactly the dimensions along which a personal tool scales to an enterprise system. That alignment is not accidental.
