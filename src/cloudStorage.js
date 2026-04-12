// cloudStorage.js
// Dropbox Chooser/Saver integration (fully client-side, no backend needed)

import { DROPBOX_APP_KEY } from "./constants";

const DROPBOX_SDK_URL = "https://www.dropbox.com/static/api/2/dropins.js";
const PEELAWAY_FOLDER = "/PeelAway Logic";

let sdkLoaded = false;
let sdkLoading = false;
let sdkCallbacks = [];

/**
 * Load the Dropbox SDK script dynamically.
 * Resolves once window.Dropbox is available.
 */
export function loadDropboxSdk() {
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
 * Returns the text content of the file.
 */
export async function downloadDropboxFile(directLink) {
  const resp = await fetch(directLink);
  if (!resp.ok) throw new Error(`Dropbox download failed: ${resp.status}`);
  return resp.text();
}

/**
 * Save content to the user's Dropbox using the Saver widget.
 * For small text files, we convert to a data URI.
 * Returns true if save was initiated, false if cancelled.
 */
export function saveToDropbox(content, fileName) {
  return new Promise(async (resolve, reject) => {
    try {
      await loadDropboxSdk();
      const blob = new Blob([content], { type: "text/plain" });
      const dataUri = await blobToDataUri(blob);
      window.Dropbox.save(dataUri, fileName, {
        success: () => resolve(true),
        cancel: () => resolve(false),
        error: (errMsg) => reject(new Error(errMsg || "Dropbox save failed")),
      });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Save the sync data file to Dropbox using the Saver widget.
 * This saves the full app state as a JSON file.
 */
export function saveSyncDataToDropbox(syncData) {
  const json = JSON.stringify(syncData, null, 2);
  return saveToDropbox(json, "peelaway-sync-data.json");
}

/**
 * Open the Dropbox Chooser to pick the sync data file.
 * Returns parsed JSON or null if cancelled/not found.
 */
export async function loadSyncDataFromDropbox() {
  const file = await openDropboxChooser({ extensions: [".json"] });
  if (!file) return null;
  const text = await downloadDropboxFile(file.link);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Sync file is corrupted or not valid JSON");
  }
}

// -- Helpers --

function blobToDataUri(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Failed to convert to data URI"));
    reader.readAsDataURL(blob);
  });
}

/**
 * Check if Dropbox is configured (app key is set).
 */
export function isDropboxConfigured() {
  return Boolean(DROPBOX_APP_KEY);
}
