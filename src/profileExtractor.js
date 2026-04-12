/**
 * profileExtractor.js
 * Regex/heuristic-based extraction of skills, keywords, name, level, and location
 * from resume text. No LLM calls — runs entirely client-side.
 */

// ── Skills Dictionary ──────────────────────────────────────────────────────────

const SKILLS_DICTIONARY = {
  languages: [
    "JavaScript", "TypeScript", "Python", "C#", "Java", "Go", "Rust", "Ruby",
    "PHP", "Swift", "Kotlin", "Scala", "R", "SQL", "T-SQL", "PL/SQL",
    "HTML", "CSS", "SASS", "LESS", "Bash", "Shell", "PowerShell", "Perl",
    "Objective-C", "Dart", "Elixir", "Haskell", "Lua", "MATLAB", "Groovy",
    "COBOL", "Fortran", "Assembly", "VHDL", "Verilog",
  ],
  frameworks: [
    "React", "Angular", "Vue", "Svelte", "Next.js", "Nuxt", "Gatsby",
    "Node.js", ".NET", ".NET Core", "ASP.NET", "ASP.NET Core", "Blazor",
    "Spring Boot", "Spring", "Django", "Flask", "FastAPI", "Express",
    "Rails", "Ruby on Rails", "Laravel", "Symfony", "NestJS", "Remix",
    "Electron", "React Native", "Flutter", "SwiftUI", "Xamarin", "MAUI",
    "jQuery", "Bootstrap", "Tailwind", "Material UI", "Ant Design",
    "WPF", "WinForms", "Entity Framework",
  ],
  cloud: [
    "AWS", "Amazon Web Services", "Azure", "Microsoft Azure", "GCP",
    "Google Cloud", "Google Cloud Platform", "Heroku", "Vercel", "Netlify",
    "Cloudflare", "DigitalOcean", "Oracle Cloud", "IBM Cloud",
    "Azure DevOps", "Azure Functions", "AWS Lambda", "S3", "EC2", "ECS",
    "EKS", "AKS", "CloudFormation", "ARM Templates", "Bicep",
  ],
  ai_ml: [
    "Agentic AI", "RAG", "Retrieval Augmented Generation", "LLM",
    "Large Language Model", "GPT", "Claude", "OpenAI", "Anthropic",
    "TensorFlow", "PyTorch", "Keras", "scikit-learn", "Langchain",
    "LangGraph", "Machine Learning", "Deep Learning", "NLP",
    "Natural Language Processing", "Computer Vision", "Hugging Face",
    "Transformers", "BERT", "Stable Diffusion", "Generative AI",
    "Prompt Engineering", "Fine-Tuning", "Vector Database", "Embeddings",
    "Pinecone", "Weaviate", "Chroma", "FAISS", "Semantic Search",
    "AI Integration", "MLOps", "Model Deployment",
  ],
  databases: [
    "SQL Server", "Microsoft SQL Server", "PostgreSQL", "MySQL", "MariaDB",
    "MongoDB", "DynamoDB", "Redis", "Elasticsearch", "Cosmos DB",
    "Azure Cosmos DB", "Cassandra", "Neo4j", "Firebase", "Firestore",
    "Supabase", "CouchDB", "InfluxDB", "TimescaleDB", "Snowflake",
    "BigQuery", "Redshift", "Data Warehouse", "ETL", "Data Pipeline",
    "SSIS", "SSRS", "SSAS",
  ],
  devops: [
    "Docker", "Kubernetes", "Terraform", "Ansible", "Puppet", "Chef",
    "CI/CD", "Jenkins", "GitHub Actions", "GitLab CI", "CircleCI",
    "Travis CI", "Azure Pipelines", "Bamboo", "ArgoCD", "Helm",
    "Prometheus", "Grafana", "DataDog", "New Relic", "Splunk",
    "ELK Stack", "Nginx", "Apache", "IIS", "Load Balancer",
  ],
  architecture: [
    "Microservices", "REST APIs", "RESTful", "GraphQL", "gRPC",
    "Event-Driven", "Serverless", "Solutions Architecture",
    "System Design", "Domain-Driven Design", "DDD", "CQRS",
    "Event Sourcing", "Service Mesh", "API Gateway", "Message Queue",
    "RabbitMQ", "Kafka", "Azure Service Bus", "SQS", "SNS",
    "WebSockets", "OAuth", "JWT", "SAML", "SSO",
    "Enterprise Architecture", "Integration Architecture",
  ],
  compliance: [
    "PCI Compliance", "PCI DSS", "HIPAA", "SOC 2", "SOC2", "GDPR",
    "FedRAMP", "NIST", "ISO 27001", "CCPA", "FERPA", "ITAR",
    "Security Clearance",
  ],
  methodologies: [
    "Agile", "Scrum", "Kanban", "SAFe", "Lean", "Waterfall",
    "TDD", "Test-Driven Development", "BDD", "Pair Programming",
    "Code Review", "DevSecOps", "SRE", "Site Reliability",
  ],
  tools: [
    "Git", "GitHub", "GitLab", "Bitbucket", "Jira", "Confluence",
    "Slack", "Teams", "Figma", "Sketch", "Adobe XD", "Postman",
    "Swagger", "OpenAPI", "Storybook", "Webpack", "Vite", "Babel",
    "ESLint", "Prettier", "SonarQube", "Terraform Cloud",
    "Visual Studio", "VS Code", "IntelliJ", "Rider",
  ],
};

