import {
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
} from "../JobSearchPipelineV4";

// ============================================================
// normalizeTitle
// ============================================================

describe("normalizeTitle", () => {
  it("lowercases and trims", () => {
    expect(normalizeTitle("  Senior Engineer  ")).toBe("senior engineer");
  });

  it("expands 'Sr.' to 'senior'", () => {
    expect(normalizeTitle("Sr. Software Engineer")).toBe("senior software engineer");
  });

  it("expands 'Jr.' to 'junior'", () => {
    expect(normalizeTitle("Jr. Developer")).toBe("junior developer");
  });

  it("expands 'Eng.' to 'engineer'", () => {
    expect(normalizeTitle("Software Eng.")).toBe("software engineer");
  });

  it("expands 'Dev.' to 'developer'", () => {
    expect(normalizeTitle("Full Stack Dev")).toBe("full stack developer");
  });

  it("normalizes separators (dashes, slashes, commas)", () => {
    expect(normalizeTitle("Frontend/Backend Engineer")).toBe("frontend backend engineer");
    expect(normalizeTitle("Senior - Staff Engineer")).toBe("senior staff engineer");
  });

  it("collapses multiple spaces", () => {
    expect(normalizeTitle("Senior   Software    Engineer")).toBe("senior software engineer");
  });

  it("handles empty string", () => {
    expect(normalizeTitle("")).toBe("");
  });

  it("handles null/undefined", () => {
    expect(normalizeTitle(null)).toBe("");
    expect(normalizeTitle(undefined)).toBe("");
  });
});

// ============================================================
// companyTitleKey
// ============================================================

describe("companyTitleKey", () => {
  it("generates normalized company|title key", () => {
    const job = { company: "Acme Corp", title: "Senior Engineer" };
    expect(companyTitleKey(job)).toBe("acme|senior engineer");
  });

  it("strips common suffixes (Inc, LLC, Ltd, Corp, Co)", () => {
    expect(companyTitleKey({ company: "Acme Inc", title: "Dev" })).toBe("acme|developer");
    expect(companyTitleKey({ company: "Acme LLC", title: "Dev" })).toBe("acme|developer");
    expect(companyTitleKey({ company: "Acme Ltd.", title: "Dev" })).toBe("acme|developer");
    expect(companyTitleKey({ company: "Acme Co", title: "Dev" })).toBe("acme|developer");
  });

  it("matches same job from different sources with title variations", () => {
    const adzunaJob = { company: "TechCo Inc", title: "Sr. Software Engineer" };
    const jsearchJob = { company: "TechCo", title: "Senior Software Engineer" };
    expect(companyTitleKey(adzunaJob)).toBe(companyTitleKey(jsearchJob));
  });

  it("handles missing fields", () => {
    expect(companyTitleKey({})).toBe("|");
    expect(companyTitleKey({ company: "Test" })).toBe("test|");
  });
});

// ============================================================
// stripCodeFences
// ============================================================

describe("stripCodeFences", () => {
  it("removes ```json fences", () => {
    const input = '```json\n{"key": "value"}\n```';
    expect(stripCodeFences(input)).toBe('{"key": "value"}');
  });

  it("removes plain ``` fences", () => {
    const input = '```\n{"key": "value"}\n```';
    expect(stripCodeFences(input)).toBe('{"key": "value"}');
  });

  it("returns text unchanged when no fences present", () => {
    const input = '{"key": "value"}';
    expect(stripCodeFences(input)).toBe('{"key": "value"}');
  });

  it("handles leading/trailing whitespace", () => {
    const input = '  ```json\n{"a": 1}\n```  ';
    expect(stripCodeFences(input)).toBe('{"a": 1}');
  });
});

// ============================================================
// extractOutermostJson
// ============================================================

describe("extractOutermostJson", () => {
  it("extracts JSON from text with surrounding noise", () => {
    const input = 'Here is the result: {"score": 8} end.';
    expect(extractOutermostJson(input)).toEqual({ score: 8 });
  });

  it("extracts the first valid JSON object", () => {
    const input = '{"a": 1} some text {"b": 2}';
    expect(extractOutermostJson(input)).toEqual({ a: 1 });
  });

  it("handles nested braces correctly", () => {
    const input = '{"outer": {"inner": true}}';
    expect(extractOutermostJson(input)).toEqual({ outer: { inner: true } });
  });

  it("throws when no valid JSON found", () => {
    expect(() => extractOutermostJson("no json here")).toThrow("No valid JSON object found");
  });

  it("throws on malformed JSON with braces", () => {
    expect(() => extractOutermostJson("{not: valid json}")).toThrow("No valid JSON object found");
  });
});

