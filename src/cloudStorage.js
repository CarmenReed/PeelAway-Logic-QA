// cloudStorage.js
// Dropbox integration via OAuth 2 implicit grant + HTTP API.
// Auth happens once via popup; all sync is silent after that.

import { DROPBOX_APP_KEY } from "./constants";

const SYNC_FILE_PATH = "/PeelAway Logic/peelaway-sync-data.json";
const TOKEN_KEY = "jsp-dropbox-token";

// -- OAuth --

/**
 * Get the stored Dropbox access token.
 */
export function getDropboxToken() {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

/**
 * Save or clear the Dropbox access token.
 */
export function setDropboxToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

/**
 * Start the Dropbox OAuth implicit grant flow in a popup.
 * Resolves with the access token on success, or null if cancelled.
 */
export function authenticateDropbox() {
  return new Promise((resolve) => {
    const redirectUri = window.location.origin + window.location.pathname;
    const authUrl =
      `https://www.dropbox.com/oauth2/authorize` +
      `?client_id=${encodeURIComponent(DROPBOX_APP_KEY)}` +
      `&response_type=token` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}`;

    const popup = window.open(authUrl, "dropbox-auth", "width=600,height=700");
    if (!popup) {
      resolve(null);
      return;
    }

    const interval = setInterval(() => {
      try {
        if (popup.closed) {
          clearInterval(interval);
          resolve(null);
          return;
        }
        const popupUrl = popup.location.href;
        if (popupUrl && popupUrl.startsWith(redirectUri)) {
          clearInterval(interval);
          popup.close();
          const hash = popup.location.hash.substring(1);
          const params = new URLSearchParams(hash);
          const token = params.get("access_token");
          if (token) {
            setDropboxToken(token);
            resolve(token);
          } else {
            resolve(null);
          }
        }
      } catch {
        // Cross-origin - popup hasn't redirected back yet, keep polling
      }
    }, 200);
  });
}

// -- File operations (silent, no popups) --

/**
 * Ensure the sync folder exists in Dropbox. Silent no-op if it already exists.
 */
async function ensureSyncFolder(token) {
  try {
    await fetch("https://api.dropboxapi.com/2/files/create_folder_v2", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ path: "/PeelAway Logic", autorename: false }),
    });
  } catch {
    // Folder likely already exists
  }
}

/**
 * Save a text file to Dropbox silently (no popup).
 * Returns true on success, false on failure.
 */
export async function saveToDropbox(content, fileName) {
  const token = getDropboxToken();
  if (!token) return false;
  try {
    await ensureSyncFolder(token);
    const filePath = `/PeelAway Logic/${fileName}`;
    const resp = await fetch("https://content.dropboxapi.com/2/files/upload", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/octet-stream",
        "Dropbox-API-Arg": JSON.stringify({
          path: filePath,
          mode: "overwrite",
          autorename: false,
          mute: true,
        }),
      },
      body: content,
    });
    return resp.ok;
  } catch {
    return false;
  }
}

/**
 * Save sync data to Dropbox silently (no popup).
 * Returns true on success, false on failure.
 */
export async function saveSyncDataToDropbox(syncData) {
  const token = getDropboxToken();
  if (!token) return false;
  try {
    await ensureSyncFolder(token);
    const resp = await fetch("https://content.dropboxapi.com/2/files/upload", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/octet-stream",
        "Dropbox-API-Arg": JSON.stringify({
          path: SYNC_FILE_PATH,
          mode: "overwrite",
          autorename: false,
          mute: true,
        }),
      },
      body: JSON.stringify(syncData, null, 2),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

/**
 * Load sync data from Dropbox silently (no popup).
 * Returns parsed JSON or null if not found / error.
 */
export async function loadSyncDataFromDropbox() {
  const token = getDropboxToken();
  if (!token) return null;
  try {
    const resp = await fetch("https://content.dropboxapi.com/2/files/download", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Dropbox-API-Arg": JSON.stringify({ path: SYNC_FILE_PATH }),
      },
    });
    if (!resp.ok) return null;
    const text = await resp.text();
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// -- Dropbox Chooser (for user-initiated file picking) --

const DROPBOX_SDK_URL = "https://www.dropbox.com/static/api/2/dropins.js";
let sdkLoaded = false;
let sdkLoading = false;
let sdkCallbacks = [];

function loadDropboxSdk() {
  if (sdkLoaded && window.Dropbox) return Promise.resolve();
  if (sdkLoading) {
    return new Promise((resolve, reject) => {
      sdkCallbacks.push({ resolve, reject });
    });
  }
  sdkLoading = true;
  return new Promise((resolve, reject) => {
    sdkCallbacks.push({ resolve, reject });
    const script = document.createElement("script");
    script.src = DROPBOX_SDK_URL;
    script.id = "dropboxjs";
    script.setAttribute("data-app-key", DROPBOX_APP_KEY);
    script.onload = () => {
      sdkLoaded = true;
      sdkLoading = false;
      sdkCallbacks.forEach(cb => cb.resolve());
      sdkCallbacks = [];
    };
    script.onerror = () => {
      sdkLoading = false;
      const err = new Error("Failed to load Dropbox SDK");
      sdkCallbacks.forEach(cb => cb.reject(err));
      sdkCallbacks = [];
    };
    document.head.appendChild(script);
  });
}

/**
 * Open the Dropbox Chooser to let the user pick a file.
 * Returns { name, link, bytes, icon } or null if cancelled.
 */
export function openDropboxChooser({ extensions = [".pdf", ".txt"], multiselect = false } = {}) {
  return new Promise(async (resolve, reject) => {
    try {
      await loadDropboxSdk();
      window.Dropbox.choose({
        success: (files) => resolve(files[0] || null),
        cancel: () => resolve(null),
        linkType: "direct",
        multiselect,
        extensions,
      });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Download file content from a Dropbox direct link.
 */
export async function downloadDropboxFile(directLink) {
  const resp = await fetch(directLink);
  if (!resp.ok) throw new Error(`Dropbox download failed: ${resp.status}`);
  return resp.text();
}

/**
 * Check if Dropbox is configured (app key is set).
 */
export function isDropboxConfigured() {
  return Boolean(DROPBOX_APP_KEY);
}

/**
 * Check if we have a valid stored token.
 */
export function hasDropboxToken() {
  return Boolean(getDropboxToken());
}
