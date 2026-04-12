// JobSearchPipeline.jsx
// Main orchestrator: state management, phase routing, callbacks

import { useState, useCallback, useEffect } from "react";
import { STORAGE_KEY, SCOUT_STORAGE_KEY } from "./constants";
import { isAppliedMatch } from "./utils";
import { loadAppliedJobs, saveAppliedJobs, loadTailorResults, clearTailorResults } from "./storage";
import { getCloudConnection, gatherSyncData } from "./cloudSync";
import { saveSyncDataToDropbox, hasDropboxToken } from "./cloudStorage";
import LandingScreen from "./components/LandingScreen";
import Header from "./components/Header";
import ProgressStepper from "./components/ProgressStepper";
import ScoutPhase from "./phases/ScoutPhase";
import SearchPhase from "./phases/SearchPhase";
import ReviewPhase from "./phases/ReviewPhase";
import TailorPhase from "./phases/TailorPhase";
import CompletePhase from "./phases/CompletePhase";

// Phase indices: 0=Scout, 1=Search, 2=Review, 3=Tailor, 4=Complete

// Debounced cloud sync: saves to Dropbox after data changes settle
let syncTimer = null;
function scheduleCloudSync() {
  const conn = getCloudConnection();
  if (!conn?.connected || !hasDropboxToken()) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    const data = gatherSyncData();
    saveSyncDataToDropbox(data).catch(() => {});
  }, 5000);
}

export default function JobSearchPipeline() {
  const [started, setStarted] = useState(false);
  const [profileText, setProfileText] = useState("");
  const [phase, setPhase] = useState(0);
  const [scoutResults, setScoutResults] = useState(null);
  const [scoutKey, setScoutKey] = useState(0);
  const [searchKey, setSearchKey] = useState(0);
  const [extractedProfile, setExtractedProfile] = useState(null);
  const [approvedJobs, setApprovedJobs] = useState([]);
  const [tailorResults, setTailorResults] = useState(() => loadTailorResults());
  const [appliedJobs, setAppliedJobs] = useState(loadAppliedJobs);
  const [maxVisited, setMaxVisited] = useState(0);
  const [cloudConn, setCloudConn] = useState(() => getCloudConnection());

  const advanceTo = useCallback((n) => {
    setPhase(n);
    setMaxVisited(prev => Math.max(prev, n));
  }, []);

  useEffect(() => { saveAppliedJobs(appliedJobs); scheduleCloudSync(); }, [appliedJobs]);

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
    advanceTo(4);
    scheduleCloudSync();
  }, [advanceTo]);

  const handleRunAgain = useCallback(() => {
    setScoutResults(null);
    setApprovedJobs([]);
    setPhase(0);
    setMaxVisited(0);
  }, []);

  // Start Over: clears everything EXCEPT tailorResults and appliedJobs
  const handleStartOver = useCallback(() => {
    const msg = tailorResults.length > 0
      ? "This will clear your current search results. Your tailored documents and applied jobs will be preserved. Continue?"
      : "This will clear your current search results. Continue?";
    if (!window.confirm(msg)) return;
    setScoutResults(null);
    setApprovedJobs([]);
    setProfileText("");
    setExtractedProfile(null);
    setPhase(0);
    setMaxVisited(0);
    setScoutKey(k => k + 1);
    setSearchKey(k => k + 1);
  }, [tailorResults]);

  // Whether a PDF/text has been loaded (controls Start Over visibility)
  const hasProfile = profileText.trim().length > 50;

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

      {/* Start Over button — on every tab, only after a PDF has been uploaded */}
      {hasProfile && (
        <div className="start-over-row">
          <button className="btn danger-btn sm" onClick={handleStartOver}>Start Over</button>
        </div>
      )}

      {phase === 0 && tailorResults.length > 0 && (
        <div className="saved-notice">
          <p className="saved-notice-text">You have {tailorResults.length} saved tailor result(s) from a previous session.</p>
          <div className="flex-gap">
            <button className="btn primary sm" onClick={() => advanceTo(4)}>View Results</button>
            <button className="btn default sm" onClick={() => { clearTailorResults(); setTailorResults([]); }}>Dismiss</button>
          </div>
        </div>
      )}

      {phase === 0 && (
        <ScoutPhase
          key={scoutKey}
          profileText={profileText}
          setProfileText={setProfileText}
          extractedProfile={extractedProfile}
          setExtractedProfile={setExtractedProfile}
          locked={maxVisited > 0 && phase !== maxVisited}
          onAdvance={() => advanceTo(1)}
        />
      )}

      {phase === 1 && (
        <SearchPhase
          key={searchKey}
          profileText={profileText}
          extractedProfile={extractedProfile}
          appliedList={appliedJobs}
          locked={maxVisited > 1 && phase !== maxVisited}
          onComplete={(data) => { setScoutResults(data); advanceTo(2); }}
        />
      )}

      {phase === 2 && (
        <ReviewPhase
          scoutResults={scoutResults}
          appliedList={appliedJobs}
          onAdvance={(jobs) => { setApprovedJobs(jobs); advanceTo(3); }}
        />
      )}

      {phase === 3 && (
        <TailorPhase
          approvedJobs={approvedJobs}
          profileText={profileText}
          extractedProfile={extractedProfile}
          onComplete={handleTailorComplete}
          cloudConnected={cloudConn?.connected}
        />
      )}

      {phase === 4 && (
        <CompletePhase
          tailorResults={tailorResults}
          appliedList={appliedJobs}
          onAddApplied={addAppliedJob}
          onRemoveApplied={removeAppliedJob}
          onClearApplied={clearAppliedJobs}
          onRunAgain={handleRunAgain}
          cloudConnected={cloudConn?.connected}
        />
      )}
    </div>
  );
}
