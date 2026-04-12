"""
PeelAway Logic - Semantic Kernel Orchestration Demo
Demonstrates Microsoft Semantic Kernel orchestrating the PeelAway job scoring pipeline.
Mirrors the same multi-phase logic as the React application using SK plugins and functions.
"""

import asyncio
import json
import os
from dotenv import load_dotenv
import semantic_kernel as sk
from semantic_kernel.connectors.ai.open_ai import OpenAIChatCompletion, AzureChatCompletion
from semantic_kernel.functions import KernelArguments

load_dotenv()

SAMPLE_JOBS = [
    {"id": "job-001", "title": "Principal AI Architect", "company": "Contoso Corp",
     "location": "Remote US", "description": "Lead AI strategy and Azure OpenAI integrations. Requires C#/.NET, Azure AI Foundry, Semantic Kernel experience. 10+ years.", "posted": "2026-04-10"},
    {"id": "job-002", "title": "Senior Software Engineer", "company": "Fabrikam Inc",
     "location": "Remote US", "description": "React and Node.js development. No AI experience required.", "posted": "2026-04-08"},
    {"id": "job-003", "title": "Staff AI Engineer", "company": "Northwind Traders",
     "location": "Hybrid - Tampa, FL", "description": "Build RAG pipelines and agentic systems. Azure, Python, LLM orchestration. PCI compliance experience a plus.", "posted": "2026-04-11"}
]

SAMPLE_RESUME = """
Carmen Reed - Principal AI / Solutions Architect
Decades of experience. Specializations: Agentic AI, RAG pipelines, LLM integration,
Azure, C#/.NET Core, SQL Server, REST APIs, PCI Compliance.
Built PeelAway Logic: production agentic job search pipeline (React, Anthropic Claude API,
multi-phase human-gated pipeline, anti-hallucination prompt engineering, 15-file test suite).
Legacy modernization: NMI payment gateway PCI extraction, WorldPay/Tiba SOAP migration,
T-SQL-to-REST decoupling. Remote US or Tampa Bay, FL.
"""

async def main():
    kernel = sk.Kernel()

    # Azure OpenAI (comment in when Azure OpenAI access approved)
    # kernel.add_service(AzureChatCompletion(
    #     service_id="scorer",
    #     deployment_name=os.getenv("AZURE_OPENAI_DEPLOYMENT"),
    #     endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
    #     api_key=os.getenv("AZURE_OPENAI_KEY"),
    # ))

    # Standard OpenAI (active fallback)
    kernel.add_service(OpenAIChatCompletion(
        service_id="scorer",
        ai_model_id=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
        api_key=os.getenv("OPENAI_API_KEY"),
    ))

    from plugins.job_scoring_plugin import JobScoringPlugin
    from plugins.resume_parser_plugin import ResumeParserPlugin

    kernel.add_plugin(JobScoringPlugin(), plugin_name="JobScoring")
    kernel.add_plugin(ResumeParserPlugin(), plugin_name="ResumeParser")

    print("=== PeelAway Logic - Semantic Kernel Pipeline Demo ===\n")

    print("Phase 1: Extracting resume signals...")
    skills_result = await kernel.invoke(
        plugin_name="ResumeParser",
        function_name="extract_key_skills",
        arguments=KernelArguments(resume_text=SAMPLE_RESUME))
    level_result = await kernel.invoke(
        plugin_name="ResumeParser",
        function_name="extract_experience_level",
        arguments=KernelArguments(resume_text=SAMPLE_RESUME))
    print(f"  Skills: {skills_result}")
    print(f"  Level:  {level_result}\n")

    print("Phase 2: Scoring jobs against resume...")
    scored_jobs = []
    for job in SAMPLE_JOBS:
        result = await kernel.invoke(
            plugin_name="JobScoring",
            function_name="score_job_against_resume",
            arguments=KernelArguments(job_title=job["title"], company=job["company"],
                            job_description=job["description"], resume_text=SAMPLE_RESUME))
        parsed = json.loads(str(result))
        scored_jobs.append({**job, **parsed})
        tier_emoji = "\U0001f7e2" if parsed["tier"] == "strong" else "\U0001f7e1" if parsed["tier"] == "possible" else "\U0001f534"
        print(f"  {tier_emoji} {job['title']} @ {job['company']}: {parsed['score']}/10")

    approved = [j for j in scored_jobs if j["score"] >= 8]
    print(f"\nPhase 3: Human Gate - {len(approved)}/{len(scored_jobs)} jobs approved for tailoring\n")
    print("Pipeline complete. Swap AzureChatCompletion in when Azure OpenAI is provisioned.")

if __name__ == "__main__":
    asyncio.run(main())
