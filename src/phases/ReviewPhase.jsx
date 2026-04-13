import { useState } from "react";
import { jobKey } from "../utils";
import { saveDismissedJob } from "../storage";
import JobCard from "../components/JobCard";
import GuideBar from "../components/GuideBar";

const TIER_CONFIG = [
  { label: "Strong", emoji: "\u2705", key: "strong_match", tabClass: "strong-tab" },
  { label: "Possible", emoji: "\uD83D\uDD36", key: "possible", tabClass: "possible-tab" },
  { label: "Weak", emoji: "\u26A0\uFE0F", key: "weak", tabClass: "weak-tab" },
];

function applyDemoScoreFloor(tiers) {
  const floored = {};
  for (const [key, jobs] of Object.entries(tiers)) {
    floored[key] = jobs.map(job => {
      if (job.total_score < 8) {
        return { ...job, total_score: 8 };
      }
      return job;
    });
  }
  return floored;
}

function ReviewPhase({ scoutResults, appliedList, demoMode, onAdvance, onStartOver }) {
  const [activeTab, setActiveTab] = useState("strong_match");
  const [sortBy, setSortBy] = useState("score");
  const [selected, setSelected] = useState([]);

  const rawTiers = scoutResults?.tiers ?? {};
  const tiers = demoMode ? applyDemoScoreFloor(rawTiers) : rawTiers;
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

  const totalJobs = (tiers.strong_match?.length || 0) + (tiers.possible?.length || 0) + (tiers.weak?.length || 0);

  return (
    <div className="content" data-testid="review-phase">
      <GuideBar emoji={"\uD83C\uDFAF"} text="Select jobs for tailored documents, then advance." onStartOver={onStartOver} />

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
          <JobCard key={i} job={job} selectable={activeTab === "strong_match" || activeTab === "possible"} selected={isSelected(job)} onToggle={toggle} />
        ))
      }

      {(activeTab === "strong_match" || activeTab === "possible") && (
        <div className="mt-12">
          {activeTab === "strong_match" && (
            <button className="btn ghost sm" onClick={selectAllStrong}>Select All ({(tiers.strong_match ?? []).length})</button>
          )}
          <p className="text-hint mt-8">{selected.length} job{selected.length !== 1 ? "s" : ""} selected</p>
        </div>
      )}

      <div className="flex-end mt-12">
        <button className="btn glow-btn" data-testid="review-advance-btn" disabled={selected.length === 0} onClick={() => {
          const allCandidates = [...(tiers.strong_match ?? []), ...(tiers.possible ?? [])];
          allCandidates.filter(j => !isSelected(j)).forEach(j => saveDismissedJob(j));
          onAdvance(selected);
        }}>
          Advance to Complete ({selected.length})
        </button>
      </div>
    </div>
  );
}

// ============================================================
// COMPLETE PHASE (on-demand per job)
// ============================================================


export default ReviewPhase;
