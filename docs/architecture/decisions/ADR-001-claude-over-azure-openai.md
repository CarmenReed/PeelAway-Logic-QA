# ADR-001: Why Anthropic Claude over Azure OpenAI (with Azure OpenAI swap-ready design)

**Date:** April 12, 2026
**Status:** Accepted
**Author:** Carmen Reed

## Context

PeelAway Logic needed an LLM for job scoring, resume tailoring, and cover letter generation. Azure OpenAI requires approved access and subscription provisioning which was not available at demo build time. Anthropic Claude API is immediately accessible with a single key. However, the panel interview context required demonstrating Azure platform fluency.

## Decision

Use Anthropic Claude (claude-sonnet) as the primary LLM. Design all prompt calls through an abstracted api.js layer using a consistent interface so the underlying model is swappable without changing callers. The Semantic Kernel demo (semantic-kernel-demo/) uses AzureChatCompletion commented in, showing exactly how the swap works.

## Consequences

**Benefits:**
- Zero provisioning friction. Immediate deployment.
- Claude excels at structured JSON output needed for job scoring.
- Azure-swap-ready design proves architectural thinking over tool loyalty.

**Trade-offs:**
- Not Azure-native by default.
- API keys managed client-side rather than via managed identity.

## Azure Migration Path

> At Microsoft scale with full Azure access, this would change as follows:

Replace OpenAI calls in api.js with Azure OpenAI SDK. Add DefaultAzureCredential with managed identity - remove API keys entirely. Estimated migration: 30-minute swap in api.js. The Semantic Kernel demo already has AzureChatCompletion coded; just comment-swap the service registration.
