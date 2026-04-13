# PeelAway Logic: Architecture

## Overview

PeelAway Logic is an AI-powered job search pipeline built as a React 18 single-page application (Create React App), deployed to GitHub Pages. It orchestrates a 4-phase workflow (Scout, Search, Review, Complete) that transforms a resume and keywords into scored job matches and tailored application materials, using Anthropic Claude (claude-sonnet) for AI scoring and content generation with all state persisted in localStorage. The current sprint adds Azure AI Search integration and a standalone Semantic Kernel demo as enterprise proof-of-concept extensions.

## System Context

```mermaid
C4Context
    title PeelAway Logic — System Context (C4 Level 1)

    Person(user, "Job Seeker", "Uploads resume, reviews scored jobs, exports tailored applications")

    System(peelaway, "PeelAway Logic", "React 18 SPA (Create React App)<br/>4-phase job search pipeline")

    System_Ext(claude, "Anthropic Claude API", "claude-sonnet via client-side fetch<br/>Scoring + tailoring + web search")
    System_Ext(adzuna, "Adzuna API", "Job listings (structured REST)")
    System_Ext(jsearch, "JSearch API", "Job listings (RapidAPI)")
    System_Ext(rss, "RSS Feeds", "Job board syndication")
    System_Ext(azure, "Azure AI Search", "peelaway-search index (F0 tier)<br/>Optional, user-connects")

    Rel(user, peelaway, "Uses")
    Rel(peelaway, claude, "Scores jobs, tailors resumes, web search")
    Rel(peelaway, adzuna, "Fetches job listings")
    Rel(peelaway, jsearch, "Fetches job listings")
    Rel(peelaway, rss, "Parses job feeds")
    Rel(peelaway, azure, "Indexes & queries scored jobs")

    UpdateLayoutConfig($c4ShapeInRow="3", $c4BoundaryInRow="1")
```

## Container Diagram

```mermaid
C4Container
    title PeelAway Logic — Container Diagram (C4 Level 2)

    Person(user, "Job Seeker")

    System_Boundary(spa, "PeelAway Logic React SPA") {
        Container(scout, "Scout Phase", "React Component", "Job search: Adzuna, JSearch, RSS, Claude web search<br/>Cap 10 results per source")
        Container(review, "Review Phase", "React Component", "Claude scores jobs (Strong/Possible/Weak)<br/>Human gate: explicit approval<br/>Optional Azure Search indexing")
        Container(complete, "Complete Phase", "React Component", "Claude tailors resume and cover letter to approved jobs<br/>Anti-hallucination constraints<br/>Export PDF/TXT")
        ContainerDb(storage, "Pipeline State", "localStorage", "Jobs, scores, resumes, tracking data")
        Container(azureService, "azureSearchService.js", "Azure REST Client", "Index/query Azure AI Search<br/>REST calls, no SDK")
    }

    System_Boundary(sk, "Semantic Kernel Demo") {
        Container(skDemo, "semantic-kernel-demo/", "Python (standalone)", "SK Plugins: JobScoring, ResumeParser<br/>OpenAI fallback, Azure OpenAI swap-ready")
    }

    System_Ext(claude, "Anthropic Claude API", "claude-sonnet")
    System_Ext(adzuna, "Adzuna API", "Job listings")
    System_Ext(jsearch, "JSearch API", "Job listings")
    System_Ext(rss, "RSS Feeds", "Job sources")
    System_Ext(azure, "Azure AI Search", "peelaway-search (F0)")
    System_Ext(ghPages, "GitHub Pages", "Static hosting via GitHub Actions CI/CD")

    Rel(user, scout, "Enters keywords")
    Rel(scout, review, "Passes fetched jobs")
    Rel(review, complete, "Passes approved jobs")

    Rel(scout, adzuna, "Fetches jobs")
    Rel(scout, jsearch, "Fetches jobs")
    Rel(scout, rss, "Parses feeds")
    Rel(scout, claude, "Web search")
    Rel(review, claude, "Scores jobs")
    Rel(review, azureService, "Indexes scored jobs")
    Rel(complete, claude, "Tailors resume and cover letter")
    Rel(azureService, azure, "REST API calls")
    Rel(scout, storage, "Persists state")
    Rel(review, storage, "Persists state")
    Rel(complete, storage, "Persists state")
    Rel(skDemo, claude, "Uses Claude API")

    UpdateLayoutConfig($c4ShapeInRow="3", $c4BoundaryInRow="2")
```

