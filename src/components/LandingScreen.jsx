import { useState } from "react";
import CloudConnector from "./CloudConnector";
import { getCloudConnection } from "../cloudSync";

export default function LandingScreen({ onStart, demoMode, onDemoModeChange }) {
  const [showCloud, setShowCloud] = useState(false);
  const [cloudConn, setCloudConn] = useState(() => getCloudConnection());

  const isConnected = cloudConn?.provider === "dropbox" && cloudConn?.connected;

  return (
    <div className="landing" data-testid="landing-screen">
      <img src={`${process.env.PUBLIC_URL}/PeelAwayLogicLogoText.png`} alt="PeelAway Logic" className="landing-logo" />
      <p className="landing-tagline">AI-powered job search pipeline for busy professionals.</p>

      <div className="demo-toggle" data-testid="demo-toggle">
        <label className="demo-toggle-label">
          <input
            type="checkbox"
            checked={demoMode}
            onChange={(e) => onDemoModeChange(e.target.checked)}
            data-testid="demo-toggle-checkbox"
          />
          <span className="demo-toggle-text">Demo Mode</span>
        </label>
        {demoMode && (
          <span className="demo-toggle-hint" data-testid="demo-toggle-hint">
            Demo: 1 result per search, scores floored at 80%
          </span>
        )}
      </div>

      <div className="landing-buttons">
        {isConnected ? (
          <>
            <button className="btn primary" data-testid="landing-launch-btn" onClick={onStart}>
              {"\uD83D\uDE80"} Launch Pipeline
            </button>
            <button className="btn glow-btn" onClick={() => setShowCloud(true)}>
              {"\u2705"} Dropbox Connected
            </button>
          </>
        ) : (
          <>
            <button className="btn primary" data-testid="landing-guest-btn" onClick={onStart}>
              {"\uD83D\uDE80"} Start as Guest
            </button>
            <button className="btn default" data-testid="landing-cloud-btn" onClick={() => setShowCloud(true)}>
              {"\u2601\uFE0F"} Connect Your Workspace
            </button>
          </>
        )}
      </div>
      <p className="landing-privacy">
        {isConnected
          ? "Your data syncs to your Dropbox. No account required."
          : "Your data stays private. No account required to start."}
      </p>
      <CloudConnector
        show={showCloud}
        onClose={() => setShowCloud(false)}
        onConnectionChange={(conn) => setCloudConn(conn)}
      />
    </div>
  );
}
