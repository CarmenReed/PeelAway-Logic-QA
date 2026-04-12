# ADR-003: Human-gated pipeline vs fully autonomous agents

**Date:** April 12, 2026
**Status:** Accepted
**Author:** Carmen Reed

## Context

Early PeelAway versions auto-applied all AI scoring and tailoring output. The tailor and cover letter phases made incorrect assumptions about job requirements and occasionally fabricated experience. User trust eroded after seeing tailored resumes that misrepresented the source material.

## Decision

Implement explicit human approval gates before Phase 2 (tailoring) and Phase 3 (cover letter generation). Users must review scored jobs and approve before tailoring proceeds. Gates are UI checkpoints, not automated thresholds.

## Consequences

**Benefits:**
- Prevents compounding hallucination errors downstream.
- User maintains agency and can catch AI errors before they propagate.
- Reviewable output at each stage.
- Aligns with responsible AI deployment principles.

**Trade-offs:**
- Slower than fully autonomous pipeline.
- Requires user presence.
- Cannot run unattended overnight batch jobs.

## Azure Migration Path

> At Microsoft scale with full Azure access, this would change as follows:

Replace hard UI gates with Azure Monitor alerts and async approval workflow via Logic Apps. High-confidence scores (above configurable threshold) proceed autonomously. Low-confidence items trigger email/Teams notification for human review. Audit log in Cosmos DB. This is the enterprise pattern for human-in-the-loop AI at scale.