## Pipeline Data Flow

```mermaid
flowchart LR
    Keywords["🔍 Keywords<br/>(User Input)"]

    subgraph Scout["Scout Phase"]
        Adzuna["Adzuna API<br/>(cap 10)"]
        JSearch["JSearch API<br/>(cap 10)"]
        RSS["RSS Feeds<br/>(cap 10)"]
        WebSearch["Claude Web Search<br/>(cap 10)"]
        Dedup["Deduplicate<br/>& Combine"]
        Adzuna --> Dedup
        JSearch --> Dedup
        RSS --> Dedup
        WebSearch --> Dedup
    end

    subgraph Review["Review Phase"]
        Score["Claude Scores<br/>(claude-sonnet)"]
        Tier["Tier Classification<br/>Strong: 8-10<br/>Possible: 6-7<br/>Weak: 3-5"]
        Gate["🚦 Human Gate<br/>(Explicit Approval)"]
        AzureIdx["Azure AI Search<br/>(Optional Index)"]
        Score --> Tier
        Tier --> Gate
        Tier -.->|optional| AzureIdx
    end

    subgraph Complete["Complete Phase"]
        TailorResume["Claude Tailors Resume<br/>(claude-sonnet)"]
        GenCL["Generate Cover Letter<br/>(claude-sonnet)"]
        Constraints["Anti-Hallucination<br/>Constraints:<br/>• No invented experience<br/>• No false credentials<br/>• Skills from resume only"]
        TailorResume --- Constraints
        TailorResume --> GenCL
    end

    Export["📥 Export<br/>PDF + TXT<br/>localStorage tracking"]

    Keywords --> Scout
    Dedup --> Score
    Gate -->|Approved jobs| TailorResume
    GenCL --> Export

    classDef input fill:#FFE6CC,stroke:#D68910,color:#000,stroke-width:2px
    classDef phase fill:#D4E8FF,stroke:#2E5C8A,color:#000,stroke-width:2px
    classDef ai fill:#E8D5FF,stroke:#9013FE,color:#000,stroke-width:2px
    classDef gate fill:#FFE6D5,stroke:#E67E22,color:#000,stroke-width:2px
    classDef azure fill:#C2E0FF,stroke:#0078D4,color:#000,stroke-width:2px
    classDef output fill:#D4EDDA,stroke:#5FA319,color:#000,stroke-width:2px
    classDef constraint fill:#FFF3CD,stroke:#D68910,color:#000,stroke-width:1px

    class Keywords input
    class Adzuna,JSearch,RSS,WebSearch,Dedup phase
    class Score,TailorResume,GenCL ai
    class Tier phase
    class Gate gate
    class AzureIdx azure
    class Export output
    class Constraints constraint
```

## Azure Integration

