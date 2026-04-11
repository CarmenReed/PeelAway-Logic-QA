// utils.js
// Pure utility functions (no API calls, no localStorage, no React)

export function stripCodeFences(text) {
  const s = text.trim();
  if (s.startsWith("```")) {
    return s.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  }
  return s;
}

export function extractOutermostJson(text) {
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

export function extractJson(textBlocks) {
  const blocks = Array.isArray(textBlocks) ? textBlocks : [textBlocks];
  for (let i = blocks.length - 1; i >= 0; i--) {
    const raw = blocks[i].trim();
    try { return JSON.parse(raw); } catch { /* continue */ }
    try { return JSON.parse(stripCodeFences(raw)); } catch { /* continue */ }
    try { return extractOutermostJson(raw); } catch { /* continue */ }
  }
  throw new Error("Could not find valid JSON in the response. The model may not have completed its search.");
}

export function extractTextFromBlocks(content) {
  return content.filter(b => b.type === "text").map(b => b.text).join("\n");
}

export function normalizeTitle(title) {
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

export function companyTitleKey(job) {
  const company = (job.company || "").toLowerCase().trim().replace(/\s+(inc|llc|ltd|corp|co)\.?$/i, "").trim();
  return `${company}|${normalizeTitle(job.title)}`;
}

export function jobKey(job) {
  if (job.url && job.url.length > 0) return job.url;
  return companyTitleKey(job);
}

export function isAppliedMatch(job, entry) {
  if (job.url && entry.url && job.url === entry.url) return true;
  return (job.company || "").toLowerCase() === (entry.company || "").toLowerCase()
    && (job.title || "").toLowerCase() === (entry.title || "").toLowerCase();
}

export function deduplicateJobs(jobs) {
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

export function mergeRawJobs(existing, incoming) {
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

export function mergeScoutResults(results) {
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

  for (const tier of Object.keys(allTiers)) {
    allTiers[tier] = deduplicateJobs(allTiers[tier]);
  }

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

export function reTierJobs(tiers) {
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

export function filterAppliedFromTiers(tiers, appliedList) {
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

export function keywordPreFilter(jobs) {
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
