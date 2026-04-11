import {
  loadTailorResults,
  saveTailorResult,
  clearTailorResults,
  TAILOR_RESULTS_KEY,
} from "../JobSearchPipelineV4";

beforeEach(() => {
  localStorage.clear();
});

// ============================================================
// loadTailorResults
// ============================================================

describe("loadTailorResults", () => {
  it("returns empty array when localStorage is empty", () => {
    expect(loadTailorResults()).toEqual([]);
  });

  it("returns empty array when localStorage value is corrupted JSON", () => {
    localStorage.setItem(TAILOR_RESULTS_KEY, "{not valid json!!");
    expect(loadTailorResults()).toEqual([]);
  });

  it("returns parsed results when valid data exists", () => {
    const data = [{ company: "Acme", job_title: "Engineer" }];
    localStorage.setItem(TAILOR_RESULTS_KEY, JSON.stringify(data));
    expect(loadTailorResults()).toEqual(data);
  });
});

// ============================================================
// saveTailorResult
// ============================================================

describe("saveTailorResult", () => {
  it("persists a result retrievable by loadTailorResults", () => {
    const result = { company: "Acme", job_title: "Engineer", resume: "...", cover_letter: "..." };
    saveTailorResult(result);
    expect(loadTailorResults()).toEqual([result]);
  });

  it("upserts: same company+title replaces old entry, does not duplicate", () => {
    saveTailorResult({ company: "Acme", job_title: "Engineer", resume: "v1" });
    saveTailorResult({ company: "Acme", job_title: "Engineer", resume: "v2" });
    const results = loadTailorResults();
    expect(results).toHaveLength(1);
    expect(results[0].resume).toBe("v2");
  });

  it("upserts case-insensitively", () => {
    saveTailorResult({ company: "ACME", job_title: "ENGINEER", resume: "v1" });
    saveTailorResult({ company: "acme", job_title: "engineer", resume: "v2" });
    const results = loadTailorResults();
    expect(results).toHaveLength(1);
    expect(results[0].resume).toBe("v2");
  });

  it("appends: two different jobs both present", () => {
    saveTailorResult({ company: "Acme", job_title: "Engineer" });
    saveTailorResult({ company: "Globex", job_title: "Architect" });
    expect(loadTailorResults()).toHaveLength(2);
  });

  it("does not throw when localStorage is unavailable", () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new Error("Quota exceeded"); };
    expect(() => {
      saveTailorResult({ company: "Acme", job_title: "Engineer" });
    }).not.toThrow();
    Storage.prototype.setItem = original;
  });
});

// ============================================================
// clearTailorResults
// ============================================================

describe("clearTailorResults", () => {
  it("empties the store", () => {
    saveTailorResult({ company: "Acme", job_title: "Engineer" });
    clearTailorResults();
    expect(loadTailorResults()).toEqual([]);
    expect(localStorage.getItem(TAILOR_RESULTS_KEY)).toBeNull();
  });
});
