import { useState } from "react";
import CloudConnector from "./CloudConnector";
import { getCloudConnection } from "../cloudSync";

export default function LandingScreen({ onStart }) {
  const [showCloud, setShowCloud] = useState(false);
  const [cloudConn, setCloudConn] = useState(() => getCloudConnection());

  const isConnected = cloudConn?.provider === "dropbox" && cloudConn?.connected;

  return (
    <div className="landing">
      <img src={`${process.env.PUBLIC_URL}/PeelAwayLogicLogoText.png`} alt="PeelAway Logic" className="landing-logo" />
      <p className="landing-tagline">AI-powered job search pipeline for busy professionals.</p>
      <div className="landing-buttons">
        <button className="btn primary" onClick={onStart} disabled={isConnected}>
          {"\uD83D\uDE80"} Start as Guest
        </button>
        <button
          className={`btn ${isConnected ? "glow-btn" : "default"}`}
          onClick={() => setShowCloud(true)}
        >
          {isConnected ? "\u2705 Dropbox Connected" : "\u2601\uFE0F Connect Your Workspace"}
        </button>
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
