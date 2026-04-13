import { useState } from "react";

export default function AppliedTracker({ appliedList, onRemove, onClear }) {
  const [expanded, setExpanded] = useState(true);

  const formatDate = (iso) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <div className="tracker-card">
      <button
        type="button"
        className="tracker-header"
        onClick={() => setExpanded(e => !e)}
        aria-expanded={expanded}
        aria-controls="tracker-body"
        style={{ background: "none", border: "none", width: "100%", textAlign: "inherit", font: "inherit", color: "inherit", cursor: "pointer" }}
      >
        <span>{"\uD83D\uDCCA"} Applied Tracker ({appliedList.length})</span>
        <span aria-hidden="true">{expanded ? "\u25B2" : "\u25BC"}</span>
      </button>
      {expanded && (
        <div id="tracker-body">
          {appliedList.length === 0 ? (
            <p className="text-p mt-12">No applications tracked yet.</p>
          ) : (
            <>
              {appliedList.map((entry, i) => {
                const entryName = `${entry.title}${entry.company ? ` at ${entry.company}` : ""}`;
                return (
                  <div key={i} className="tracker-row">
                    <input
                      type="checkbox"
                      checked
                      readOnly
                      className="tracker-check"
                      aria-label={`${entryName} marked as applied`}
                    />
                    <span className="tracker-label">{entry.title} {entry.company ? `\u2014 ${entry.company}` : ""}</span>
                    <span className="tracker-date">{formatDate(entry.appliedDate)}</span>
                    {entry.url && (
                      <a
                        href={entry.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-link"
                        aria-label={`View listing for ${entryName}`}
                      >
                        View
                      </a>
                    )}
                    <button
                      className="tracker-remove"
                      onClick={() => onRemove(i)}
                      aria-label={`Remove ${entryName} from applied tracker`}
                    >
                      Remove
                    </button>
                  </div>
                );
              })}
              <button className="btn danger-btn sm mt-8" onClick={onClear}>Clear All</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
