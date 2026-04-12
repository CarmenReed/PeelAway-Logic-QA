# ADR-002: Why client-side REST calls over the Azure Search SDK

**Date:** April 12, 2026
**Status:** Accepted
**Author:** Carmen Reed

## Context

PeelAway Logic deploys to GitHub Pages (purely static hosting). The @azure/search-documents SDK assumes a Node.js server runtime. Client-side JavaScript can call Azure AI Search REST APIs directly via fetch() without any server.

## Decision

Use direct REST API calls (fetch) for all Azure AI Search operations rather than the @azure/search-documents npm package. All four operations (create index, batch index, search, delete) implemented as thin fetch wrappers in azureSearchService.js.

## Consequences

**Benefits:**
- Zero dependency bloat. No bundler configuration changes.
- Deployable to any static host.
- Teaches the underlying HTTP protocol Azure SDKs abstract away - valuable for debugging and interviews.

**Trade-offs:**
- Verbose request construction.
- Must manually track API versions.
- No automatic retry logic.

## Azure Migration Path

> At Microsoft scale with full Azure access, this would change as follows:

In a Node.js or Azure Functions backend, replace azureSearchService.js with @azure/search-documents SDK using DefaultAzureCredential. Eliminates API key handling entirely. The function signatures stay identical - callers don't change.
