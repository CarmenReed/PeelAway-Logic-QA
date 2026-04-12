// storage.test.js
// Tests for ALL storage.js functions (applied, scout, tailor, dismissed)

import {
  loadAppliedJobs,
  saveAppliedJobs,
  loadLastScoutResults,
  saveLastScoutResults,
  loadTailorResults,
  saveTailorResult,
  clearTailorResults,
  loadDismissedJobs,
  saveDismissedJob,
  clearDismissedJobs,
  isDismissed,
} from "../storage";

import { STORAGE_KEY, SCOUT_STORAGE_KEY, TAILOR_RESULTS_KEY, DISMISSED_KEY } from "../constants";

beforeEach(() => {
  localStorage.clear();
});

// ============================================================
// loadAppliedJobs / saveAppliedJobs
// ============================================================

describe("loadAppliedJobs", () => {
  it("returns empty array when localStorage is empty", () => {
    expect(loadAppliedJobs()).toEqual([]);
  });

  it("returns empty array when value is corrupted JSON", () => {
    localStorage.setItem(STORAGE_KEY, "{bad json!!");
    expect(loadAppliedJobs()).toEqual([]);
  });

  it("returns parsed array when valid data exists", () => {
    const data = [{ title: "Dev", company: "Acme", url: "https://acme.com" }];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    expect(loadAppliedJobs()).toEqual(data);
  });
});

describe("saveAppliedJobs", () => {
  it("persists jobs retrievable by loadAppliedJobs", () => {
    const jobs = [{ title: "Dev", company: "Acme" }];
    saveAppliedJobs(jobs);
    expect(loadAppliedJobs()).toEqual(jobs);
  });

  it("overwrites previous applied jobs", () => {
    saveAppliedJobs([{ title: "Old" }]);
    saveAppliedJobs([{ title: "New" }]);
    const result = loadAppliedJobs();
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("New");
  });

  it("does not throw when localStorage is unavailable", () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new Error("Quota exceeded"); };
    expect(() => saveAppliedJobs([{ title: "Test" }])).not.toThrow();
    Storage.prototype.setItem = original;
  });
});

// ============================================================
// loadLastScoutResults / saveLastScoutResults
// ============================================================

describe("loadLastScoutResults", () => {
  it("returns null when localStorage is empty", () => {
    expect(loadLastScoutResults()).toBeNull();
  });

  it("returns null when value is corrupted JSON", () => {
    localStorage.setItem(SCOUT_STORAGE_KEY, "not json!");
    expect(loadLastScoutResults()).toBeNull();
  });

  it("returns parsed data when valid results exist", () => {
    const data = { tiers: { strong_match: [], possible: [], weak: [], rejected: [] }, summary: "test" };
    localStorage.setItem(SCOUT_STORAGE_KEY, JSON.stringify(data));
    expect(loadLastScoutResults()).toEqual(data);
  });
});

describe("saveLastScoutResults", () => {
  it("persists results retrievable by loadLastScoutResults", () => {
    const data = { tiers: { strong_match: [{ title: "Job" }] }, summary: "found 1" };
    saveLastScoutResults(data);
    expect(loadLastScoutResults()).toEqual(data);
  });

  it("overwrites previous scout results", () => {
    saveLastScoutResults({ summary: "old" });
    saveLastScoutResults({ summary: "new" });
    expect(loadLastScoutResults().summary).toBe("new");
  });

  it("does not throw when localStorage is unavailable", () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new Error("Quota exceeded"); };
    expect(() => saveLastScoutResults({ summary: "test" })).not.toThrow();
    Storage.prototype.setItem = original;
  });
});

// ============================================================
// loadTailorResults / saveTailorResult / clearTailorResults
// ============================================================

describe("loadTailorResults (from storage.js)", () => {
  it("returns empty array when empty", () => {
    expect(loadTailorResults()).toEqual([]);
  });

  it("returns parsed results when valid", () => {
    const data = [{ company: "Acme", job_title: "Dev" }];
    localStorage.setItem(TAILOR_RESULTS_KEY, JSON.stringify(data));
    expect(loadTailorResults()).toEqual(data);
  });

  it("returns empty array on corrupted JSON", () => {
    localStorage.setItem(TAILOR_RESULTS_KEY, "corrupt");
    expect(loadTailorResults()).toEqual([]);
  });
});

describe("saveTailorResult (from storage.js)", () => {
  it("persists and retrieves a result", () => {
    saveTailorResult({ company: "Acme", job_title: "Dev", resume: "r1" });
    expect(loadTailorResults()).toHaveLength(1);
  });

  it("upserts by company+title (case-insensitive)", () => {
    saveTailorResult({ company: "ACME", job_title: "DEV", resume: "v1" });
    saveTailorResult({ company: "acme", job_title: "dev", resume: "v2" });
    const results = loadTailorResults();
    expect(results).toHaveLength(1);
    expect(results[0].resume).toBe("v2");
  });

  it("appends different jobs", () => {
    saveTailorResult({ company: "A", job_title: "X" });
    saveTailorResult({ company: "B", job_title: "Y" });
    expect(loadTailorResults()).toHaveLength(2);
  });
});

