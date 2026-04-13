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
    <div className="progress" data-testid="progress-stepper">
      <div className="progress-track">
        {PHASES.map((name, i) => {
          const cls = i === current ? "current" : i < current ? "done" : "future";
          const clickable = i <= maxVisited;
          return (
            <span key={name} style={{ display: "contents" }}>
              <div
                className={`step-dot ${cls}${!clickable ? " no-click" : ""}`}
                onClick={clickable ? () => onTabClick(i) : undefined}
              >
                {i < current ? "\u2713" : i + 1}
              </div>
              {i < PHASES.length - 1 && <div className={`step-line ${i < current ? "done" : "future"}`} />}
            </span>
          );
        })}
      </div>
      <div className="step-labels">
        {PHASES.map((name, i) => (
          <span key={name} className={`step-label${i === current ? " current-label" : ""}`}>{name}</span>
        ))}
      </div>
    </div>
  );
}
