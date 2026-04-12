# ADR-005: Why GitHub Pages over Azure Static Web Apps

**Date:** April 12, 2026
**Status:** Accepted
**Author:** Carmen Reed

## Context

PeelAway Logic needs to be publicly accessible for portfolio demos without infrastructure cost or maintenance overhead. The app is a React SPA (Create React App) with no server-side processing requirements at this stage.

## Decision

Deploy to GitHub Pages via GitHub Actions (build + deploy on push to main). Free, zero maintenance, professional URL (carmenreed.github.io/PeelAway-Logic), instant deployment.

## Consequences

**Benefits:**
- Free indefinitely. Zero infrastructure management.
- Deployment in under 2 minutes on push.
- No Azure subscription required for the portfolio use case.

**Trade-offs:**
- No server-side processing.
- No secrets management at runtime.
- API keys must be user-entered via UI.
- No built-in auth.

## Azure Migration Path

> At Microsoft scale with full Azure access, this would change as follows:

Migrate to Azure Static Web Apps (free tier) to add: managed API backend via Azure Functions, Azure Key Vault integration for secrets, Azure Entra ID authentication. The GitHub Actions workflow change is minimal - replace gh-pages action with Azure Static Web Apps action. API keys move from UI input to Key Vault references.