describe("clearTailorResults (from storage.js)", () => {
  it("removes all tailor results", () => {
    saveTailorResult({ company: "Acme", job_title: "Dev" });
    clearTailorResults();
    expect(loadTailorResults()).toEqual([]);
  });
});

// ============================================================
// loadDismissedJobs / saveDismissedJob / clearDismissedJobs
// ============================================================

describe("loadDismissedJobs", () => {
  it("returns empty array when localStorage is empty", () => {
    expect(loadDismissedJobs()).toEqual([]);
  });

  it("returns empty array when value is corrupted", () => {
    localStorage.setItem(DISMISSED_KEY, "bad!");
    expect(loadDismissedJobs()).toEqual([]);
  });

  it("returns parsed list when valid", () => {
    const data = [{ title: "Dev", company: "Acme", url: "" }];
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(data));
    expect(loadDismissedJobs()).toEqual(data);
  });
});

describe("saveDismissedJob", () => {
  it("saves a dismissed job", () => {
    saveDismissedJob({ title: "Dev", company: "Acme", url: "https://acme.com/1" });
    const result = loadDismissedJobs();
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Dev");
    expect(result[0].company).toBe("Acme");
    expect(result[0].url).toBe("https://acme.com/1");
  });

  it("does not duplicate if same job key already exists", () => {
    saveDismissedJob({ title: "Dev", company: "Acme", url: "https://acme.com/1" });
    saveDismissedJob({ title: "Dev", company: "Acme", url: "https://acme.com/1" });
    expect(loadDismissedJobs()).toHaveLength(1);
  });

  it("appends different jobs", () => {
    saveDismissedJob({ title: "Dev", company: "Acme", url: "https://acme.com/1" });
    saveDismissedJob({ title: "Arch", company: "Globex", url: "https://globex.com/1" });
    expect(loadDismissedJobs()).toHaveLength(2);
  });

  it("stores only title, company, url fields", () => {
    saveDismissedJob({ title: "Dev", company: "Acme", url: "https://acme.com/1", extra: "ignored" });
    const result = loadDismissedJobs();
    expect(result[0]).toEqual({ title: "Dev", company: "Acme", url: "https://acme.com/1" });
  });

  it("handles missing url by defaulting to empty string", () => {
    saveDismissedJob({ title: "Dev", company: "Acme" });
    const result = loadDismissedJobs();
    expect(result[0].url).toBe("");
  });

  it("does not throw when localStorage is unavailable", () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new Error("Quota exceeded"); };
    expect(() => saveDismissedJob({ title: "Dev", company: "Acme", url: "" })).not.toThrow();
    Storage.prototype.setItem = original;
  });
});

describe("clearDismissedJobs", () => {
  it("removes all dismissed jobs", () => {
    saveDismissedJob({ title: "Dev", company: "Acme", url: "" });
    clearDismissedJobs();
    expect(loadDismissedJobs()).toEqual([]);
  });
});

// ============================================================
// isDismissed
// ============================================================

describe("isDismissed", () => {
  it("returns true when URL matches", () => {
    const job = { url: "https://acme.com/1", company: "Acme", title: "Dev" };
    const dismissed = [{ url: "https://acme.com/1", company: "Other", title: "Other" }];
    expect(isDismissed(job, dismissed)).toBe(true);
  });

  it("returns true when company+title match (case-insensitive)", () => {
    const job = { url: "https://new-url.com", company: "Acme", title: "Dev" };
    const dismissed = [{ url: "", company: "acme", title: "dev" }];
    expect(isDismissed(job, dismissed)).toBe(true);
  });

  it("returns false when nothing matches", () => {
    const job = { url: "https://acme.com/1", company: "Acme", title: "Dev" };
    const dismissed = [{ url: "https://other.com", company: "Other", title: "Other" }];
    expect(isDismissed(job, dismissed)).toBe(false);
  });

  it("returns false for empty dismissed list", () => {
    const job = { url: "https://acme.com/1", company: "Acme", title: "Dev" };
    expect(isDismissed(job, [])).toBe(false);
  });

  it("handles missing fields gracefully", () => {
    const job = { company: "Acme", title: "Dev" };
    const dismissed = [{ company: "Acme", title: "Dev" }];
    expect(isDismissed(job, dismissed)).toBe(true);
  });

  it("does not match when only company matches but title differs", () => {
    const job = { url: "", company: "Acme", title: "Architect" };
    const dismissed = [{ url: "", company: "Acme", title: "Dev" }];
    expect(isDismissed(job, dismissed)).toBe(false);
  });
});
