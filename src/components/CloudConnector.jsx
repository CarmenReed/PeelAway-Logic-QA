// CloudConnector.jsx
// Connection UI for Dropbox workspace integration

import { useState } from "react";
import { isDropboxConfigured, saveSyncDataToDropbox, loadSyncDataFromDropbox } from "../cloudStorage";
import { gatherSyncData, restoreSyncData, getCloudConnection, setCloudConnection } from "../cloudSync";

export default function CloudConnector({ show, onClose, onConnectionChange }) {
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const [syncError, setSyncError] = useState("");

  const connection = getCloudConnection();
  const isConnected = connection?.provider === "dropbox" && connection?.connected;
  const configured = isDropboxConfigured();

  const handleConnect = async () => {
    setSyncing(true);
    setSyncMsg("Looking for existing PeelAway data in Dropbox...");
    setSyncError("");
    try {
      const cloudData = await loadSyncDataFromDropbox();
      if (cloudData) {
        restoreSyncData(cloudData);
        setSyncMsg("Synced! Your data has been restored from Dropbox.");
      } else {
        setSyncMsg("Connected! No existing data found. Your data will sync when you save.");
      }
      setCloudConnection({ provider: "dropbox", connected: true, connectedAt: new Date().toISOString() });
      onConnectionChange?.({ provider: "dropbox", connected: true });
    } catch (err) {
      if (err.message?.includes("Failed to load")) {
        setSyncError("Could not load Dropbox. Check your popup blocker settings.");
      } else {
        // User cancelled the file picker — just connect without syncing
        setCloudConnection({ provider: "dropbox", connected: true, connectedAt: new Date().toISOString() });
        onConnectionChange?.({ provider: "dropbox", connected: true });
        setSyncMsg("Connected to Dropbox! Your data will sync when you save.");
      }
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    setSyncMsg("Saving your data to Dropbox...");
    setSyncError("");
    try {
      const data = gatherSyncData();
      const saved = await saveSyncDataToDropbox(data);
      if (saved) {
        setSyncMsg("Data saved to Dropbox successfully!");
      } else {
        setSyncMsg("Save cancelled.");
      }
    } catch (err) {
      setSyncError(`Sync failed: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleRestoreFromCloud = async () => {
    setSyncing(true);
    setSyncMsg("Loading data from Dropbox...");
    setSyncError("");
    try {
      const cloudData = await loadSyncDataFromDropbox();
      if (cloudData) {
        restoreSyncData(cloudData);
        setSyncMsg("Data restored from Dropbox! Reload the page to see changes.");
      } else {
        setSyncMsg("No file selected.");
      }
    } catch (err) {
      setSyncError(`Restore failed: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = () => {
    setCloudConnection(null);
    onConnectionChange?.(null);
    setSyncMsg("");
    setSyncError("");
  };

  if (!show) return null;

  return (
    <div className="cloud-overlay" onClick={onClose}>
      <div className="cloud-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cloud-modal-header">
          <h3 className="cloud-modal-title">Connect Your Workspace</h3>
          <button className="cloud-close-btn" onClick={onClose}>&times;</button>
        </div>

        <div className="cloud-provider-card">
          <div className="cloud-provider-header">
            <div className="cloud-provider-icon">
              <svg viewBox="0 0 24 24" width="32" height="32" fill="none">
                <path d="M6.5 7.5L12 11l-5.5 3.5L1 11l5.5-3.5zM17.5 7.5L12 11l5.5 3.5L23 11l-5.5-3.5zM6.5 14.5L12 18l5.5-3.5L12 11l-5.5 3.5zM12 4l5.5 3.5L12 11 6.5 7.5 12 4z" fill="#0061FF"/>
              </svg>
            </div>
            <div>
              <div className="cloud-provider-name">Dropbox</div>
              <div className="cloud-provider-desc">
                {isConnected ? "Connected" : "Import resumes and save tailored documents"}
              </div>
            </div>
            {isConnected && <span className="cloud-connected-badge">Connected</span>}
          </div>

          {!configured && (
            <p className="text-hint mt-8">Dropbox integration requires an App Key. Set REACT_APP_DROPBOX_APP_KEY in your environment.</p>
          )}

          {configured && !isConnected && (
            <div className="cloud-actions mt-12">
              <button className="btn primary" onClick={handleConnect} disabled={syncing}>
                {syncing ? "Connecting..." : "Connect Dropbox"}
              </button>
              <p className="text-hint mt-8">
                You'll be asked to select your PeelAway sync file if you have one. If not, just cancel and we'll create one when you save.
              </p>
            </div>
          )}

          {configured && isConnected && (
            <div className="cloud-actions mt-12">
              <div className="flex-gap">
                <button className="btn primary sm" onClick={handleSyncNow} disabled={syncing}>
                  {syncing ? "Syncing..." : "Save to Dropbox"}
                </button>
                <button className="btn default sm" onClick={handleRestoreFromCloud} disabled={syncing}>
                  Restore from Dropbox
                </button>
                <button className="btn danger-btn sm" onClick={handleDisconnect} disabled={syncing}>
                  Disconnect
                </button>
              </div>
            </div>
          )}

          {syncMsg && <p className="text-success mt-8">{syncMsg}</p>}
          {syncError && <p className="text-error mt-8">{syncError}</p>}
        </div>

        <div className="cloud-info mt-16">
          <p className="text-hint">
            Connecting your workspace syncs your applied jobs, tailored documents, and search history across devices.
            Your data is saved as a file in your own Dropbox — we never store it on our servers.
          </p>
        </div>
      </div>
    </div>
  );
}
