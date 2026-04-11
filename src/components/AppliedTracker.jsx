import { useState } from "react";

export default function AppliedTracker({ appliedList, onRemove, onClear }) {
  const [expanded, setExpanded] = useState(true);

  const formatDate = (iso) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <div className="tracker-card">
      <div className="tracker-header" onClick={() => setExpanded(e => !e)}>
        <span>{"\uD83D\uDCCA"} Applied Tracker ({appliedList.length})</span>
        <span>{expanded ? "\u25B2" : "\u25BC"}</span>
      </div>
      {expanded && (
        appliedList.length === 0 ? (
          <p className="text-p mt-12">No applications tracked yet.</p>
        ) : (
          <>
            {appliedList.map((entry, i) => (
              <div key={i} className="tracker-row">
                <input type="checkbox" checked readOnly className="tracker-check" />
                <span className="tracker-label">{entry.title} {entry.company ? `\u2014 ${entry.company}` : ""}</span>
                <span className="tracker-date">{formatDate(entry.appliedDate)}</span>
                {entry.url && <a href={entry.url} target="_blank" rel="noopener noreferrer" className="text-link">View</a>}
                <button className="tracker-remove" onClick={() => onRemove(i)}>Remove</button>
              </div>
            ))}
            <button className="btn danger-btn sm mt-8" onClick={onClear}>Clear All</button>
          </>
        )
      )}
    </div>
  );
}