// ============================================================
// extractJson
// ============================================================

describe("extractJson", () => {
  it("parses clean JSON directly", () => {
    expect(extractJson(['{"key": "value"}'])).toEqual({ key: "value" });
  });

  it("parses JSON inside code fences", () => {
    const input = '```json\n{"score": 10}\n```';
    expect(extractJson([input])).toEqual({ score: 10 });
  });

  it("extracts JSON from noisy text", () => {
    const input = "Here is the answer: {\"result\": true} done.";
    expect(extractJson([input])).toEqual({ result: true });
  });

  it("prefers the last text block", () => {
    const blocks = ['junk text', '{"final": true}'];
    expect(extractJson(blocks)).toEqual({ final: true });
  });

  it("falls through strategies until one works", () => {
    const blocks = ["not json", "still not", '```\n{"found": "it"}\n```'];
    expect(extractJson(blocks)).toEqual({ found: "it" });
  });

  it("throws when no JSON found anywhere", () => {
    expect(() => extractJson(["no json here", "still nothing"])).toThrow();
  });

  it("accepts a single string instead of array", () => {
    expect(extractJson('{"single": true}')).toEqual({ single: true });
  });
});

// ============================================================
// extractTextFromBlocks
// ============================================================

describe("extractTextFromBlocks", () => {
  it("extracts text from content blocks", () => {
    const blocks = [
      { type: "text", text: "Hello" },
      { type: "text", text: "World" },
    ];
    expect(extractTextFromBlocks(blocks)).toBe("Hello\nWorld");
  });

  it("filters out non-text blocks", () => {
    const blocks = [
      { type: "text", text: "Keep" },
      { type: "tool_use", id: "123" },
      { type: "text", text: "This" },
    ];
    expect(extractTextFromBlocks(blocks)).toBe("Keep\nThis");
  });

  it("returns empty string for no text blocks", () => {
    expect(extractTextFromBlocks([{ type: "tool_use", id: "1" }])).toBe("");
  });

  it("handles empty array", () => {
    expect(extractTextFromBlocks([])).toBe("");
  });
});

// ============================================================
// jobKey
// ============================================================

describe("jobKey", () => {
  it("returns URL when present", () => {
    const job = { url: "https://example.com/job/123", company: "Acme", title: "Engineer" };
    expect(jobKey(job)).toBe("https://example.com/job/123");
  });

  it("returns normalized company|title when no URL", () => {
    const job = { url: "", company: "Acme Corp", title: "Senior Engineer" };
    expect(jobKey(job)).toBe("acme|senior engineer");
  });

  it("handles missing company and title gracefully", () => {
    const job = { url: "" };
    expect(jobKey(job)).toBe("|");
  });

  it("normalizes to lowercase, trims, and expands abbreviations", () => {
    const job = { url: "", company: "  ACME  ", title: "  Sr. Dev  " };
    expect(jobKey(job)).toBe("acme|senior developer");
  });

  it("returns normalized company|title when url is null", () => {
    const job = { url: null, company: "Test", title: "Dev" };
    expect(jobKey(job)).toBe("test|developer");
  });
});

// ============================================================
// isAppliedMatch
// ============================================================

describe("isAppliedMatch", () => {
  it("matches by URL when both have URLs", () => {
    const job = { url: "https://example.com/1", company: "A", title: "X" };
    const entry = { url: "https://example.com/1", company: "B", title: "Y" };
    expect(isAppliedMatch(job, entry)).toBe(true);
  });

  it("does not match when URLs differ and company+title differ", () => {
    const job = { url: "https://example.com/1", company: "A", title: "X" };
    const entry = { url: "https://example.com/2", company: "B", title: "Y" };
    expect(isAppliedMatch(job, entry)).toBe(false);
  });

  it("matches by company+title even when URLs differ", () => {
    const job = { url: "https://example.com/1", company: "A", title: "X" };
    const entry = { url: "https://example.com/2", company: "A", title: "X" };
    expect(isAppliedMatch(job, entry)).toBe(true);
  });

  it("matches by company+title when no URL", () => {
    const job = { url: "", company: "Acme", title: "Engineer" };
    const entry = { url: "", company: "acme", title: "engineer" };
    expect(isAppliedMatch(job, entry)).toBe(true);
  });

  it("does not match different company+title", () => {
    const job = { url: "", company: "Acme", title: "Engineer" };
    const entry = { url: "", company: "Other", title: "Engineer" };
    expect(isAppliedMatch(job, entry)).toBe(false);
  });

  it("handles missing fields gracefully", () => {
    const job = {};
    const entry = {};
    expect(isAppliedMatch(job, entry)).toBe(true);
  });
});

