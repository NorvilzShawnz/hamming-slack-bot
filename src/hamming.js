const fetch = require("node-fetch");

const BASE_URL = "https://app.hamming.ai/api/rest";

function getHeaders() {
  if (!process.env.HAMMING_API_KEY) {
    throw new Error("HAMMING_API_KEY is not set in environment variables.");
  }
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.HAMMING_API_KEY}`,
  };
}

async function request(method, path, body = null) {
  const url = `${BASE_URL}${path}`;
  const options = { method, headers: getHeaders() };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(url, options);
  const text = await res.text();

  let data = null;
  let parsed = false;
  try {
    data = JSON.parse(text);
    parsed = true;
  } catch {
    // non-JSON response (e.g. Cloudflare HTML error page on 5xx)
  }

  if (!res.ok) {
    let msg;
    if (parsed) {
      msg = data?.message || data?.error || `HTTP ${res.status}`;
    } else if (res.status >= 500) {
      msg = "Hamming API temporarily unavailable — try again in a moment";
    } else {
      msg = `HTTP ${res.status}`;
    }
    throw new Error(`Hamming API error (${res.status}): ${msg}`);
  }
  return data;
}

// POST /test-runs/test-outbound-agent
// testConfigurations: array of items shaped { testCaseId } OR { tagId }
// options: optional { samplingCount, maxConcurrentCalls }
async function startOutboundTestRun(agentId, testConfigurations, options = {}) {
  const body = { agentId, testConfigurations };
  if (options.samplingCount != null) body.samplingCount = options.samplingCount;
  if (options.maxConcurrentCalls != null) body.maxConcurrentCalls = options.maxConcurrentCalls;
  return request("POST", `/test-runs/test-outbound-agent`, body);
}

async function startInboundTestRun(agentId, testConfigurations, phoneNumbers, options = {}) {
  const body = { agentId, testConfigurations, phoneNumbers };
  if (options.samplingCount != null) body.samplingCount = options.samplingCount;
  if (options.maxConcurrentCalls != null) body.maxConcurrentCalls = options.maxConcurrentCalls;
  return request("POST", `/test-runs/test-inbound-agent`, body);
}

// GET /test-runs/{id}/status
async function getTestRunStatus(testRunId) {
  return request("GET", `/test-runs/${testRunId}/status`);
}

// GET /test-runs/{id}/results
async function getTestRunResults(testRunId) {
  return request("GET", `/test-runs/${testRunId}/results`);
}

// GET /agents
async function listAgents() {
  return request("GET", `/agents`);
}

// GET /agents/{id}/test-tags
async function listAgentTags(agentId) {
  return request("GET", `/agents/${agentId}/test-tags`);
}

// GET /test-cases  (path inferred from data-retrieval tool name `list_test_cases`)
async function listTestCases() {
  return request("GET", `/test-cases`);
}

module.exports = {
  startOutboundTestRun,
  startInboundTestRun,
  getTestRunStatus,
  getTestRunResults,
  listAgents,
  listAgentTags,
  listTestCases,
};
