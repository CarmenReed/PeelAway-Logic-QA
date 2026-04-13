# ADR-006: Anti-hallucination prompt engineering strategy

**Date:** April 12, 2026
**Status:** Accepted
**Author:** Carmen Reed

## Context

Early versions allowed Claude to invent job requirements not present in the posting, fabricate skills from resume context, and embellish cover letters with experience that wasn't stated. This created legal and professional risk if applied to real applications.

## Decision

Implement hard grounding constraints on all tailor and cover letter prompts: instructions explicitly state "Only use information explicitly stated in the provided text. Do not infer, assume, or add information not present in the source material." The constraint is included in every prompt that generates resume or cover letter content.

## Consequences

**Benefits:**
- 453 unit/component tests (Jest) and 62 E2E tests (Playwright) include specific anti-hallucination regression tests that verify output only contains derivable content.
- Zero fabrication incidents in production use since implementation.
- Demonstrates responsible AI engineering to interviewers.

**Trade-offs:**
- Slightly more conservative output.
- May miss valid inferences a human recruiter would make.
- Requires more complete source material as input.

## Azure Migration Path

> At Microsoft scale with full Azure access, this would change as follows:

Augment with Azure AI Content Safety API for automated output validation. Add RAG grounding check: verify tailored resume claims are traceable to specific chunks of the source resume (Azure AI Search as the grounding store). This is the enterprise pattern for verifiable, auditable AI output.
