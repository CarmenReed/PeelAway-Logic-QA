import { useState, useRef } from "react";
import { ANTHROPIC_API_KEY, TAILOR_DELAY_MS } from "../constants";
import { companyTitleKey, jobKey, extractTextFromBlocks, extractJson } from "../utils";
import { loadTailorResults, saveTailorResult } from "../storage";
import { TAILOR_SYSTEM, buildResumeOnlyPrompt, buildCoverLetterOnlyPrompt } from "../prompts";
import { withRetry, callAnthropic } from "../api";
import { saveToDropbox, isDropboxConfigured } from "../cloudStorage";
import Spinner from "../components/Spinner";
import AppliedTracker from "../components/AppliedTracker";
import GuideBar from "../components/GuideBar";

function CompletePhase({ approvedJobs, profileText, extractedProfile, appliedList, onAddApplied, onRemoveApplied, onClearApplied, onRunAgain, cloudConnected, onStartOver }) {
  const [downloadFormat, setDownloadFormat] = useState("txt");
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [copiedType, setCopiedType] = useState(null);

  // Per-job generation state: { [jobKey]: { resumeStatus, coverStatus, resume, coverLetter, error } }
  const [jobState, setJobState] = useState(() => {
    const saved = loadTailorResults();
    const restored = {};
    for (const r of saved) {
      const key = companyTitleKey({ company: r.company, title: r.job_title });
      const match = approvedJobs.find(j => companyTitleKey(j) === key);
      if (match) {
        restored[jobKey(match)] = {
          resumeStatus: r.resume ? "done" : "idle",
          coverStatus: r.cover_letter ? "done" : "idle",
          resume: r.resume || null,
          coverLetter: r.cover_letter || null,
        };
      }
    }
    return restored;
  });
  const abortRefs = useRef({});
  const lastCallTime = useRef(0);

  const getJobState = (job) => jobState[jobKey(job)] ?? {};

  const setJobField = (job, fields) => {
    setJobState(prev => ({
      ...prev,
      [jobKey(job)]: { ...prev[jobKey(job)], ...fields },
    }));
  };

  const waitForRateLimit = async () => {
    const now = Date.now();
    const elapsed = now - lastCallTime.current;
    if (lastCallTime.current > 0 && elapsed < TAILOR_DELAY_MS) {
      await new Promise(r => setTimeout(r, TAILOR_DELAY_MS - elapsed));
    }
    lastCallTime.current = Date.now();
  };

  const persistJobResult = (job, fields) => {
    const currentState = { ...jobState[jobKey(job)], ...fields };
    saveTailorResult({
      job_title: job.title,
      company: job.company,
      url: job.url || "",
      resume: currentState.resume || "",
      cover_letter: currentState.coverLetter || "",
    });
  };

  const handleCreateResume = async (job) => {
    const key = jobKey(job);
    abortRefs.current[key + "_resume"] = new AbortController();
    setJobField(job, { resumeStatus: "running", resumeError: null });
    try {
      await waitForRateLimit();
      const data = await withRetry(() => callAnthropic({
        apiKey: ANTHROPIC_API_KEY,
        system: TAILOR_SYSTEM,
        messages: [{ role: "user", content: buildResumeOnlyPrompt(profileText, job) }],
        maxTokens: 4000,
        signal: abortRefs.current[key + "_resume"].signal,
      }));
      const raw = extractTextFromBlocks(data.content);
      const parsed = extractJson([raw]);
      setJobField(job, { resumeStatus: "done", resume: parsed.resume });
      persistJobResult(job, { resume: parsed.resume });
    } catch (err) {
      if (err.name === "AbortError") { setJobField(job, { resumeStatus: "idle" }); return; }
      console.error(`Resume generation failed for ${job.title} at ${job.company}:`, err);
      setJobField(job, { resumeStatus: "error", resumeError: err.message });
    }
  };

  const handleCreateCoverLetter = async (job) => {
    const key = jobKey(job);
    abortRefs.current[key + "_cover"] = new AbortController();
    setJobField(job, { coverStatus: "running", coverError: null });
    try {
      await waitForRateLimit();
      const data = await withRetry(() => callAnthropic({
        apiKey: ANTHROPIC_API_KEY,
        system: TAILOR_SYSTEM,
        messages: [{ role: "user", content: buildCoverLetterOnlyPrompt(profileText, job, extractedProfile?.name) }],
        maxTokens: 2000,
        signal: abortRefs.current[key + "_cover"].signal,
      }));
      const raw = extractTextFromBlocks(data.content);
      const parsed = extractJson([raw]);
      setJobField(job, { coverStatus: "done", coverLetter: parsed.cover_letter });
      persistJobResult(job, { coverLetter: parsed.cover_letter });
    } catch (err) {
      if (err.name === "AbortError") { setJobField(job, { coverStatus: "idle" }); return; }
      console.error(`Cover letter generation failed for ${job.title} at ${job.company}:`, err);
      setJobField(job, { coverStatus: "error", coverError: err.message });
    }
  };

  const download = (content, baseName, type) => {
    if (downloadFormat === "pdf") {
      const win = window.open("", "_blank");
      if (!win) return;
      const escaped = content.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
      win.document.write(`<!DOCTYPE html><html><head><title>${baseName}</title><style>body{font-family:Arial,sans-serif;white-space:pre-wrap;padding:40px;max-width:800px;margin:0 auto;font-size:13px;line-height:1.6}@media print{body{padding:20px}}</style></head><body><pre>${escaped}</pre></body></html>`);
      win.document.close();
      win.focus();
      setTimeout(() => { win.print(); }, 400);
      return;
    }
    const ext = downloadFormat === "md" ? ".md" : ".txt";
    const mimeType = downloadFormat === "md" ? "text/markdown" : "text/plain";
    const finalContent = downloadFormat === "md"
      ? `# ${type === "resume" ? "Resume" : "Cover Letter"}: ${baseName}\n\n${content}`
      : content;
    const blob = new Blob([finalContent], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${baseName}${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copy = async (text, index, type) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setCopiedType(type);
      setTimeout(() => { setCopiedIndex(null); setCopiedType(null); }, 2000);
    } catch { /* noop */ }
  };

  const isApplied = (job) => appliedList.some(j =>
    (j.url && j.url === (job.url || "")) ||
    (j.company?.toLowerCase() === job.company?.toLowerCase() && j.title?.toLowerCase() === job.title?.toLowerCase())
  );

  if (approvedJobs.length === 0) {
    return (
      <div className="content" data-testid="complete-phase">
        <GuideBar emoji={"\uD83C\uDF89"} text="Generate tailored documents, download, apply, and track your progress!" onStartOver={onStartOver} />
        <p className="text-p">No jobs were approved. Go back to Review to select jobs.</p>
        <AppliedTracker appliedList={appliedList} onRemove={onRemoveApplied} onClear={onClearApplied} />
        <div className="flex-gap mt-16">
          <button className="btn primary" onClick={onRunAgain}>{"\uD83D\uDD04"} New Search</button>
        </div>
      </div>
    );
  }

  const restoredCount = Object.values(jobState).filter(s => s.resume || s.coverLetter).length;
  const doneCount = approvedJobs.filter(job => { const s = getJobState(job); return s.resume && s.coverLetter; }).length;

  return (
    <div className="content" data-testid="complete-phase">
      <GuideBar emoji={"\uD83C\uDF89"} text="Generate tailored documents, download, apply, and track your progress!" onStartOver={onStartOver} />

      <div className="format-row">
        <span className="format-label">Download format:</span>
        <select value={downloadFormat} onChange={e => setDownloadFormat(e.target.value)} className="form-select">
          <option value="txt">Plain Text (.txt)</option>
          <option value="md">Markdown (.md)</option>
          <option value="pdf">PDF (print dialog)</option>
        </select>
      </div>

      {restoredCount > 0 && <p className="text-success mb-12">Restored {restoredCount} result(s) from previous session.</p>}

      {approvedJobs.map((job, i) => {
        const s = getJobState(job);
        const resumeRunning = s.resumeStatus === "running";
        const coverRunning = s.coverStatus === "running";
        const isReady = s.resume && s.coverLetter;
        const isGenerating = resumeRunning || coverRunning;
        const applied = isApplied(job);
        const cardClass = applied ? "card glow a-success" : isReady ? "card glow a-success" : isGenerating ? "card a-warn" : "card a-gray";
        const statusLabel = applied ? "Applied" : isReady ? "Ready" : isGenerating ? "Generating..." : "Pending";
        const statusClass = applied ? "applied-chip" : isReady ? "status-chip status-ready" : isGenerating ? "status-chip status-gen" : "status-chip status-pending";

        return (
          <div key={i} className={cardClass}>
            <div className="flex-between">
              <div>
                <div className="job-title">{job.title}</div>
                <div className="job-meta">{job.company}</div>
              </div>
              <span className={statusClass}>{applied ? "\u2705 Applied" : isReady ? "\u2705 Ready" : isGenerating ? "\u23F3 Generating..." : statusLabel}</span>
            </div>

            {job.url && (
              <a href={job.url} target="_blank" rel="noopener noreferrer" className="text-link mb-10" data-testid="job-posting-link">View Posting</a>
            )}

            <div className="flex-gap mt-12">
              {!s.resume ? (
                <button className="btn primary sm" disabled={resumeRunning} onClick={() => handleCreateResume(job)}>
                  {resumeRunning ? <><Spinner />Resume...</> : "\uD83D\uDCC4 Create Resume"}
                </button>
              ) : (
                <>
                  <button className="btn primary sm" onClick={() => download(s.resume, `${job.company}_resume`, "resume")}>{"\uD83D\uDCE5"} Resume</button>
                  <button className="btn default sm" onClick={() => copy(s.resume, i, "resume")}>Copy</button>
                  <button className="btn default sm" onClick={() => handleCreateResume(job)}>Redo</button>
                </>
              )}
              {resumeRunning && <button className="btn default sm" onClick={() => abortRefs.current[jobKey(job) + "_resume"]?.abort()}>Cancel</button>}

              {!s.coverLetter ? (
                <button className="btn primary sm" disabled={coverRunning} onClick={() => handleCreateCoverLetter(job)}>
                  {coverRunning ? <><Spinner />Cover...</> : "\uD83D\uDCDD Create Cover Letter"}
                </button>
              ) : (
                <>
                  <button className="btn primary sm" onClick={() => download(s.coverLetter, `${job.company}_cover_letter`, "cover")}>{"\uD83D\uDCE5"} Cover Letter</button>
                  <button className="btn default sm" onClick={() => copy(s.coverLetter, i, "cover")}>Copy</button>
                  <button className="btn default sm" onClick={() => handleCreateCoverLetter(job)}>Redo</button>
                </>
              )}
              {coverRunning && <button className="btn default sm" onClick={() => abortRefs.current[jobKey(job) + "_cover"]?.abort()}>Cancel</button>}

              {isReady && (
                <button className="btn default sm" onClick={() => { download(s.resume, `${job.company}_resume`, "resume"); download(s.coverLetter, `${job.company}_cover_letter`, "cover"); }}>{"\u2B07\uFE0F"} Download All</button>
              )}
              {isReady && cloudConnected && isDropboxConfigured() && (
                <button className="btn default sm" onClick={async () => {
                  try {
                    await saveToDropbox(s.resume, `${job.company}_resume.txt`);
                    await saveToDropbox(s.coverLetter, `${job.company}_cover_letter.txt`);
                  } catch { /* user cancelled or error */ }
                }}>{"\u2601\uFE0F"} Dropbox</button>
              )}

              {isReady && !applied && (
                <button className="btn glow-btn sm" onClick={() => onAddApplied({
                  title: job.title, company: job.company, url: job.url || "",
                  appliedDate: new Date().toISOString().slice(0, 10),
                })}>Mark Applied</button>
              )}
            </div>
            {s.resumeError && <p className="text-error mt-4">{s.resumeError}</p>}
            {s.coverError && <p className="text-error mt-4">{s.coverError}</p>}
          </div>
        );
      })}

      <div className="progress-bar">{doneCount} of {approvedJobs.length} complete {doneCount < approvedJobs.length ? "- generate documents above" : "- all done!"}</div>

      <AppliedTracker appliedList={appliedList} onRemove={onRemoveApplied} onClear={onClearApplied} />

      <div className="flex-gap mt-16">
        <button className="btn primary" onClick={onRunAgain}>{"\uD83D\uDD04"} New Search</button>
      </div>
    </div>
  );
}

export default CompletePhase;
