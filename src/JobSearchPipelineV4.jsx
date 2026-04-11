// JobSearchPipelineV4.jsx
// React app: Scout (manual layer buttons) -> JD Fetch -> Re-Score -> Review -> Human Gate -> Tailor (on-demand per job) -> Complete
// Anthropic API /v1/messages only. PDF.js v3.11.174 (CDN, pinned).
// No em-dashes anywhere in output or code.

import { useState, useRef, useEffect, useCallback } from "react";
import {
  MODEL, SCORING_MODEL, SCORING_BATCH_SIZE, SCORING_BATCH_DELAY_MS,
  API_URL, API_HEADERS_BASE, ANTHROPIC_API_KEY, STORAGE_KEY,
  SCOUT_STORAGE_KEY, TAILOR_RESULTS_KEY, TAILOR_DELAY_MS,
  DISMISSED_KEY, MOBILE_BP, ADZUNA_APP_ID, ADZUNA_APP_KEY, RAPIDAPI_KEY,
} from "./constants";

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

async function withRetry(fn, maxAttempts = 3) {
  for (let i = 0; i < maxAttempts; i++) {
    try { return await fn(); }
    catch (err) {
      if (err.name === "AbortError") throw err;
      if (i === maxAttempts - 1) throw err;
      const waitMs = err?.message?.includes("429") ? 20000 : 2000 * Math.pow(2, i);
      await new Promise(r => setTimeout(r, waitMs));
    }
  }
}

function stripCodeFences(text) {
  const s = text.trim();
  if (s.startsWith("```")) {
    return s.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  }
  return s;
}

function extractOutermostJson(text) {
  let depth = 0, start = -1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "{") { if (depth === 0) start = i; depth++; }
    else if (text[i] === "}") {
      depth--;
      if (depth === 0 && start !== -1) {
        try { return JSON.parse(text.slice(start, i + 1)); }
        catch { start = -1; }
      }
    }
  }
  throw new Error("No valid JSON object found in response");
}

function extractJson(textBlocks) {
  const blocks = Array.isArray(textBlocks) ? textBlocks : [textBlocks];
  for (let i = blocks.length - 1; i >= 0; i--) {
    const raw = blocks[i].trim();
    try { return JSON.parse(raw); } catch { /* continue */ }
    try { return JSON.parse(stripCodeFences(raw)); } catch { /* continue */ }
    try { return extractOutermostJson(raw); } catch { /* continue */ }
  }
  throw new Error("Could not find valid JSON in the response. The model may not have completed its search.");
}

function extractTextFromBlocks(content) {
  return content.filter(b => b.type === "text").map(b => b.text).join("\n");
}

function normalizeTitle(title) {
  return (title || "")
    .toLowerCase()
    .trim()
    .replace(/\bsr\.?\s/g, "senior ")
    .replace(/\bsr\.?$/g, "senior")
    .replace(/\bjr\.?\s/g, "junior ")
    .replace(/\bjr\.?$/g, "junior")
    .replace(/\beng\.?\s/g, "engineer ")
    .replace(/\beng\.?$/g, "engineer")
    .replace(/\bmgr\.?\s/g, "manager ")
    .replace(/\bmgr\.?$/g, "manager")
    .replace(/\bdev\b\.?/g, "developer")
    .replace(/\barch\b\.?/g, "architect")
    .replace(/\s*[-/,&]\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function companyTitleKey(job) {
  const company = (job.company || "").toLowerCase().trim().replace(/\s+(inc|llc|ltd|corp|co)\.?$/i, "").trim();
  return `${company}|${normalizeTitle(job.title)}`;
}

function jobKey(job) {
  if (job.url && job.url.length > 0) return job.url;
  return companyTitleKey(job);
}

function isAppliedMatch(job, entry) {
  if (job.url && entry.url && job.url === entry.url) return true;
  return (job.company || "").toLowerCase() === (entry.company || "").toLowerCase()
    && (job.title || "").toLowerCase() === (entry.title || "").toLowerCase();
}

// ============================================================
// PERSISTENCE (localStorage)
// ============================================================

function loadAppliedJobs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveAppliedJobs(jobs) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs)); } catch { /* noop */ }
}