// ============================================================
// deduplicateJobs
// ============================================================

describe("deduplicateJobs", () => {
  it("removes duplicates by URL, keeping highest score", () => {
    const jobs = [
      { url: "https://a.com", company: "A", title: "Dev", total_score: 5 },
      { url: "https://a.com", company: "A", title: "Dev", total_score: 8 },
    ];
    const result = deduplicateJobs(jobs);
    expect(result).toHaveLength(1);
    expect(result[0].total_score).toBe(8);
  });

  it("keeps both when URLs differ", () => {
    const jobs = [
      { url: "https://a.com", company: "A", title: "Dev", total_score: 5 },
      { url: "https://b.com", company: "B", title: "Dev", total_score: 8 },
    ];
    expect(deduplicateJobs(jobs)).toHaveLength(2);
  });

  it("deduplicates by company|title when no URL", () => {
    const jobs = [
      { url: "", company: "Acme", title: "Dev", total_score: 3 },
      { url: "", company: "acme", title: "dev", total_score: 7 },
    ];
    const result = deduplicateJobs(jobs);
    expect(result).toHaveLength(1);
    expect(result[0].total_score).toBe(7);
  });

  it("returns empty array for empty input", () => {
    expect(deduplicateJobs([])).toEqual([]);
  });

  it("keeps lower-scored job if it comes second", () => {
    const jobs = [
      { url: "https://a.com", title: "X", company: "Y", total_score: 9 },
      { url: "https://a.com", title: "X", company: "Y", total_score: 4 },
    ];
    const result = deduplicateJobs(jobs);
    expect(result).toHaveLength(1);
    expect(result[0].total_score).toBe(9);
  });
});

// ============================================================
// mergeRawJobs
// ============================================================

