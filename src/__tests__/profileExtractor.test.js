import { extractProfile } from "../profileExtractor";

// ============================================================
// Basic extraction
// ============================================================

describe("extractProfile — basic", () => {
  it("returns null for empty text", () => {
    expect(extractProfile("")).toBeNull();
    expect(extractProfile(null)).toBeNull();
    expect(extractProfile("short")).toBeNull();
  });

  it("returns an object with expected keys for valid text", () => {
    const result = extractProfile("John Doe\nSenior Software Engineer with 10 years of experience in React, Node.js, and Python. Based in Tampa, FL.");
    expect(result).toHaveProperty("name");
    expect(result).toHaveProperty("skills");
    expect(result).toHaveProperty("yearsExperience");
    expect(result).toHaveProperty("targetLevel");
    expect(result).toHaveProperty("location");
    expect(result).toHaveProperty("searchQueries");
  });
});

// ============================================================
// Name extraction
// ============================================================

describe("extractProfile — name extraction", () => {
  it("extracts a simple two-word name", () => {
    const result = extractProfile("Jane Smith\nSenior Developer with 5 years experience in JavaScript and React");
    expect(result.name).toBe("Jane Smith");
  });

  it("extracts a three-word name", () => {
    const result = extractProfile("Mary Jane Watson\nSoftware Engineer with 8 years experience in Python and AWS");
    expect(result.name).toBe("Mary Jane Watson");
  });

  it("skips email lines to find name", () => {
    const result = extractProfile("john@example.com\nJohn Doe\nSenior Developer with 5 years experience in JavaScript");
    expect(result.name).toBe("John Doe");
  });

  it("skips phone number lines to find name", () => {
    const result = extractProfile("(555) 123-4567\nJohn Doe\nSenior Developer with 5 years experience in JavaScript");
    expect(result.name).toBe("John Doe");
  });

  it("returns empty string when no name can be found", () => {
    const result = extractProfile("https://example.com\njohn@test.com\n555-123-4567\nSenior Developer with 5 years of experience in JavaScript and React");
    expect(result.name).toBe("");
  });
});

// ============================================================
// Skills extraction
// ============================================================

describe("extractProfile — skills extraction", () => {
  it("extracts common programming languages", () => {
    const result = extractProfile("John Doe\nExperienced developer proficient in JavaScript, Python, and Java with 5 years experience");
    expect(result.skills).toContain("JavaScript");
    expect(result.skills).toContain("Python");
    expect(result.skills).toContain("Java");
  });

  it("extracts frameworks", () => {
    const result = extractProfile("John Doe\nFull-stack developer using React, Node.js, and Django with 5 years of experience");
    expect(result.skills).toContain("React");
    expect(result.skills).toContain("Node.js");
    expect(result.skills).toContain("Django");
  });

  it("extracts cloud platforms", () => {
    const result = extractProfile("John Doe\nCloud architect working with AWS, Azure, and GCP for enterprise deployments with 8 years experience");
    expect(result.skills).toContain("AWS");
    expect(result.skills).toContain("Azure");
    expect(result.skills).toContain("GCP");
  });

  it("extracts AI/ML skills", () => {
    const result = extractProfile("John Doe\nAI engineer specializing in RAG, LLM integration, and Agentic AI patterns with 5 years experience");
    expect(result.skills).toContain("RAG");
    expect(result.skills).toContain("LLM");
    expect(result.skills).toContain("Agentic AI");
  });

  it("extracts databases", () => {
    const result = extractProfile("John Doe\nDatabase administrator with SQL Server, PostgreSQL, and MongoDB expertise with 10 years experience");
    expect(result.skills).toContain("SQL Server");
    expect(result.skills).toContain("PostgreSQL");
    expect(result.skills).toContain("MongoDB");
  });

  it("extracts special-character skills like C# and .NET", () => {
    const result = extractProfile("John Doe\nBackend developer using C# and .NET Core for enterprise applications with 5 years of experience");
    expect(result.skills).toContain("C#");
    expect(result.skills).toContain(".NET Core");
  });

  it("returns skills sorted alphabetically", () => {
    const result = extractProfile("John Doe\nDeveloper using Python, AWS, and React with 5 years of professional experience in building apps");
    const sorted = [...result.skills].sort();
    expect(result.skills).toEqual(sorted);
  });
});

// ============================================================
// Years of experience
// ============================================================

