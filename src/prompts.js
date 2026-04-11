// prompts.js
// All LLM prompt builders

export const TAILOR_SYSTEM = `You are a professional resume writer. Return valid JSON only. No preamble, no markdown fences, no explanation outside the JSON.

ANTI-HALLUCINATION DIRECTIVE (core requirement):
- NEVER invent skills, experience, or technologies the candidate does not have
- NEVER exaggerate proficiency levels
- NEVER add fake certifications
- NEVER fabricate metrics, team sizes, or impact numbers not stated in the profile
- NEVER use AI marketing language: no "passionate", "innovative", "cutting-edge", "dynamic", "synergy"
- NEVER add content if the profile is incomplete, return an error field instead
- Only draw from what is explicitly stated in the candidate profile

OUTPUT RULES:
- No em-dashes anywhere in the output
- No hyphens used as dashes (use commas or restructure the sentence)
- No AI fluff or superlatives
- ATS-proof formatting: clear section headings, no special characters, no tables
- One page maximum for the resume
- Human-engineer tone: direct, factual, specific`;

export function buildTailorPrompt(profileText, job) {
  return `Generate a tailored resume and cover letter for the candidate below, targeting the specified role.

CANDIDATE PROFILE (extracted from uploaded resume):
${profileText}

TARGET ROLE:
Title: ${job.title}
Company: ${job.company}
Location: ${job.location}
Full Job Description:
${job.jd_text || "Not available, tailor based on metadata only"}
Key Tech Stack: ${Array.isArray(job.key_tech_stack) ? job.key_tech_stack.join(", ") : "not specified"}
Scoring Reasoning: ${job.reasoning}

RESUME STRUCTURE:
PROFESSIONAL SUMMARY: 2-3 sentences tailored to this specific role. No fluff.
CORE COMPETENCIES: Skills matching this job posting. Only include skills the candidate actually has.
PROFESSIONAL EXPERIENCE: Each role with title, company, dates, bullet points. Use quantified impact only where the profile supports it. Do not invent numbers.
EDUCATION: As stated in the profile.

COVER LETTER STRUCTURE:
Paragraph 1: Why this role, brief connection to the company.
Paragraph 2: 1-2 specific examples from the candidate's actual background matching role requirements.
Paragraph 3: Why the candidate's tech stack and domain experience fit this role.
Paragraph 4: Professional call to action and sign-off.

Return this exact JSON with no other text:
{
  "job_title": "${job.title}",
  "company": "${job.company}",
  "resume": "full resume text here",
  "cover_letter": "full cover letter text here"
}`;
}

export function buildResumeOnlyPrompt(profileText, job) {
  return `Generate a tailored resume for the candidate below targeting the specified role.

CANDIDATE PROFILE:
${profileText}

TARGET ROLE:
Title: ${job.title}
Company: ${job.company}
Location: ${job.location}
Full Job Description:
${job.jd_text || "Not available, tailor based on metadata only"}
Key Tech Stack: ${Array.isArray(job.key_tech_stack) ? job.key_tech_stack.join(", ") : "not specified"}
Scoring Reasoning: ${job.reasoning}

RESUME STRUCTURE:
PROFESSIONAL SUMMARY: 2-3 sentences tailored to this specific role. No fluff.
CORE COMPETENCIES: Skills matching this job posting. Only include skills the candidate actually has.
PROFESSIONAL EXPERIENCE: Each role with title, company, dates, bullet points. Use quantified impact only where the profile supports it. Do not invent numbers.
EDUCATION: As stated in the profile.

Return this exact JSON with no other text:
{
  "job_title": "${job.title}",
  "company": "${job.company}",
  "resume": "full resume text here"
}`;
}

export function buildCoverLetterOnlyPrompt(profileText, job) {
  return `Generate a tailored cover letter for the candidate below targeting the specified role.

CANDIDATE PROFILE:
${profileText}

TARGET ROLE:
Title: ${job.title}
Company: ${job.company}
Location: ${job.location}
Full Job Description:
${job.jd_text || "Not available, tailor based on metadata only"}
Key Tech Stack: ${Array.isArray(job.key_tech_stack) ? job.key_tech_stack.join(", ") : "not specified"}
Scoring Reasoning: ${job.reasoning}

COVER LETTER STRUCTURE:
Paragraph 1: Why this role, brief connection to the company or mission.
Paragraph 2: 1-2 specific examples from the candidate's actual background matching role requirements.
Paragraph 3: Why the candidate's tech stack and domain experience fit this role.
Paragraph 4: Professional call to action and sign-off as Carmen Reed.

Return this exact JSON with no other text:
{
  "job_title": "${job.title}",
  "company": "${job.company}",
  "cover_letter": "full cover letter text here"
}`;
}
