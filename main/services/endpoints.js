const store = require("./store");
const keychain = require("./keychain");
const { validateCreateEndpoint, validateUpdateEndpoint, MAX_ENDPOINTS } = require("./validation");
const { uuid } = require("./uuid");

const PRESET_URLS = {
  "openai-compatible": "https://api.openai.com/v1",
  "openrouter-compatible": "https://openrouter.ai/api/v1",
  litellm: "http://localhost:4000",
  custom: "",
};

function listEndpoints(userDataPath) {
  const data = store.read(userDataPath);
  return Promise.resolve(data.endpointProfiles || []);
}

function createEndpoint(userDataPath, input) {
  const err = validateCreateEndpoint(input);
  if (err) return Promise.reject(new Error(err));
  const data = store.read(userDataPath);
  const profiles = data.endpointProfiles || [];
  if (profiles.length >= MAX_ENDPOINTS) {
    return Promise.reject(new Error(`Maximum ${MAX_ENDPOINTS} providers allowed. Remove one to add another.`));
  }
  const baseUrl =
    input.baseUrl && input.baseUrl.trim()
      ? input.baseUrl.trim().replace(/\/$/, "")
      : (PRESET_URLS[input.preset] || "");
  const now = Date.now();
  const profile = {
    id: uuid(),
    name: input.name.trim(),
    preset: input.preset,
    baseUrl,
    createdAt: now,
    updatedAt: now,
  };
  profiles.push(profile);
  data.endpointProfiles = profiles;
  store.write(userDataPath, data);
  return Promise.resolve(profile);
}

function updateEndpoint(userDataPath, id, patch) {
  const err = validateUpdateEndpoint(patch);
  if (err) return Promise.reject(new Error(err));
  const data = store.read(userDataPath);
  const profiles = data.endpointProfiles || [];
  const idx = profiles.findIndex((p) => p.id === id);
  if (idx === -1) return Promise.reject(new Error("Endpoint not found"));
  const existing = profiles[idx];
  if (patch.name !== undefined) existing.name = patch.name.trim();
  if (patch.preset !== undefined) existing.preset = patch.preset;
  if (patch.baseUrl !== undefined) {
    existing.baseUrl = patch.baseUrl.trim().replace(/\/$/, "");
  }
  existing.updatedAt = Date.now();
  store.write(userDataPath, data);
  return Promise.resolve(existing);
}

async function deleteEndpoint(userDataPath, id) {
  const data = store.read(userDataPath);
  const removedModelIds = new Set(
    (data.modelProfiles || []).filter((m) => m.endpointProfileId === id).map((m) => m.id)
  );
  const profiles = (data.endpointProfiles || []).filter((p) => p.id !== id);
  const models = (data.modelProfiles || []).filter((m) => m.endpointProfileId !== id);
  data.endpointProfiles = profiles;
  data.modelProfiles = models;
  const sel = data.modelSelection || {};
  if (removedModelIds.has(sel.voiceModelId)) sel.voiceModelId = null;
  if (removedModelIds.has(sel.imageModelId)) sel.imageModelId = null;
  data.modelSelection = sel;
  store.write(userDataPath, data);
  await keychain.deleteApiKey(id);
  return Promise.resolve();
}

function saveApiKey(endpointId, apiKey) {
  if (!endpointId || typeof apiKey !== "string" || !apiKey.trim())
    return Promise.reject(new Error("endpointId and apiKey required"));
  return keychain.setApiKey(endpointId, apiKey.trim());
}

function clearApiKey(endpointId) {
  return keychain.deleteApiKey(endpointId);
}

async function getEndpoint(userDataPath, id) {
  const data = store.read(userDataPath);
  const profiles = data.endpointProfiles || [];
  return profiles.find((p) => p.id === id) || null;
}

async function fetchModels(userDataPath, endpointId) {
  const endpoint = await getEndpoint(userDataPath, endpointId);
  if (!endpoint) return Promise.reject(new Error("Endpoint not found"));
  const apiKey = await keychain.getApiKey(endpointId);
  // Send Authorization only when key exists (local and optional-auth endpoints work without key)
  const url = `${endpoint.baseUrl.replace(/\/$/, "")}/models`;
  const headers = {};
  if (apiKey && apiKey.trim()) {
    headers.Authorization = `Bearer ${apiKey.trim()}`;
  }
  let res;
  try {
    res = await fetch(url, { method: "GET", headers });
  } catch (e) {
    return Promise.reject(new Error(e && (e.message || String(e)) || "Network request failed"));
  }
  if (!res.ok) return Promise.reject(new Error(`Failed to fetch models: ${res.status}`));
  let data;
  try {
    data = await res.json();
  } catch {
    return Promise.resolve([]);
  }
  const list = Array.isArray(data)
    ? data
    : Array.isArray(data.data)
      ? data.data
      : Array.isArray(data.models)
        ? data.models
        : [];
  const out = [];
  for (const m of list) {
    const id = m.id ?? m.model ?? (typeof m === "string" ? m : null);
    if (id) out.push({ id, label: m.id || m.model || id });
  }
  return Promise.resolve(out);
}

async function testConnection(userDataPath, endpointId) {
  const endpoint = await getEndpoint(userDataPath, endpointId);
  if (!endpoint) return { ok: false, message: "Endpoint not found" };
  const apiKey = await keychain.getApiKey(endpointId);
  const headers = {};
  if (apiKey && apiKey.trim()) {
    headers.Authorization = `Bearer ${apiKey.trim()}`;
  }
  const url = `${endpoint.baseUrl.replace(/\/$/, "")}/models`;
  try {
    const res = await fetch(url, { method: "GET", headers });
    if (res.status === 401 || res.status === 403) return { ok: false, message: "Invalid API key" };
    if (res.status === 404) return { ok: false, message: "Endpoint not found" };
    if (!res.ok) return { ok: false, message: `Request failed: ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, message: (e && (e.message || String(e))) || "Connection failed" };
  }
}

module.exports = {
  listEndpoints,
  createEndpoint,
  updateEndpoint,
  deleteEndpoint,
  saveApiKey,
  clearApiKey,
  getEndpoint,
  fetchModels,
  testConnection,
  PRESET_URLS,
};
