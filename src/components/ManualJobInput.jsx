// ManualJobInput.jsx
// Quick-score a single job by URL or pasted JD text

import { useState, useRef } from "react";
import { callAnthropicWithLoop } from "../api";
import Spinner from "./Spinner";

function ManualJobInput({ profileText, extractedProfile, apiKey, onJobScored, scoreRawJobs }) {
  const [mode, setMode] = useState("url"); // "url" | "paste"
  const [inputVal, setInputVal] = useState("");
  const [status, setStatus] = useState("idle"); // "idle" | "running" | "done" | "error"
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  const handleScore = async () => {
    if (!inputVal.trim()) { setError("Paste a URL or job description first."); return; }
    if (!apiKey) { setError("API key not set."); return; }
    setStatus("running");
    setError(null);
    setResult(null);
    abortRef.current = new AbortController();

    try {
      let jdText = "";
      let jobTitle = "Manual Entry";
      let company = "Unknown";
      let url = "";

      if (mode === "url") {
        url = inputVal.trim();
        // Use web search to fetch JD from URL
        const fetchData = await callAnthropicWithLoop({
          apiKey,
          system: "You are a job description fetcher. Return valid JSON only. No preamble, no markdown.",
          userMessage: `Fetch the job description from this URL: ${url}\nReturn JSON: { "title": "job title", "company": "company name", "jd_text": "full job description text" }`,
          maxTokens: 3000,
          tools: [{ type: "web_search_20250305", name: "web_search" }],
          signal: abortRef.current.signal,
          maxTurns: 5,
        });
        jdText = fetchData.jd_text || "";
        jobTitle = fetchData.title || "Manual Entry";
        company = fetchData.company || "Unknown";
      } else {
        jdText = inputVal.trim();
      }

      // Score the job against the profile
      const raw = [{
        title: jobTitle,
        company,
        location: "Remote",
        url,
        description: jdText.slice(0, 400),
        source: "manual",
      }];
      const scored = await scoreRawJobs(apiKey, profileText, extractedProfile, raw, abortRef.current.signal, () => {});
      const job = scored[0] ? { ...scored[0], jd_text: jdText, source_layer: "manual" } : null;

      if (!job) { setError("Scoring returned no result."); setStatus("error"); return; }
      setResult(job);
      setStatus("done");
    } catch (err) {
      if (err.name === "AbortError") { setStatus("idle"); return; }
      setError(err.message);
      setStatus("error");
    }
  };

  const handleAddToQueue = () => {
    if (result) {
      onJobScored(result);
      setResult(null);
      setInputVal("");
      setStatus("idle");
    }
  };

  const scorePercent = result ? Math.round(result.total_score * 10) : 0;
  return (
    <div className="mt-12">
      <div className="ep-label mb-6">QUICK SCORE A JOB</div>
      <div className="tab-bar">
        <button className={`tab-btn${mode === "url" ? " active" : ""}`} onClick={() => { setMode("url"); setInputVal(""); setResult(null); setError(null); }}>Paste URL</button>
        <button className={`tab-btn${mode === "paste" ? " active" : ""}`} onClick={() => { setMode("paste"); setInputVal(""); setResult(null); setError(null); }}>Paste JD Text</button>
      </div>
      {mode === "url" ? (
        <input type="url" placeholder="https://jobs.lever.co/company/job-id" value={inputVal} onChange={(e) => setInputVal(e.target.value)} className="form-input mb-10" disabled={status === "running"} />
      ) : (
        <textarea placeholder="Paste the full job description here..." value={inputVal} onChange={(e) => setInputVal(e.target.value)} rows={6} className="form-textarea mb-10" disabled={status === "running"} />
      )}
      <div className="flex-gap">
        <button className="btn primary" disabled={status === "running" || !inputVal.trim()} onClick={handleScore}>
          {status === "running" ? <><Spinner />Scoring...</> : "Score This Job"}
        </button>
        {status === "running" && (
          <button className="btn default sm" onClick={() => { abortRef.current?.abort(); setStatus("idle"); }}>Cancel</button>
        )}
      </div>
      {error && <p className="text-error">{error}</p>}
      {result && status === "done" && (
        <div className="card a-yellow mt-12">
          <div className="flex-between">
            <div>
              <div className="job-title">{result.title}</div>
              <div className="job-meta">{result.company} {result.location ? `\u00B7 ${result.location}` : ""}</div>
            </div>
            <div className="score-badge">{scorePercent}%</div>
          </div>
          <div className="job-meta mt-4">Skills: {result.skills_fit}/5 | Level: {result.level_fit}/5</div>
          <div className="text-hint mt-4">{result.reasoning}</div>
          {Array.isArray(result.key_tech_stack) && result.key_tech_stack.length > 0 && (
            <div className="tech-stack mt-4">{result.key_tech_stack.map(t => <span key={t} className="badge">{t}</span>)}</div>
          )}
          <button className="btn primary sm mt-12" onClick={handleAddToQueue}>Add to Scout Queue</button>
          <p className="text-hint mt-4">Adding to queue lets you include this job in scoring and advance to Review.</p>
        </div>
      )}
    </div>
  );
}

export default ManualJobInput;