// ── Level Indicators ────────────────────────────────────────────────────────────

const LEVEL_PATTERNS = [
  { level: "Principal", patterns: [/\bprincipal\b/i, /\bdistinguished\b/i] },
  { level: "Staff", patterns: [/\bstaff\s+(engineer|developer|architect|scientist)/i] },
  { level: "Architect", patterns: [/\barchitect\b/i] },
  { level: "Lead", patterns: [/\blead\b/i, /\bteam\s+lead\b/i, /\btech\s+lead\b/i] },
  { level: "Senior", patterns: [/\bsenior\b/i, /\bsr\.?\s/i] },
  { level: "Director", patterns: [/\bdirector\b/i] },
  { level: "Manager", patterns: [/\bmanager\b/i, /\bengineering\s+manager\b/i] },
  { level: "Mid", patterns: [/\bmid[\s-]?level\b/i] },
  { level: "Junior", patterns: [/\bjunior\b/i, /\bjr\.?\s/i, /\bentry[\s-]level\b/i] },
];

// ── US State Abbreviations ──────────────────────────────────────────────────────

const US_STATES = new Set([
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC",
]);

// ── Helpers ─────────────────────────────────────────────────────────────────────

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Build a word-boundary regex for a skill. Handles special chars like
 * ".NET", "C#", "CI/CD", "Node.js" gracefully.
 */
function skillRegex(skill) {
  const escaped = escapeRegex(skill);
  // For skills starting/ending with special chars, relax boundaries
  const left = /^[A-Za-z]/.test(skill) ? "\\b" : "(?<![A-Za-z])";
  const right = /[A-Za-z]$/.test(skill) ? "\\b" : "(?![A-Za-z])";
  return new RegExp(`${left}${escaped}${right}`, "i");
}

// ── Main Extraction ─────────────────────────────────────────────────────────────

export function extractProfile(resumeText) {
  if (!resumeText || resumeText.trim().length < 30) {
    return null;
  }

  const text = resumeText.trim();
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  // 1. Name extraction — first short line that isn't metadata
  const name = extractName(lines);

  // 2. Skills extraction
  const skills = extractSkills(text);

  // 3. Years of experience
  const yearsExperience = extractYears(text);

  // 4. Target level
  const targetLevel = inferTargetLevel(text, yearsExperience);

  // 5. Location
  const location = extractLocation(text);

  // 6. Job titles found in resume (for query generation)
  const titles = extractTitles(text);

  // 7. Generate search queries
  const searchQueries = generateSearchQueries(skills, targetLevel, titles, location);

  return {
    name,
    skills,
    yearsExperience,
    targetLevel,
    location,
    titles,
    searchQueries,
  };
}

