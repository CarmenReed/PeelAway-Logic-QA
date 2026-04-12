import { useState, useRef, useEffect } from "react";
import {
  ANTHROPIC_API_KEY, SCORING_MODEL, SCORING_BATCH_SIZE,
  SCORING_BATCH_DELAY_MS, ADZUNA_APP_ID, ADZUNA_APP_KEY, RAPIDAPI_KEY,
} from "../constants";
import {
  extractJson, extractTextFromBlocks, companyTitleKey, jobKey,
  mergeRawJobs, reTierJobs, filterAppliedFromTiers, keywordPreFilter,
} from "../utils";
import { saveLastScoutResults, loadDismissedJobs, isDismissed } from "../storage";
import { withRetry, callAnthropic, callAnthropicWithLoop, extractTextFromPdf } from "../api";
import Spinner from "../components/Spinner";
import GuideBar from "../components/GuideBar";
import ManualJobInput from "../components/ManualJobInput";

async function fetchAdzunaJobs(queries, filters, signal) {
  const workType = filters?.workType || "remote";
  const empType = filters?.employmentType || "full_time";
  const zipCode = filters?.zipCode || "";
  const radius = filters?.radius || "25";
  const results = [];
  for (const q of queries) {
    try {
      let url = `https://api.adzuna.com/v1/api/jobs/us/search/1?app_id=${ADZUNA_APP_ID}&app_key=${ADZUNA_APP_KEY}&results_per_page=10&what=${encodeURIComponent(q)}&sort_by=date`;
      if (workType === "remote") url += "&where=remote";
      else if (zipCode) url += `&where=${encodeURIComponent(zipCode)}&distance=${radius}`;
      if (empType === "full_time") url += "&full_time=1";
      else if (empType === "part_time") url += "&part_time=1";
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

async function fetchJSearchJobs(queries, filters, signal) {
  const datePosted = filters?.datePosted || "week";
  const workType = filters?.workType || "remote";
  const zipCode = filters?.zipCode || "";
  const radius = filters?.radius || "25";
  const results = [];
  for (const q of queries) {
    try {
      let queryStr = q;
      if (workType !== "remote" && zipCode) queryStr += ` near ${zipCode}`;
      let url = `https://jsearch.p.rapidapi.com/search?query=${encodeURIComponent(queryStr)}&page=1&num_pages=1&date_posted=${datePosted}&country=us`;
      if (workType !== "remote" && zipCode) url += `&radius=${radius}`;
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

async function fetchAtsJobs(apiKey, profileText, targetLevels, filters, signal) {
  const levelStr = (targetLevels || ["Senior", "Lead"]).join("/").toLowerCase();
  const workType = filters?.workType || "remote";
  const workTypeStr = workType === "any" ? "" : ` ${workType}`;
  const system = "You are a job search assistant. Use web_search to find currently open job postings on Greenhouse, Lever, and Workday career pages only. Return valid JSON only. No preamble, no markdown fences.";
  const message = `Find 5 to 10 currently open ${levelStr} level${workTypeStr} roles in the United States matching this profile. Search Greenhouse, Lever, and Workday only.

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

async function scoreRawJobs(apiKey, profileText, extractedProfile, rawJobs, signal, onStatus) {
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
      const skillsStr = extractedProfile?.skills?.join(", ") || "not specified";
      const yearsStr = extractedProfile?.yearsExperience ? `, ${extractedProfile.yearsExperience} years experience` : "";
      const levelStr = extractedProfile?.targetLevel?.join(", ") || "Senior, Lead";
      const locationStr = extractedProfile?.location?.join(" or ") || "remote";
      const scoringPrompt = `Score each job against this candidate profile.

CANDIDATE PROFILE (condensed):
${profileText.slice(0, 400)}

KEY SKILLS: ${skillsStr}${yearsStr}.
TARGET LEVEL: ${levelStr} only.
LOCATION: ${locationStr} only.

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
- level_fit (0-5): 5=exact level match, 2-3=ambiguous scope, 0=wrong level or management only
- total_score: skills_fit + level_fit
- date_posted: Use the date_posted value already on the job object if present. If not present, set to null.
- freshness_flag: "fresh" if date_posted is within 14 days of today, "stale" otherwise.

HARD EXCLUSIONS -- set total_score to 0 for: government/defense/clearance, level mismatch (too junior or too senior for target), location mismatch.

Return JSON only: { "scores": [ { "idx": 0, "skills_fit": 3, "level_fit": 4, "total_score": 7, "reasoning": "1 sentence", "key_tech_stack": ["C#", "Azure"], "date_posted": "2025-04-06 or null", "freshness_flag": "fresh or stale" } ] }`;

      const data = await withRetry(() => callAnthropic({
        apiKey,
        model: SCORING_MODEL,
        system: "You are a job scoring AI. Return valid JSON only. No preamble, no markdown fences.",
        messages: [{ role: "user", content: scoringPrompt }],
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

function SearchPhase({ profileText, extractedProfile, appliedList, locked, onComplete, onStartOver }) {
  const [status, setStatus] = useState("idle");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState(null);
  const [progressMsg, setProgressMsg] = useState("");
  const [jobCount, setJobCount] = useState(0);
  const [subStatus, setSubStatus] = useState("");
  const [searchFilters, setSearchFilters] = useState({
    workType: "remote",
    datePosted: "week",
    employmentType: "full_time",
    zipCode: "",
    radius: "25",
  });
  const abortRef = useRef(null);
  const timerRef = useRef(null);

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

  const hasProfile = profileText.trim().length > 50;

  const handleLayer1 = async () => {
    if (!ANTHROPIC_API_KEY) { setError("REACT_APP_ANTHROPIC_API_KEY is not set."); return; }
    if (!hasProfile) { setError("Upload a resume or paste profile text first."); return; }
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
      const adzunaQueries = extractedProfile?.searchQueries?.adzuna || ["Software Engineer"];
      const jsearchQueries = extractedProfile?.searchQueries?.jsearch || ["Software Engineer remote"];
      const [adzuna, jsearch] = await Promise.allSettled([
        fetchAdzunaJobs(adzunaQueries, searchFilters, abort1Ref.current.signal),
        fetchJSearchJobs(jsearchQueries, searchFilters, abort1Ref.current.signal),
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
    if (!hasProfile) { setError("Upload a resume or paste profile text first."); return; }
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
    if (!hasProfile) { setError("Upload a resume or paste profile text first."); return; }
    abort3Ref.current = new AbortController();
    setLayer3Status("running");
    setLayer3Msg("Searching ATS boards (Greenhouse, Lever, Workday)...");
    try {
      const ats = await fetchAtsJobs(ANTHROPIC_API_KEY, profileText.trim(), extractedProfile?.targetLevel, searchFilters, abort3Ref.current.signal);
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
      const { passed, rejected: preRejected } = keywordPreFilter(deduped, extractedProfile);
      setProgressMsg(`${passed.length} passed pre-filter. Scoring with Haiku...`);

      const scored = await scoreRawJobs(
        ANTHROPIC_API_KEY, profileText.trim(), extractedProfile, passed, abortRef.current.signal,
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

  return (
    <div className="content">
      <GuideBar emoji={"\uD83D\uDD0D"} text="Run one or more search layers, then score results to find your best matches." onStartOver={onStartOver} />

      {error && <p className="text-error">{error}</p>}

      {/* Search Filters */}
      {status !== "running" && (
        <div className="card mb-14">
          <div className="section-title"><span className="step-num">1</span> Search for Jobs</div>

          <div className="search-filters mb-12">
            <div className="sf-row">
              <label className="sf-label">Work Type</label>
              <select className="form-input sf-select" value={searchFilters.workType} onChange={(e) => setSearchFilters(f => ({ ...f, workType: e.target.value }))} disabled={locked}>
                <option value="remote">Remote</option>
                <option value="hybrid">Hybrid</option>
                <option value="on-site">On-Site</option>
                <option value="any">Any</option>
              </select>
            </div>
            <div className="sf-row">
              <label className="sf-label">Posted Within</label>
              <select className="form-input sf-select" value={searchFilters.datePosted} onChange={(e) => setSearchFilters(f => ({ ...f, datePosted: e.target.value }))} disabled={locked}>
                <option value="today">Today</option>
                <option value="3days">Last 3 Days</option>
                <option value="week">Last Week</option>
                <option value="month">Last Month</option>
                <option value="all">Any Time</option>
              </select>
            </div>
            <div className="sf-row">
              <label className="sf-label">Employment</label>
              <select className="form-input sf-select" value={searchFilters.employmentType} onChange={(e) => setSearchFilters(f => ({ ...f, employmentType: e.target.value }))} disabled={locked}>
                <option value="full_time">Full-Time</option>
                <option value="part_time">Part-Time</option>
                <option value="contract">Contract</option>
                <option value="any">Any</option>
              </select>
            </div>
            <div className="sf-row">
              <label className="sf-label">Zip Code</label>
              <input type="text" className="form-input sf-select" placeholder="e.g. 33602" maxLength={5} value={searchFilters.zipCode} onChange={(e) => setSearchFilters(f => ({ ...f, zipCode: e.target.value.replace(/\D/g, "").slice(0, 5) }))} disabled={locked || searchFilters.workType === "remote"} />
            </div>
            <div className="sf-row">
              <label className="sf-label">Radius</label>
              <select className="form-input sf-select" value={searchFilters.radius} onChange={(e) => setSearchFilters(f => ({ ...f, radius: e.target.value }))} disabled={locked || searchFilters.workType === "remote"}>
                <option value="10">10 miles</option>
                <option value="25">25 miles</option>
                <option value="50">50 miles</option>
                <option value="100">100 miles</option>
              </select>
            </div>
          </div>

          <button className="search-btn" disabled={locked || !hasProfile || layer1Status === "done" || layer1Status === "running" || layer2Status === "running" || layer3Status === "running"} onClick={handleLayer1}>
            <span className="icon">{"\uD83D\uDCBC"}</span>
            <span className="info">
              {layer1Status === "running" ? <span className="running-label"><Spinner />Searching job boards...</span> : <><span className="label">Job Boards</span><br /><span className="sub">Adzuna + JSearch</span></>}
            </span>
            {layer1Status === "running" ? <span className="arrow" onClick={(e) => { e.stopPropagation(); abort1Ref.current?.abort(); setLayer1Status("idle"); setLayer1Msg(""); }}>Cancel</span> : <span className="arrow">{"\u203A"}</span>}
          </button>
          {layer1Msg && <p className={layer1Status === "error" ? "text-error" : "text-hint mb-8"}>{layer1Msg}</p>}

          <button className="search-btn" disabled={locked || !hasProfile || layer2Status === "done" || layer1Status === "running" || layer2Status === "running" || layer3Status === "running"} onClick={handleLayer2}>
            <span className="icon">{"\uD83D\uDCE1"}</span>
            <span className="info">
              {layer2Status === "running" ? <span className="running-label"><Spinner />Scouting RSS feeds...</span> : <><span className="label">RSS Feeds</span><br /><span className="sub">WeWorkRemotely, Remotive, RemoteOK</span></>}
            </span>
            {layer2Status === "running" ? <span className="arrow" onClick={(e) => { e.stopPropagation(); abort2Ref.current?.abort(); setLayer2Status("idle"); setLayer2Msg(""); }}>Cancel</span> : <span className="arrow">{"\u203A"}</span>}
          </button>
          {layer2Msg && <p className={layer2Status === "error" ? "text-error" : "text-hint mb-8"}>{layer2Msg}</p>}

          <button className="search-btn" disabled={locked || !hasProfile || layer3Status === "done" || layer1Status === "running" || layer2Status === "running" || layer3Status === "running"} onClick={handleLayer3}>
            <span className="icon">{"\uD83C\uDFE2"}</span>
            <span className="info">
              {layer3Status === "running" ? <span className="running-label"><Spinner />Scouting ATS boards...</span> : <><span className="label">ATS Boards</span><br /><span className="sub">Greenhouse, Lever, Workday</span></>}
            </span>
            {layer3Status === "running" ? <span className="arrow" onClick={(e) => { e.stopPropagation(); abort3Ref.current?.abort(); setLayer3Status("idle"); setLayer3Msg(""); }}>Cancel</span> : <span className="arrow">{"\u203A"}</span>}
          </button>
          {layer3Msg && <p className={layer3Status === "error" ? "text-error" : "text-hint mb-8"}>{layer3Msg}</p>}

          {accumulatedRaw.length > 0 && <p className="text-hint mb-8">{accumulatedRaw.length} raw listings accumulated across layers.</p>}
        </div>
      )}

      {/* Score Results */}
      {status !== "running" && (
        <div className="card mb-14">
          <div className="section-title"><span className="step-num">2</span> Score Results</div>
          <button className="btn primary full" disabled={locked || !scoutReady} onClick={handleScoreAndAdvance}>Score & Review ({accumulatedRaw.length} listings)</button>
          {!scoutReady && <p className="text-hint mt-4">Run at least one search layer or add a job manually below.</p>}
          <ManualJobInput profileText={profileText} extractedProfile={extractedProfile} apiKey={ANTHROPIC_API_KEY} scoreRawJobs={scoreRawJobs} onJobScored={(job) => { setAccumulatedRaw(prev => mergeRawJobs(prev, [job])); setScoutReady(true); }} />
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
    </div>
  );
}

export default SearchPhase;
