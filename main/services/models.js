const store = require("./store");
const endpoints = require("./endpoints");
const { validateAddModel, validateUpdateModel, MAX_MODELS } = require("./validation");
const { uuid } = require("./uuid");

function listModels(userDataPath) {
  const data = store.read(userDataPath);
  const profiles = data.modelProfiles || [];
  return Promise.resolve(
    profiles.map((m) => ({
      ...m,
      purpose: m.purpose && ["chat", "voice", "image"].includes(m.purpose) ? m.purpose : "chat",
    }))
  );
}

async function addModel(userDataPath, input) {
  const err = validateAddModel(input);
  if (err) return Promise.reject(new Error(err));
  const endpoint = await endpoints.getEndpoint(userDataPath, input.endpointProfileId.trim());
  if (!endpoint) return Promise.reject(new Error("Endpoint not found"));
  const data = store.read(userDataPath);
  const models = data.modelProfiles || [];
  if (models.length >= MAX_MODELS) {
    return Promise.reject(new Error(`Maximum ${MAX_MODELS} models allowed. Remove one to add another.`));
  }
  const purpose = input.purpose && ["chat", "voice", "image"].includes(input.purpose) ? input.purpose : "chat";
  const chatModels = models.filter((m) => (m.purpose || "chat") === "chat");
  const hasDefault = chatModels.some((m) => m.isDefault);
  const now = Date.now();
  const profile = {
    id: uuid(),
    label: (input.label && input.label.trim()) || input.modelId.trim(),
    modelId: input.modelId.trim(),
    endpointProfileId: input.endpointProfileId.trim(),
    purpose,
    isDefault: purpose === "chat" ? !hasDefault : false,
    temperature: input.temperature ?? null,
    maxTokens: input.maxTokens ?? null,
    createdAt: now,
    updatedAt: now,
  };
  models.push(profile);
  data.modelProfiles = models;
  store.write(userDataPath, data);
  return Promise.resolve(profile);
}

function updateModel(userDataPath, id, patch) {
  const err = validateUpdateModel(patch);
  if (err) return Promise.reject(new Error(err));
  const data = store.read(userDataPath);
  const models = data.modelProfiles || [];
  const idx = models.findIndex((m) => m.id === id);
  if (idx === -1) return Promise.reject(new Error("Model not found"));
  const existing = models[idx];
  if (patch.purpose !== undefined && patch.purpose !== (existing.purpose || "chat")) {
    if (existing.isDefault) {
      const chatModels = models.filter((m) => m.id !== id && (m.purpose || "chat") === "chat");
      existing.isDefault = false;
      const next = chatModels[0];
      if (next) {
        next.isDefault = true;
        next.updatedAt = Date.now();
      }
    }
  }
  if (patch.label !== undefined) existing.label = patch.label;
  if (patch.modelId !== undefined) existing.modelId = patch.modelId.trim();
  if (patch.temperature !== undefined) existing.temperature = patch.temperature;
  if (patch.maxTokens !== undefined) existing.maxTokens = patch.maxTokens;
  if (patch.purpose !== undefined) existing.purpose = patch.purpose;
  existing.updatedAt = Date.now();
  store.write(userDataPath, data);
  return Promise.resolve(existing);
}

function deleteModel(userDataPath, id) {
  const data = store.read(userDataPath);
  const models = (data.modelProfiles || []).filter((m) => m.id !== id);
  const removed = (data.modelProfiles || []).find((m) => m.id === id);
  if (removed && removed.isDefault) {
    const chatModels = models.filter((m) => (m.purpose || "chat") === "chat");
    const next = chatModels[0];
    if (next) {
      next.isDefault = true;
      next.updatedAt = Date.now();
    }
  }
  const sel = data.modelSelection || {};
  if (sel.voiceModelId === id) sel.voiceModelId = null;
  if (sel.imageModelId === id) sel.imageModelId = null;
  data.modelProfiles = models;
  data.modelSelection = sel;
  store.write(userDataPath, data);
  return Promise.resolve();
}

function setDefaultModel(userDataPath, modelId) {
  const data = store.read(userDataPath);
  const models = data.modelProfiles || [];
  const idx = models.findIndex((m) => m.id === modelId);
  if (idx === -1) return Promise.reject(new Error("Model not found"));
  const target = models[idx];
  if ((target.purpose || "chat") !== "chat") return Promise.reject(new Error("Only chat models can be set as default"));
  models.forEach((m) => {
    if ((m.purpose || "chat") === "chat") {
      m.isDefault = m.id === modelId;
      if (m.isDefault) m.updatedAt = Date.now();
    }
  });
  store.write(userDataPath, data);
  return Promise.resolve();
}

function getModelSelection(userDataPath) {
  const data = store.read(userDataPath);
  const sel = data.modelSelection || {};
  return Promise.resolve({
    voiceModelId: sel.voiceModelId || null,
    imageModelId: sel.imageModelId || null,
  });
}

function setVoiceModelId(userDataPath, modelId) {
  if (!modelId) {
    const data = store.read(userDataPath);
    if (!data.modelSelection) data.modelSelection = {};
    data.modelSelection.voiceModelId = null;
    store.write(userDataPath, data);
    return Promise.resolve();
  }
  const data = store.read(userDataPath);
  const model = (data.modelProfiles || []).find((m) => m.id === modelId);
  if (!model) return Promise.reject(new Error("Model not found"));
  if (model.purpose !== "voice") return Promise.reject(new Error("Model must have purpose 'voice'"));
  if (!data.modelSelection) data.modelSelection = {};
  data.modelSelection.voiceModelId = modelId;
  store.write(userDataPath, data);
  return Promise.resolve();
}

function setImageModelId(userDataPath, modelId) {
  if (!modelId) {
    const data = store.read(userDataPath);
    if (!data.modelSelection) data.modelSelection = {};
    data.modelSelection.imageModelId = null;
    store.write(userDataPath, data);
    return Promise.resolve();
  }
  const data = store.read(userDataPath);
  const model = (data.modelProfiles || []).find((m) => m.id === modelId);
  if (!model) return Promise.reject(new Error("Model not found"));
  if (model.purpose !== "image") return Promise.reject(new Error("Model must have purpose 'image'"));
  if (!data.modelSelection) data.modelSelection = {};
  data.modelSelection.imageModelId = modelId;
  store.write(userDataPath, data);
  return Promise.resolve();
}

function getModel(userDataPath, id) {
  const data = store.read(userDataPath);
  const models = data.modelProfiles || [];
  return models.find((m) => m.id === id) || null;
}

module.exports = {
  listModels,
  addModel,
  updateModel,
  deleteModel,
  setDefaultModel,
  getModel,
  getModelSelection,
  setVoiceModelId,
  setImageModelId,
};
