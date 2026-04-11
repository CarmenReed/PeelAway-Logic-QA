// JobSearchPipeline.jsx
// Main orchestrator: state management, phase routing, callbacks

import { useState, useCallback, useEffect } from "react";
import { STORAGE_KEY, SCOUT_STORAGE_KEY } from "./constants";
import { isAppliedMatch } from "./utils";
import { loadAppliedJobs, saveAppliedJobs, loadTailorResults, clearTailorResults } from "./storage";
import LandingScreen from "./components/LandingScreen";
import Header from "./components/Header";
import ProgressStepper from "./components/ProgressStepper";
import ScoutPhase from "./phases/ScoutPhase";
import ReviewPhase from "./phases/ReviewPhase";
import TailorPhase from "./phases/TailorPhase";
import CompletePhase from "./phases/CompletePhase";

export default function JobSearchPipeline() {
  const [started, setStarted] = useState(false);
  const [profileText, setProfileText] = useState("");
  const [phase, setPhase] = useState(0);
  const [scoutResults, setScoutResults] = useState(null);
  const [approvedJobs, setApprovedJobs] = useState([]);
  const [tailorResults, setTailorResults] = useState(() => loadTailorResults());
  const [appliedJobs, setAppliedJobs] = useState(loadAppliedJobs);
  const [maxVisited, setMaxVisited] = useState(0);

  const advanceTo = useCallback((n) => {
    setPhase(n);
    setMaxVisited(prev => Math.max(prev, n));
  }, []);

  useEffect(() => { saveAppliedJobs(appliedJobs); }, [appliedJobs]);

  const addAppliedJob = useCallback((job) => {
    setAppliedJobs(prev => {
      const dup = prev.some(j => isAppliedMatch(j, job));
      return dup ? prev : [...prev, job];
    });
  }, []);

  const removeAppliedJob = useCallback((index) => {
    setAppliedJobs(prev => prev.filter((_, i) => i !== index));
  }, []);

  const clearAppliedJobs = useCallback(() => {
    setAppliedJobs([]);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SCOUT_STORAGE_KEY);
  }, []);

  const handleTailorComplete = useCallback((results) => {
    setTailorResults(results);
    advanceTo(3);
  }, [advanceTo]);

  const handleRunAgain = useCallback(() => {
    setScoutResults(null);
    setApprovedJobs([]);
    setPhase(0);
    setMaxVisited(0);
  }, []);

  const handleStartOver = useCallback(() => {
    const msg = tailorResults.length > 0
      ? "This will clear your current search results. Your tailored documents and applied jobs will be preserved. Continue?"
      : "This will clear your current search results. Continue?";
    if (!window.confirm(msg)) return;
    setScoutResults(null);
    setApprovedJobs([]);
    setPhase(0);
    setMaxVisited(0);
  }, [tailorResults]);

  if (!started) {
    return (
      <div className="jsp-app">
        <LandingScreen onStart={() => setStarted(true)} />
      </div>
    );
  }

  return (
    <div className="jsp-app">
      <Header />
      <ProgressStepper current={phase} maxVisited={maxVisited} onTabClick={setPhase} />

      {maxVisited > 0 && (
        <div className="start-over-row">
          <button className="btn danger-btn sm" onClick={handleStartOver}>Start Over</button>
        </div>
      )}

      {phase === 0 && tailorResults.length > 0 && (
        <div className="saved-notice">
          <p className="saved-notice-text">You have {tailorResults.length} saved tailor result(s) from a previous session.</p>
          <div className="flex-gap">
            <button className="btn primary sm" onClick={() => advanceTo(3)}>View Results</button>
            <button className="btn default sm" onClick={() => { clearTailorResults(); setTailorResults([]); }}>Dismiss</button>
          </div>
        </div>
      )}

      {phase === 0 && (
        <ScoutPhase
          profileText={profileText}
          setProfileText={setProfileText}
          appliedList={appliedJobs}
          onComplete={(data) => { setScoutResults(data); advanceTo(1); }}
        />
      )}

      {phase === 1 && (
        <ReviewPhase
          scoutResults={scoutResults}
          appliedList={appliedJobs}
          onAdvance={(jobs) => { setApprovedJobs(jobs); advanceTo(2); }}
        />
      )}

      {phase === 2 && (
        <TailorPhase
          approvedJobs={approvedJobs}
          profileText={profileText}
          onComplete={handleTailorComplete}
        />
      )}

      {phase === 3 && (
        <CompletePhase
          tailorResults={tailorResults}
          appliedList={appliedJobs}
          onAddApplied={addAppliedJob}
          onRemoveApplied={removeAppliedJob}
          onClearApplied={clearAppliedJobs}
          onRunAgain={handleRunAgain}
        />
      )}
    </div>
  );
}
