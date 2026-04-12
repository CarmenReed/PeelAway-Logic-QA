// cloudSync.js
// Sync layer: mirrors all 4 localStorage keys to Dropbox as a single JSON file.
// localStorage remains the fast in-memory cache; Dropbox is the source of truth.

import { STORAGE_KEY, SCOUT_STORAGE_KEY, TAILOR_RESULTS_KEY, DISMISSED_KEY } from "./constants";

const CLOUD_AUTH_KEY = "jsp-cloud-auth";

/**
 * Get the current connection state from localStorage.
 */
export function getCloudConnection() {
  try {
    const raw = localStorage.getItem(CLOUD_AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

/**
 * Save connection state to localStorage.
 */
export function setCloudConnection(conn) {
  if (conn) {
    localStorage.setItem(CLOUD_AUTH_KEY, JSON.stringify(conn));
  } else {
    localStorage.removeItem(CLOUD_AUTH_KEY);
  }
}

/**
 * Gather all localStorage app data into a single sync payload.
 */
export function gatherSyncData() {
  const get = (key) => {
    try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : null; } catch { return null; }
  };
  return {
    version: 1,
    syncedAt: new Date().toISOString(),
    appliedJobs: get(STORAGE_KEY) || [],
    lastScout: get(SCOUT_STORAGE_KEY),
    tailorResults: get(TAILOR_RESULTS_KEY) || [],
    dismissedJobs: get(DISMISSED_KEY) || [],
  };
}

/**
 * Restore sync data from cloud into localStorage.
 * Merges intelligently: cloud data wins for lists (union), latest wins for timestamps.
 */
export function restoreSyncData(syncData) {
  if (!syncData || syncData.version !== 1) return false;

  const setIfPresent = (key, value) => {
    if (value !== null && value !== undefined) {
      localStorage.setItem(key, JSON.stringify(value));
    }
  };

  // For applied jobs: merge by deduplicating on company+title+url
  const localApplied = safeParseArray(localStorage.getItem(STORAGE_KEY));
  const merged = mergeAppliedJobs(localApplied, syncData.appliedJobs || []);
  setIfPresent(STORAGE_KEY, merged);

  // For tailor results: merge by company+title key
  const localTailor = safeParseArray(localStorage.getItem(TAILOR_RESULTS_KEY));
  const mergedTailor = mergeTailorResults(localTailor, syncData.tailorResults || []);
  setIfPresent(TAILOR_RESULTS_KEY, mergedTailor);

  // For dismissed jobs: merge by deduplication
  const localDismissed = safeParseArray(localStorage.getItem(DISMISSED_KEY));
  const mergedDismissed = mergeDismissedJobs(localDismissed, syncData.dismissedJobs || []);
  setIfPresent(DISMISSED_KEY, mergedDismissed);

  // For scout results: cloud wins if present (it's a snapshot, not a list)
  if (syncData.lastScout) {
    setIfPresent(SCOUT_STORAGE_KEY, syncData.lastScout);
  }

  return true;
}

// -- Merge helpers --

function safeParseArray(raw) {
  try { const parsed = JSON.parse(raw); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
}

function appliedJobKey(j) {
  return `${(j.company || "").toLowerCase().trim()}|${(j.title || "").toLowerCase().trim()}|${(j.url || "").toLowerCase().trim()}`;
}

function mergeAppliedJobs(local, cloud) {
  const seen = new Set();
  const result = [];
  for (const j of [...local, ...cloud]) {
    const key = appliedJobKey(j);
    if (!seen.has(key)) { seen.add(key); result.push(j); }
  }
  return result;
}

function tailorKey(r) {
  return `${(r.company || "").toLowerCase().trim()}|${(r.job_title || "").toLowerCase().trim()}`;
}

function mergeTailorResults(local, cloud) {
  const map = new Map();
  for (const r of [...cloud, ...local]) {
    const key = tailorKey(r);
    if (!map.has(key)) map.set(key, r);
  }
  return Array.from(map.values());
}

function dismissedKey(j) {
  return `${(j.company || "").toLowerCase().trim()}|${(j.title || "").toLowerCase().trim()}`;
}

function mergeDismissedJobs(local, cloud) {
  const seen = new Set();
  const result = [];
  for (const j of [...local, ...cloud]) {
    const key = dismissedKey(j);
    if (!seen.has(key)) { seen.add(key); result.push(j); }
  }
  return result;
}
