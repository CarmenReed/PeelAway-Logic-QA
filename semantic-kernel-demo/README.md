# PeelAway Logic - Semantic Kernel Demo

Semantic Kernel orchestration of the PeelAway Logic job scoring pipeline. This demo mirrors the same multi-phase, human-gated logic as the production React application, using Microsoft's Semantic Kernel framework for AI orchestration.

## How It Maps to the React App

| React Phase | SK Plugin / Function | What It Does |
|---|---|---|
| **Upload Resume** | `ResumeParser.extract_key_skills` | Extracts tech skills and role titles from resume text |
| **Upload Resume** | `ResumeParser.extract_experience_level` | Determines seniority (junior → principal) |
| **Scout (Search)** | Sample data (SAMPLE_JOBS) | In production, this would call job board APIs |
| **Review (Score)** | `JobScoring.score_job_against_resume` | Scores each job 0-10 with tier classification |
| **Review (Filter)** | `JobScoring.filter_by_freshness` | Removes stale postings beyond N days |
| **Review (Dedup)** | `JobScoring.deduplicate_jobs` | Removes duplicate title+company entries |
| **Tailor** | Phase 3 human gate | Filters to score ≥ 8 for document tailoring |

## Setup

```bash
cd semantic-kernel-demo
pip install -r requirements.txt
cp .env.example .env
# Edit .env and add your OpenAI API key
```

## Run

> **Note:** Always use the venv Python, not system Python.
> Python 3.13 venv is required — Python 3.14 lacks pydantic-core wheels at this time.

```bash
# Windows (required — system Python may lack pydantic-core wheels)
.venv\Scripts\python.exe job_pipeline_sk.py

# macOS/Linux
.venv/bin/python job_pipeline_sk.py
```

Expected output:
```
=== PeelAway Logic - Semantic Kernel Pipeline Demo ===

Phase 1: Extracting resume signals...
  Skills: ["Azure", "AI", "C#", ".NET Core", "SQL Server", "REST APIs", ...]
  Level:  principal

Phase 2: Scoring jobs against resume...
  🟢 Principal AI Architect @ Contoso Corp: 10/10
  🔴 Senior Software Engineer @ Fabrikam Inc: 4/10
  🟢 Staff AI Engineer @ Northwind Traders: 9/10

Phase 3: Human Gate - 2/3 jobs approved for tailoring
```

## Azure OpenAI

The code is already wired for Azure OpenAI. When your Azure OpenAI resource is provisioned:

1. Edit `.env` with your Azure OpenAI endpoint, key, and deployment name
2. In `job_pipeline_sk.py`, uncomment lines 43-48 (AzureChatCompletion) and comment out lines 51-55 (OpenAIChatCompletion)

No other code changes required.

## Why Semantic Kernel

- **Microsoft's production-grade AI orchestration framework** — same team behind Azure AI Foundry
- **Plugin architecture** mirrors PeelAway's modular phase design
- **Native Azure OpenAI support** with one-line swap from OpenAI
- **Function calling, planners, and agents** for future agentic pipeline expansion
- **Enterprise-ready** — used in Microsoft 365 Copilot, GitHub Copilot, and Azure AI services
