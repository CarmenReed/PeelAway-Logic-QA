import { useState } from "react";
import JobSearchPipeline from "./JobSearchPipeline";
import "./App.css";

const isQA =
  window.location.hostname === "carmenreed.github.io" &&
  window.location.pathname.startsWith("/PeelAway-Logic-QA");

function QABanner() {
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem("qa-banner-dismissed") === "1"
  );

  if (!isQA || dismissed) return null;

  function dismiss() {
    sessionStorage.setItem("qa-banner-dismissed", "1");
    setDismissed(true);
  }

  return (
    <div
      style={{
        background: "#f0ad00",
        color: "#1a1a00",
        fontSize: "12px",
        height: "28px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "10px",
        position: "relative",
        flexShrink: 0,
      }}
    >
      ⚠️ QA Preview — not the production version
      <a
        href="https://carmenreed.github.io/PeelAway-Logic"
        style={{ color: "#1a1a00", fontWeight: 600 }}
      >
        View PROD →
      </a>
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        style={{
          position: "absolute",
          right: "8px",
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "#1a1a00",
          fontSize: "14px",
          lineHeight: 1,
          padding: "0 4px",
        }}
      >
        ×
      </button>
    </div>
  );
}

export default function App() {
  return (
    <>
      <QABanner />
      <JobSearchPipeline />
    </>
  );
}
