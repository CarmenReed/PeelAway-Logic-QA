import { useState, useRef, useCallback } from "react";
import { jobKey } from "../utils";
import { saveDismissedJob } from "../storage";
import { createJobIndex, indexJobs, searchJobs } from "../services/azureSearchService";
import JobCard from "../components/JobCard";
import GuideBar from "../components/GuideBar";

const TIER_CONFIG = [
  { label: "Strong", emoji: "\u2705", key: "strong_match", tabClass: "strong-tab" },
  { label: "Possible", emoji: "\uD83D\uDD36", key: "possible", tabClass: "possible-tab" },
  { label: "Weak", emoji: "\u26A0\uFE0F", key: "weak", tabClass: "weak-tab" },
];

function ReviewPhase({ scoutResults, appliedList, onAdvance, onStartOver }) {
  const [activeTab, setActiveTab] = useState("strong_match");
  const [sortBy, setSortBy] = useState("score");
  const [selected, setSelected] = useState([]);

  // Azure AI Search state
  const [azureExpanded, setAzureExpanded] = useState(false);
  const [azureEndpoint, setAzureEndpoint] = useState("");
  const [azureKey, setAzureKey] = useState("");
  const [azureStatus, setAzureStatus] = useState("");
  const [azureIndexed, setAzureIndexed] = useState(false);
  const [azureIndexing, setAzureIndexing] = useState(false);
  const [azureSearchText, setAzureSearchText] = useState("");
  const [azureResults, setAzureResults] = useState(null);
  const searchTimerRef = useRef(null);

  const handleAzureIndex = useCallback(async () => {
    if (!azureEndpoint || !azureKey) { setAzureStatus("Please enter endpoint and key."); return; }
    setAzureIndexing(true);
    setAzureStatus("Creating index...");
    const createRes = await createJobIndex(azureEndpoint, azureKey);
    if (!createRes.success) { setAzureStatus(createRes.message); setAzureIndexing(false); return; }

    setAzureStatus("Indexing jobs...");
    const allJobs = Object.values(scoutResults?.tiers ?? {}).flat();
    const indexRes = await indexJobs(azureEndpoint, azureKey, allJobs);
    setAzureIndexing(false);
    if (indexRes.errors.length > 0) {
      setAzureStatus(`${indexRes.indexed} jobs indexed. Errors: ${indexRes.errors[0]}`);
    } else {
      setAzureStatus(`${indexRes.indexed} jobs indexed to Azure AI Search`);
    }
    if (indexRes.indexed > 0) setAzureIndexed(true);
  }, [azureEndpoint, azureKey, scoutResults]);

  const handleAzureSearch = useCallback((text) => {
    setAzureSearchText(text);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!text.trim()) { setAzureResults(null); return; }
    searchTimerRef.current = setTimeout(async () => {
      const results = await searchJobs(azureEndpoint, azureKey, text);
      setAzureResults(results);
    }, 400);
  }, [azureEndpoint, azureKey]);

  const tiers = scoutResults?.tiers ?? {};
  const isSelected = (job) => selected.some(s => jobKey(s) === jobKey(job));
  const toggle = (job) => setSelected(prev =>
    isSelected(job) ? prev.filter(j => jobKey(j) !== jobKey(job)) : [...prev, job]
  );
  const selectAllStrong = () => {
    const keys = new Set(selected.map(jobKey));
    setSelected(prev => [...prev, ...(tiers.strong_match ?? []).filter(j => !keys.has(jobKey(j)))]);
  };

  const jobs = (tiers[activeTab] ?? []).slice().sort((a, b) => {
    if (sortBy === "score") return b.total_score - a.total_score;
    if (sortBy === "date") {
      if (!a.date_posted && !b.date_posted) return 0;
      if (!a.date_posted) return 1;
      if (!b.date_posted) return -1;
      return new Date(b.date_posted) - new Date(a.date_posted);
    }
    return a.company.localeCompare(b.company);
  });

  const totalJobs = Object.values(tiers).reduce((s, a) => s + (a?.length || 0), 0);

  // Azure search highlight set (match by title+company)
  const azureMatchSet = new Set(
    (azureResults || []).map((r) => `${(r.title || "").toLowerCase()}|${(r.company || "").toLowerCase()}`)
  );
  const isAzureMatch = (job) =>
    azureResults && azureResults.length > 0 &&
    azureMatchSet.has(`${(job.title || "").toLowerCase()}|${(job.company || "").toLowerCase()}`);

  return (
    <div className="content">
      <GuideBar emoji={"\uD83C\uDFAF"} text="Select jobs for tailored documents, then advance." onStartOver={onStartOver} />

      {/* Azure AI Search (optional, collapsible) */}
      <div className="mb-12">
        {!azureExpanded ? (
          <button className="btn ghost sm" onClick={() => setAzureExpanded(true)} style={{ opacity: 0.7, fontSize: "0.85rem" }}>
            Connect Azure AI Search (optional)
          </button>
        ) : (
          <details open style={{ border: "1px solid var(--border, #333)", borderRadius: 8, padding: 12, marginBottom: 8 }}>
            <summary style={{ cursor: "pointer", fontWeight: 600, marginBottom: 8 }} onClick={(e) => { e.preventDefault(); setAzureExpanded(false); }}>
              Azure AI Search
            </summary>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <input className="form-input" type="text" placeholder="Search Endpoint (e.g. mysearch.search.windows.net)" value={azureEndpoint} onChange={(e) => setAzureEndpoint(e.target.value)} />
              <input className="form-input" type="password" placeholder="Admin Key" value={azureKey} onChange={(e) => setAzureKey(e.target.value)} />
              <button className="btn sm" onClick={handleAzureIndex} disabled={azureIndexing || !azureEndpoint || !azureKey}>
                {azureIndexing ? "Indexing..." : "Connect & Index Jobs"}
              </button>
              {azureStatus && <p className="text-hint" style={{ margin: 0 }}>{azureStatus}</p>}
              {azureIndexed && (
                <input className="form-input" type="text" placeholder="Search indexed jobs..." value={azureSearchText} onChange={(e) => handleAzureSearch(e.target.value)} />
              )}
              {azureResults && azureResults.length > 0 && (
                <div style={{ fontSize: "0.85rem", opacity: 0.8 }}>
                  {azureResults.length} result{azureResults.length !== 1 ? "s" : ""} found
                </div>
              )}
            </div>
          </details>
        )}
      </div>

      <div className="text-p mb-12">{scoutResults?.summary} ({totalJobs} total)</div>

      <div className="tier-tabs">
        {TIER_CONFIG.map(tab => (
          <button key={tab.key} className={`tier-tab ${tab.tabClass}${activeTab === tab.key ? " active" : ""}`} onClick={() => setActiveTab(tab.key)}>
            {tab.emoji} {tab.label} ({(tiers[tab.key] ?? []).length})
          </button>
        ))}
      </div>

      <div className="sort-row">
        <label>Sort by:</label>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="form-select">
          <option value="score">Score</option>
          <option value="date">Date Posted (newest first)</option>
          <option value="company">Company</option>
        </select>
      </div>

      {jobs.length === 0
        ? <p className="text-p">No jobs in this tier.</p>
        : jobs.map((job, i) => (
          <JobCard key={i} job={job} selectable={activeTab === "strong_match" || activeTab === "possible"} selected={isSelected(job)} onToggle={toggle} highlight={isAzureMatch(job)} />
        ))
      }

      {(activeTab === "strong_match" || activeTab === "possible") && (
        <div className="mt-12">
          {activeTab === "strong_match" && (
            <button className="btn ghost sm" onClick={selectAllStrong}>Select All ({(tiers.strong_match ?? []).length})</button>
          )}
          <p className="text-hint mt-8">{selected.length} job{selected.length !== 1 ? "s" : ""} selected for tailoring</p>
        </div>
      )}

      <div className="flex-end mt-12">
        <button className="btn glow-btn" disabled={selected.length === 0} onClick={() => {
          const allCandidates = [...(tiers.strong_match ?? []), ...(tiers.possible ?? [])];
          allCandidates.filter(j => !isSelected(j)).forEach(j => saveDismissedJob(j));
          onAdvance(selected);
        }}>
          Advance to Tailor ({selected.length})
        </button>
      </div>
    </div>
  );
}

// ============================================================
// TAILOR PHASE (on-demand per job)
// ============================================================


export default ReviewPhase;