describe("mergeRawJobs", () => {
  it("merges non-duplicate jobs", () => {
    const existing = [{ url: "https://a.com", title: "Job A", company: "Company A" }];
    const incoming = [{ url: "https://b.com", title: "Job B", company: "Company B" }];
    const result = mergeRawJobs(existing, incoming);
    expect(result).toHaveLength(2);
  });

  it("filters out duplicates by URL", () => {
    const existing = [{ url: "https://a.com", title: "A", company: "X" }];
    const incoming = [{ url: "https://a.com", title: "A duplicate", company: "Y" }];
    expect(mergeRawJobs(existing, incoming)).toHaveLength(1);
  });

  it("allows incoming jobs with no URL if company+title is unique", () => {
    const existing = [{ url: "https://a.com", title: "A", company: "X" }];
    const incoming = [{ url: "", title: "Unique Job", company: "Unique Co" }];
    expect(mergeRawJobs(existing, incoming)).toHaveLength(2);
  });

  it("handles empty existing array", () => {
    const incoming = [{ url: "https://a.com", title: "A", company: "X" }];
    expect(mergeRawJobs([], incoming)).toHaveLength(1);
  });

  it("handles empty incoming array", () => {
    const existing = [{ url: "https://a.com", title: "A", company: "X" }];
    expect(mergeRawJobs(existing, [])).toHaveLength(1);
  });

  it("preserves order: existing first, then incoming", () => {
    const existing = [{ url: "https://a.com", title: "First", company: "X" }];
    const incoming = [{ url: "https://b.com", title: "Second", company: "Y" }];
    const result = mergeRawJobs(existing, incoming);
    expect(result[0].title).toBe("First");
    expect(result[1].title).toBe("Second");
  });

  // Cross-source duplicate detection (same job, different URLs)
  it("filters duplicate by company+title even when URLs differ", () => {
    const existing = [{ url: "https://adzuna.com/job/1", company: "Acme Corp", title: "Senior Engineer" }];
    const incoming = [{ url: "https://jsearch.com/job/2", company: "Acme Corp", title: "Senior Engineer" }];
    expect(mergeRawJobs(existing, incoming)).toHaveLength(1);
  });

  it("catches 'Sr.' vs 'Senior' as duplicates across sources", () => {
    const existing = [{ url: "https://adzuna.com/1", company: "TechCo Inc", title: "Sr. Software Engineer" }];
    const incoming = [{ url: "https://jsearch.com/2", company: "TechCo", title: "Senior Software Engineer" }];
    expect(mergeRawJobs(existing, incoming)).toHaveLength(1);
  });

  it("keeps both jobs when company differs", () => {
    const existing = [{ url: "https://a.com/1", company: "Company A", title: "Senior Engineer" }];
    const incoming = [{ url: "https://b.com/2", company: "Company B", title: "Senior Engineer" }];
    expect(mergeRawJobs(existing, incoming)).toHaveLength(2);
  });

  it("keeps both jobs when title differs", () => {
    const existing = [{ url: "https://a.com/1", company: "Acme", title: "Senior Engineer" }];
    const incoming = [{ url: "https://b.com/2", company: "Acme", title: "Staff Architect" }];
    expect(mergeRawJobs(existing, incoming)).toHaveLength(2);
  });

  it("deduplicates within incoming batch", () => {
    const incoming = [
      { url: "https://a.com/1", company: "Acme", title: "Dev" },
      { url: "https://b.com/2", company: "Acme", title: "Developer" },
    ];
    expect(mergeRawJobs([], incoming)).toHaveLength(1);
  });

  it("handles RSS jobs with empty company gracefully", () => {
    const existing = [{ url: "https://a.com", company: "", title: "Remote Dev" }];
    const incoming = [{ url: "https://b.com", company: "", title: "Remote Dev" }];
    // Both have empty company, so companyTitleKey is "|remote developer" - should dedup
    expect(mergeRawJobs(existing, incoming)).toHaveLength(1);
  });
});

// ============================================================
// reTierJobs
// ============================================================

describe("reTierJobs", () => {
  const makeJob = (score) => ({ title: `Job ${score}`, total_score: score });

  it("tiers jobs by score thresholds", () => {
    const tiers = { strong_match: [], possible: [], weak: [], rejected: [
      makeJob(9), makeJob(7), makeJob(4), makeJob(1),
    ]};
    const result = reTierJobs(tiers);
    expect(result.strong_match).toHaveLength(1);
    expect(result.strong_match[0].total_score).toBe(9);
    expect(result.possible).toHaveLength(1);
    expect(result.possible[0].total_score).toBe(7);
    expect(result.weak).toHaveLength(1);
    expect(result.weak[0].total_score).toBe(4);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0].total_score).toBe(1);
  });

  it("places score=8 in strong_match", () => {
    const result = reTierJobs({ strong_match: [], possible: [], weak: [], rejected: [makeJob(8)] });
    expect(result.strong_match).toHaveLength(1);
  });

  it("places score=6 in possible", () => {
    const result = reTierJobs({ strong_match: [], possible: [], weak: [], rejected: [makeJob(6)] });
    expect(result.possible).toHaveLength(1);
  });

  it("places score=3 in weak", () => {
    const result = reTierJobs({ strong_match: [], possible: [], weak: [], rejected: [makeJob(3)] });
    expect(result.weak).toHaveLength(1);
  });

  it("places score=0 in rejected", () => {
    const result = reTierJobs({ strong_match: [], possible: [], weak: [], rejected: [makeJob(0)] });
    expect(result.rejected).toHaveLength(1);
  });

  it("handles empty tiers", () => {
    const result = reTierJobs({ strong_match: [], possible: [], weak: [], rejected: [] });
    expect(result.strong_match).toHaveLength(0);
    expect(result.possible).toHaveLength(0);
    expect(result.weak).toHaveLength(0);
    expect(result.rejected).toHaveLength(0);
  });
});

// ============================================================
// filterAppliedFromTiers
// ============================================================

