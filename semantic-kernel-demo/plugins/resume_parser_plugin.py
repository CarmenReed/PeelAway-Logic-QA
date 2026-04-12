"""
Resume Parser Plugin for Semantic Kernel
Extracts structured signals from resume text for scoring alignment.
"""

import json
import re
from semantic_kernel.functions import kernel_function


class ResumeParserPlugin:
    """Extracts skills, role titles, and seniority from resume text."""

    @kernel_function(
        name="extract_key_skills",
        description="Extract top technical skills and role titles from resume text. Return JSON array of strings.",
    )
    def extract_key_skills(self, resume_text: str) -> str:
        """
        Pattern-based skill extraction. Looks for known tech keywords
        and role titles explicitly present in the resume text.
        """
        tech_patterns = [
            "Azure", "AI", "C#", ".NET", ".NET Core", "SQL Server", "REST APIs",
            "RAG", "LLM", "Semantic Kernel", "Python", "React", "Node.js",
            "PCI Compliance", "Agentic AI", "Claude API", "Anthropic",
            "T-SQL", "SOAP", "WorldPay", "Payment Gateway",
        ]

        role_patterns = [
            "Principal", "Architect", "Solutions Architect", "AI Architect",
            "Staff Engineer", "Senior Engineer", "Lead Engineer",
        ]

        text_lower = resume_text.lower()
        found_skills = []

        for skill in tech_patterns:
            if skill.lower() in text_lower:
                found_skills.append(skill)

        for role in role_patterns:
            if role.lower() in text_lower:
                found_skills.append(f"Role: {role}")

        return json.dumps(found_skills)

    @kernel_function(
        name="extract_experience_level",
        description="Determine seniority level from resume. Return one of: junior, mid, senior, principal, staff",
    )
    def extract_experience_level(self, resume_text: str) -> str:
        """
        Determines seniority from explicit titles and years of experience.
        Prioritizes explicit title mentions over inferred years.
        """
        text_lower = resume_text.lower()

        # Check explicit title mentions first (highest priority)
        if "principal" in text_lower:
            return "principal"
        if "staff" in text_lower:
            return "staff"

        # Check years of experience
        years_match = re.search(r"(\d+)\+?\s*years?\s*(?:of\s+)?experience", text_lower)
        if years_match:
            years = int(years_match.group(1))
            if years >= 15:
                return "principal"
            if years >= 10:
                return "staff"
            if years >= 5:
                return "senior"
            if years >= 2:
                return "mid"
            return "junior"

        # Check title keywords as fallback
        if "senior" in text_lower or "lead" in text_lower:
            return "senior"
        if "junior" in text_lower or "entry" in text_lower:
            return "junior"

        return "mid"
