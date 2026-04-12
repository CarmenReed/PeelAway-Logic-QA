// api.test.js
// Tests for api.js: withRetry, callAnthropic, callAnthropicWithLoop, detectWebSearchSupport

import { withRetry, callAnthropic, callAnthropicWithLoop, detectWebSearchSupport } from "../api";

// ============================================================
// Setup & teardown
// ============================================================

const originalFetch = global.fetch;

beforeEach(() => {
  jest.restoreAllMocks();
});

afterEach(() => {
  global.fetch = originalFetch;
});

// ============================================================
// withRetry — use real timers but mock delays via instant-resolving fns
// ============================================================

describe("withRetry", () => {
  it("returns the value on first success", async () => {
    const fn = jest.fn().mockResolvedValue("ok");
    const result = await withRetry(fn);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on failure and succeeds on second attempt", async () => {
    // Override setTimeout to resolve instantly
    const origSetTimeout = global.setTimeout;
    global.setTimeout = (cb) => origSetTimeout(cb, 0);

    const fn = jest.fn()
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValueOnce("ok");

    const result = await withRetry(fn, 3);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);

    global.setTimeout = origSetTimeout;
  });

  it("throws after maxAttempts exhausted", async () => {
    const origSetTimeout = global.setTimeout;
    global.setTimeout = (cb) => origSetTimeout(cb, 0);

    const fn = jest.fn().mockRejectedValue(new Error("always fail"));

    await expect(withRetry(fn, 2)).rejects.toThrow("always fail");
    expect(fn).toHaveBeenCalledTimes(2);

    global.setTimeout = origSetTimeout;
  });

  it("immediately rethrows AbortError without retry", async () => {
    const abortErr = new DOMException("Aborted", "AbortError");
    const fn = jest.fn().mockRejectedValue(abortErr);

    await expect(withRetry(fn, 3)).rejects.toThrow("Aborted");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("defaults to 3 maxAttempts", async () => {
    const origSetTimeout = global.setTimeout;
    global.setTimeout = (cb) => origSetTimeout(cb, 0);

    const fn = jest.fn().mockRejectedValue(new Error("fail"));

    await expect(withRetry(fn)).rejects.toThrow("fail");
    expect(fn).toHaveBeenCalledTimes(3);

    global.setTimeout = origSetTimeout;
  });
});

// ============================================================
// callAnthropic
// ============================================================

describe("callAnthropic", () => {
  it("makes a POST request with correct body and headers", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ type: "text", text: "hello" }] }),
    });

    await callAnthropic({
      apiKey: "test-key",
      system: "You are helpful",
      messages: [{ role: "user", content: "hi" }],
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect(opts.method).toBe("POST");
    expect(opts.headers["x-api-key"]).toBe("test-key");

    const body = JSON.parse(opts.body);
    expect(body.system).toBe("You are helpful");
    expect(body.messages).toEqual([{ role: "user", content: "hi" }]);
    expect(body.max_tokens).toBe(4000);
    expect(body.model).toBe("claude-sonnet-4-6");
  });

  it("uses custom model when provided", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ content: [] }),
    });

    await callAnthropic({
      apiKey: "k",
      system: "",
      messages: [],
      model: "claude-haiku-4-5-20251001",
    });

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.model).toBe("claude-haiku-4-5-20251001");
  });

  it("includes tools in body when provided", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ content: [] }),
    });

    const tools = [{ type: "web_search_20250305", name: "web_search" }];
    await callAnthropic({ apiKey: "k", system: "", messages: [], tools });

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.tools).toEqual(tools);
  });

  it("does not include tools key when not provided", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ content: [] }),
    });

    await callAnthropic({ apiKey: "k", system: "", messages: [] });

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.tools).toBeUndefined();
  });

  it("throws on non-ok response with status and body", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => "Rate limited",
    });

    await expect(
      callAnthropic({ apiKey: "k", system: "", messages: [] })
    ).rejects.toThrow("API 429: Rate limited");
  });

  it("handles text() failure gracefully in error path", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => { throw new Error("body read fail"); },
    });

    await expect(
      callAnthropic({ apiKey: "k", system: "", messages: [] })
    ).rejects.toThrow("API 500:");
  });

  it("passes signal to fetch", async () => {
    const ac = new AbortController();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ content: [] }),
    });

    await callAnthropic({
      apiKey: "k",
      system: "",
      messages: [],
      signal: ac.signal,
    });

    expect(global.fetch.mock.calls[0][1].signal).toBe(ac.signal);
  });

  it("uses default maxTokens of 4000", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ content: [] }),
    });

    await callAnthropic({ apiKey: "k", system: "", messages: [] });

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.max_tokens).toBe(4000);
  });

  it("uses custom maxTokens when provided", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ content: [] }),
    });

    await callAnthropic({ apiKey: "k", system: "", messages: [], maxTokens: 8000 });

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.max_tokens).toBe(8000);
  });
});

// ============================================================
// callAnthropicWithLoop
// ============================================================