function loadLastScoutResults() {
  try {
    const raw = localStorage.getItem(SCOUT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveLastScoutResults(results) {
  try { localStorage.setItem(SCOUT_STORAGE_KEY, JSON.stringify(results)); } catch { /* noop */ }
}

function loadTailorResults() {
  try {
    const raw = localStorage.getItem(TAILOR_RESULTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveTailorResult(result) {
  try {
    const existing = loadTailorResults();
    const key = `${(result.company || "").toLowerCase().trim()}|${(result.job_title || "").toLowerCase().trim()}`;
    const idx = existing.findIndex(r =>
      `${(r.company || "").toLowerCase().trim()}|${(r.job_title || "").toLowerCase().trim()}` === key
    );
    if (idx >= 0) existing[idx] = result;
    else existing.push(result);
    localStorage.setItem(TAILOR_RESULTS_KEY, JSON.stringify(existing));
  } catch { /* noop */ }
}

function clearTailorResults() {
  try { localStorage.removeItem(TAILOR_RESULTS_KEY); } catch { /* noop */ }
}

function loadDismissedJobs() {
  try { const r = localStorage.getItem(DISMISSED_KEY); return r ? JSON.parse(r) : []; } catch { return []; }
}
function saveDismissedJob(job) {
  try {
    const existing = loadDismissedJobs();
    const key = jobKey(job);
    if (!existing.some(j => jobKey(j) === key)) {
      existing.push({ title: job.title, company: job.company, url: job.url || "" });
      localStorage.setItem(DISMISSED_KEY, JSON.stringify(existing));
    }
  } catch { }
}
function clearDismissedJobs() {
  try { localStorage.removeItem(DISMISSED_KEY); } catch { }
}
function isDismissed(job, dismissedList) {
  return dismissedList.some(d =>
    (d.url && d.url === job.url) ||
    (d.company?.toLowerCase() === job.company?.toLowerCase() && d.title?.toLowerCase() === job.title?.toLowerCase())
  );
}

// ============================================================
// PDF TEXT EXTRACTION (pdf.js loaded from CDN at runtime)
// ============================================================

let pdfjsLoaded = null;

function loadPdfJs() {
  if (pdfjsLoaded) return pdfjsLoaded;
  pdfjsLoaded = new Promise((resolve, reject) => {
    if (window.pdfjsLib) { resolve(window.pdfjsLib); return; }
    const script = document.createElement("script");
    // pdf.js v3.11.174 -- pinned
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    script.onload = () => {
      const lib = window.pdfjsLib;
      lib.GlobalWorkerOptions.workerSrc = "";
      resolve(lib);
    };
    script.onerror = () => reject(new Error("Failed to load PDF.js from CDN"));
    document.head.appendChild(script);
  });
  return pdfjsLoaded;
}

async function extractTextFromPdf(file) {
  const pdfjsLib = await loadPdfJs();
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({
    data: buffer,
    cMapUrl: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/",
    cMapPacked: true,
    standardFontDataUrl: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/standard_fonts/",
    disableWorker: true,
  }).promise;
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const lines = [];
    let lastY = null;
    for (const item of content.items) {
      if (lastY !== null && Math.abs(item.transform[5] - lastY) > 2) lines.push("\n");
      lines.push(item.str);
      lastY = item.transform[5];
    }
    pages.push(lines.join(""));
  }
  const fullText = pages.join("\n\n").trim();
  if (fullText.length > 0) {
    let garbled = 0;
    for (let c = 0; c < fullText.length; c++) {
      const code = fullText.charCodeAt(c);
      if (code === 0xfffd || (code >= 0xe000 && code <= 0xf8ff) ||
          (code < 0x20 && code !== 0x0a && code !== 0x0d && code !== 0x09)) garbled++;
    }
    if (garbled / fullText.length > 0.3) {
      throw new Error("PDF text appears garbled (font encoding issue). Please export as .txt or paste text directly.");
    }
  }
  return fullText;
}

// ============================================================
// ANTHROPIC API LAYER
// ============================================================

// Single API call. Returns parsed response JSON.
async function callAnthropic({ apiKey, system, messages, maxTokens = 4000, tools, signal, model }) {
  const body = { model: model ?? MODEL, max_tokens: maxTokens, system, messages };
  if (tools) body.tools = tools;
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { ...API_HEADERS_BASE, "x-api-key": apiKey },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${errBody.slice(0, 300)}`);
  }
  return res.json();
}

// Multi-turn agentic loop for server-side tool use (web_search).
// Runs conversation until stop_reason is "end_turn" or maxTurns reached.
// Returns parsed JSON from the final text response.
async function callAnthropicWithLoop({
  apiKey, system, userMessage, maxTokens = 16000, tools, signal, maxTurns = 20, onTurn,
  turnDelayMs = 0,
}) {
  const messages = [{ role: "user", content: userMessage }];

  for (let turn = 0; turn < maxTurns; turn++) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

    // Rate-limit throttle: pause before each API call (except the first)
    if (turnDelayMs > 0 && turn > 0) {
      await new Promise(r => setTimeout(r, turnDelayMs));
    }

    const data = await withRetry(() =>
      callAnthropic({ apiKey, system, messages, maxTokens, tools, signal })
    );

    messages.push({ role: "assistant", content: data.content });

    // Extract search queries for progress reporting
    const toolUseBlocks = (data.content || []).filter(b => b.type === "tool_use");
    if (onTurn && toolUseBlocks.length > 0) {
      const queries = toolUseBlocks.map(b => b.input?.query).filter(Boolean);
      onTurn({ turn: turn + 1, queries });
    }

    if (data.stop_reason === "end_turn") {
      const textBlocks = data.content.filter(b => b.type === "text").map(b => b.text);
      if (textBlocks.length === 0) throw new Error("No text in final response");
      return extractJson(textBlocks);
    }

    if (data.stop_reason === "tool_use") {
      // Push tool_result acknowledgments so the API allows the next assistant turn.
      // web_search is server-side; the API resolves it internally. The tool_result
      // is required as a protocol turn but the content is informational only.
      const toolResults = toolUseBlocks.map(b => ({
        type: "tool_result",
        tool_use_id: b.id,
        content: `Search executed: "${b.input?.query ?? "unknown"}". Results available for analysis.`,
      }));
      messages.push({ role: "user", content: toolResults });
      continue;
    }

    // Fallback: try to extract from whatever text is present
    const fallbackText = data.content.filter(b => b.type === "text").map(b => b.text);
    if (fallbackText.length > 0) return extractJson(fallbackText);
    throw new Error(`Unexpected stop_reason: ${data.stop_reason}`);
  }

  throw new Error("Scout exceeded maximum search iterations");
}

// Preflight: confirm web_search tool is available. Fast and cheap (max_tokens: 10).
async function detectWebSearchSupport(apiKey, signal) {
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { ...API_HEADERS_BASE, "x-api-key": apiKey },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 10,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [{ role: "user", content: "ping" }],
      }),
      signal,
    });
    if (res.ok) return { supported: true };
    const body = await res.text();
    const lower = body.toLowerCase();
    if (lower.includes("web_search") || lower.includes("tool not found") ||
        lower.includes("tool not enabled") || lower.includes("unknown tool") ||
        lower.includes("not available")) {
      return {
        supported: false,
        reason: "Web search is not enabled on your API key. Visit console.anthropic.com to enable it.",
      };
    }
    return { supported: false, reason: `Something went wrong (${res.status}): ${body.slice(0, 200)}` };
  } catch (err) {
    throw err;
  }
}

// ============================================================
// PROMPTS
// ============================================================

const TAILOR_SYSTEM = `You are a professional resume writer. Return valid JSON only. No preamble, no markdown fences, no explanation outside the JSON.

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

function buildTailorPrompt(profileText, job) {
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

function buildResumeOnlyPrompt(profileText, job) {
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

function buildCoverLetterOnlyPrompt(profileText, job) {
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

// ============================================================
// SCOUT: PARALLEL SEARCH, MERGE, DEDUP
// ============================================================

function deduplicateJobs(jobs) {
  const seen = new Map();
  for (const job of jobs) {
    const key = jobKey(job);
    if (seen.has(key)) {
      if (job.total_score > seen.get(key).total_score) seen.set(key, job);
    } else {
      seen.set(key, job);
    }
  }
  return Array.from(seen.values());
}

function mergeRawJobs(existing, incoming) {
  const seenUrls = new Set(existing.map(j => j.url).filter(Boolean));
  const seenKeys = new Set(existing.map(j => companyTitleKey(j)).filter(k => k !== "|"));
  const deduped = incoming.filter(j => {
    if (j.url && seenUrls.has(j.url)) return false;
    const ctKey = companyTitleKey(j);
    if (ctKey !== "|" && seenKeys.has(ctKey)) return false;
    if (j.url) seenUrls.add(j.url);
    if (ctKey !== "|") seenKeys.add(ctKey);
    return true;
  });
  return [...existing, ...deduped];
}

function mergeScoutResults(results) {
  const allTiers = { strong_match: [], possible: [], weak: [], rejected: [] };
  const summaries = [], notes = [];

  for (const r of results) {
    if (!r || !r.tiers) continue;
    for (const tier of Object.keys(allTiers)) {
      if (Array.isArray(r.tiers[tier])) allTiers[tier].push(...r.tiers[tier]);
    }
    if (r.summary) summaries.push(r.summary);
    if (r.notes) notes.push(r.notes);
  }

  // Deduplicate within each tier
  for (const tier of Object.keys(allTiers)) {
    allTiers[tier] = deduplicateJobs(allTiers[tier]);
  }

  // Remove cross-tier duplicates (keep in highest tier)
  const seenKeys = new Set();
  for (const tier of ["strong_match", "possible", "weak", "rejected"]) {
    allTiers[tier] = allTiers[tier].filter(job => {
      const key = jobKey(job);
      if (seenKeys.has(key)) return false;
      seenKeys.add(key);
      return true;
    });
  }

  const totalFound = Object.values(allTiers).reduce((s, a) => s + a.length, 0);
  return {
    found: totalFound > 0,
    summary: summaries.join(" ") || "No results found.",
    tiers: allTiers,
    notes: notes.join(" ") || "",
  };
}

function reTierJobs(tiers) {
  const allJobs = Object.values(tiers).flat();
  const reTiered = { strong_match: [], possible: [], weak: [], rejected: [] };
  for (const job of allJobs) {
    const s = job.total_score;
    if (s >= 8) reTiered.strong_match.push(job);
    else if (s >= 6) reTiered.possible.push(job);
    else if (s >= 3) reTiered.weak.push(job);
    else reTiered.rejected.push(job);
  }
  return reTiered;
}

function filterAppliedFromTiers(tiers, appliedList) {
  if (!appliedList.length) return { tiers, filtered: 0 };
  let filtered = 0;
  const out = {};
  for (const key of Object.keys(tiers)) {
    out[key] = (tiers[key] ?? []).filter(job => {
      const match = appliedList.some(e => isAppliedMatch(job, e));
      if (match) filtered++;
      return !match;
    });
  }
  return { tiers: out, filtered };
}

async function fetchAdzunaJobs(profileText, signal) {
  const queries = [
    "Senior Solutions Architect",
    "Principal Software Architect",
    "Staff Engineer AI",
    "Lead AI Engineer",
    "Senior AI Architect",
    "AI Integration Architect",
    "Senior .NET Architect",
  ];
  const results = [];
  for (const q of queries) {
    try {
      const url = `https://api.adzuna.com/v1/api/jobs/us/search/1?app_id=${ADZUNA_APP_ID}&app_key=${ADZUNA_APP_KEY}&results_per_page=10&what=${encodeURIComponent(q)}&where=remote&full_time=1&sort_by=date`;
      const res = await fetch(url, { signal });
      if (!res.ok) continue;
      const data = await res.json();
      for (const job of (data.results || [])) {
        results.push({
          title: job.title,
          company: job.company?.display_name || "",
          location: job.location?.display_name || "Remote",
          url: job.redirect_url,
          salary_range: job.salary_min ? `$${Math.round(job.salary_min/1000)}k - $${Math.round(job.salary_max/1000)}k` : "",
          description: job.description || "",
          date_posted: job.created ? job.created.slice(0, 10) : null,
          source: "adzuna",
        });
      }
    } catch { continue; }
  }
  return results;
}

async function fetchJSearchJobs(signal) {
  const queries = [
    "Senior Solutions Architect remote",
    "Principal AI Engineer remote",
    "Staff Software Architect Azure remote",
    "Lead AI Engineer .NET remote",
    "Agentic AI Architect remote",
    "Senior AI Integration Engineer remote",
    "LLM Solutions Architect remote",
  ];
  const results = [];
  for (const q of queries) {
    try {
      const url = `https://jsearch.p.rapidapi.com/search?query=${encodeURIComponent(q)}&page=1&num_pages=1&date_posted=week`;
      const res = await fetch(url, {
        signal,
        headers: {
          "X-RapidAPI-Key": RAPIDAPI_KEY,
          "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
        },
      });
      if (!res.ok) continue;
      const data = await res.json();
      for (const job of (data.data || [])) {
        if (!job.job_apply_link) continue;
        results.push({
          title: job.job_title,
          company: job.employer_name || "",
          location: job.job_is_remote ? "Remote" : `${job.job_city || ""}, ${job.job_state || ""}`.trim(),
          url: job.job_apply_link,
          salary_range: job.job_min_salary ? `$${Math.round(job.job_min_salary/1000)}k - $${Math.round(job.job_max_salary/1000)}k` : "",
          description: job.job_description || "",
          date_posted: job.job_posted_at_datetime_utc ? job.job_posted_at_datetime_utc.slice(0, 10) : null,
          source: "jsearch",
        });
      }
    } catch { continue; }
  }
  return results;
}

async function fetchRssJobs(signal, onProgress) {
  const feeds = [
    { url: "https://weworkremotely.com/categories/remote-senior-programmer-jobs.rss", source: "weworkremotely" },
    { url: "https://weworkremotely.com/categories/remote-full-stack-programming-jobs.rss", source: "weworkremotely" },
    { url: "https://remotive.com/remote-jobs/feed/software-dev", source: "remotive" },
    { url: "https://remotive.com/remote-jobs/feed/data", source: "remotive" },
    { url: "https://remoteok.com/remote-jobs.rss", source: "remoteok" },
    { url: "https://himalayas.app/jobs/rss", source: "himalayas" },
    { url: "https://jobicy.com/?feed=job_feed&job_category=engineering", source: "jobicy" },
  ];

  function parseXmlItems(xmlStr) {
    try {
      const doc = new DOMParser().parseFromString(xmlStr, "text/xml");
      const parseErr = doc.querySelector("parsererror");
      if (parseErr) return [];
      return [...doc.querySelectorAll("item, entry")].map(el => {
        const getT = (tag) => el.querySelector(tag)?.textContent?.trim() || "";
        const linkEl = el.querySelector("link");
        const link = linkEl?.textContent?.trim() || linkEl?.getAttribute("href") || "";
        const pubDate = getT("pubDate") || getT("published") || getT("updated") || getT("dc\\:date") || "";
        let parsedDate = null;
        if (pubDate) {
          const d = new Date(pubDate);
          if (!isNaN(d.getTime())) parsedDate = d.toISOString().slice(0, 10);
        }
        return {
          title: getT("title"),
          link,
          author: getT("author") || getT("dc\\:creator") || "",
          categories: [...el.querySelectorAll("category")].map(c => c.textContent.trim()),
          description: getT("description") || getT("summary") || getT("content"),
          date_posted: parsedDate,
        };
      });
    } catch { return []; }
  }

  async function tryFetch(url, opts) {
    const r = await fetch(url, opts);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r;
  }

  const results = [];

  for (const feed of feeds) {
    if (signal?.aborted) break;
    if (onProgress) onProgress(`Checking ${feed.source}...`);
    let items = [];

    // Proxy 1: rss2json
    if (items.length === 0) {
      try {
        const r = await tryFetch(
          `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feed.url)}&count=50`,
          { signal }
        );
        const d = await r.json();
        if (d.status === "ok" && Array.isArray(d.items) && d.items.length > 0) {
          items = d.items.map(item => ({
            title: item.title || "",
            link: item.link || "",
            author: item.author || item.categories?.[0] || "",
            categories: item.categories || [],
            description: item.description || item.content || "",
            date_posted: item.pubDate ? new Date(item.pubDate).toISOString().slice(0, 10) : (item.isoDate ? item.isoDate.slice(0, 10) : null),
          }));
        }
      } catch { /* try next */ }
    }

    // Proxy 2: allorigins
    if (items.length === 0) {
      try {
        const r = await tryFetch(
          `https://api.allorigins.win/get?url=${encodeURIComponent(feed.url)}`,
          { signal }
        );
        const d = await r.json();
        if (d.contents && d.contents.length > 200) items = parseXmlItems(d.contents);
      } catch { /* try next */ }
    }

    // Proxy 3: corsproxy.io
    if (items.length === 0) {
      try {
        const r = await tryFetch(
          `https://corsproxy.io/?${encodeURIComponent(feed.url)}`,
          { signal }
        );
        const xml = await r.text();
        if (xml && xml.length > 200) items = parseXmlItems(xml);
      } catch { /* give up on this feed */ }
    }

    for (const item of items) {
      if (!item.link) continue;
      results.push({
        title: item.title || "",
        company: item.author || item.categories?.[0] || "",
        location: "Remote",
        url: item.link,
        salary_range: "",
        description: item.description || "",
        date_posted: item.date_posted || null,
        source: feed.source,
      });
    }

    if (onProgress) onProgress(`${feed.source}: ${items.length} found`);
  }

  return results;
}

async function fetchAtsJobs(apiKey, profileText, signal) {
  const system = "You are a job scout. Use web_search to find currently open senior-level job postings on Greenhouse, Lever, and Workday career pages only. Return valid JSON only. No preamble, no markdown fences.";
  const message = `Find 5 to 10 currently open senior/principal/architect/staff level remote roles matching this profile. Search Greenhouse, Lever, and Workday only.

PROFILE SUMMARY:
${profileText.slice(0, 800)}

Return this JSON:
{
  "jobs": [
    {
      "title": "job title",
      "company": "company name",
      "location": "Remote or city state",
      "url": "direct URL to posting",
      "salary_range": "range or empty string",
      "description": "brief description from posting",
      "source": "greenhouse or lever or workday"
    }
  ]
}`;
  try {
    const data = await callAnthropicWithLoop({
      apiKey, system, userMessage: message, maxTokens: 4000,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      signal, maxTurns: 8,
    });
    return (data.jobs || []).map(j => ({ ...j, source: j.source || "ats" }));
  } catch { return []; }
}

function keywordPreFilter(jobs) {
  const TITLE_HARD_REJECT = [
    /\bjunior\b/i, /\bassociate\b/i, /\bmid.?level\b/i, /\bentry.?level\b/i,
    /\bintern\b/i, /\bapprentice\b/i, /\bstaff accountant\b/i,
    /\bdata entry\b/i, /\bsupport engineer\b/i, /\bhelp desk\b/i,
    /\bdevops engineer\b/i, /\bsre\b/i, /\bsite reliability\b/i,
    /\bquality assurance\b/i, /\bqa engineer\b/i,
    /\brecruiter\b/i, /\bhuman resources\b/i, /\baccountant\b/i,
    /\bmarketing\b/i, /\bsales engineer\b/i, /\bcustomer success\b/i,
  ];

  const TITLE_SOFT_REJECT = [
    /\bmanager\b/i, /\bdirector\b/i, /\bvp\b/i, /\bchief\b/i,
  ];

  const LOCATION_PASS = [
    /remote/i, /florida/i, /tampa/i, /st\.?\s*pete/i, /clearwater/i,
    /sarasota/i, /brandon/i, /riverview/i, /orlando/i,
  ];

  const passed = [];
  const rejected = [];

  for (const job of jobs) {
    const title = (job.title || "").toLowerCase();
    const location = (job.location || "").toLowerCase();

    if (!job.url) {
      rejected.push({ ...job, filter_reason: "no URL", total_score: 0, skills_fit: 0, level_fit: 0, reasoning: "Pre-filter: no URL", key_tech_stack: [], status: "open" });
      continue;
    }

    const hardRejected = TITLE_HARD_REJECT.some(r => r.test(title));
    if (hardRejected) {
      rejected.push({ ...job, filter_reason: "title hard reject", total_score: 0, skills_fit: 0, level_fit: 0, reasoning: `Pre-filter: title rejected (${job.title})`, key_tech_stack: [], status: "open" });
      continue;
    }

    const isMgmtTitle = TITLE_SOFT_REJECT.some(r => r.test(title));
    const hasTechSignal = /\bengineering\b|\btechnical\b|\barchitect\b|\bprincipal\b|\bstaff\b/i.test(title);
    if (isMgmtTitle && !hasTechSignal) {
      rejected.push({ ...job, filter_reason: "management title, no technical scope", total_score: 0, skills_fit: 0, level_fit: 0, reasoning: `Pre-filter: management title (${job.title})`, key_tech_stack: [], status: "open" });
      continue;
    }

    const locationOk = LOCATION_PASS.some(r => r.test(location)) || location === "" || location === "remote";
    if (!locationOk) {
      rejected.push({ ...job, filter_reason: "location not remote or Tampa Bay", total_score: 0, skills_fit: 0, level_fit: 0, reasoning: `Pre-filter: location rejected (${job.location})`, key_tech_stack: [], status: "open" });
      continue;
    }

    passed.push(job);
  }

  return { passed, rejected };
}

async function scoreRawJobs(apiKey, profileText, rawJobs, signal, onStatus) {
  const scored = [];

  for (let i = 0; i < rawJobs.length; i += SCORING_BATCH_SIZE) {
    if (signal.aborted) break;

    if (i > 0) {
      onStatus(`Processing results, almost done... (${i}/${rawJobs.length} scored)`);
      await new Promise(r => setTimeout(r, SCORING_BATCH_DELAY_MS));
    }

    const batch = rawJobs.slice(i, i + SCORING_BATCH_SIZE);
    onStatus(`Scoring jobs ${i + 1} to ${Math.min(i + SCORING_BATCH_SIZE, rawJobs.length)} of ${rawJobs.length}...`);

    try {
      const data = await withRetry(() => callAnthropic({
        apiKey,
        model: SCORING_MODEL,
        system: "You are a job scoring AI. Return valid JSON only. No preamble, no markdown fences.",
        messages: [{
          role: "user",
          content: `Score each job against this candidate profile.

CANDIDATE PROFILE (condensed):
${profileText.slice(0, 400)}

KEY SKILLS: Agentic AI, RAG, LLM Integration, Azure, C#, .NET Core, SQL Server, Solutions Architecture, REST APIs, PCI Compliance, 28 years experience.
TARGET LEVEL: Senior, Lead, Principal, Architect, Staff only.
LOCATION: Remote US or Tampa Bay Florida only.

JOBS TO SCORE:
${JSON.stringify(batch.map((j, idx) => ({
  idx,
  title: j.title,
  company: j.company,
  location: j.location,
  description: (j.description || "").slice(0, 120),
})))}

SCORING RUBRIC:
- skills_fit (0-5): 5=4+ core skills match, 3-4=2-3 skills, 1-2=minimal, 0=none
- level_fit (0-5): 5=Senior/Lead/Principal/Architect/Staff, 2-3=ambiguous scope, 0=junior or management only
- total_score: skills_fit + level_fit
- date_posted: Use the date_posted value already on the job object if present. If not present, set to null.
- freshness_flag: "fresh" if date_posted is within 14 days of today, "stale" otherwise.

HARD EXCLUSIONS -- set total_score to 0 for: government/defense/clearance, Junior/Mid/Associate, on-site non-FL.

Return JSON only: { "scores": [ { "idx": 0, "skills_fit": 3, "level_fit": 4, "total_score": 7, "reasoning": "1 sentence", "key_tech_stack": ["C#", "Azure"], "date_posted": "2025-04-06 or null", "freshness_flag": "fresh or stale" } ] }`
        }],
        maxTokens: 1200,
        signal,
      }));
      const raw = extractTextFromBlocks(data.content);
      const parsed = extractJson([raw]);
      for (const score of (parsed.scores || [])) {
        const job = batch[score.idx];
        if (!job) continue;
        scored.push({
          ...job,
          skills_fit: score.skills_fit ?? 0,
          level_fit: score.level_fit ?? 0,
          total_score: score.total_score ?? 0,
          reasoning: score.reasoning ?? "",
          key_tech_stack: score.key_tech_stack ?? [],
          date_posted: score.date_posted ?? batch[score.idx]?.date_posted ?? null,
          freshness_flag: (() => {
            const dp = score.date_posted ?? batch[score.idx]?.date_posted ?? null;
            if (!dp) return "stale";
            const diff = (Date.now() - new Date(dp).getTime()) / (1000 * 60 * 60 * 24);
            return diff <= 14 ? "fresh" : "stale";
          })(),
          status: "open",
        });
      }
    } catch (err) {
      console.error(`Scoring batch ${i}-${i + SCORING_BATCH_SIZE} failed:`, err?.message ?? err);
      for (const job of batch) scored.push({
        ...job, skills_fit: 0, level_fit: 1, total_score: 1,
        reasoning: "Scoring error - review manually", key_tech_stack: [], status: "open",
      });
    }
  }

  return scored;
}

async function runParallelScout(apiKey, profileText, appliedList, signal, onProgress) {
  onProgress({ message: "Layer 1: Searching Adzuna, JSearch, and RSS feeds in parallel...", jobsSoFar: 0 });

  const [adzunaJobs, jsearchJobs, rssJobs] = await Promise.allSettled([
    fetchAdzunaJobs(profileText, signal),
    fetchJSearchJobs(signal),
    fetchRssJobs(signal),
  ]).then(results => results.map(r => r.status === "fulfilled" ? r.value : []));

  onProgress({ message: "Layer 2: Searching ATS boards (Greenhouse, Lever, Workday)...", jobsSoFar: adzunaJobs.length + jsearchJobs.length + rssJobs.length });
  const atsJobs = await fetchAtsJobs(apiKey, profileText, signal);

  const allRaw = [...adzunaJobs, ...jsearchJobs, ...rssJobs, ...atsJobs];
  onProgress({ message: `Found ${allRaw.length} raw listings. Deduplicating...`, jobsSoFar: allRaw.length });

  const seen = new Set();
  let deduped = allRaw.filter(j => {
    if (!j.url || seen.has(j.url)) return false;
    seen.add(j.url); return true;
  });

  // Retry with broader queries if initial fetch returned nothing
  if (deduped.length === 0) {
    onProgress({ message: "Zero results from initial fetch. Retrying with broader queries...", jobsSoFar: 0 });
    const retryJobs = await fetchAtsJobs(apiKey, profileText, signal);
    const retrySeen = new Set();
    const retryDeduped = retryJobs.filter(j => {
      if (!j.url || retrySeen.has(j.url)) return false;
      retrySeen.add(j.url);
      return true;
    });
    if (retryDeduped.length > 0) {
      deduped.push(...retryDeduped);
      onProgress({ message: `Retry found ${retryDeduped.length} listings. Scoring...`, jobsSoFar: retryDeduped.length });
    } else {
      onProgress({ message: "Retry also returned 0 results. Check API keys and network.", jobsSoFar: 0 });
    }
  }

  onProgress({ message: `Pre-filtering ${deduped.length} listings (title + location check)...`, jobsSoFar: deduped.length });
  const { passed, rejected: preRejected } = keywordPreFilter(deduped);
  onProgress({ message: `${passed.length} passed pre-filter (${preRejected.length} rejected). Scoring with Haiku...`, jobsSoFar: passed.length });

  const scored = await scoreRawJobs(apiKey, profileText, passed, signal, (msg) => onProgress({ message: msg, jobsSoFar: passed.length }));

  const allScored = [...scored, ...preRejected];

  const allTiers = { strong_match: [], possible: [], weak: [], rejected: [] };
  for (const job of allScored) {
    const s = job.total_score;
    if (s >= 8) allTiers.strong_match.push(job);
    else if (s >= 6) allTiers.possible.push(job);
    else if (s >= 3) allTiers.weak.push(job);
    else allTiers.rejected.push(job);
  }

  const { tiers: filteredTiers, filtered } = filterAppliedFromTiers(allTiers, appliedList);
  const totalFound = Object.values(filteredTiers).reduce((s, a) => s + a.length, 0);

  return {
    found: totalFound > 0,
    summary: `Found ${totalFound} roles across Adzuna, JSearch, RSS feeds, and ATS boards.${filtered > 0 ? ` ${filtered} previously applied role(s) excluded.` : ""}`,
    tiers: filteredTiers,
    notes: `Sources: Adzuna (${adzunaJobs.length}), JSearch (${jsearchJobs.length}), RSS (${rssJobs.length}), ATS web search (${atsJobs.length}). Deduplicated to ${deduped.length} unique listings.`,
  };
}

// ============================================================
// JD FETCH + RE-SCORE
// ============================================================

// JD fetch that returns text (not JSON)
async function fetchJdText(apiKey, job, signal) {
  try {
    const messages = [{ role: "user", content: `Fetch the full job description from: ${job.url}\nCompany: ${job.company}\nTitle: ${job.title}\n\nReturn the complete JD text as-is. If the URL is inaccessible, search for "${job.title} ${job.company} job description" and return the closest match. Return only the JD text, nothing else.` }];

    // Use agentic loop manually for text (not JSON) extraction
    const tools = [{ type: "web_search_20250305", name: "web_search" }];
    for (let turn = 0; turn < 5; turn++) {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      const data = await withRetry(() =>
        callAnthropic({
          apiKey,
          system: "You are a job description fetcher. Use web search to find and return the full job description text. Return only the JD text, no commentary, no JSON wrapping.",
          messages,
          maxTokens: 2000,
          tools,
          signal,
        })
      );
      messages.push({ role: "assistant", content: data.content });
      if (data.stop_reason === "end_turn") {
        const text = extractTextFromBlocks(data.content);
        return text && text.length > 50 ? text : null;
      }
      if (data.stop_reason === "tool_use") {
        const toolResults = data.content.filter(b => b.type === "tool_use").map(b => ({
          type: "tool_result",
          tool_use_id: b.id,
          content: `Search executed: "${b.input?.query ?? "unknown"}". Results available.`,
        }));
        messages.push({ role: "user", content: toolResults });
        continue;
      }
      const fallback = extractTextFromBlocks(data.content);
      return fallback && fallback.length > 50 ? fallback : null;
    }
    return null;
  } catch { return null; }
}

async function rescoreJob(apiKey, job, profileText, signal) {
  try {
    const data = await withRetry(async () => {
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      return callAnthropic({
        apiKey,
        system: "You are a job scoring AI. Return valid JSON only. No preamble, no markdown fences.",
        messages: [{ role: "user", content: `Re-score this job based on the full job description.

CANDIDATE PROFILE:
${profileText.slice(0, 1000)}

FULL JOB DESCRIPTION:
${(job.jd_text || "").slice(0, 2500)}

JOB TITLE: ${job.title}
COMPANY: ${job.company}

Score using this rubric:
- Skills Fit (0-5): match to candidate's technical skills
- Level Fit (0-5): seniority alignment
- Total Score (0-10): sum

Return JSON: {"skills_fit": <int>, "level_fit": <int>, "total_score": <int>, "reasoning": "1-2 sentences"}` }],
        maxTokens: 1000,
        signal,
      });
    });
    const raw = extractTextFromBlocks(data.content);
    return extractJson([raw]);
  } catch { return null; }
}

async function runJdFetchAndRescore(apiKey, profileText, results, signal, onStatus) {
  const jobsToFetch = (results.tiers?.strong_match ?? []).slice(0, 5);

  if (jobsToFetch.length === 0 || !apiKey) return results;

  // JD Fetch phase
  onStatus(`Fetching job descriptions... (0 of ${jobsToFetch.length})`);
  for (let i = 0; i < jobsToFetch.length; i++) {
    if (signal.aborted) break;
    onStatus(`Fetching JD ${i + 1} of ${jobsToFetch.length}: ${jobsToFetch[i].company}...`);
    jobsToFetch[i].jd_text = await fetchJdText(apiKey, jobsToFetch[i], signal);
  }

  // Re-score phase
  const jobsWithJd = jobsToFetch.filter(j => j.jd_text);
  if (jobsWithJd.length > 0) {
    onStatus(`Re-scoring ${jobsWithJd.length} jobs with full JD text...`);
    for (let i = 0; i < jobsWithJd.length; i++) {
      if (signal.aborted) break;
      onStatus(`Re-scoring ${i + 1} of ${jobsWithJd.length}: ${jobsWithJd[i].company}...`);
      const scores = await rescoreJob(apiKey, jobsWithJd[i], profileText, signal);
      if (scores) {
        jobsWithJd[i].skills_fit = scores.skills_fit;
        jobsWithJd[i].level_fit = scores.level_fit;
        jobsWithJd[i].total_score = scores.total_score;
        jobsWithJd[i].reasoning = scores.reasoning;
      }
      await new Promise(r => setTimeout(r, 3000));
    }
    results.tiers = reTierJobs(results.tiers);
  }

  onStatus("");
  return { ...results };
}

// ============================================================
// HOOKS
// ============================================================

function useWindowWidth() {
  const [width, setWidth] = useState(typeof window !== "undefined" ? window.innerWidth : 1024);
  useEffect(() => {
    let timer;
    const handler = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setWidth(window.innerWidth), 150);
    };
    window.addEventListener("resize", handler);
    return () => { window.removeEventListener("resize", handler); clearTimeout(timer); };
  }, []);
  return width;
}

// ============================================================
// SUB-COMPONENTS
// ============================================================

const PHASES = ["Scout", "Review", "Tailor", "Complete"];

function Spinner() {
  return <span className="jsp-spinner" />;
}

function Header() {
  return (
    <div className="header">
      <img src={`${process.env.PUBLIC_URL}/PeelAwayLogicLogo.png`} alt="PeelAway Logic" className="header-logo" />
      <div>
        <div className="header-brand">PeelAway Logic</div>
        <div className="header-title">PeelAway Logic</div>
      </div>
    </div>
  );
}

function ProgressStepper({ current, maxVisited, onTabClick }) {
  const isMobile = useWindowWidth() < MOBILE_BP;
  if (isMobile) {
    const name = PHASES[current] ?? PHASES[PHASES.length - 1];
    return (
      <div className="progress-mobile">
        Step {current + 1} of {PHASES.length}: {name}
      </div>
    );
  }
  return (
    <div className="progress">
      <div className="progress-track">
        {PHASES.map((name, i) => {
          const cls = i === current ? "current" : i < current ? "done" : "future";
          const clickable = i <= maxVisited;
          return (
            <span key={name} style={{ display: "contents" }}>
              <div
                className={`step-dot ${cls}${!clickable ? " no-click" : ""}`}
                onClick={clickable ? () => onTabClick(i) : undefined}
              >
                {i < current ? "\u2713" : i + 1}
              </div>
              {i < 3 && <div className={`step-line ${i < current ? "done" : "future"}`} />}
            </span>
          );
        })}
      </div>
      <div className="step-labels">
        {PHASES.map((name, i) => (
          <span key={name} className={`step-label${i === current ? " current-label" : ""}`}>{name}</span>
        ))}
      </div>
    </div>
  );
}

function GuideBar({ emoji, text }) {
  return (
    <div className="guide">
      <span className="guide-emoji">{emoji}</span>
      <div className="guide-text">{text}</div>
    </div>
  );
}

function LandingScreen({ onStart }) {
  return (
    <div className="landing">
      <img src={`${process.env.PUBLIC_URL}/PeelAwayLogicLogoText.png`} alt="PeelAway Logic" className="landing-logo" />
      <p className="landing-tagline">AI-powered job search pipeline for busy professionals.</p>
      <div className="landing-buttons">
        <button className="btn primary" onClick={onStart}>
          {"\uD83D\uDE80"} Start as Guest
        </button>
      </div>
      <p className="landing-privacy">Your data stays private. No account required to start.</p>
    </div>
  );
}

function JobCard({ job, selectable, selected, onToggle }) {
  const { title, company, location, total_score, skills_fit, level_fit, reasoning, key_tech_stack, status, salary_range, url, jd_text } = job;
  const scorePercent = Math.round(total_score * 10);
  return (
    <div className={`card job-row${selected ? " selected" : ""}`}>
      {selectable && (
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggle(job)}
          className="job-check"
          aria-label={`Select ${title} at ${company}`}
        />
      )}
      <div className="job-info">
        <div className="job-title">
          {url ? <a href={url} target="_blank" rel="noopener noreferrer">{title}</a> : title}
        </div>
        <div className="job-meta">{company} {location ? `\u00B7 ${location}` : ""}</div>
        {salary_range && <div className="job-meta text-success">{salary_range}</div>}
        <div className="job-date">
          {job.date_posted && job.freshness_flag === "fresh" && <>Posted: {job.date_posted} </>}
          {job.freshness_flag === "stale" && <span className="text-stale">Date unverified or older than 14 days</span>}
          {jd_text && <span className="text-success"> Full JD fetched</span>}
          {url && <>{" "}<a href={url} target="_blank" rel="noopener noreferrer">View Listing</a></>}
        </div>
        <div className="job-meta mt-4">Skills: {skills_fit}/5 | Level: {level_fit}/5 | {status}</div>
        <div className="text-hint mt-4">{reasoning}</div>
        {Array.isArray(key_tech_stack) && key_tech_stack.length > 0 && (
          <div className="tech-stack mt-4">
            {key_tech_stack.map(t => <span key={t} className="badge">{t}</span>)}
          </div>
        )}
      </div>
      <div className="score-badge">{scorePercent}%</div>
    </div>
  );
}

// ============================================================
// MANUAL JOB INPUT
// ============================================================

function ManualJobInput({ profileText, apiKey, onJobScored }) {
  const [mode, setMode] = useState("url"); // "url" | "paste"
  const [inputVal, setInputVal] = useState("");
  const [status, setStatus] = useState("idle"); // "idle" | "running" | "done" | "error"
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  const handleScore = async () => {
    if (!inputVal.trim()) { setError("Paste a URL or job description first."); return; }
    if (!apiKey) { setError("API key not set."); return; }
    setStatus("running");
    setError(null);
    setResult(null);
    abortRef.current = new AbortController();

    try {
      let jdText = "";
      let jobTitle = "Manual Entry";
      let company = "Unknown";
      let url = "";

      if (mode === "url") {
        url = inputVal.trim();
        // Use web search to fetch JD from URL
        const fetchData = await callAnthropicWithLoop({
          apiKey,
          system: "You are a job description fetcher. Return valid JSON only. No preamble, no markdown.",
          userMessage: `Fetch the job description from this URL: ${url}\nReturn JSON: { "title": "job title", "company": "company name", "jd_text": "full job description text" }`,
          maxTokens: 3000,
          tools: [{ type: "web_search_20250305", name: "web_search" }],
          signal: abortRef.current.signal,
          maxTurns: 5,
        });
        jdText = fetchData.jd_text || "";
        jobTitle = fetchData.title || "Manual Entry";
        company = fetchData.company || "Unknown";
      } else {
        jdText = inputVal.trim();
      }

      // Score the job against the profile
      const raw = [{
        title: jobTitle,
        company,
        location: "Remote",
        url,
        description: jdText.slice(0, 400),
        source: "manual",
      }];
      const scored = await scoreRawJobs(apiKey, profileText, raw, abortRef.current.signal, () => {});
      const job = scored[0] ? { ...scored[0], jd_text: jdText, source_layer: "manual" } : null;

      if (!job) { setError("Scoring returned no result."); setStatus("error"); return; }
      setResult(job);
      setStatus("done");
    } catch (err) {
      if (err.name === "AbortError") { setStatus("idle"); return; }
      setError(err.message);
      setStatus("error");
    }
  };

  const handleAddToQueue = () => {
    if (result) {
      onJobScored(result);
      setResult(null);
      setInputVal("");
      setStatus("idle");
    }
  };

  const scorePercent = result ? Math.round(result.total_score * 10) : 0;
  return (
    <div className="card mt-16">
      <div className="section-title"><span className="step-num">4</span> Quick Score</div>
      <div className="tab-bar">
        <button className={`tab-btn${mode === "url" ? " active" : ""}`} onClick={() => { setMode("url"); setInputVal(""); setResult(null); setError(null); }}>Paste URL</button>
        <button className={`tab-btn${mode === "paste" ? " active" : ""}`} onClick={() => { setMode("paste"); setInputVal(""); setResult(null); setError(null); }}>Paste JD Text</button>
      </div>
      {mode === "url" ? (
        <input type="url" placeholder="https://jobs.lever.co/company/job-id" value={inputVal} onChange={(e) => setInputVal(e.target.value)} className="form-input mb-10" disabled={status === "running"} />
      ) : (
        <textarea placeholder="Paste the full job description here..." value={inputVal} onChange={(e) => setInputVal(e.target.value)} rows={6} className="form-textarea mb-10" disabled={status === "running"} />
      )}
      <div className="flex-gap">
        <button className="btn primary" disabled={status === "running" || !inputVal.trim()} onClick={handleScore}>
          {status === "running" ? <><Spinner />Scoring...</> : "Score This Job"}
        </button>
        {status === "running" && (
          <button className="btn default sm" onClick={() => { abortRef.current?.abort(); setStatus("idle"); }}>Cancel</button>
        )}
      </div>
      {error && <p className="text-error">{error}</p>}
      {result && status === "done" && (
        <div className="card a-yellow mt-12">
          <div className="flex-between">
            <div>
              <div className="job-title">{result.title}</div>
              <div className="job-meta">{result.company} {result.location ? `\u00B7 ${result.location}` : ""}</div>
            </div>
            <div className="score-badge">{scorePercent}%</div>
          </div>
          <div className="job-meta mt-4">Skills: {result.skills_fit}/5 | Level: {result.level_fit}/5</div>
          <div className="text-hint mt-4">{result.reasoning}</div>
          {Array.isArray(result.key_tech_stack) && result.key_tech_stack.length > 0 && (
            <div className="tech-stack mt-4">{result.key_tech_stack.map(t => <span key={t} className="badge">{t}</span>)}</div>
          )}
          <button className="btn primary sm mt-12" onClick={handleAddToQueue}>Add to Scout Queue</button>
          <p className="text-hint mt-4">Adding to queue lets you include this job in scoring and advance to Review.</p>
        </div>
      )}
    </div>
  );
}

// ============================================================
// PHASE 1: SCOUT
// ============================================================

function ScoutPhase({ profileText, setProfileText, appliedList, onComplete }) {
  const [status, setStatus] = useState("idle");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState(null);
  const [progressMsg, setProgressMsg] = useState("");
  const [jobCount, setJobCount] = useState(0);
  const [subStatus, setSubStatus] = useState("");
  const [fileName, setFileName] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [fileError, setFileError] = useState(null);
  const [inputMode, setInputMode] = useState("upload"); // "upload" | "paste"
  const abortRef = useRef(null);
  const timerRef = useRef(null);
  const fileRef = useRef(null);

  // Layer-specific state
  const [layer1Status, setLayer1Status] = useState("idle");
  const [layer2Status, setLayer2Status] = useState("idle");
  const [layer3Status, setLayer3Status] = useState("idle");
  const [runSummary, setRunSummary] = useState(null);
  const [layer1Msg, setLayer1Msg] = useState("");
  const [layer2Msg, setLayer2Msg] = useState("");
  const [layer3Msg, setLayer3Msg] = useState("");
  const [accumulatedRaw, setAccumulatedRaw] = useState([]);
  const [scoutReady, setScoutReady] = useState(false);

  const abort1Ref = useRef(null);
  const abort2Ref = useRef(null);
  const abort3Ref = useRef(null);

  // Cleanup timer and abort on unmount
  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      abortRef.current?.abort();
      abort1Ref.current?.abort();
      abort2Ref.current?.abort();
      abort3Ref.current?.abort();
    };
  }, []);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setExtracting(true);
    setFileError(null);
    try {
      if (file.name.toLowerCase().endsWith(".txt")) {
        setProfileText(await file.text());
      } else if (file.name.toLowerCase().endsWith(".pdf")) {
        const text = await extractTextFromPdf(file);
        if (!text || text.length < 30) {
          setFileError("PDF appears image-based or unreadable. Paste your resume text below instead.");
          setProfileText("");
        } else {
          setProfileText(text);
        }
      } else {
        setFileError("Unsupported file type. Use .pdf or .txt.");
      }
    } catch (err) {
      setFileError(`Failed to extract text: ${err.message}`);
      setProfileText("");
    } finally {
      setExtracting(false);
    }
  };

  const handleLayer1 = async () => {
    if (!ANTHROPIC_API_KEY) { setError("REACT_APP_ANTHROPIC_API_KEY is not set."); return; }
    if (profileText.trim().length <= 50) { setError("Upload a resume or paste profile text first."); return; }
    const missingKeys = [];
    if (!ADZUNA_APP_ID || !ADZUNA_APP_KEY) missingKeys.push("REACT_APP_ADZUNA_APP_ID / REACT_APP_ADZUNA_APP_KEY");
    if (!RAPIDAPI_KEY) missingKeys.push("REACT_APP_RAPIDAPI_KEY");
    if (missingKeys.length > 0) {
      setLayer1Msg(`Warning: missing API keys: ${missingKeys.join(", ")}. Layer 1 may return 0 results. Continuing anyway.`);
    }
    abort1Ref.current = new AbortController();
    setLayer1Status("running");
    setLayer1Msg("Searching Adzuna and JSearch...");
    try {
      const [adzuna, jsearch] = await Promise.allSettled([
        fetchAdzunaJobs(profileText.trim(), abort1Ref.current.signal),
        fetchJSearchJobs(abort1Ref.current.signal),
      ]).then(r => r.map(x => x.status === "fulfilled" ? x.value : []));
      const combined = [...adzuna, ...jsearch].map(j => ({ ...j, source_layer: "job_boards" }));
      setAccumulatedRaw(prev => mergeRawJobs(prev, combined));
      setLayer1Msg(`Done. Found ${combined.length} listings from Adzuna and JSearch.`);
      setLayer1Status("done");
      setScoutReady(true);
    } catch (err) {
      if (err.name === "AbortError") { setLayer1Status("idle"); setLayer1Msg(""); return; }
      setLayer1Status("error");
      setLayer1Msg(`Layer 1 error: ${err.message}`);
    }
  };

  const handleLayer2 = async () => {
    if (!ANTHROPIC_API_KEY) { setError("REACT_APP_ANTHROPIC_API_KEY is not set."); return; }
    if (profileText.trim().length <= 50) { setError("Upload a resume or paste profile text first."); return; }
    abort2Ref.current = new AbortController();
    setLayer2Status("running");
    setLayer2Msg("Searching RSS feeds (WeWorkRemotely, Remotive, RemoteOK, Stack Overflow)...");
    try {
      const rss = await fetchRssJobs(abort2Ref.current.signal, (msg) => setLayer2Msg(msg));
      const combined = rss.map(j => ({ ...j, source_layer: "rss" }));
      setAccumulatedRaw(prev => mergeRawJobs(prev, combined));
      setLayer2Msg(`Done. Found ${combined.length} listings from RSS feeds.`);
      setLayer2Status("done");
      setScoutReady(true);
    } catch (err) {
      if (err.name === "AbortError") { setLayer2Status("idle"); setLayer2Msg(""); return; }
      setLayer2Status("error");
      setLayer2Msg(`Layer 2 error: ${err.message}`);
    }
  };

  const handleLayer3 = async () => {
    if (!ANTHROPIC_API_KEY) { setError("REACT_APP_ANTHROPIC_API_KEY is not set."); return; }
    if (profileText.trim().length <= 50) { setError("Upload a resume or paste profile text first."); return; }
    abort3Ref.current = new AbortController();
    setLayer3Status("running");
    setLayer3Msg("Searching ATS boards (Greenhouse, Lever, Workday)...");
    try {
      const ats = await fetchAtsJobs(ANTHROPIC_API_KEY, profileText.trim(), abort3Ref.current.signal);
      const combined = ats.map(j => ({ ...j, source_layer: "ats" }));
      setAccumulatedRaw(prev => mergeRawJobs(prev, combined));
      setLayer3Msg(`Done. Found ${combined.length} listings from ATS boards.`);
      setLayer3Status("done");
      setScoutReady(true);
    } catch (err) {
      if (err.name === "AbortError") { setLayer3Status("idle"); setLayer3Msg(""); return; }
      setLayer3Status("error");
      setLayer3Msg(`Layer 3 error: ${err.message}`);
    }
  };

  const handleScoreAndAdvance = async () => {
    if (accumulatedRaw.length === 0) { setError("Run at least one search layer first."); return; }
    setStatus("running");
    setProgressMsg("Deduplicating listings...");
    setError(null);
    abortRef.current = new AbortController();
    timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    try {
      const seenUrls = new Set();
      const seenKeys = new Set();
      const deduped = accumulatedRaw.filter(j => {
        if (!j.url) return false;
        if (seenUrls.has(j.url)) return false;
        const ctKey = companyTitleKey(j);
        if (ctKey !== "|" && seenKeys.has(ctKey)) return false;
        seenUrls.add(j.url);
        if (ctKey !== "|") seenKeys.add(ctKey);
        return true;
      });
      setProgressMsg(`Pre-filtering ${deduped.length} listings (${accumulatedRaw.length - deduped.length} duplicates removed)...`);
      const { passed, rejected: preRejected } = keywordPreFilter(deduped);
      setProgressMsg(`${passed.length} passed pre-filter. Scoring with Haiku...`);

      const scored = await scoreRawJobs(
        ANTHROPIC_API_KEY, profileText.trim(), passed, abortRef.current.signal,
        (msg) => setProgressMsg(msg)
      );
      const allScored = [...scored, ...preRejected];

      const allTiers = { strong_match: [], possible: [], weak: [], rejected: [] };
      for (const job of allScored) {
        const s = job.total_score;
        if (s >= 8) allTiers.strong_match.push(job);
        else if (s >= 6) allTiers.possible.push(job);
        else if (s >= 3) allTiers.weak.push(job);
        else allTiers.rejected.push(job);
      }

      const { tiers: filteredTiers, filtered } = filterAppliedFromTiers(allTiers, appliedList);
      const dismissed = loadDismissedJobs();
      if (dismissed.length > 0) {
        for (const tier of Object.keys(filteredTiers)) {
          filteredTiers[tier] = filteredTiers[tier].filter(j => !isDismissed(j, dismissed));
        }
      }
      const totalFound = Object.values(filteredTiers).reduce((s, a) => s + a.length, 0);
      setRunSummary({
        total: accumulatedRaw.length,
        deduped: deduped.length,
        passed: passed.length,
        strong: filteredTiers.strong_match?.length ?? 0,
        possible: filteredTiers.possible?.length ?? 0,
        weak: filteredTiers.weak?.length ?? 0,
        rejected: filteredTiers.rejected?.length ?? 0,
      });
      const data = {
        found: totalFound > 0,
        summary: `Found ${totalFound} roles across all searched sources.${filtered > 0 ? ` ${filtered} previously applied role(s) excluded.` : ""}`,
        tiers: filteredTiers,
        notes: `Total raw: ${accumulatedRaw.length}. Deduped: ${deduped.length}. Passed pre-filter: ${passed.length}.`,
      };

      setProgressMsg("Fetching full job descriptions and re-scoring...");
      const enhanced = await runJdFetchAndRescore(
        ANTHROPIC_API_KEY, profileText.trim(), data, abortRef.current.signal,
        (msg) => setProgressMsg(msg)
      );
      saveLastScoutResults(enhanced);
      setStatus("done");
      onComplete(enhanced);
    } catch (err) {
      if (err.name === "AbortError") { setStatus("cancelled"); }
      else { setStatus("error"); setError(err.message); }
    } finally {
      clearInterval(timerRef.current);
    }
  };

  const hasProfile = profileText.trim().length > 50;

  return (
    <div className="content">
      <GuideBar emoji={"\uD83D\uDC4B"} text="Upload your resume, then run one or more search layers to find matching jobs." />

      {/* Step 1: Upload Resume */}
      <div className="card mb-14">
        <div className="section-title"><span className="step-num">1</span> Upload Resume</div>
        <div className="tab-bar mb-10">
          <button className={`tab-btn${inputMode === "upload" ? " active" : ""}`} onClick={() => setInputMode("upload")} disabled={status === "running"}>Upload PDF/TXT</button>
          <button className={`tab-btn${inputMode === "paste" ? " active" : ""}`} onClick={() => setInputMode("paste")} disabled={status === "running"}>Paste Resume Text</button>
        </div>
        {inputMode === "upload" && (
          <div className="dashed-box">
            <input ref={fileRef} type="file" accept=".pdf,.txt" onChange={handleFile} className="hidden" />
            <button type="button" className="btn primary" onClick={() => fileRef.current?.click()} disabled={status === "running"}>Upload Resume (PDF or TXT)</button>
            {fileName && <p className="text-hint mt-8">{fileName}</p>}
            {extracting && <p className="text-hint">Extracting...</p>}
            {hasProfile && !extracting && <p className="text-success mt-4">{profileText.length} characters extracted</p>}
            {fileError && <p className="text-error">{fileError}</p>}
          </div>
        )}
        {inputMode === "paste" && (
          <div className="mb-16">
            <textarea className="form-textarea" placeholder="Paste your resume text here..." value={profileText} onChange={(e) => setProfileText(e.target.value)} rows={12} disabled={status === "running"} />
            {profileText.trim().length > 50 && <p className="text-success mt-4">{profileText.length} characters</p>}
          </div>
        )}
        {hasProfile && status !== "running" && inputMode === "upload" && (
          <details className="mt-8">
            <summary className="text-hint mb-6 cursor-pointer">Review extracted profile</summary>
            <textarea className="form-textarea" value={profileText} onChange={(e) => setProfileText(e.target.value)} rows={10} />
          </details>
        )}
      </div>

      {error && <p className="text-error">{error}</p>}

      {/* Step 2: Search for Jobs */}
      {status !== "running" && (
        <div className="card mb-14">
          <div className="section-title"><span className="step-num">2</span> Search for Jobs</div>
          <button className="search-btn" disabled={!hasProfile || layer1Status === "running"} onClick={handleLayer1}>
            <span className="icon">{"\uD83D\uDCBC"}</span>
            <span className="info">
              {layer1Status === "running" ? <span className="running-label"><Spinner />Searching job boards...</span> : <><span className="label">Job Boards</span><span className="sub">Adzuna + JSearch</span></>}
            </span>
            {layer1Status === "running" ? <span className="arrow" onClick={(e) => { e.stopPropagation(); abort1Ref.current?.abort(); setLayer1Status("idle"); setLayer1Msg(""); }}>Cancel</span> : <span className="arrow">{"\u203A"}</span>}
          </button>
          {layer1Msg && <p className={layer1Status === "error" ? "text-error" : "text-hint mb-8"}>{layer1Msg}</p>}

          <button className="search-btn" disabled={!hasProfile || layer2Status === "running"} onClick={handleLayer2}>
            <span className="icon">{"\uD83D\uDCE1"}</span>
            <span className="info">
              {layer2Status === "running" ? <span className="running-label"><Spinner />Scouting RSS feeds...</span> : <><span className="label">RSS Feeds</span><span className="sub">WeWorkRemotely, Remotive, RemoteOK</span></>}
            </span>
            {layer2Status === "running" ? <span className="arrow" onClick={(e) => { e.stopPropagation(); abort2Ref.current?.abort(); setLayer2Status("idle"); setLayer2Msg(""); }}>Cancel</span> : <span className="arrow">{"\u203A"}</span>}
          </button>
          {layer2Msg && <p className={layer2Status === "error" ? "text-error" : "text-hint mb-8"}>{layer2Msg}</p>}

          <button className="search-btn" disabled={!hasProfile || layer3Status === "running"} onClick={handleLayer3}>
            <span className="icon">{"\uD83C\uDFE2"}</span>
            <span className="info">
              {layer3Status === "running" ? <span className="running-label"><Spinner />Scouting ATS boards...</span> : <><span className="label">ATS Boards</span><span className="sub">Greenhouse, Lever, Workday</span></>}
            </span>
            {layer3Status === "running" ? <span className="arrow" onClick={(e) => { e.stopPropagation(); abort3Ref.current?.abort(); setLayer3Status("idle"); setLayer3Msg(""); }}>Cancel</span> : <span className="arrow">{"\u203A"}</span>}
          </button>
          {layer3Msg && <p className={layer3Status === "error" ? "text-error" : "text-hint mb-8"}>{layer3Msg}</p>}

          {accumulatedRaw.length > 0 && <p className="text-hint mb-8">{accumulatedRaw.length} raw listings accumulated across layers.</p>}
        </div>
      )}

      {/* Step 3: Score Results */}
      {status !== "running" && (
        <div className="card mb-14">
          <div className="section-title"><span className="step-num">3</span> Score Results</div>
          <button className="btn primary full" disabled={!scoutReady} onClick={handleScoreAndAdvance}>Score & Review ({accumulatedRaw.length} listings)</button>
          {!scoutReady && <p className="text-hint mt-4">Run at least one search layer before scoring.</p>}
        </div>
      )}

      {/* Scoring in progress */}
      {status === "running" && (
        <div className="card mb-14">
          <p className="text-p"><Spinner />{progressMsg} ({elapsed}s)</p>
          {jobCount > 0 && <p className="text-p">Found {jobCount} potential matches so far...</p>}
          {subStatus && <p className="text-hint mt-4">{subStatus}</p>}
          <button className="btn default mt-12" onClick={() => { abortRef.current?.abort(); clearInterval(timerRef.current); setStatus("cancelled"); }}>Cancel Scoring</button>
        </div>
      )}
      {runSummary && status !== "running" && (
        <div className="run-summary">
          <p className="run-summary-title">Run Summary</p>
          <p className="run-summary-line">Raw scanned: {runSummary.total} | After dedup: {runSummary.deduped} | Passed pre-filter: {runSummary.passed}</p>
          <p className="run-summary-line bold">Strong matches (8-10): {runSummary.strong} | Possible (6-7): {runSummary.possible}</p>
          <p className="run-summary-line muted">Weak: {runSummary.weak} | Auto-rejected: {runSummary.rejected}</p>
        </div>
      )}
      {status === "error" && <button className="btn default mt-8" onClick={() => { setStatus("idle"); setError(null); }}>Retry Scoring</button>}
      {status === "cancelled" && (
        <div className="mt-8">
          <p className="text-p">Scoring cancelled.</p>
          <button className="btn default" onClick={() => setStatus("idle")}>Retry</button>
        </div>
      )}

      {/* Quick Score */}
      <ManualJobInput profileText={profileText} apiKey={ANTHROPIC_API_KEY} onJobScored={(job) => setAccumulatedRaw(prev => mergeRawJobs(prev, [job]))} />
    </div>
  );
}

// ============================================================
// PHASE 2: REVIEW
// ============================================================

const TIER_CONFIG = [
  { label: "Strong", emoji: "\u2705", key: "strong_match", tabClass: "strong-tab" },
  { label: "Possible", emoji: "\uD83D\uDD36", key: "possible", tabClass: "possible-tab" },
  { label: "Weak", emoji: "\u26A0\uFE0F", key: "weak", tabClass: "weak-tab" },
];

function ReviewPhase({ scoutResults, appliedList, onAdvance }) {
  const [activeTab, setActiveTab] = useState("strong_match");
  const [sortBy, setSortBy] = useState("score");
  const [selected, setSelected] = useState([]);

  const tiers = scoutResults?.tiers ?? {};
  const isSelected = (job) => selected.some(s => jobKey(s) === jobKey(job));
  const toggle = (job) => setSelected(prev =>
    isSelected(job) ? prev.filter(j => jobKey(j) !== jobKey(job)) : [...prev, job]
  );
  const selectAllStrong = () => {
    const keys = new Set(selected.map(jobKey));
    setSelected(prev => [...prev, ...(tiers.strong_match ?? []).filter(j => !keys.has(jobKey(j)))]);
  };

  const jobs = (tiers[activeTab] ?? []).slice().sort((a, b) => {
    if (sortBy === "score") return b.total_score - a.total_score;
    if (sortBy === "date") {
      if (!a.date_posted && !b.date_posted) return 0;
      if (!a.date_posted) return 1;
      if (!b.date_posted) return -1;
      return new Date(b.date_posted) - new Date(a.date_posted);
    }
    return a.company.localeCompare(b.company);
  });

  const totalJobs = Object.values(tiers).reduce((s, a) => s + (a?.length || 0), 0);

  return (
    <div className="content">
      <GuideBar emoji={"\uD83C\uDFAF"} text="Select jobs for tailored documents, then advance." />
      <div className="text-p mb-12">{scoutResults?.summary} ({totalJobs} total)</div>

      <div className="tier-tabs">
        {TIER_CONFIG.map(tab => (
          <button key={tab.key} className={`tier-tab ${tab.tabClass}${activeTab === tab.key ? " active" : ""}`} onClick={() => setActiveTab(tab.key)}>
            {tab.emoji} {tab.label} ({(tiers[tab.key] ?? []).length})
          </button>
        ))}
      </div>

      <div className="sort-row">
        <label>Sort by:</label>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="form-select">
          <option value="score">Score</option>
          <option value="date">Date Posted (newest first)</option>
          <option value="company">Company</option>
        </select>
      </div>

      {jobs.length === 0
        ? <p className="text-p">No jobs in this tier.</p>
        : jobs.map((job, i) => (
          <JobCard key={i} job={job} selectable={activeTab === "strong_match" || activeTab === "possible"} selected={isSelected(job)} onToggle={toggle} />
        ))
      }

      {(activeTab === "strong_match" || activeTab === "possible") && (
        <div className="mt-12">
          {activeTab === "strong_match" && (
            <button className="btn ghost sm" onClick={selectAllStrong}>Select All ({(tiers.strong_match ?? []).length})</button>
          )}
          <p className="text-hint mt-8">{selected.length} job{selected.length !== 1 ? "s" : ""} selected for tailoring</p>
        </div>
      )}

      <div className="flex-end mt-12">
        <button className="btn glow-btn" disabled={selected.length === 0} onClick={() => {
          const allCandidates = [...(tiers.strong_match ?? []), ...(tiers.possible ?? [])];
          allCandidates.filter(j => !isSelected(j)).forEach(j => saveDismissedJob(j));
          onAdvance(selected);
        }}>
          Advance to Tailor ({selected.length})
        </button>
      </div>
    </div>
  );
}

// ============================================================
// TAILOR PHASE (on-demand per job)
// ============================================================

function TailorPhase({ approvedJobs, profileText, onComplete }) {
  const [downloadFormat, setDownloadFormat] = useState("txt");
  // Per-job generation state: { [jobKey]: { resumeStatus, coverStatus, resume, coverLetter, error } }
  const [jobState, setJobState] = useState(() => {
    // Restore any previously saved results from localStorage
    const saved = loadTailorResults();
    const restored = {};
    for (const r of saved) {
      const key = companyTitleKey({ company: r.company, title: r.job_title });
      // Find the matching approved job to use its jobKey
      const match = approvedJobs.find(j => companyTitleKey(j) === key);
      if (match) {
        restored[jobKey(match)] = {
          resumeStatus: r.resume ? "done" : "idle",
          coverStatus: r.cover_letter ? "done" : "idle",
          resume: r.resume || null,
          coverLetter: r.cover_letter || null,
        };
      }
    }
    return restored;
  });
  const abortRefs = useRef({});
  const lastCallTime = useRef(0);

  const getJobState = (job) => jobState[jobKey(job)] ?? {};

  const setJobField = (job, fields) => {
    setJobState(prev => ({
      ...prev,
      [jobKey(job)]: { ...prev[jobKey(job)], ...fields },
    }));
  };

  // Rate-limit helper: waits until TAILOR_DELAY_MS has elapsed since last API call
  const waitForRateLimit = async () => {
    const now = Date.now();
    const elapsed = now - lastCallTime.current;
    if (lastCallTime.current > 0 && elapsed < TAILOR_DELAY_MS) {
      await new Promise(r => setTimeout(r, TAILOR_DELAY_MS - elapsed));
    }
    lastCallTime.current = Date.now();
  };

  // Persist the current state of a completed job to localStorage
  const persistJobResult = (job, fields) => {
    const currentState = { ...jobState[jobKey(job)], ...fields };
    saveTailorResult({
      job_title: job.title,
      company: job.company,
      url: job.url || "",
      resume: currentState.resume || "",
      cover_letter: currentState.coverLetter || "",
    });
  };

  const handleCreateResume = async (job) => {
    const key = jobKey(job);
    abortRefs.current[key + "_resume"] = new AbortController();
    setJobField(job, { resumeStatus: "running", resumeError: null });
    try {
      await waitForRateLimit();
      const data = await withRetry(() => callAnthropic({
        apiKey: ANTHROPIC_API_KEY,
        system: TAILOR_SYSTEM,
        messages: [{ role: "user", content: buildResumeOnlyPrompt(profileText, job) }],
        maxTokens: 4000,
        signal: abortRefs.current[key + "_resume"].signal,
      }));
      const raw = extractTextFromBlocks(data.content);
      const parsed = extractJson([raw]);
      setJobField(job, { resumeStatus: "done", resume: parsed.resume });
      persistJobResult(job, { resume: parsed.resume });
    } catch (err) {
      if (err.name === "AbortError") { setJobField(job, { resumeStatus: "idle" }); return; }
      console.error(`Tailor resume failed for ${job.title} at ${job.company}:`, err);
      setJobField(job, { resumeStatus: "error", resumeError: err.message });
    }
  };

  const handleCreateCoverLetter = async (job) => {
    const key = jobKey(job);
    abortRefs.current[key + "_cover"] = new AbortController();
    setJobField(job, { coverStatus: "running", coverError: null });
    try {
      await waitForRateLimit();
      const data = await withRetry(() => callAnthropic({
        apiKey: ANTHROPIC_API_KEY,
        system: TAILOR_SYSTEM,
        messages: [{ role: "user", content: buildCoverLetterOnlyPrompt(profileText, job) }],
        maxTokens: 2000,
        signal: abortRefs.current[key + "_cover"].signal,
      }));
      const raw = extractTextFromBlocks(data.content);
      const parsed = extractJson([raw]);
      setJobField(job, { coverStatus: "done", coverLetter: parsed.cover_letter });
      persistJobResult(job, { coverLetter: parsed.cover_letter });
    } catch (err) {
      if (err.name === "AbortError") { setJobField(job, { coverStatus: "idle" }); return; }
      console.error(`Tailor cover letter failed for ${job.title} at ${job.company}:`, err);
      setJobField(job, { coverStatus: "error", coverError: err.message });
    }
  };

  const download = (content, baseName, type) => {
    if (downloadFormat === "pdf") {
      const win = window.open("", "_blank");
      if (!win) return;
      const escaped = content.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
      win.document.write(`<!DOCTYPE html><html><head><title>${baseName}</title><style>body{font-family:Arial,sans-serif;white-space:pre-wrap;padding:40px;max-width:800px;margin:0 auto;font-size:13px;line-height:1.6}@media print{body{padding:20px}}</style></head><body><pre>${escaped}</pre></body></html>`);
      win.document.close();
      win.focus();
      setTimeout(() => { win.print(); }, 400);
      return;
    }
    const ext = downloadFormat === "md" ? ".md" : ".txt";
    const mimeType = downloadFormat === "md" ? "text/markdown" : "text/plain";
    const finalContent = downloadFormat === "md"
      ? `# ${type === "resume" ? "Resume" : "Cover Letter"}: ${baseName}\n\n${content}`
      : content;
    const blob = new Blob([finalContent], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${baseName}${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copy = async (text) => {
    try { await navigator.clipboard.writeText(text); } catch { /* noop */ }
  };

  // Advance to Complete only enabled when at least one job has both resume and cover letter
  const anyComplete = approvedJobs.some(job => {
    const s = getJobState(job);
    return s.resume && s.coverLetter;
  });

  // Build tailorResults format for CompletePhase
  const handleAdvance = () => {
    const results = approvedJobs
      .filter(job => { const s = getJobState(job); return s.resume || s.coverLetter; })
      .map(job => {
        const s = getJobState(job);
        return {
          job_title: job.title,
          company: job.company,
          url: job.url || "",
          resume: s.resume || "",
          cover_letter: s.coverLetter || "",
        };
      });
    onComplete(results);
  };

  if (approvedJobs.length === 0) {
    return (
      <div className="content">
        <GuideBar emoji={"\u23F3"} text="Generating tailored resumes and cover letters. This will not take long!" />
        <p className="text-p">No jobs were approved for tailoring.</p>
      </div>
    );
  }

  return (
    <div className="content">
      <GuideBar emoji={"\u23F3"} text="Generating tailored resumes and cover letters. This will not take long!" />
      <div className="format-row">
        <span className="format-label">Download format:</span>
        <select value={downloadFormat} onChange={e => setDownloadFormat(e.target.value)} className="form-select">
          <option value="txt">Plain Text (.txt)</option>
          <option value="md">Markdown (.md)</option>
          <option value="pdf">PDF (print dialog)</option>
        </select>
      </div>
      {(() => {
        const restoredCount = Object.values(jobState).filter(s => s.resume || s.coverLetter).length;
        return restoredCount > 0 ? <p className="text-success mb-12">Restored {restoredCount} result(s) from previous session.</p> : null;
      })()}

      {approvedJobs.map((job, i) => {
        const s = getJobState(job);
        const resumeRunning = s.resumeStatus === "running";
        const coverRunning = s.coverStatus === "running";
        const isReady = s.resume && s.coverLetter;
        const isGenerating = resumeRunning || coverRunning;
        const cardClass = isReady ? "card glow a-success" : isGenerating ? "card a-warn" : "card a-gray";
        const statusLabel = isReady ? "Ready" : isGenerating ? "Generating..." : "Pending";
        const statusClass = isReady ? "status-chip status-ready" : isGenerating ? "status-chip status-gen" : "status-chip status-pending";

        return (
          <div key={i} className={cardClass}>
            <div className="flex-between">
              <div>
                <div className="job-title">{job.title}</div>
                <div className="job-meta">{job.company}</div>
              </div>
              <span className={statusClass}>{isReady ? "\u2705 " : isGenerating ? "\u23F3 " : ""}{statusLabel}</span>
            </div>
            <div className="flex-gap mt-12">
              {!s.resume ? (
                <button className="btn primary sm" disabled={resumeRunning} onClick={() => handleCreateResume(job)}>
                  {resumeRunning ? <><Spinner />Resume...</> : "\uD83D\uDCC4 Resume"}
                </button>
              ) : (
                <>
                  <button className="btn primary sm" onClick={() => download(s.resume, `${job.company}_resume`, "resume")}>{"\uD83D\uDCC4"} Resume</button>
                  <button className="btn default sm" onClick={() => copy(s.resume)}>Copy</button>
                  <button className="btn default sm" onClick={() => handleCreateResume(job)}>Redo</button>
                </>
              )}
              {resumeRunning && <button className="btn default sm" onClick={() => abortRefs.current[jobKey(job) + "_resume"]?.abort()}>Cancel</button>}

              {!s.coverLetter ? (
                <button className="btn primary sm" disabled={coverRunning} onClick={() => handleCreateCoverLetter(job)}>
                  {coverRunning ? <><Spinner />Cover...</> : "\uD83D\uDCDD Cover Letter"}
                </button>
              ) : (
                <>
                  <button className="btn primary sm" onClick={() => download(s.coverLetter, `${job.company}_cover_letter`, "cover")}>{"\uD83D\uDCDD"} Cover Letter</button>
                  <button className="btn default sm" onClick={() => copy(s.coverLetter)}>Copy</button>
                  <button className="btn default sm" onClick={() => handleCreateCoverLetter(job)}>Redo</button>
                </>
              )}
              {coverRunning && <button className="btn default sm" onClick={() => abortRefs.current[jobKey(job) + "_cover"]?.abort()}>Cancel</button>}

              {isReady && (
                <button className="btn default sm" onClick={() => { download(s.resume, `${job.company}_resume`, "resume"); download(s.coverLetter, `${job.company}_cover_letter`, "cover"); }}>{"\u2B07\uFE0F"} Download</button>
              )}
            </div>
            {s.resumeError && <p className="text-error mt-4">{s.resumeError}</p>}
            {s.coverError && <p className="text-error mt-4">{s.coverError}</p>}
          </div>
        );
      })}

      <button className="btn glow-btn full mt-16" disabled={!anyComplete} onClick={handleAdvance}>Advance to Complete</button>
      {!anyComplete && <p className="text-hint mt-4">Generate at least one resume and one cover letter to advance.</p>}
    </div>
  );
}

// ============================================================
// PHASE 5: COMPLETE
// ============================================================

function AppliedTracker({ appliedList, onRemove, onClear }) {
  const [expanded, setExpanded] = useState(true);

  const formatDate = (iso) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <div className="tracker-card">
      <div className="tracker-header" onClick={() => setExpanded(e => !e)}>
        <span>{"\uD83D\uDCCA"} Applied Tracker ({appliedList.length})</span>
        <span>{expanded ? "\u25B2" : "\u25BC"}</span>
      </div>
      {expanded && (
        appliedList.length === 0 ? (
          <p className="text-p mt-12">No applications tracked yet.</p>
        ) : (
          <>
            {appliedList.map((entry, i) => (
              <div key={i} className="tracker-row">
                <input type="checkbox" checked readOnly className="tracker-check" />
                <span className="tracker-label">{entry.title} {entry.company ? `\u2014 ${entry.company}` : ""}</span>
                <span className="tracker-date">{formatDate(entry.appliedDate)}</span>
                {entry.url && <a href={entry.url} target="_blank" rel="noopener noreferrer" className="text-link">View</a>}
                <button className="tracker-remove" onClick={() => onRemove(i)}>Remove</button>
              </div>
            ))}
            <button className="btn danger-btn sm mt-8" onClick={onClear}>Clear All</button>
          </>
        )
      )}
    </div>
  );
}

function CompletePhase({ tailorResults, appliedList, onAddApplied, onRemoveApplied, onClearApplied, onRunAgain }) {
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [copiedType, setCopiedType] = useState(null);
  const [downloadFormat, setDownloadFormat] = useState("txt");

  const download = (content, baseName, type) => {
    if (downloadFormat === "pdf") {
      const win = window.open("", "_blank");
      if (!win) return;
      const escaped = content.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
      win.document.write(`<!DOCTYPE html><html><head><title>${baseName}</title><style>body{font-family:Arial,sans-serif;white-space:pre-wrap;padding:40px;max-width:800px;margin:0 auto;font-size:13px;line-height:1.6}@media print{body{padding:20px}}</style></head><body><pre>${escaped}</pre></body></html>`);
      win.document.close();
      win.focus();
      setTimeout(() => { win.print(); }, 400);
      return;
    }
    const ext = downloadFormat === "md" ? ".md" : ".txt";
    const mimeType = downloadFormat === "md" ? "text/markdown" : "text/plain";
    const finalContent = downloadFormat === "md"
      ? `# ${type === "resume" ? "Resume" : "Cover Letter"}: ${baseName}\n\n${content}`
      : content;
    const blob = new Blob([finalContent], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${baseName}${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copy = async (text, index, type) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setCopiedType(type);
      setTimeout(() => { setCopiedIndex(null); setCopiedType(null); }, 2000);
    } catch { /* noop */ }
  };

  const isApplied = (result) => appliedList.some(j =>
    (j.url && j.url === result.url) ||
    (j.company?.toLowerCase() === result.company?.toLowerCase() && j.title?.toLowerCase() === result.job_title?.toLowerCase())
  );

  const estimateWords = (text) => text ? text.split(/\s+/).length : 0;

  return (
    <div className="content">
      <GuideBar emoji={"\uD83C\uDF89"} text="Your tailored documents are ready! Download, apply, and track." />

      <div className="format-row">
        <span className="format-label">Download format:</span>
        <select value={downloadFormat} onChange={e => setDownloadFormat(e.target.value)} className="form-select">
          <option value="txt">Plain Text (.txt)</option>
          <option value="md">Markdown (.md)</option>
          <option value="pdf">PDF (print dialog)</option>
        </select>
      </div>

      {tailorResults.map((r, i) => {
        const applied = isApplied(r);
        const cardClass = applied ? "card glow a-success" : "card a-yellow";
        return (
          <div key={i} className={cardClass}>
            <div className="flex-between">
              <div>
                <div className="job-title">{r.job_title}</div>
                <div className="job-meta">{r.company}</div>
              </div>
              {applied && <span className="applied-chip">{"\u2705"} Applied</span>}
            </div>
            {r.url && <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-link mb-10">View Posting</a>}
            {r.error ? (
              <p className="text-error">{r.error}</p>
            ) : (
              <>
                <div className="flex-gap mt-12">
                  <button className="btn primary sm" onClick={() => download(r.resume, `${r.company}_resume`, "resume")}>{"\uD83D\uDCE5"} Resume</button>
                  <button className="btn primary sm" onClick={() => download(r.cover_letter, `${r.company}_cover_letter`, "cover")}>{"\uD83D\uDCE5"} Cover Letter</button>
                  {!applied && (
                    <button className="btn glow-btn sm" onClick={() => onAddApplied({
                      title: r.job_title, company: r.company, url: r.url || "",
                      appliedDate: new Date().toISOString().slice(0, 10),
                    })}>Mark Applied</button>
                  )}
                </div>
              </>
            )}
          </div>
        );
      })}

      <AppliedTracker appliedList={appliedList} onRemove={onRemoveApplied} onClear={onClearApplied} />

      <div className="flex-gap mt-16">
        <button className="btn primary" onClick={onRunAgain}>{"\uD83D\uDD04"} New Search</button>
      </div>
    </div>
  );
}

// ============================================================
// MAIN PIPELINE
// ============================================================

export default function JobSearchPipelineV4() {
  const [started, setStarted] = useState(false);
  const [profileText, setProfileText] = useState("");
  const [phase, setPhase] = useState(0);
  const [scoutResults, setScoutResults] = useState(null);
  const [approvedJobs, setApprovedJobs] = useState([]);
  const [tailorResults, setTailorResults] = useState(() => loadTailorResults());
  const [appliedJobs, setAppliedJobs] = useState(loadAppliedJobs);
  const [maxVisited, setMaxVisited] = useState(0);

  const advanceTo = useCallback((n) => {
    setPhase(n);
    setMaxVisited(prev => Math.max(prev, n));
  }, []);

  useEffect(() => { saveAppliedJobs(appliedJobs); }, [appliedJobs]);

  const addAppliedJob = useCallback((job) => {
    setAppliedJobs(prev => {
      const dup = prev.some(j => isAppliedMatch(j, job));
      return dup ? prev : [...prev, job];
    });
  }, []);

  const removeAppliedJob = useCallback((index) => {
    setAppliedJobs(prev => prev.filter((_, i) => i !== index));
  }, []);

  const clearAppliedJobs = useCallback(() => {
    setAppliedJobs([]);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SCOUT_STORAGE_KEY);
  }, []);

  const handleTailorComplete = useCallback((results) => {
    setTailorResults(results);
    advanceTo(3);
  }, [advanceTo]);

  const handleRunAgain = useCallback(() => {
    setScoutResults(null);
    setApprovedJobs([]);
    setPhase(0);
    setMaxVisited(0);
  }, []);

  const handleStartOver = useCallback(() => {
    const msg = tailorResults.length > 0
      ? "This will clear your current search results. Your tailored documents and applied jobs will be preserved. Continue?"
      : "This will clear your current search results. Continue?";
    if (!window.confirm(msg)) return;
    setScoutResults(null);
    setApprovedJobs([]);
    setPhase(0);
    setMaxVisited(0);
  }, [tailorResults]);

  if (!started) {
    return (
      <div className="jsp-app">
        <LandingScreen onStart={() => setStarted(true)} />
      </div>
    );
  }

  return (
    <div className="jsp-app">
      <Header />
      <ProgressStepper current={phase} maxVisited={maxVisited} onTabClick={setPhase} />

      {maxVisited > 0 && (
        <div className="start-over-row">
          <button className="btn danger-btn sm" onClick={handleStartOver}>Start Over</button>
        </div>
      )}

      {phase === 0 && tailorResults.length > 0 && (
        <div className="saved-notice">
          <p className="saved-notice-text">You have {tailorResults.length} saved tailor result(s) from a previous session.</p>
          <div className="flex-gap">
            <button className="btn primary sm" onClick={() => advanceTo(3)}>View Results</button>
            <button className="btn default sm" onClick={() => { clearTailorResults(); setTailorResults([]); }}>Dismiss</button>
          </div>
        </div>
      )}

      {phase === 0 && (
        <ScoutPhase
          profileText={profileText}
          setProfileText={setProfileText}
          appliedList={appliedJobs}
          onComplete={(data) => { setScoutResults(data); advanceTo(1); }}
        />
      )}

      {phase === 1 && (
        <ReviewPhase
          scoutResults={scoutResults}
          appliedList={appliedJobs}
          onAdvance={(jobs) => { setApprovedJobs(jobs); advanceTo(2); }}
        />
      )}

      {phase === 2 && (
        <TailorPhase
          approvedJobs={approvedJobs}
          profileText={profileText}
          onComplete={handleTailorComplete}
        />
      )}

      {phase === 3 && (
        <CompletePhase
          tailorResults={tailorResults}
          appliedList={appliedJobs}
          onAddApplied={addAppliedJob}
          onRemoveApplied={removeAppliedJob}
          onClearApplied={clearAppliedJobs}
          onRunAgain={handleRunAgain}
        />
      )}
    </div>
  );
}


// Named exports for testing
export {
  normalizeTitle,
  companyTitleKey,
  stripCodeFences,
  extractOutermostJson,
  extractJson,
  extractTextFromBlocks,
  jobKey,
  isAppliedMatch,
  deduplicateJobs,
  mergeRawJobs,
  mergeScoutResults,
  reTierJobs,
  filterAppliedFromTiers,
  keywordPreFilter,
  buildTailorPrompt,
  buildResumeOnlyPrompt,
  buildCoverLetterOnlyPrompt,
  loadTailorResults,
  saveTailorResult,
  clearTailorResults,
  TAILOR_RESULTS_KEY,
  TAILOR_DELAY_MS,
  TailorPhase,
  callAnthropic,
};