describe("filterAppliedFromTiers", () => {
  const tiers = {
    strong_match: [
      { url: "https://a.com", company: "A", title: "Dev" },
      { url: "https://b.com", company: "B", title: "Dev" },
    ],
    possible: [{ url: "https://c.com", company: "C", title: "Dev" }],
    weak: [],
    rejected: [],
  };

  it("removes applied jobs from tiers", () => {
    const applied = [{ url: "https://a.com", company: "A", title: "Dev" }];
    const result = filterAppliedFromTiers(tiers, applied);
    expect(result.tiers.strong_match).toHaveLength(1);
    expect(result.tiers.strong_match[0].company).toBe("B");
    expect(result.filtered).toBe(1);
  });

  it("returns unchanged tiers when no applied list", () => {
    const result = filterAppliedFromTiers(tiers, []);
    expect(result.tiers.strong_match).toHaveLength(2);
    expect(result.filtered).toBe(0);
  });

  it("counts multiple filtered jobs", () => {
    const applied = [
      { url: "https://a.com", company: "A", title: "Dev" },
      { url: "https://c.com", company: "C", title: "Dev" },
    ];
    const result = filterAppliedFromTiers(tiers, applied);
    expect(result.filtered).toBe(2);
  });
});

// ============================================================
// mergeScoutResults
// ============================================================

describe("mergeScoutResults", () => {
  it("merges multiple scout results into combined tiers", () => {
    const results = [
      {
        tiers: { strong_match: [{ url: "https://a.com", company: "A", title: "X", total_score: 9 }], possible: [], weak: [], rejected: [] },
        summary: "Source 1",
        notes: "Note 1",
      },
      {
        tiers: { strong_match: [{ url: "https://b.com", company: "B", title: "Y", total_score: 8 }], possible: [], weak: [], rejected: [] },
        summary: "Source 2",
        notes: "Note 2",
      },
    ];
    const merged = mergeScoutResults(results);
    expect(merged.tiers.strong_match).toHaveLength(2);
    expect(merged.summary).toContain("Source 1");
    expect(merged.summary).toContain("Source 2");
    expect(merged.found).toBe(true);
  });

  it("deduplicates jobs across results by URL", () => {
    const job = { url: "https://a.com", company: "A", title: "X", total_score: 9 };
    const results = [
      { tiers: { strong_match: [job], possible: [], weak: [], rejected: [] }, summary: "", notes: "" },
      { tiers: { strong_match: [{ ...job }], possible: [], weak: [], rejected: [] }, summary: "", notes: "" },
    ];
    const merged = mergeScoutResults(results);
    expect(merged.tiers.strong_match).toHaveLength(1);
  });

  it("removes cross-tier duplicates keeping highest tier", () => {
    const job = { url: "https://a.com", company: "A", title: "X", total_score: 9 };
    const results = [{
      tiers: {
        strong_match: [job],
        possible: [{ ...job, total_score: 6 }],
        weak: [],
        rejected: [],
      },
      summary: "",
      notes: "",
    }];
    const merged = mergeScoutResults(results);
    expect(merged.tiers.strong_match).toHaveLength(1);
    expect(merged.tiers.possible).toHaveLength(0);
  });

  it("handles null/empty results", () => {
    const merged = mergeScoutResults([null, undefined, {}]);
    expect(merged.found).toBe(false);
    expect(merged.summary).toBe("No results found.");
  });

  it("returns empty tiers for empty input", () => {
    const merged = mergeScoutResults([]);
    expect(merged.tiers.strong_match).toHaveLength(0);
    expect(merged.found).toBe(false);
  });
});

// ============================================================
// keywordPreFilter
// ============================================================

