// constants.js
// All top-level constants, API config, and storage keys

export const MODEL = "claude-sonnet-4-6";
export const SCORING_MODEL = "claude-haiku-4-5-20251001";
export const SCORING_BATCH_SIZE = 8;
export const SCORING_BATCH_DELAY_MS = 15000;
export const API_URL = "https://api.anthropic.com/v1/messages";
export const API_HEADERS_BASE = {
  "Content-Type": "application/json",
  "anthropic-version": "2023-06-01",
  "anthropic-dangerous-direct-browser-access": "true",
};
export const ANTHROPIC_API_KEY = process.env.REACT_APP_ANTHROPIC_API_KEY || "";
export const STORAGE_KEY = "jsp-applied-jobs";
export const SCOUT_STORAGE_KEY = "jsp-last-scout";
export const TAILOR_RESULTS_KEY = "jsp-tailor-results";
export const TAILOR_DELAY_MS = 8000;
export const DISMISSED_KEY = "jsp-dismissed-jobs";
export const MOBILE_BP = 640;
export const ADZUNA_APP_ID = process.env.REACT_APP_ADZUNA_APP_ID || "";
export const ADZUNA_APP_KEY = process.env.REACT_APP_ADZUNA_APP_KEY || "";
export const RAPIDAPI_KEY = process.env.REACT_APP_RAPIDAPI_KEY || "";