// ── Sub-extractors ──────────────────────────────────────────────────────────────

function extractName(lines) {
  const skipPatterns = [
    /@/,                              // email
    /https?:\/\//i,                   // URL
    /www\./i,                         // URL
    /^\(?\d{3}\)?[\s.-]?\d{3}/,       // phone
    /^\d{5}/,                         // zip code
    /resume|curriculum|vitae|cv\b/i,  // document title
    /objective|summary|experience|education|skills|profile/i, // section headers
    /\|/,                             // separator lines
    /,\s*[A-Z]{2}\s+\d{5}/,          // city, ST 12345
  ];

  for (const line of lines.slice(0, 5)) {
    if (line.length > 60 || line.length < 3) continue;
    if (skipPatterns.some(p => p.test(line))) continue;
    // Likely a name: 2-4 words, mostly letters
    const words = line.split(/\s+/);
    if (words.length >= 2 && words.length <= 5) {
      const allAlpha = words.every(w => /^[A-Za-z.''-]+$/.test(w));
      if (allAlpha) return line;
    }
  }
  return "";
}

function extractSkills(text) {
  const found = new Set();
  for (const category of Object.values(SKILLS_DICTIONARY)) {
    for (const skill of category) {
      if (skillRegex(skill).test(text)) {
        found.add(skill);
      }
    }
  }
  return [...found].sort();
}

function extractYears(text) {
  const patterns = [
    /(\d{1,2})\+?\s*years?\s+(?:of\s+)?(?:professional\s+)?experience/i,
    /(\d{1,2})\+?\s*years?\s+in\s+/i,
    /(?:over|more\s+than)\s+(\d{1,2})\s*years?/i,
    /(\d{1,2})\+?\s*years?\s+(?:of\s+)?(?:software|engineering|development|IT|technology)/i,
  ];
  let maxYears = 0;
  for (const pat of patterns) {
    const matches = text.matchAll(new RegExp(pat, "gi"));
    for (const m of matches) {
      const n = parseInt(m[1], 10);
      if (n > 0 && n <= 50) maxYears = Math.max(maxYears, n);
    }
  }
  return maxYears || null;
}

function inferTargetLevel(text, years) {
  const found = new Set();

  // Scan for level indicators in the text (especially in title-like contexts)
  for (const { level, patterns } of LEVEL_PATTERNS) {
    for (const pat of patterns) {
      if (pat.test(text)) {
        found.add(level);
        break;
      }
    }
  }

  // Remove unlikely lower levels if higher ones are present
  if (found.has("Principal") || found.has("Staff") || found.has("Director")) {
    found.delete("Junior");
    found.delete("Mid");
  }
  if (found.has("Senior") || found.has("Lead") || found.has("Architect")) {
    found.delete("Junior");
    found.delete("Mid");
  }

  // If no levels detected, infer from years of experience
  if (found.size === 0) {
    if (years && years >= 15) {
      return ["Senior", "Lead", "Principal", "Architect", "Staff"];
    } else if (years && years >= 8) {
      return ["Senior", "Lead"];
    } else if (years && years >= 3) {
      return ["Mid", "Senior"];
    } else {
      return ["Junior", "Mid"];
    }
  }

  return [...found];
}