describe("keywordPreFilter", () => {
  const makeJob = (title, location, url = "https://example.com") => ({
    title, location, url, company: "Test", description: "A job",
  });

  describe("title hard rejections", () => {
    it.each([
      "Junior Developer",
      "Associate Engineer",
      "Mid-Level Engineer",
      "Entry Level Dev",
      "Software Intern",
      "Data Entry Clerk",
      "Support Engineer",
      "Help Desk Analyst",
      "DevOps Engineer",
      "SRE Lead",
      "QA Engineer",
      "Recruiter",
      "Marketing Manager",
    ])("rejects '%s'", (title) => {
      const { passed, rejected } = keywordPreFilter([makeJob(title, "Remote")]);
      expect(passed).toHaveLength(0);
      expect(rejected).toHaveLength(1);
    });
  });

  describe("passing titles", () => {
    it.each([
      "Senior Solutions Architect",
      "Principal Engineer",
      "Staff Software Engineer",
      "Lead Developer",
      "Software Architect",
    ])("passes '%s'", (title) => {
      const { passed } = keywordPreFilter([makeJob(title, "Remote")]);
      expect(passed).toHaveLength(1);
    });
  });

  describe("management titles with tech signals", () => {
    it("rejects 'VP of Sales' (management, no tech signal)", () => {
      const { rejected } = keywordPreFilter([makeJob("VP of Sales", "Remote")]);
      expect(rejected).toHaveLength(1);
    });

    it("passes 'Director of Engineering' (management with tech signal)", () => {
      const { passed } = keywordPreFilter([makeJob("Director of Engineering", "Remote")]);
      expect(passed).toHaveLength(1);
    });

    it("passes 'VP of Technical Architecture' (management with tech signal)", () => {
      const { passed } = keywordPreFilter([makeJob("VP of Technical Architecture", "Remote")]);
      expect(passed).toHaveLength(1);
    });
  });

  describe("location filtering", () => {
    it("passes Remote locations", () => {
      const { passed } = keywordPreFilter([makeJob("Senior Dev", "Remote")]);
      expect(passed).toHaveLength(1);
    });

    it("passes Tampa Bay area", () => {
      const { passed } = keywordPreFilter([makeJob("Senior Dev", "Tampa, FL")]);
      expect(passed).toHaveLength(1);
    });

    it("passes Florida locations", () => {
      const { passed } = keywordPreFilter([makeJob("Senior Dev", "Orlando, Florida")]);
      expect(passed).toHaveLength(1);
    });

    it("passes empty location", () => {
      const { passed } = keywordPreFilter([makeJob("Senior Dev", "")]);
      expect(passed).toHaveLength(1);
    });

    it("rejects non-Florida, non-remote locations", () => {
      const { rejected } = keywordPreFilter([makeJob("Senior Dev", "New York, NY")]);
      expect(rejected).toHaveLength(1);
    });
  });

  it("rejects jobs with no URL", () => {
    const { rejected } = keywordPreFilter([makeJob("Senior Dev", "Remote", "")]);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].filter_reason).toBe("no URL");
  });

  it("handles a mixed batch correctly", () => {
    const jobs = [
      makeJob("Senior Architect", "Remote"),
      makeJob("Junior Developer", "Remote"),
      makeJob("Lead Engineer", "New York"),
      makeJob("Staff Engineer", "Tampa, FL"),
    ];
    const { passed, rejected } = keywordPreFilter(jobs);
    expect(passed).toHaveLength(2);
    expect(rejected).toHaveLength(2);
    expect(passed.map(j => j.title)).toEqual(["Senior Architect", "Staff Engineer"]);
  });
});

// ============================================================
// Prompt builders
// ============================================================

describe("buildTailorPrompt", () => {
  const job = {
    title: "Senior Engineer",
    company: "Acme Corp",
    location: "Remote",
    jd_text: "Full stack role",
    key_tech_stack: ["React", "Node.js"],
    reasoning: "Strong fit",
  };

  it("includes the profile text", () => {
    const result = buildTailorPrompt("My resume content", job);
    expect(result).toContain("My resume content");
  });

  it("includes job details", () => {
    const result = buildTailorPrompt("profile", job);
    expect(result).toContain("Senior Engineer");
    expect(result).toContain("Acme Corp");
    expect(result).toContain("Remote");
    expect(result).toContain("Full stack role");
    expect(result).toContain("React, Node.js");
  });

  it("includes JSON return structure", () => {
    const result = buildTailorPrompt("profile", job);
    expect(result).toContain('"resume"');
    expect(result).toContain('"cover_letter"');
  });

  it("handles missing jd_text gracefully", () => {
    const jobNoJd = { ...job, jd_text: "" };
    const result = buildTailorPrompt("profile", jobNoJd);
    expect(result).toContain("Not available, tailor based on metadata only");
  });

  it("handles non-array key_tech_stack", () => {
    const jobBadTech = { ...job, key_tech_stack: "not an array" };
    const result = buildTailorPrompt("profile", jobBadTech);
    expect(result).toContain("not specified");
  });
});

