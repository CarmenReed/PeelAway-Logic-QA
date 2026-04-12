import { useState, useRef } from "react";
import { extractTextFromPdf } from "../api";
import { extractProfile } from "../profileExtractor";
import { openDropboxChooser, downloadDropboxFile, isDropboxConfigured } from "../cloudStorage";
import { getCloudConnection } from "../cloudSync";
import GuideBar from "../components/GuideBar";

function ScoutPhase({ profileText, setProfileText, extractedProfile, setExtractedProfile, locked, onAdvance }) {
  const cloudConnected = getCloudConnection()?.connected;
  const [fileName, setFileName] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [fileError, setFileError] = useState(null);
  const [inputMode, setInputMode] = useState("upload"); // "upload" | "paste"
  const [newSkill, setNewSkill] = useState("");
  const [newQuery, setNewQuery] = useState("");
  const fileRef = useRef(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setExtracting(true);
    setFileError(null);
    try {
      if (file.name.toLowerCase().endsWith(".txt")) {
        const text = await file.text();
        setProfileText(text);
        setExtractedProfile(extractProfile(text));
      } else if (file.name.toLowerCase().endsWith(".pdf")) {
        const text = await extractTextFromPdf(file);
        if (!text || text.length < 30) {
          setFileError("PDF appears image-based or unreadable. Paste your resume text below instead.");
          setProfileText("");
          setExtractedProfile(null);
        } else {
          setProfileText(text);
          setExtractedProfile(extractProfile(text));
        }
      } else {
        setFileError("Unsupported file type. Use .pdf or .txt.");
      }
    } catch (err) {
      setFileError(`Failed to extract text: ${err.message}`);
      setProfileText("");
    } finally {
      setExtracting(false);
    }
  };

  const hasProfile = profileText.trim().length > 50;

  return (
    <div className="content">
      <GuideBar emoji={"\uD83D\uDC4B"} text="Upload your resume to extract your profile, then move to Search." />

      {/* Upload Resume */}
      <div className="card mb-14">
        <div className="section-title"><span className="step-num">1</span> Upload Resume</div>
        {!locked && (
          <div className="tab-bar mb-10">
            <button className={`tab-btn${inputMode === "upload" ? " active" : ""}`} onClick={() => setInputMode("upload")}>Upload PDF/TXT</button>
            <button className={`tab-btn${inputMode === "paste" ? " active" : ""}`} onClick={() => setInputMode("paste")}>Paste Resume Text</button>
            {cloudConnected && isDropboxConfigured() && (
              <button className={`tab-btn${inputMode === "dropbox" ? " active" : ""}`} onClick={() => setInputMode("dropbox")}>Import from Dropbox</button>
            )}
          </div>
        )}
        {!locked && inputMode === "upload" && (
          <div className="dashed-box">
            <input ref={fileRef} type="file" accept=".pdf,.txt" onChange={handleFile} className="hidden" />
            <button type="button" className="btn primary" onClick={() => fileRef.current?.click()}>Upload Resume (PDF or TXT)</button>
            {fileName && <p className="text-hint mt-8">{fileName}</p>}
            {extracting && <p className="text-hint">Extracting...</p>}
            {hasProfile && !extracting && <p className="text-success mt-4">{profileText.length} characters extracted</p>}
            {fileError && <p className="text-error">{fileError}</p>}
          </div>
        )}
        {!locked && inputMode === "paste" && (
          <div className="mb-16">
            <textarea className="form-textarea" placeholder="Paste your resume text here..." value={profileText} onChange={(e) => { setProfileText(e.target.value); if (e.target.value.trim().length > 50) setExtractedProfile(extractProfile(e.target.value)); }} rows={12} />
            {profileText.trim().length > 50 && <p className="text-success mt-4">{profileText.length} characters</p>}
          </div>
        )}
        {!locked && inputMode === "dropbox" && (
          <div className="dashed-box">
            <button type="button" className="btn primary" onClick={async () => {
              setFileError(null);
              setExtracting(true);
              try {
                const file = await openDropboxChooser({ extensions: [".pdf", ".txt"] });
                if (!file) { setExtracting(false); return; }
                setFileName(file.name);
                const text = await downloadDropboxFile(file.link);
                if (text && text.length > 30) {
                  setProfileText(text);
                  setExtractedProfile(extractProfile(text));
                } else {
                  setFileError("File appears empty or unreadable. Try a different file.");
                }
              } catch (err) {
                setFileError(`Dropbox import failed: ${err.message}`);
              } finally {
                setExtracting(false);
              }
            }} disabled={extracting}>
              {extracting ? "Importing..." : "Pick Resume from Dropbox"}
            </button>
            {fileName && <p className="text-hint mt-8">{fileName}</p>}
            {extracting && <p className="text-hint">Importing from Dropbox...</p>}
            {hasProfile && !extracting && <p className="text-success mt-4">{profileText.length} characters extracted</p>}
            {fileError && <p className="text-error">{fileError}</p>}
          </div>
        )}
        {locked && hasProfile && (
          <p className="text-success mt-4">{profileText.length} characters extracted{fileName ? ` from ${fileName}` : ""}</p>
        )}
      </div>

      {/* Extracted Profile */}
      {hasProfile && extractedProfile && (
        <div className="card mb-14">
          <div className="section-title"><span className="step-num">2</span> Review Extracted Profile</div>
          <div className="extracted-profile">
            <div className="ep-row">
              <label className="ep-label">Name</label>
              <input className="form-input ep-input" value={extractedProfile.name || ""} disabled={locked} onChange={(e) => setExtractedProfile(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="ep-row">
              <label className="ep-label">Years Experience</label>
              <input className="form-input ep-input ep-narrow" type="number" min="0" max="50" value={extractedProfile.yearsExperience || ""} disabled={locked} onChange={(e) => setExtractedProfile(p => ({ ...p, yearsExperience: parseInt(e.target.value, 10) || null }))} />
            </div>
            <div className="ep-row">
              <label className="ep-label">Skills & Keywords</label>
              <div className="ep-tags">
                {(extractedProfile.skills || []).map((skill, i) => (
                  <span key={i} className="ep-tag">{skill}{!locked && <button className="ep-tag-x" onClick={() => setExtractedProfile(p => ({ ...p, skills: p.skills.filter((_, idx) => idx !== i) }))}>x</button>}</span>
                ))}
                {!locked && (
                  <span className="ep-add-row">
                    <input className="form-input ep-add-input" placeholder="Add skill..." value={newSkill} onChange={(e) => setNewSkill(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && newSkill.trim()) { setExtractedProfile(p => ({ ...p, skills: [...(p.skills || []), newSkill.trim()] })); setNewSkill(""); }}} />
                  </span>
                )}
              </div>
            </div>
            <div className="ep-row">
              <label className="ep-label">Target Level</label>
              <div className="ep-checks">
                {["Junior", "Mid", "Senior", "Lead", "Principal", "Architect", "Staff", "Director"].map(level => (
                  <label key={level} className="ep-check">
                    <input type="checkbox" disabled={locked} checked={(extractedProfile.targetLevel || []).includes(level)} onChange={(e) => { setExtractedProfile(p => ({ ...p, targetLevel: e.target.checked ? [...(p.targetLevel || []), level] : (p.targetLevel || []).filter(l => l !== level) })); }} />
                    {level}
                  </label>
                ))}
              </div>
            </div>
            <div className="ep-row">
              <label className="ep-label">Location</label>
              <div className="ep-tags">
                {(extractedProfile.location || []).map((loc, i) => (
                  <span key={i} className="ep-tag">{loc}{!locked && <button className="ep-tag-x" onClick={() => setExtractedProfile(p => ({ ...p, location: p.location.filter((_, idx) => idx !== i) }))}>x</button>}</span>
                ))}
                {!locked && (
                  <input className="form-input ep-add-input" placeholder="Add location..." onKeyDown={(e) => { if (e.key === "Enter" && e.target.value.trim()) { setExtractedProfile(p => ({ ...p, location: [...(p.location || []), e.target.value.trim()] })); e.target.value = ""; }}} />
                )}
              </div>
            </div>
            <div className="ep-row">
              <label className="ep-label">Search Queries</label>
              <div className="ep-query-list">
                {(extractedProfile.searchQueries?.jsearch || []).map((q, i) => (
                  <div key={i} className="ep-query-row">
                    <input className="form-input ep-query-input" value={q} disabled={locked} onChange={(e) => { setExtractedProfile(p => { const jsearch = [...(p.searchQueries?.jsearch || [])]; const adzuna = [...(p.searchQueries?.adzuna || [])]; jsearch[i] = e.target.value; adzuna[i] = e.target.value.replace(/\s+remote$/i, ""); return { ...p, searchQueries: { jsearch, adzuna } }; }); }} />
                    {!locked && <button className="ep-tag-x" onClick={() => { setExtractedProfile(p => { const jsearch = (p.searchQueries?.jsearch || []).filter((_, idx) => idx !== i); const adzuna = (p.searchQueries?.adzuna || []).filter((_, idx) => idx !== i); return { ...p, searchQueries: { jsearch, adzuna } }; }); }}>x</button>}
                  </div>
                ))}
                {!locked && (
                  <div className="ep-query-row">
                    <input className="form-input ep-query-input" placeholder="Add search query..." value={newQuery} onChange={(e) => setNewQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && newQuery.trim()) { setExtractedProfile(p => ({ ...p, searchQueries: { jsearch: [...(p.searchQueries?.jsearch || []), newQuery.trim()], adzuna: [...(p.searchQueries?.adzuna || []), newQuery.trim().replace(/\s+remote$/i, "")] } })); setNewQuery(""); }}} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Advance button */}
      {hasProfile && extractedProfile && !locked && (
        <button className="btn primary full" onClick={onAdvance}>Continue to Search</button>
      )}
    </div>
  );
}

export default ScoutPhase;
