// azureSearchService.js
// Azure AI Search integration for indexing and searching scored jobs

import { AZURE_SEARCH_API_VERSION, AZURE_SEARCH_INDEX_NAME } from "../constants";

const INDEX_SCHEMA = {
  name: AZURE_SEARCH_INDEX_NAME,
  fields: [
    { name: "id", type: "Edm.String", key: true, searchable: false, retrievable: true },
    { name: "title", type: "Edm.String", searchable: true, retrievable: true },
    { name: "company", type: "Edm.String", searchable: true, filterable: true, retrievable: true },
    { name: "description", type: "Edm.String", searchable: true, retrievable: true },
    { name: "score", type: "Edm.Double", filterable: true, sortable: true, retrievable: true },
    { name: "scoreReason", type: "Edm.String", searchable: true, retrievable: true },
    { name: "location", type: "Edm.String", filterable: true, retrievable: true },
    { name: "source", type: "Edm.String", filterable: true, retrievable: true },
    { name: "url", type: "Edm.String", retrievable: true },
    { name: "postedDate", type: "Edm.String", filterable: true, retrievable: true },
  ],
};

/**
 * Creates or updates the peelaway-jobs index in Azure AI Search.
 * @param {string} endpoint - Azure Search endpoint (e.g. "mysearch.search.windows.net")
 * @param {string} adminKey - Admin API key for the Azure Search service
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function createJobIndex(endpoint, adminKey) {
  try {
    const url = `https://${endpoint}/indexes/${AZURE_SEARCH_INDEX_NAME}?api-version=${AZURE_SEARCH_API_VERSION}`;
    const res = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "api-key": adminKey,
      },
      body: JSON.stringify(INDEX_SCHEMA),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { success: false, message: `Failed to create index (${res.status}): ${body.slice(0, 300)}` };
    }
    return { success: true, message: "Index created successfully" };
  } catch (err) {
    return { success: false, message: `Network error: ${err.message}` };
  }
}

/**
 * Indexes an array of scored job objects into Azure AI Search.
 * Jobs are batched in groups of 50 (Azure limit).
 * @param {string} endpoint - Azure Search endpoint
 * @param {string} adminKey - Admin API key
 * @param {Array<Object>} jobs - Scored job objects from the PeelAway pipeline
 * @returns {Promise<{indexed: number, errors: string[]}>}
 */
export async function indexJobs(endpoint, adminKey, jobs) {
  try {
    const docs = jobs.map((job) => ({
      "@search.action": "mergeOrUpload",
      id: job.id || crypto.randomUUID(),
      title: job.title || "",
      company: job.company || "",
      description: job.description || job.snippet || "",
      score: job.total_score ?? job.score ?? 0,
      scoreReason: job.score_reason || job.reason || "",
      location: job.location || "",
      source: job.source || "",
      url: job.url || "",
      postedDate: job.date_posted || job.postedDate || "",
    }));

    const batchSize = 50;
    let indexed = 0;
    const errors = [];

    for (let i = 0; i < docs.length; i += batchSize) {
      const batch = docs.slice(i, i + batchSize);
      const url = `https://${endpoint}/indexes/${AZURE_SEARCH_INDEX_NAME}/docs/index?api-version=${AZURE_SEARCH_API_VERSION}`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": adminKey,
        },
        body: JSON.stringify({ value: batch }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        errors.push(`Batch ${Math.floor(i / batchSize) + 1} failed (${res.status}): ${body.slice(0, 200)}`);
        continue;
      }

      const result = await res.json();
      const failed = (result.value || []).filter((r) => !r.status);
      indexed += batch.length - failed.length;
      failed.forEach((f) => errors.push(`Doc ${f.key}: ${f.errorMessage}`));
    }

    return { indexed, errors };
  } catch (err) {
    return { indexed: 0, errors: [`Network error: ${err.message}`] };
  }
}

/**
 * Searches indexed jobs in Azure AI Search.
 * @param {string} endpoint - Azure Search endpoint
 * @param {string} queryKey - Query API key (or admin key)
 * @param {string} searchText - Free-text search query
 * @param {Object} [filters] - Optional filters (e.g. { source: "linkedin" })
 * @returns {Promise<Array<Object>>}
 */
export async function searchJobs(endpoint, queryKey, searchText, filters = {}) {
  try {
    const url = `https://${endpoint}/indexes/${AZURE_SEARCH_INDEX_NAME}/docs/search.post.search?api-version=${AZURE_SEARCH_API_VERSION}`;
    const body = {
      search: searchText,
      top: 50,
      orderby: "score desc",
    };
    if (filters.source) {
      body["$filter"] = `source eq '${filters.source}'`;
    }
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": queryKey,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.value || [];
  } catch {
    return [];
  }
}

/**
 * Deletes the peelaway-jobs index from Azure AI Search.
 * @param {string} endpoint - Azure Search endpoint
 * @param {string} adminKey - Admin API key
 * @returns {Promise<{success: boolean}>}
 */
export async function deleteIndex(endpoint, adminKey) {
  try {
    const url = `https://${endpoint}/indexes/${AZURE_SEARCH_INDEX_NAME}?api-version=${AZURE_SEARCH_API_VERSION}`;
    const res = await fetch(url, {
      method: "DELETE",
      headers: { "api-key": adminKey },
    });
    return { success: res.ok };
  } catch {
    return { success: false };
  }
}
