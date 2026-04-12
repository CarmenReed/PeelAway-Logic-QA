# ADR-004: From disconnected Gemini Gems to unified agentic React pipeline

**Date:** April 12, 2026
**Status:** Accepted
**Author:** Carmen Reed

## Context

PeelAway Logic v1 consisted of 5 separate Gemini Gems, each handling one pipeline phase. Each run required manual copy-paste between phases with no state continuity. Resume context was re-pasted for every phase. No tests, no versioning, no reproducibility.

## Decision

Rebuild as a unified React application with a 4-phase pipeline state machine, persistent localStorage state, 346+ unit tests, GitHub Actions CI/CD, and a real test suite that can catch regressions.

## Consequences

**Benefits:**
- End-to-end automated flow with persistent state.
- Fully testable and demonstrable to technical panels.
- Version-controlled with git history showing architectural evolution.

**Trade-offs:**
- 6-week rebuild from scratch.
- Lost the simplicity of the Gem-per-phase approach.
- Introduced JavaScript dependency surface.

## Azure Migration Path

> At Microsoft scale with full Azure access, this would change as follows:

Migrate state persistence from localStorage to Azure Cosmos DB (free tier) for multi-device access and persistent pipeline history. Replace GitHub Pages with Azure Static Web Apps for built-in auth via Azure Entra ID and managed API backend via Azure Functions.
