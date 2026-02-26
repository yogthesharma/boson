const PRESETS = ["openai-compatible", "openrouter-compatible", "litellm", "custom"];
const PURPOSES = ["chat", "voice", "image"];

/** Maximum API providers (endpoints) a user can add. */
const MAX_ENDPOINTS = 100;
/** Maximum models a user can add across all providers. */
const MAX_MODELS = 500;

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

function validateCreateEndpoint(input) {
  if (!input || typeof input !== "object") return "Invalid input";
  const { name, preset, baseUrl } = input;
  if (!isNonEmptyString(name)) return "name is required";
  if (!PRESETS.includes(preset)) return "preset must be one of: " + PRESETS.join(", ");
  if (!isNonEmptyString(baseUrl)) return "baseUrl is required";
  try {
    new URL(baseUrl);
  } catch {
    return "baseUrl must be a valid URL";
  }
  return null;
}

function validateUpdateEndpoint(patch) {
  if (!patch || typeof patch !== "object") return "Invalid patch";
  if (patch.name !== undefined && !isNonEmptyString(patch.name)) return "name must be non-empty";
  if (patch.preset !== undefined && !PRESETS.includes(patch.preset)) return "invalid preset";
  if (patch.baseUrl !== undefined) {
    if (!isNonEmptyString(patch.baseUrl)) return "baseUrl must be non-empty";
    try {
      new URL(patch.baseUrl);
    } catch {
      return "baseUrl must be a valid URL";
    }
  }
  return null;
}

function validateAddModel(input) {
  if (!input || typeof input !== "object") return "Invalid input";
  const { label, modelId, endpointProfileId, purpose } = input;
  if (!isNonEmptyString(modelId)) return "modelId is required";
  if (!isNonEmptyString(endpointProfileId)) return "endpointProfileId is required";
  if (label !== undefined && typeof label !== "string") return "label must be string";
  if (purpose !== undefined && !PURPOSES.includes(purpose)) return "purpose must be one of: " + PURPOSES.join(", ");
  return null;
}

function validateUpdateModel(patch) {
  if (!patch || typeof patch !== "object") return "Invalid patch";
  if (patch.label !== undefined && typeof patch.label !== "string") return "label must be string";
  if (patch.modelId !== undefined && !isNonEmptyString(patch.modelId)) return "modelId must be non-empty";
  if (patch.temperature !== undefined) {
    const t = patch.temperature;
    if (t !== null && (typeof t !== "number" || t < 0 || t > 2)) return "temperature must be null or 0-2";
  }
  if (patch.maxTokens !== undefined) {
    const m = patch.maxTokens;
    if (m !== null && (typeof m !== "number" || m < 1)) return "maxTokens must be null or positive";
  }
  if (patch.purpose !== undefined && !PURPOSES.includes(patch.purpose)) return "purpose must be one of: " + PURPOSES.join(", ");
  return null;
}

function validateChatSend(payload) {
  if (!payload || typeof payload !== "object") return "Invalid payload";
  const { modelProfileId, messages } = payload;
  if (!isNonEmptyString(modelProfileId)) return "modelProfileId is required";
  if (!Array.isArray(messages) || messages.length === 0) return "messages must be a non-empty array";
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (!m || typeof m.role !== "string" || typeof m.content !== "string")
      return `messages[${i}] must have role and content`;
    if (!["user", "assistant", "system"].includes(m.role)) return `messages[${i}].role invalid`;
  }
  return null;
}

module.exports = {
  validateCreateEndpoint,
  validateUpdateEndpoint,
  validateAddModel,
  validateUpdateModel,
  validateChatSend,
  MAX_ENDPOINTS,
  MAX_MODELS,
  PURPOSES,
};
