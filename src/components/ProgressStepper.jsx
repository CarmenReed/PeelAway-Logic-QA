import useWindowWidth from "../hooks/useWindowWidth";
import { MOBILE_BP } from "../constants";

const PHASES = ["Scout", "Search/Score", "Review", "Complete"];

export default function ProgressStepper({ current, maxVisited, onTabClick }) {
  const isMobile = useWindowWidth() < MOBILE_BP;
  if (isMobile) {
    const name = PHASES[current] ?? PHASES[PHASES.length - 1];
    return (
      <div className="progress-mobile" data-testid="progress-stepper-mobile">
        Step {current + 1} of {PHASES.length}: {name}
      </div>
    );
  }
  return (
    <nav className="progress" data-testid="progress-stepper" aria-label="Pipeline progress">
      <ol className="progress-track">
        {PHASES.map((name, i) => {
          const cls = i === current ? "current" : i < current ? "done" : "future";
          const clickable = i <= maxVisited;
          const ariaCurrent = i === current ? "step" : undefined;
          const ariaLabel = `Step ${i + 1} of ${PHASES.length}: ${name}${i === current ? " (current)" : i < current ? " (completed)" : ""}`;
          return (
            <li key={name} className="progress-step" style={{ display: "contents" }}>
              {clickable ? (
                <button
                  type="button"
                  className={`step-dot ${cls}`}
                  onClick={() => onTabClick(i)}
                  aria-current={ariaCurrent}
                  aria-label={ariaLabel}
                >
                  {i < current ? "\u2713" : i + 1}
                </button>
              ) : (
                <div
                  className={`step-dot ${cls} no-click`}
                  aria-current={ariaCurrent}
                  aria-label={ariaLabel}
                  role="img"
                >
                  {i < current ? "\u2713" : i + 1}
                </div>
              )}
              {i < PHASES.length - 1 && <div className={`step-line ${i < current ? "done" : "future"}`} aria-hidden="true" />}
            </li>
          );
        })}
      </ol>
      <div className="step-labels" aria-hidden="true">
        {PHASES.map((name, i) => (
          <span key={name} className={`step-label${i === current ? " current-label" : ""}`}>{name}</span>
        ))}
      </div>
    </nav>
  );
}
