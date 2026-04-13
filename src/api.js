// api.js
// Anthropic API call wrappers, withRetry, PDF.js loader

import { MODEL, API_URL, API_HEADERS_BASE } from "./constants";
import { extractJson } from "./utils";

export async function withRetry(fn, maxAttempts = 3) {
  const is429 = (err) => err?.message?.includes("429");
  const effectiveMax = (err) => is429(err) ? 6 : maxAttempts;
  for (let i = 0; ; i++) {
    try { return await fn(); }
    catch (err) {
      if (err.name === "AbortError") throw err;
      if (i >= effectiveMax(err) - 1) {
        if (is429(err)) {
          throw new Error("Rate limit: too many tokens per minute. Please wait about a minute, then try again.");
        }
        throw err;
      }
      const waitMs = is429(err) ? 30000 + 15000 * i : 2000 * Math.pow(2, i);
      await new Promise(r => setTimeout(r, waitMs));
    }
  }
}

// ============================================================
// PDF TEXT EXTRACTION (pdf.js loaded from CDN at runtime)
// ============================================================

let pdfjsLoaded = null;

export function loadPdfJs() {
  if (pdfjsLoaded) return pdfjsLoaded;
  pdfjsLoaded = new Promise((resolve, reject) => {
    if (window.pdfjsLib) { resolve(window.pdfjsLib); return; }
    const script = document.createElement("script");
    // pdf.js v3.11.174 -- pinned
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    script.onload = () => {
      const lib = window.pdfjsLib;
      lib.GlobalWorkerOptions.workerSrc = "";
      resolve(lib);
    };
    script.onerror = () => reject(new Error("Failed to load PDF.js from CDN"));
    document.head.appendChild(script);
  });
  return pdfjsLoaded;
}

export async function extractTextFromPdf(file) {
  const pdfjsLib = await loadPdfJs();
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({
    data: buffer,
    cMapUrl: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/",
    cMapPacked: true,
    standardFontDataUrl: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/standard_fonts/",
    disableWorker: true,
  }).promise;
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const lines = [];
    let lastY = null;
    for (const item of content.items) {
      if (lastY !== null && Math.abs(item.transform[5] - lastY) > 2) lines.push("\n");
      lines.push(item.str);
      lastY = item.transform[5];
    }
    pages.push(lines.join(""));
  }
  const fullText = pages.join("\n\n").trim();
  if (fullText.length > 0) {
    let garbled = 0;
    for (let c = 0; c < fullText.length; c++) {
      const code = fullText.charCodeAt(c);
      if (code === 0xfffd || (code >= 0xe000 && code <= 0xf8ff) ||
          (code < 0x20 && code !== 0x0a && code !== 0x0d && code !== 0x09)) garbled++;
    }
    if (garbled / fullText.length > 0.3) {
      throw new Error("PDF text appears garbled (font encoding issue). Please export as .txt or paste text directly.");
    }
  }
  return fullText;
}

// ============================================================
// ANTHROPIC API LAYER
// ============================================================

export async function callAnthropic({ apiKey, system, messages, maxTokens = 4000, tools, signal, model }) {
  const body = { model: model ?? MODEL, max_tokens: maxTokens, system, messages };
  if (tools) body.tools = tools;
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { ...API_HEADERS_BASE, "x-api-key": apiKey },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${errBody.slice(0, 300)}`);
  }
  return res.json();
}

export async function callAnthropicWithLoop({
  apiKey, system, userMessage, maxTokens = 16000, tools, signal, maxTurns = 20, onTurn,
  turnDelayMs = 0, model,
}) {
  const messages = [{ role: "user", content: userMessage }];

  for (let turn = 0; turn < maxTurns; turn++) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

    if (turnDelayMs > 0 && turn > 0) {
      await new Promise(r => setTimeout(r, turnDelayMs));
    }

    const data = await withRetry(() =>
      callAnthropic({ apiKey, system, messages, maxTokens, tools, signal, model })
    );

    messages.push({ role: "assistant", content: data.content });

    const toolUseBlocks = (data.content || []).filter(b => b.type === "tool_use");
    if (onTurn && toolUseBlocks.length > 0) {
      const queries = toolUseBlocks.map(b => b.input?.query).filter(Boolean);
      onTurn({ turn: turn + 1, queries });
    }

    if (data.stop_reason === "end_turn") {
      const textBlocks = data.content.filter(b => b.type === "text").map(b => b.text);
      if (textBlocks.length === 0) throw new Error("No text in final response");
      return extractJson(textBlocks);
    }

    if (data.stop_reason === "tool_use") {
      const toolResults = toolUseBlocks.map(b => ({
        type: "tool_result",
        tool_use_id: b.id,
        content: `Search executed: "${b.input?.query ?? "unknown"}". Results available for analysis.`,
      }));
      messages.push({ role: "user", content: toolResults });
      continue;
    }

    const fallbackText = data.content.filter(b => b.type === "text").map(b => b.text);
    if (fallbackText.length > 0) return extractJson(fallbackText);
    throw new Error(`Unexpected stop_reason: ${data.stop_reason}`);
  }

  throw new Error("Scout exceeded maximum search iterations");
}

export async function detectWebSearchSupport(apiKey, signal) {
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { ...API_HEADERS_BASE, "x-api-key": apiKey },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 10,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [{ role: "user", content: "ping" }],
      }),
      signal,
    });
    if (res.ok) return { supported: true };
    const body = await res.text();
    const lower = body.toLowerCase();
    if (lower.includes("web_search") || lower.includes("tool not found") ||
        lower.includes("tool not enabled") || lower.includes("unknown tool") ||
        lower.includes("not available")) {
      return {
        supported: false,
        reason: "Web search is not enabled on your API key. Visit console.anthropic.com to enable it.",
      };
    }
    return { supported: false, reason: `Something went wrong (${res.status}): ${body.slice(0, 200)}` };
  } catch (err) {
    throw err;
  }
}