describe("extractProfile — years of experience", () => {
  it("extracts 'X years of experience' pattern", () => {
    const result = extractProfile("John Doe\nSoftware engineer with 12 years of experience in full-stack development and cloud architecture");
    expect(result.yearsExperience).toBe(12);
  });

  it("extracts 'X+ years' pattern", () => {
    const result = extractProfile("John Doe\nSeasoned architect with 15+ years in enterprise software and distributed systems engineering");
    expect(result.yearsExperience).toBe(15);
  });

  it("extracts 'over X years' pattern", () => {
    const result = extractProfile("John Doe\nTech lead with over 8 years building scalable web applications and microservices architectures");
    expect(result.yearsExperience).toBe(8);
  });

  it("takes the maximum when multiple year mentions exist", () => {
    const result = extractProfile("John Doe\n5 years in frontend, 10 years of experience in software engineering, 3 years in management");
    expect(result.yearsExperience).toBe(10);
  });

  it("returns null when no years found", () => {
    const result = extractProfile("John Doe\nSoftware engineer skilled in React, Node.js, Python, and AWS for building modern web applications");
    expect(result.yearsExperience).toBeNull();
  });
});

// ============================================================
// Target level inference
// ============================================================

describe("extractProfile — target level", () => {
  it("detects Senior from resume text", () => {
    const result = extractProfile("John Doe\nSenior Software Engineer at Google with 10 years of experience in distributed systems");
    expect(result.targetLevel).toContain("Senior");
  });

  it("detects multiple levels", () => {
    const result = extractProfile("John Doe\nPrincipal Architect and Lead Engineer with 20 years of experience in enterprise software systems");
    expect(result.targetLevel).toContain("Principal");
    expect(result.targetLevel).toContain("Lead");
    expect(result.targetLevel).toContain("Architect");
  });

  it("removes Junior/Mid when Senior is present", () => {
    const result = extractProfile("John Doe\nSenior Engineer, previously junior developer, now leading a team of architects and staff engineers");
    expect(result.targetLevel).toContain("Senior");
    expect(result.targetLevel).not.toContain("Junior");
    expect(result.targetLevel).not.toContain("Mid");
  });

  it("infers from years of experience when no levels found", () => {
    const result = extractProfile("John Doe\n123 Main St\nExperienced developer with 20 years of experience building enterprise software applications");
    expect(result.targetLevel).toContain("Senior");
    expect(result.targetLevel).toContain("Principal");
  });
});

// ============================================================
// Location extraction
// ============================================================

describe("extractProfile — location", () => {
  it("detects remote", () => {
    const result = extractProfile("John Doe\nRemote software engineer with 5 years of experience in JavaScript, React, and Node.js development");
    expect(result.location).toContain("remote");
  });

  it("returns empty array when no obvious location found", () => {
    const result = extractProfile("John Doe\nSoftware engineer with 5 years of experience in building distributed systems and microservices");
    expect(result.location).toEqual([]);
  });

  it("extracts City, ST from header area", () => {
    const result = extractProfile("John Doe\nSan Francisco, CA\nSoftware engineer with 5 years of experience in JavaScript, React, and Node.js development");
    expect(result.location).toContain("San Francisco, CA");
  });

  it("does not grab preceding words from job titles as city name", () => {
    // "Systems Engineer | Tampa, FL" should yield "Tampa, FL", not "Systems Tampa, FL"
    const result = extractProfile("John Doe\nSystems Engineer | Tampa, FL\n5 years of experience in JavaScript and React");
    expect(result.location).toContain("Tampa, FL");
    expect(result.location).not.toContain("Systems Tampa, FL");
  });

  it("extracts City, ST after common separators", () => {
    const result = extractProfile("Jane Smith\nSolutions Architect - Orlando, FL\n8 years of experience");
    expect(result.location).toContain("Orlando, FL");
  });

  it("does not extract City, ST from deep in resume body", () => {
    // Location buried far below header in an old job should not be picked up
    const lines = ["John Doe", "Senior Engineer", "10 years of experience in JavaScript"];
    // Add 20 filler lines then a location in an old job
    for (let i = 0; i < 20; i++) lines.push("Built scalable systems for enterprise clients");
    lines.push("Previous Role at ACME Corp, Austin, TX");
    const result = extractProfile(lines.join("\n"));
    expect(result.location).not.toContain("Austin, TX");
  });
});

// ============================================================
// Search query generation
// ============================================================

describe("extractProfile — search queries", () => {
  it("generates adzuna and jsearch query arrays", () => {
    const result = extractProfile("John Doe\nSenior React Developer with 8 years of experience in JavaScript, React, Node.js, and AWS");
    expect(result.searchQueries).toHaveProperty("adzuna");
    expect(result.searchQueries).toHaveProperty("jsearch");
    expect(Array.isArray(result.searchQueries.adzuna)).toBe(true);
    expect(Array.isArray(result.searchQueries.jsearch)).toBe(true);
  });

  it("generates at least 2 queries", () => {
    const result = extractProfile("John Doe\nSenior React Developer with 8 years of experience in JavaScript, React, Node.js, and AWS");
    expect(result.searchQueries.jsearch.length).toBeGreaterThanOrEqual(2);
  });

  it("generates queries that include extracted titles", () => {
    const result = extractProfile("John Doe\nSenior Software Engineer at ACME Corp with 10 years of experience in full-stack development");
    const allQueries = result.searchQueries.jsearch.join(" ");
    expect(allQueries).toMatch(/senior/i);
  });
});