describe("callAnthropicWithLoop", () => {
  it("returns parsed JSON from end_turn response", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        stop_reason: "end_turn",
        content: [{ type: "text", text: '{"result": true}' }],
      }),
    });

    const result = await callAnthropicWithLoop({
      apiKey: "k",
      system: "",
      userMessage: "test",
    });

    expect(result).toEqual({ result: true });
  });

  it("handles tool_use stop reason by sending tool results", async () => {
    let callCount = 0;
    global.fetch = jest.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return {
          ok: true,
          json: async () => ({
            stop_reason: "tool_use",
            content: [
              { type: "tool_use", id: "t1", input: { query: "test search" } },
            ],
          }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          stop_reason: "end_turn",
          content: [{ type: "text", text: '{"answer": "found"}' }],
        }),
      };
    });

    const result = await callAnthropicWithLoop({
      apiKey: "k",
      system: "",
      userMessage: "search for something",
    });

    expect(result).toEqual({ answer: "found" });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("calls onTurn callback with tool queries", async () => {
    let callCount = 0;
    global.fetch = jest.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return {
          ok: true,
          json: async () => ({
            stop_reason: "tool_use",
            content: [
              { type: "tool_use", id: "t1", input: { query: "search query" } },
            ],
          }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          stop_reason: "end_turn",
          content: [{ type: "text", text: '{"done": true}' }],
        }),
      };
    });

    const onTurn = jest.fn();
    await callAnthropicWithLoop({
      apiKey: "k",
      system: "",
      userMessage: "test",
      onTurn,
    });

    expect(onTurn).toHaveBeenCalledWith({ turn: 1, queries: ["search query"] });
  });

  it("throws when end_turn has no text blocks", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        stop_reason: "end_turn",
        content: [{ type: "tool_use", id: "t1" }],
      }),
    });

    await expect(
      callAnthropicWithLoop({ apiKey: "k", system: "", userMessage: "test" })
    ).rejects.toThrow("No text in final response");
  });

  it("throws when signal is already aborted", async () => {
    const ac = new AbortController();
    ac.abort();

    await expect(
      callAnthropicWithLoop({
        apiKey: "k",
        system: "",
        userMessage: "test",
        signal: ac.signal,
      })
    ).rejects.toThrow("Aborted");
  });

  it("throws after maxTurns exceeded", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        stop_reason: "tool_use",
        content: [{ type: "tool_use", id: "t1", input: { query: "loop" } }],
      }),
    });

    await expect(
      callAnthropicWithLoop({
        apiKey: "k",
        system: "",
        userMessage: "test",
        maxTurns: 2,
      })
    ).rejects.toThrow("Scout exceeded maximum search iterations");
  });

  it("handles unexpected stop_reason with text fallback", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        stop_reason: "max_tokens",
        content: [{ type: "text", text: '{"partial": true}' }],
      }),
    });

    const result = await callAnthropicWithLoop({
      apiKey: "k",
      system: "",
      userMessage: "test",
    });

    expect(result).toEqual({ partial: true });
  });

  it("throws on unexpected stop_reason with no text", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        stop_reason: "max_tokens",
        content: [],
      }),
    });

    await expect(
      callAnthropicWithLoop({ apiKey: "k", system: "", userMessage: "test" })
    ).rejects.toThrow("Unexpected stop_reason: max_tokens");
  });

  it("builds messages array correctly across turns", async () => {
    let callCount = 0;
    global.fetch = jest.fn().mockImplementation(async (url, opts) => {
      callCount++;
      if (callCount === 1) {
        return {
          ok: true,
          json: async () => ({
            stop_reason: "tool_use",
            content: [
              { type: "tool_use", id: "t1", input: { query: "search" } },
            ],
          }),
        };
      }
      // On second call, verify messages contain tool results
      const body = JSON.parse(opts.body);
      expect(body.messages).toHaveLength(3); // user, assistant, user (tool_results)
      expect(body.messages[2].content[0].type).toBe("tool_result");
      return {
        ok: true,
        json: async () => ({
          stop_reason: "end_turn",
          content: [{ type: "text", text: '{"done": true}' }],
        }),
      };
    });

    await callAnthropicWithLoop({
      apiKey: "k",
      system: "",
      userMessage: "test",
    });
  });
});

// ============================================================
// detectWebSearchSupport
// ============================================================

describe("detectWebSearchSupport", () => {
  it("returns supported: true when API responds ok", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true });

    const result = await detectWebSearchSupport("test-key");
    expect(result).toEqual({ supported: true });
  });

  it("returns not supported when response mentions web_search", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => "web_search tool not found in available tools",
    });

    const result = await detectWebSearchSupport("test-key");
    expect(result.supported).toBe(false);
    expect(result.reason).toContain("Web search is not enabled");
  });

  it("returns not supported when response mentions 'tool not enabled'", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => "tool not enabled for this API key",
    });

    const result = await detectWebSearchSupport("test-key");
    expect(result.supported).toBe(false);
    expect(result.reason).toContain("Web search is not enabled");
  });

  it("returns not supported when response mentions 'unknown tool'", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => "unknown tool type specified",
    });

    const result = await detectWebSearchSupport("test-key");
    expect(result.supported).toBe(false);
    expect(result.reason).toContain("Web search is not enabled");
  });

  it("returns not supported when response mentions 'not available'", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => "Feature not available for your plan",
    });

    const result = await detectWebSearchSupport("test-key");
    expect(result.supported).toBe(false);
    expect(result.reason).toContain("Web search is not enabled");
  });

  it("returns generic error for unknown non-ok responses", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "Internal server error",
    });

    const result = await detectWebSearchSupport("test-key");
    expect(result.supported).toBe(false);
    expect(result.reason).toContain("Something went wrong (500)");
  });

  it("rethrows network errors", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("Network error"));

    await expect(detectWebSearchSupport("test-key")).rejects.toThrow("Network error");
  });

  it("passes signal to fetch", async () => {
    const ac = new AbortController();
    global.fetch = jest.fn().mockResolvedValue({ ok: true });

    await detectWebSearchSupport("test-key", ac.signal);
    expect(global.fetch.mock.calls[0][1].signal).toBe(ac.signal);
  });

  it("sends correct probe request body", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true });

    await detectWebSearchSupport("test-key");

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.max_tokens).toBe(10);
    expect(body.tools).toEqual([{ type: "web_search_20250305", name: "web_search" }]);
    expect(body.messages[0].content).toBe("ping");
  });
});