```mermaid
flowchart TB
    subgraph ReactApp["React SPA (PeelAway Logic)"]
        ReviewPhase["Review Phase"]
        AzureClient["azureSearchService.js<br/>(REST client, no SDK)"]
        ReviewPhase -->|indexes scored jobs| AzureClient
    end

    subgraph AzureCloud["Azure AI Search"]
        SearchService["peelaway-search<br/>(F0 Free Tier)"]
        Index["Search Index<br/>(job profiles + scores)"]
        Query["Semantic Query<br/>(BM25 + vector ranking)"]
        SearchService --> Index
        SearchService --> Query
    end

    AzureClient -->|"REST API (api-key auth)"| SearchService

    subgraph SKDemo["semantic-kernel-demo/ (Python, standalone)"]
        SKApp["Semantic Kernel App"]
        JobPlugin["SK Plugin:<br/>JobScoring"]
        ResumePlugin["SK Plugin:<br/>ResumeParser"]
        SKApp --> JobPlugin
        SKApp --> ResumePlugin
    end

    subgraph AIProviders["AI Providers"]
        OpenAI["OpenAI API<br/>(current fallback)"]
        AzureOpenAI["Azure OpenAI<br/>(swap-ready)"]
    end

    SKApp -->|"currently using"| OpenAI
    SKApp -.->|"swap-ready"| AzureOpenAI

    note1["⚠️ Azure OpenAI: swap-ready,<br/>currently using OpenAI fallback.<br/>Config change only — no code changes needed."]

    classDef react fill:#61DAFB,stroke:#21A0C4,color:#000,stroke-width:2px
    classDef azure fill:#0078D4,stroke:#004B7A,color:#fff,stroke-width:2px
    classDef sk fill:#9013FE,stroke:#6B0BAA,color:#fff,stroke-width:2px
    classDef ai fill:#F5A623,stroke:#D68910,color:#fff,stroke-width:2px
    classDef note fill:#FFF3CD,stroke:#D68910,color:#000,stroke-width:1px

    class ReviewPhase,AzureClient react
    class SearchService,Index,Query azure
    class SKApp,JobPlugin,ResumePlugin sk
    class OpenAI,AzureOpenAI ai
    class note1 note
```

## Evolution Timeline

```mermaid
timeline
    title PeelAway Logic — Evolution Timeline

    section v0 — Gemini Gems
        Origin : 5 disconnected Gemini Gems prompts
               : Manual copy-paste between steps
               : No orchestration or state

    section v1 — Claude Code + React SPA
        Unified Pipeline : Claude Code builds React 18 SPA (Create React App)
                         : 4-phase pipeline (Scout → Search → Review → Complete)
                         : localStorage for pipeline state
                         : Client-side Claude API (claude-sonnet)

    section v2 — Tests + CI/CD + GitHub Pages
        Production Ready : 453 tests across 16 suites (Jest + RTL)
                         : 62 E2E tests (Microsoft Playwright + Chromium)
                         : GitHub Actions CI/CD pipeline
                         : Deployed to GitHub Pages

    section v3 — Azure AI Search + Semantic Kernel (Current Sprint)
        Azure Integration : Azure AI Search (peelaway-search, F0)
                          : azureSearchService.js (REST, no SDK)
                          : Semantic Kernel demo (Python, standalone)
                          : Architecture documentation + ADRs

    section Enterprise Vision
        Future State : Azure Static Web Apps (CDN + serverless)
                     : Cosmos DB (replace localStorage)
                     : Azure OpenAI (swap from Anthropic Claude)
                     : Key Vault (centralized secrets)
                     : Bicep IaC (reproducible infrastructure)
```

## Key Architectural Decisions

- [ADR-001: Claude over Azure OpenAI](decisions/ADR-001-claude-over-azure-openai.md): Why Anthropic Claude is the primary AI provider
- [ADR-002: REST over SDK](decisions/ADR-002-rest-over-sdk.md): Why Azure AI Search uses direct REST calls, not the Azure SDK
- [ADR-003: Human-Gated Pipeline](decisions/ADR-003-human-gated-pipeline.md): Why the Review phase requires explicit human approval
- [ADR-004: Project Evolution](decisions/ADR-004-project-evolution.md): How the system evolved from Gemini Gems to React SPA
- [ADR-005: GitHub Pages Hosting](decisions/ADR-005-github-pages-hosting.md): Why GitHub Pages over Azure Static Web Apps (for now)
- [ADR-006: Anti-Hallucination Constraints](decisions/ADR-006-anti-hallucination.md): How tailoring prevents fabricated experience
