import { createJobIndex, indexJobs, searchJobs, deleteIndex } from "../services/azureSearchService";

const ENDPOINT = "test-search.search.windows.net";
const KEY = "test-admin-key";

beforeEach(() => {
  global.fetch = jest.fn();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("createJobIndex", () => {
  it("sends PUT with correct schema and returns success", async () => {
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

    const result = await createJobIndex(ENDPOINT, KEY);

    expect(result).toEqual({ success: true, message: "Index created successfully" });
    expect(fetch).toHaveBeenCalledTimes(1);

    const [url, opts] = fetch.mock.calls[0];
    expect(url).toContain(`https://${ENDPOINT}/indexes/peelaway-jobs`);
    expect(url).toContain("api-version=2023-11-01");
    expect(opts.method).toBe("PUT");
    expect(opts.headers["api-key"]).toBe(KEY);

    const body = JSON.parse(opts.body);
    expect(body.name).toBe("peelaway-jobs");
    expect(body.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "id", key: true }),
        expect.objectContaining({ name: "title", searchable: true }),
        expect.objectContaining({ name: "company", filterable: true }),
        expect.objectContaining({ name: "score", sortable: true }),
      ])
    );
  });

  it("returns error on HTTP failure", async () => {
    fetch.mockResolvedValueOnce({ ok: false, status: 403, text: async () => "Forbidden" });

    const result = await createJobIndex(ENDPOINT, KEY);

    expect(result.success).toBe(false);
    expect(result.message).toContain("403");
  });

  it("returns error on network failure (never throws)", async () => {
    fetch.mockRejectedValueOnce(new Error("Network down"));

    const result = await createJobIndex(ENDPOINT, KEY);

    expect(result.success).toBe(false);
    expect(result.message).toContain("Network down");
  });
});

describe("indexJobs", () => {
  it("batches more than 50 jobs into multiple requests", async () => {
    // Create 120 jobs
    const jobs = Array.from({ length: 120 }, (_, i) => ({
      id: `job-${i}`,
      title: `Job ${i}`,
      company: "TestCo",
      total_score: 80,
    }));

    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ value: [] }),
    });

    const result = await indexJobs(ENDPOINT, KEY, jobs);

    // 120 jobs / 50 per batch = 3 batches
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(result.indexed).toBe(120);
    expect(result.errors).toEqual([]);

    // Verify first batch has 50 docs
    const firstBody = JSON.parse(fetch.mock.calls[0][1].body);
    expect(firstBody.value).toHaveLength(50);

    // Verify last batch has 20 docs
    const lastBody = JSON.parse(fetch.mock.calls[2][1].body);
    expect(lastBody.value).toHaveLength(20);
  });

  it("returns error on network failure (never throws)", async () => {
    fetch.mockRejectedValueOnce(new Error("Connection refused"));

    const result = await indexJobs(ENDPOINT, KEY, [{ id: "test-1", title: "Test" }]);

    expect(result.indexed).toBe(0);
    expect(result.errors[0]).toContain("Connection refused");
  });
});

describe("searchJobs", () => {
  it("passes correct search body with filters", async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ value: [{ id: "1", title: "Dev" }] }),
    });

    const results = await searchJobs(ENDPOINT, KEY, "developer", { source: "linkedin" });

    expect(results).toEqual([{ id: "1", title: "Dev" }]);

    const [url, opts] = fetch.mock.calls[0];
    expect(url).toContain("docs/search.post.search");
    const body = JSON.parse(opts.body);
    expect(body.search).toBe("developer");
    expect(body.top).toBe(50);
    expect(body.orderby).toBe("score desc");
    expect(body["$filter"]).toBe("source eq 'linkedin'");
  });

  it("returns empty array on network failure (never throws)", async () => {
    fetch.mockRejectedValueOnce(new Error("Timeout"));

    const results = await searchJobs(ENDPOINT, KEY, "test");

    expect(results).toEqual([]);
  });
});

describe("deleteIndex", () => {
  it("sends DELETE and returns success", async () => {
    fetch.mockResolvedValueOnce({ ok: true });

    const result = await deleteIndex(ENDPOINT, KEY);

    expect(result).toEqual({ success: true });
    expect(fetch.mock.calls[0][1].method).toBe("DELETE");
  });

  it("returns failure on network error (never throws)", async () => {
    fetch.mockRejectedValueOnce(new Error("fail"));

    const result = await deleteIndex(ENDPOINT, KEY);

    expect(result).toEqual({ success: false });
  });
});
