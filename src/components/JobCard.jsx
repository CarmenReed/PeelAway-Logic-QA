export default function JobCard({ job, selectable, selected, onToggle, highlight }) {
  const { title, company, location, total_score, skills_fit, level_fit, reasoning, key_tech_stack, status, salary_range, url, jd_text } = job;
  const scorePercent = Math.round(total_score * 10);
  return (
    <div className={`card job-row${selected ? " selected" : ""}${highlight ? " azure-highlight" : ""}`} data-testid="job-card">
      {selectable && (
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggle(job)}
          className="job-check"
          aria-label={`Select ${title} at ${company}`}
        />
      )}
      <div className="job-info">
        <div className="job-title">
          {url ? <a href={url} target="_blank" rel="noopener noreferrer">{title}</a> : title}
        </div>
        <div className="job-meta">{company} {location ? `\u00B7 ${location}` : ""}</div>
        {salary_range && <div className="job-meta text-success">{salary_range}</div>}
        <div className="job-date">
          {job.date_posted && job.freshness_flag === "fresh" && <>Posted: {job.date_posted} </>}
          {job.freshness_flag === "stale" && <span className="text-stale">Date unverified or older than 14 days</span>}
          {jd_text && <span className="text-success"> Full JD fetched</span>}
          {url && <>{" "}<a href={url} target="_blank" rel="noopener noreferrer">View Listing</a></>}
        </div>
        <div className="job-meta mt-4">Skills: {skills_fit}/5 | Level: {level_fit}/5 | {status}</div>
        <div className="text-hint mt-4">{reasoning}</div>
        {Array.isArray(key_tech_stack) && key_tech_stack.length > 0 && (
          <div className="tech-stack mt-4">
            {key_tech_stack.map(t => <span key={t} className="badge">{t}</span>)}
          </div>
        )}
      </div>
      <div className="score-badge">{scorePercent}%</div>
    </div>
  );
}