function extractLocation(text) {
  const locations = new Set();
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  // Only search the header area (top ~10 lines) and the first/current job position.
  // This avoids pulling in locations from past jobs, education, etc.
  const headerLines = lines.slice(0, 10).join("\n");

  // Find the first job position section (text between the first job-like heading and the next section)
  const currentJobSection = (() => {
    const sectionHeaders = /^(?:experience|work\s+experience|professional\s+experience|employment)/i;
    let start = -1;
    for (let i = 0; i < lines.length; i++) {
      if (sectionHeaders.test(lines[i])) { start = i + 1; break; }
    }
    if (start < 0) return "";
    // Grab lines until the next section header or 15 lines, whichever is first
    const nextSection = /^(?:education|skills|certifications|projects|publications|awards|interests|references|volunteer|summary|objective)/i;
    const chunk = [];
    for (let i = start; i < Math.min(start + 15, lines.length); i++) {
      if (nextSection.test(lines[i])) break;
      chunk.push(lines[i]);
    }
    return chunk.join("\n");
  })();

  const searchableText = headerLines + "\n" + currentJobSection;

  // Check for "remote" mentions in header or current job
  if (/\bremote\b/i.test(searchableText)) locations.add("remote");

  // Check for US state + city patterns (City, ST) — only in header/current job
  const cityStatePattern = /\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)?),\s*([A-Z]{2})\b/g;
  let match;
  while ((match = cityStatePattern.exec(searchableText)) !== null) {
    // Validate the two-letter code is a real US state abbreviation
    if (US_STATES.has(match[2])) {
      locations.add(`${match[1]}, ${match[2]}`);
    }
  }

  // Check for explicit location preferences in header/current job
  const locationPrefs = [
    /(?:seeking|prefer|open\s+to|looking\s+for)\s+(?:a\s+)?remote/i,
    /(?:willing\s+to\s+)?relocat/i,
  ];
  for (const pat of locationPrefs) {
    if (pat.test(searchableText) && !locations.has("remote")) {
      locations.add("remote");
    }
  }

  // Only return what we found — do NOT guess if nothing is obvious
  return [...locations];
}

function extractTitles(text) {
  const titlePatterns = [
    /(?:^|\n)\s*((?:Senior|Sr\.?|Lead|Principal|Staff|Chief|Director|Head|VP)\s+(?:[A-Z][a-z]+\s*){1,4}(?:Engineer|Developer|Architect|Scientist|Analyst|Designer|Manager|Consultant|Specialist))\b/gm,
    /(?:^|\n)\s*((?:Software|Full[\s-]?Stack|Front[\s-]?End|Back[\s-]?End|Data|ML|AI|Cloud|DevOps|Platform|Solutions?|Systems?|Security|Network|QA|Test)\s+(?:Engineer|Developer|Architect|Scientist|Analyst))\b/gm,
  ];

  const titles = new Set();
  for (const pat of titlePatterns) {
    let m;
    while ((m = pat.exec(text)) !== null) {
      const title = m[1].trim();
      if (title.length < 60) titles.add(title);
    }
  }

  return [...titles].slice(0, 10);
}

function generateSearchQueries(skills, targetLevel, titles, location) {
  const queries = new Set();
  const locationSuffix = location.includes("remote") ? " remote" : "";

  // Use extracted titles directly as queries
  for (const title of titles.slice(0, 4)) {
    queries.add(title + locationSuffix);
  }

  // Priority skill categories for query generation
  const prioritySkills = [];
  const skillSet = new Set(skills.map(s => s.toLowerCase()));

  // Pick top skills by category priority
  const categoryPriority = ["ai_ml", "architecture", "cloud", "frameworks", "databases", "languages"];
  for (const cat of categoryPriority) {
    const catSkills = SKILLS_DICTIONARY[cat] || [];
    for (const s of catSkills) {
      if (skillSet.has(s.toLowerCase())) {
        prioritySkills.push(s);
        if (prioritySkills.length >= 6) break;
      }
    }
    if (prioritySkills.length >= 6) break;
  }

  // Combine levels + skills into queries
  const levels = targetLevel.filter(l => !["Mid", "Junior"].includes(l)).slice(0, 3);
  for (const level of levels) {
    for (const skill of prioritySkills.slice(0, 3)) {
      const q = `${level} ${skill} Engineer${locationSuffix}`;
      queries.add(q);
      if (queries.size >= 10) break;
    }
    if (queries.size >= 10) break;
  }

  // Ensure at least a few generic queries
  if (queries.size < 3 && levels.length > 0) {
    queries.add(`${levels[0]} Software Engineer${locationSuffix}`);
    queries.add(`${levels[0]} Developer${locationSuffix}`);
  }

  const allQueries = [...queries].slice(0, 10);

  return {
    adzuna: allQueries.map(q => q.replace(/\s+remote$/i, "")),
    jsearch: allQueries,
  };
}

export default extractProfile;
