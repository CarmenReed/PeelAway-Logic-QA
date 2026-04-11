// storage.js
// localStorage read/write helpers

import { STORAGE_KEY, SCOUT_STORAGE_KEY, TAILOR_RESULTS_KEY, DISMISSED_KEY } from "./constants";
import { jobKey } from "./utils";

export function loadAppliedJobs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveAppliedJobs(jobs) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs)); } catch { /* noop */ }
}

export function loadLastScoutResults() {
  try {
    const raw = localStorage.getItem(SCOUT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function saveLastScoutResults(results) {
  try { localStorage.setItem(SCOUT_STORAGE_KEY, JSON.stringify(results)); } catch { /* noop */ }
}

export function loadTailorResults() {
  try {
    const raw = localStorage.getItem(TAILOR_RESULTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveTailorResult(result) {
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

export function clearTailorResults() {
  try { localStorage.removeItem(TAILOR_RESULTS_KEY); } catch { /* noop */ }
}

export function loadDismissedJobs() {
  try { const r = localStorage.getItem(DISMISSED_KEY); return r ? JSON.parse(r) : []; } catch { return []; }
}

export function saveDismissedJob(job) {
  try {
    const existing = loadDismissedJobs();
    const key = jobKey(job);
    if (!existing.some(j => jobKey(j) === key)) {
      existing.push({ title: job.title, company: job.company, url: job.url || "" });
      localStorage.setItem(DISMISSED_KEY, JSON.stringify(existing));
    }
  } catch { }
}

export function clearDismissedJobs() {
  try { localStorage.removeItem(DISMISSED_KEY); } catch { }
}

export function isDismissed(job, dismissedList) {
  return dismissedList.some(d =>
    (d.url && d.url === job.url) ||
    (d.company?.toLowerCase() === job.company?.toLowerCase() && d.title?.toLowerCase() === job.title?.toLowerCase())
  );
}