describe("buildResumeOnlyPrompt", () => {
  const job = {
    title: "Lead Architect",
    company: "TechCo",
    location: "Remote",
    jd_text: "Cloud architecture role",
    key_tech_stack: ["Azure", "C#"],
    reasoning: "Cloud skills match",
  };

  it("requests resume only, not cover letter", () => {
    const result = buildResumeOnlyPrompt("profile", job);
    expect(result).toContain('"resume"');
    expect(result).not.toContain('"cover_letter"');
  });

  it("includes PROFESSIONAL SUMMARY section", () => {
    const result = buildResumeOnlyPrompt("profile", job);
    expect(result).toContain("PROFESSIONAL SUMMARY");
    expect(result).toContain("CORE COMPETENCIES");
    expect(result).toContain("PROFESSIONAL EXPERIENCE");
    expect(result).toContain("EDUCATION");
  });

  it("includes job metadata", () => {
    const result = buildResumeOnlyPrompt("profile", job);
    expect(result).toContain("Lead Architect");
    expect(result).toContain("TechCo");
    expect(result).toContain("Azure, C#");
  });
});

describe("buildCoverLetterOnlyPrompt", () => {
  const job = {
    title: "Staff Engineer",
    company: "BigCorp",
    location: "Tampa, FL",
    jd_text: "Backend systems role",
    key_tech_stack: [".NET", "SQL Server"],
    reasoning: "Strong backend match",
  };

  it("requests cover letter only, not resume", () => {
    const result = buildCoverLetterOnlyPrompt("profile", job);
    expect(result).toContain('"cover_letter"');
    expect(result).not.toContain('"resume"');
  });

  it("includes cover letter paragraph structure", () => {
    const result = buildCoverLetterOnlyPrompt("profile", job);
    expect(result).toContain("Paragraph 1");
    expect(result).toContain("Paragraph 2");
    expect(result).toContain("Paragraph 3");
    expect(result).toContain("Paragraph 4");
  });

  it("includes sign-off instruction", () => {
    const result = buildCoverLetterOnlyPrompt("profile", job);
    expect(result).toContain("sign-off");
  });

  it("includes job metadata", () => {
    const result = buildCoverLetterOnlyPrompt("profile", job);
    expect(result).toContain("Staff Engineer");
    expect(result).toContain("BigCorp");
    expect(result).toContain(".NET, SQL Server");
  });
});

// ============================================================
// Edge cases and integration-style tests
// ============================================================

describe("end-to-end utility chain", () => {
  it("processes raw API response through extractTextFromBlocks -> extractJson", () => {
    const apiResponse = {
      content: [
        { type: "text", text: '```json\n{"scores": [{"idx": 0, "skills_fit": 4, "level_fit": 5, "total_score": 9}]}\n```' },
      ],
    };
    const text = extractTextFromBlocks(apiResponse.content);
    const parsed = extractJson([text]);
    expect(parsed.scores[0].total_score).toBe(9);
  });

  it("full dedup pipeline: mergeRawJobs -> deduplicateJobs", () => {
    const batch1 = [
      { url: "https://a.com", company: "A", title: "Dev", total_score: 5 },
      { url: "https://b.com", company: "B", title: "Dev", total_score: 7 },
    ];
    const batch2 = [
      { url: "https://a.com", company: "A", title: "Dev dup", total_score: 9 },
      { url: "https://c.com", company: "C", title: "Dev", total_score: 6 },
    ];

    const merged = mergeRawJobs(batch1, batch2);
    expect(merged).toHaveLength(3);

    const deduped = deduplicateJobs(merged);
    expect(deduped).toHaveLength(3);
  });

  it("filterAppliedFromTiers removes already-applied from reTierJobs output", () => {
    const scored = [
      { url: "https://applied.com", company: "Applied", title: "Dev", total_score: 9 },
      { url: "https://new.com", company: "New", title: "Dev", total_score: 8 },
      { url: "https://low.com", company: "Low", title: "Dev", total_score: 2 },
    ];
    const tiers = reTierJobs({ strong_match: scored, possible: [], weak: [], rejected: [] });
    const applied = [{ url: "https://applied.com", company: "Applied", title: "Dev" }];
    const { tiers: filtered, filtered: count } = filterAppliedFromTiers(tiers, applied);

    expect(count).toBe(1);
    expect(filtered.strong_match).toHaveLength(1);
    expect(filtered.strong_match[0].company).toBe("New");
  });
});
