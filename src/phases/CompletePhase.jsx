import { useState } from "react";
import { saveToDropbox, isDropboxConfigured } from "../cloudStorage";
import AppliedTracker from "../components/AppliedTracker";
import GuideBar from "../components/GuideBar";

function CompletePhase({ tailorResults, appliedList, onAddApplied, onRemoveApplied, onClearApplied, onRunAgain, cloudConnected }) {
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [copiedType, setCopiedType] = useState(null);
  const [downloadFormat, setDownloadFormat] = useState("txt");

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

  const isApplied = (result) => appliedList.some(j =>
    (j.url && j.url === result.url) ||
    (j.company?.toLowerCase() === result.company?.toLowerCase() && j.title?.toLowerCase() === result.job_title?.toLowerCase())
  );

  const estimateWords = (text) => text ? text.split(/\s+/).length : 0;

  return (
    <div className="content">
      <GuideBar emoji={"\uD83C\uDF89"} text="Your tailored documents are ready! Download, apply, and track." />

      <div className="format-row">
        <span className="format-label">Download format:</span>
        <select value={downloadFormat} onChange={e => setDownloadFormat(e.target.value)} className="form-select">
          <option value="txt">Plain Text (.txt)</option>
          <option value="md">Markdown (.md)</option>
          <option value="pdf">PDF (print dialog)</option>
        </select>
      </div>

      {tailorResults.map((r, i) => {
        const applied = isApplied(r);
        const cardClass = applied ? "card glow a-success" : "card a-yellow";
        return (
          <div key={i} className={cardClass}>
            <div className="flex-between">
              <div>
                <div className="job-title">{r.job_title}</div>
                <div className="job-meta">{r.company}</div>
              </div>
              {applied && <span className="applied-chip">{"\u2705"} Applied</span>}
            </div>
            {r.url && <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-link mb-10">View Posting</a>}
            {r.error ? (
              <p className="text-error">{r.error}</p>
            ) : (
              <>
                <div className="flex-gap mt-12">
                  <button className="btn primary sm" onClick={() => download(r.resume, `${r.company}_resume`, "resume")}>{"\uD83D\uDCE5"} Resume</button>
                  <button className="btn primary sm" onClick={() => download(r.cover_letter, `${r.company}_cover_letter`, "cover")}>{"\uD83D\uDCE5"} Cover Letter</button>
                  {cloudConnected && isDropboxConfigured() && (
                    <button className="btn default sm" onClick={async () => {
                      try {
                        if (r.resume) await saveToDropbox(r.resume, `${r.company}_resume.txt`);
                        if (r.cover_letter) await saveToDropbox(r.cover_letter, `${r.company}_cover_letter.txt`);
                      } catch { /* user cancelled or error */ }
                    }}>{"\u2601\uFE0F"} Dropbox</button>
                  )}
                  {!applied && (
                    <button className="btn glow-btn sm" onClick={() => onAddApplied({
                      title: r.job_title, company: r.company, url: r.url || "",
                      appliedDate: new Date().toISOString().slice(0, 10),
                    })}>Mark Applied</button>
                  )}
                </div>
              </>
            )}
          </div>
        );
      })}

      <AppliedTracker appliedList={appliedList} onRemove={onRemoveApplied} onClear={onClearApplied} />

      <div className="flex-gap mt-16">
        <button className="btn primary" onClick={onRunAgain}>{"\uD83D\uDD04"} New Search</button>
      </div>
    </div>
  );
}

// ============================================================
// MAIN PIPELINE
// ============================================================

export default CompletePhase;
