import { keywordPreFilter } from "../utils";

const makeJob = (title, location, url = "https://example.com") => ({
  title, location, url, company: "Test", description: "A job",
});

// ============================================================
// Dynamic profile-based filtering
// ============================================================

describe("keywordPreFilter (utils.js): profile-driven", () => {
  const seniorProfile = {
    targetLevel: ["Senior", "Lead", "Architect"],
    location: ["remote"],
  };

  const juniorProfile = {
    targetLevel: ["Junior", "Mid"],
    location: ["remote", "Tampa, FL"],
  };

  // ---- Universal role rejections (always applied regardless of profile) ----

  describe("universal role rejections", () => {
    it.each([
      "Data Entry Clerk",
      "Software Intern",
      "Help Desk Analyst",
      "Support Engineer",
      "Recruiter",
      "Human Resources Manager",
      "Marketing Specialist",
      "Customer Success Manager",
      "Apprentice Developer",
      "Staff Accountant",
    ])("rejects '%s' regardless of profile", (title) => {
      const { passed, rejected } = keywordPreFilter([makeJob(title, "Remote")], seniorProfile);
      expect(passed).toHaveLength(0);
      expect(rejected).toHaveLength(1);
      expect(rejected[0].filter_reason).toBe("title hard reject");
    });
  });

  // ---- Level-based dynamic rejections ----

  describe("level-based rejections for Senior profile", () => {
    it("rejects Junior titles when profile targets Senior", () => {
      const { rejected } = keywordPreFilter([makeJob("Junior Developer", "Remote")], seniorProfile);
      expect(rejected).toHaveLength(1);
    });

    it("rejects Associate titles when profile targets Senior", () => {
      const { rejected } = keywordPreFilter([makeJob("Associate Engineer", "Remote")], seniorProfile);
      expect(rejected).toHaveLength(1);
    });

    it("rejects Mid-Level titles when profile targets Senior", () => {
      const { rejected } = keywordPreFilter([makeJob("Mid-Level Engineer", "Remote")], seniorProfile);
      expect(rejected).toHaveLength(1);
    });

    it("rejects Entry-Level titles when profile targets Senior", () => {
      const { rejected } = keywordPreFilter([makeJob("Entry-Level Developer", "Remote")], seniorProfile);
      expect(rejected).toHaveLength(1);
    });
  });

  describe("level-based passes for Junior profile", () => {
    it("passes Junior titles when profile targets Junior", () => {
      const { passed } = keywordPreFilter([makeJob("Junior Developer", "Remote")], juniorProfile);
      expect(passed).toHaveLength(1);
    });

    it("passes Mid-Level titles when profile targets Mid", () => {
      const { passed } = keywordPreFilter([makeJob("Mid-Level Engineer", "Remote")], juniorProfile);
      expect(passed).toHaveLength(1);
    });

    it("passes Entry-Level titles when profile targets Junior", () => {
      const { passed } = keywordPreFilter([makeJob("Entry-Level Developer", "Remote")], juniorProfile);
      expect(passed).toHaveLength(1);
    });
  });

  // ---- Location-based dynamic filtering ----

  describe("location filtering with profile", () => {
    it("passes Remote when profile includes remote", () => {
      const { passed } = keywordPreFilter([makeJob("Senior Dev", "Remote")], seniorProfile);
      expect(passed).toHaveLength(1);
    });

    it("rejects non-remote locations when profile only has remote", () => {
      const { rejected } = keywordPreFilter([makeJob("Senior Dev", "New York, NY")], seniorProfile);
      expect(rejected).toHaveLength(1);
      expect(rejected[0].filter_reason).toBe("location mismatch");
    });

    it("passes Tampa, FL when profile includes Tampa, FL", () => {
      const { passed } = keywordPreFilter([makeJob("Junior Dev", "Tampa, FL")], juniorProfile);
      expect(passed).toHaveLength(1);
    });

    it("passes empty location (assumed remote)", () => {
      const { passed } = keywordPreFilter([makeJob("Senior Dev", "")], seniorProfile);
      expect(passed).toHaveLength(1);
    });

    it("passes 'remote' location string exactly", () => {
      const { passed } = keywordPreFilter([makeJob("Senior Dev", "remote")], seniorProfile);
      expect(passed).toHaveLength(1);
    });
  });

  // ---- No profile (null/undefined) ----

  describe("null or missing profile", () => {
    it("applies universal rejections with null profile", () => {
      const { rejected } = keywordPreFilter([makeJob("Software Intern", "Remote")], null);
      expect(rejected).toHaveLength(1);
    });

    it("still applies level rejections with null profile (defaults to reject Junior/Associate/Mid/Entry)", () => {
      const { rejected } = keywordPreFilter([makeJob("Junior Developer", "Remote")], null);
      expect(rejected).toHaveLength(1);
    });

    it("passes remote location with null profile", () => {
      const { passed } = keywordPreFilter([makeJob("Senior Dev", "Remote")], null);
      expect(passed).toHaveLength(1);
    });

    it("rejects non-remote location with null profile (no profile locations)", () => {
      const { rejected } = keywordPreFilter([makeJob("Senior Dev", "Chicago, IL")], null);
      expect(rejected).toHaveLength(1);
    });

    it("works with undefined profile", () => {
      const { passed } = keywordPreFilter([makeJob("Senior Dev", "Remote")]);
      expect(passed).toHaveLength(1);
    });
  });

  // ---- Management title soft reject with tech signals ----

  describe("management titles with tech signals", () => {
    it("rejects 'VP of Sales' (no tech signal)", () => {
      const { rejected } = keywordPreFilter([makeJob("VP of Sales", "Remote")], seniorProfile);
      expect(rejected).toHaveLength(1);
    });

    it("passes 'Director of Engineering' (tech signal present)", () => {
      const { passed } = keywordPreFilter([makeJob("Director of Engineering", "Remote")], seniorProfile);
      expect(passed).toHaveLength(1);
    });

    it("passes 'VP of Technical Architecture' (tech signal present)", () => {
      const { passed } = keywordPreFilter([makeJob("VP of Technical Architecture", "Remote")], seniorProfile);
      expect(passed).toHaveLength(1);
    });

    it("rejects 'Manager of Operations' (no tech signal)", () => {
      const { rejected } = keywordPreFilter([makeJob("Manager of Operations", "Remote")], seniorProfile);
      expect(rejected).toHaveLength(1);
    });

    it("passes 'Principal Staff Engineer' (no soft reject match)", () => {
      const { passed } = keywordPreFilter([makeJob("Principal Staff Engineer", "Remote")], seniorProfile);
      expect(passed).toHaveLength(1);
    });
  });

  // ---- No URL rejection ----

  describe("no URL rejection", () => {
    it("rejects jobs with empty URL", () => {
      const { rejected } = keywordPreFilter([makeJob("Senior Dev", "Remote", "")], seniorProfile);
      expect(rejected).toHaveLength(1);
      expect(rejected[0].filter_reason).toBe("no URL");
    });

    it("sets expected fields on rejected jobs", () => {
      const { rejected } = keywordPreFilter([makeJob("Senior Dev", "Remote", "")], seniorProfile);
      expect(rejected[0].total_score).toBe(0);
      expect(rejected[0].skills_fit).toBe(0);
      expect(rejected[0].level_fit).toBe(0);
      expect(rejected[0].key_tech_stack).toEqual([]);
      expect(rejected[0].status).toBe("open");
    });
  });

  // ---- Mixed batch ----

  describe("mixed batch processing", () => {
    it("correctly filters a mixed batch with senior profile", () => {
      const jobs = [
        makeJob("Senior Architect", "Remote"),
        makeJob("Junior Developer", "Remote"),
        makeJob("Lead Engineer", "New York"),
        makeJob("Staff Engineer", "Remote"),
        makeJob("Data Entry Clerk", "Remote"),
        makeJob("VP of Engineering", "Remote"),
      ];
      const { passed, rejected } = keywordPreFilter(jobs, seniorProfile);
      expect(passed.map(j => j.title)).toEqual(["Senior Architect", "Staff Engineer", "VP of Engineering"]);
      expect(rejected).toHaveLength(3);
    });

    it("correctly filters a mixed batch with junior profile", () => {
      const jobs = [
        makeJob("Junior Developer", "Remote"),
        makeJob("Mid-Level Engineer", "Tampa, FL"),
        makeJob("Senior Architect", "Remote"),
        makeJob("Software Intern", "Remote"),
      ];
      const { passed, rejected } = keywordPreFilter(jobs, juniorProfile);
      expect(passed.map(j => j.title)).toEqual(["Junior Developer", "Mid-Level Engineer", "Senior Architect"]);
      expect(rejected).toHaveLength(1); // intern is universal reject
    });
  });

  // ---- Custom location in profile ----

  describe("custom location patterns", () => {
    const bostonProfile = {
      targetLevel: ["Senior"],
      location: ["remote", "Boston, MA"],
    };

    it("passes Boston location when profile includes Boston", () => {
      const { passed } = keywordPreFilter([makeJob("Senior Dev", "Boston, MA")], bostonProfile);
      expect(passed).toHaveLength(1);
    });

    it("rejects Chicago when profile only has remote and Boston", () => {
      const { rejected } = keywordPreFilter([makeJob("Senior Dev", "Chicago, IL")], bostonProfile);
      expect(rejected).toHaveLength(1);
    });

    it("still passes remote with Boston profile", () => {
      const { passed } = keywordPreFilter([makeJob("Senior Dev", "Remote")], bostonProfile);
      expect(passed).toHaveLength(1);
    });
  });
});
