"""
Job Scoring Plugin for Semantic Kernel
Mirrors PeelAway Logic's multi-signal scoring pipeline.
"""

import json
from datetime import datetime, timedelta
from semantic_kernel.functions import kernel_function


class JobScoringPlugin:
    """Scores and filters job postings against a candidate resume."""

    @kernel_function(
        name="score_job_against_resume",
        description="Score a job posting 0-10 against a candidate resume. Return JSON with score and reason.",
    )
    def score_job_against_resume(
        self,
        job_title: str,
        company: str,
        job_description: str,
        resume_text: str,
    ) -> str:
        """
        Deterministic scoring that mirrors PeelAway's actual logic:
        - Title/role alignment (Principal, Architect, Senior, Staff, Lead)
        - Remote/hybrid location match
        - Tech stack overlap (Azure, AI, C#, .NET, SQL, REST APIs)
        - Anti-hallucination: only score based on what is explicitly stated
        """
        score = 0
        reasons = []
        desc_lower = job_description.lower()
        title_lower = job_title.lower()
        resume_lower = resume_text.lower()

        # --- Title/role alignment (max 3 points) ---
        seniority_keywords = ["principal", "architect", "senior", "staff", "lead", "director"]
        title_matches = [kw for kw in seniority_keywords if kw in title_lower and kw in resume_lower]
        if title_matches:
            score += min(len(title_matches), 3)
            reasons.append(f"Title alignment: {', '.join(title_matches)}")

        # --- Tech stack overlap (max 4 points) ---
        tech_keywords = [
            "azure", "ai", "c#", ".net", "sql", "rest api", "rag",
            "semantic kernel", "llm", "python", "pci", "agentic",
        ]
        tech_matches = [kw for kw in tech_keywords if kw in desc_lower and kw in resume_lower]
        tech_score = min(len(tech_matches), 4)
        if tech_score > 0:
            score += tech_score
            reasons.append(f"Tech overlap ({len(tech_matches)}): {', '.join(tech_matches[:5])}")

        # --- Location match (max 2 points) ---
        if "remote" in desc_lower and "remote" in resume_lower:
            score += 2
            reasons.append("Remote match")
        elif "hybrid" in desc_lower and ("tampa" in desc_lower and "tampa" in resume_lower):
            score += 2
            reasons.append("Hybrid location match (Tampa)")
        elif "hybrid" in desc_lower:
            score += 1
            reasons.append("Hybrid - partial location match")

        # --- Experience level (max 1 point) ---
        if "10+" in desc_lower or "15+" in desc_lower or "senior" in desc_lower:
            if "decades" in resume_lower or "principal" in resume_lower:
                score += 1
                reasons.append("Experience level exceeds requirement")

        # Clamp to 0-10
        score = max(0, min(10, score))

        # Determine tier
        if score >= 8:
            tier = "strong"
        elif score >= 5:
            tier = "possible"
        else:
            tier = "weak"

        if not reasons:
            reasons.append("No explicit alignment signals found in job description")

        return json.dumps({
            "score": score,
            "reason": "; ".join(reasons),
            "tier": tier,
        })

    @kernel_function(
        name="filter_by_freshness",
        description="Filter job postings to only those posted within max_days_old days. Return filtered JSON array.",
    )
    def filter_by_freshness(self, jobs_json: str, max_days_old: int) -> str:
        """Filter jobs by posted date freshness."""
        try:
            jobs = json.loads(jobs_json)
        except json.JSONDecodeError:
            return "[]"

        cutoff = datetime.now() - timedelta(days=int(max_days_old))
        filtered = []
        for job in jobs:
            posted = job.get("posted") or job.get("date_posted")
            if not posted:
                continue
            try:
                posted_dt = datetime.fromisoformat(posted)
                if posted_dt >= cutoff:
                    filtered.append(job)
            except ValueError:
                continue

        return json.dumps(filtered)

    @kernel_function(
        name="deduplicate_jobs",
        description="Remove duplicate job postings by title+company combination. Return deduplicated JSON array.",
    )
    def deduplicate_jobs(self, jobs_json: str) -> str:
        """Deduplicate jobs by normalized title+company key."""
        try:
            jobs = json.loads(jobs_json)
        except json.JSONDecodeError:
            return "[]"

        seen = set()
        unique = []
        for job in jobs:
            key = f"{(job.get('title') or '').lower().strip()}|{(job.get('company') or '').lower().strip()}"
            if key not in seen:
                seen.add(key)
                unique.append(job)

        return json.dumps(unique)
