const keychain = require("./keychain");
const store = require("./store");
const models = require("./models");
const endpoints = require("./endpoints");
const { validateChatSend } = require("./validation");

const ERROR_CODES = {
  MISSING_API_KEY: "MISSING_API_KEY",
  INVALID_API_KEY: "INVALID_API_KEY",
  MODEL_NOT_FOUND: "MODEL_NOT_FOUND",
  RATE_LIMITED: "RATE_LIMITED",
  NETWORK_ERROR: "NETWORK_ERROR",
};

async function send(userDataPath, payload) {
  const err = validateChatSend(payload);
  if (err) return { error: "VALIDATION_ERROR", message: err };

  const { modelProfileId, messages } = payload;
  const modelProfile = models.getModel(userDataPath, modelProfileId);
  if (!modelProfile) return { error: "MODEL_NOT_FOUND", message: "Model profile not found" };

  const endpoint = await endpoints.getEndpoint(userDataPath, modelProfile.endpointProfileId);
  if (!endpoint) return { error: "MODEL_NOT_FOUND", message: "Endpoint not found" };

  const apiKey = await keychain.getApiKey(modelProfile.endpointProfileId);
  const headers = { "Content-Type": "application/json" };
  if (apiKey && apiKey.trim()) {
    headers.Authorization = `Bearer ${apiKey.trim()}`;
  }

  const url = `${endpoint.baseUrl.replace(/\/$/, "")}/chat/completions`;
  const body = {
    model: modelProfile.modelId,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    temperature: modelProfile.temperature ?? undefined,
    max_tokens: payload.max_tokens ?? modelProfile.maxTokens ?? undefined,
  };

  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
  } catch (e) {
    return {
      error: "NETWORK_ERROR",
      message: e && (e.message || String(e)) || "Network request failed",
    };
  }

  if (res.status === 401 || res.status === 403) {
    return { error: "INVALID_API_KEY", message: "Invalid or unauthorized API key" };
  }
  if (res.status === 404) {
    return { error: "MODEL_NOT_FOUND", message: "Model or endpoint not found" };
  }
  if (res.status === 429) {
    return { error: "RATE_LIMITED", message: "Rate limited; try again later" };
  }

  if (!res.ok) {
    let message = `Request failed: ${res.status}`;
    try {
      const j = await res.json();
      if (j.error && j.error.message) message = j.error.message;
    } catch (_) {}
    return { error: "NETWORK_ERROR", message };
  }

  let data;
  try {
    data = await res.json();
  } catch (e) {
    return { error: "NETWORK_ERROR", message: "Invalid response body" };
  }

  const content =
    data.choices &&
    data.choices[0] &&
    data.choices[0].message &&
    typeof data.choices[0].message.content === "string"
      ? data.choices[0].message.content
      : "";

  return { role: "assistant", content };
}

const TITLE_SYSTEM_PROMPT =
  "You are a titling assistant. Reply with only a short phrase (3-6 words) that summarizes the following user message. No quotes, no explanation, no punctuation at the end.";

/**
 * Generate a short conversation title from the first user message using the same chat API.
 * Returns a trimmed string or null on failure.
 */
async function generateTitle(userDataPath, modelProfileId, firstMessageText) {
  const text =
    typeof firstMessageText === "string"
      ? firstMessageText.trim().slice(0, 500)
      : "";
  if (!text) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[chatClient.generateTitle] No text provided");
    }
    return null;
  }
  const payload = {
    modelProfileId,
    messages: [
      { role: "system", content: TITLE_SYSTEM_PROMPT },
      { role: "user", content: text },
    ],
  };
  const result = await send(userDataPath, payload);
  if (result.error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[chatClient.generateTitle] API error:", result.error, result.message);
    }
    return null;
  }
  const raw = result.content != null ? String(result.content).trim() : "";
  if (!raw) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[chatClient.generateTitle] Empty content in response");
    }
    return null;
  }
  const title = raw.replace(/\s+/g, " ").slice(0, 80);
  return title || null;
}

/**
 * Stream a chat completion; calls onChunk(delta) for each content delta.
 * Returns { role, content } on success or { error, message } on failure.
 */
async function sendStream(userDataPath, payload, onChunk) {
  const err = validateChatSend(payload);
  if (err) return { error: "VALIDATION_ERROR", message: err };

  const { modelProfileId, messages } = payload;
  const modelProfile = models.getModel(userDataPath, modelProfileId);
  if (!modelProfile) return { error: "MODEL_NOT_FOUND", message: "Model profile not found" };

  const endpoint = await endpoints.getEndpoint(userDataPath, modelProfile.endpointProfileId);
  if (!endpoint) return { error: "MODEL_NOT_FOUND", message: "Endpoint not found" };

  const apiKey = await keychain.getApiKey(modelProfile.endpointProfileId);
  const headers = { "Content-Type": "application/json" };
  if (apiKey && apiKey.trim()) {
    headers.Authorization = `Bearer ${apiKey.trim()}`;
  }

  const url = `${endpoint.baseUrl.replace(/\/$/, "")}/chat/completions`;
  const body = {
    model: modelProfile.modelId,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    temperature: modelProfile.temperature ?? undefined,
    max_tokens: modelProfile.maxTokens ?? undefined,
    stream: true,
  };

  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
  } catch (e) {
    return {
      error: "NETWORK_ERROR",
      message: e && (e.message || String(e)) || "Network request failed",
    };
  }

  if (res.status === 401 || res.status === 403) {
    return { error: "INVALID_API_KEY", message: "Invalid or unauthorized API key" };
  }
  if (res.status === 404) {
    return { error: "MODEL_NOT_FOUND", message: "Model or endpoint not found" };
  }
  if (res.status === 429) {
    return { error: "RATE_LIMITED", message: "Rate limited; try again later" };
  }

  if (!res.ok) {
    let message = `Request failed: ${res.status}`;
    try {
      const j = await res.json();
      if (j.error && j.error.message) message = j.error.message;
    } catch (_) {}
    return { error: "NETWORK_ERROR", message };
  }

  if (!res.body) {
    return { error: "NETWORK_ERROR", message: "No response body" };
  }

  let content = "";
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") continue;
          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (typeof delta === "string") {
              content += delta;
              onChunk(delta);
            }
          } catch (_) {
            // skip malformed line
          }
        }
      }
    }
    // flush remaining buffer
    if (buffer.startsWith("data: ")) {
      const data = buffer.slice(6).trim();
      if (data && data !== "[DONE]") {
        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (typeof delta === "string") {
            content += delta;
            onChunk(delta);
          }
        } catch (_) {}
      }
    }
  } finally {
    reader.releaseLock();
  }

  return { role: "assistant", content };
}

/**
 * Stream with structured events for UI phases.
 * emit(event, data) is called with: "start" | "status" | "tool_start" | "tool_end" | "delta" | "done" | "error"
 */
async function sendStreamWithEvents(userDataPath, payload, emit) {
  const err = validateChatSend(payload);
  if (err) {
    emit("error", { error: "VALIDATION_ERROR", message: err });
    return;
  }

  const { modelProfileId, messages } = payload;
  const modelProfile = models.getModel(userDataPath, modelProfileId);
  if (!modelProfile) {
    emit("error", { error: "MODEL_NOT_FOUND", message: "Model profile not found" });
    return;
  }

  const endpoint = await endpoints.getEndpoint(userDataPath, modelProfile.endpointProfileId);
  if (!endpoint) {
    emit("error", { error: "MODEL_NOT_FOUND", message: "Endpoint not found" });
    return;
  }

  const apiKey = await keychain.getApiKey(modelProfile.endpointProfileId);
  const headers = { "Content-Type": "application/json" };
  if (apiKey && apiKey.trim()) {
    headers.Authorization = `Bearer ${apiKey.trim()}`;
  }

  emit("start", { status: "thinking" });

  const url = `${endpoint.baseUrl.replace(/\/$/, "")}/chat/completions`;
  const body = {
    model: modelProfile.modelId,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    temperature: modelProfile.temperature ?? undefined,
    max_tokens: modelProfile.maxTokens ?? undefined,
    stream: true,
  };

  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
  } catch (e) {
    emit("error", {
      error: "NETWORK_ERROR",
      message: e && (e.message || String(e)) || "Network request failed",
    });
    return;
  }

  if (res.status === 401 || res.status === 403) {
    emit("error", { error: "INVALID_API_KEY", message: "Invalid or unauthorized API key" });
    return;
  }
  if (res.status === 404) {
    emit("error", { error: "MODEL_NOT_FOUND", message: "Model or endpoint not found" });
    return;
  }
  if (res.status === 429) {
    emit("error", { error: "RATE_LIMITED", message: "Rate limited; try again later" });
    return;
  }

  if (!res.ok) {
    let message = `Request failed: ${res.status}`;
    try {
      const j = await res.json();
      if (j.error && j.error.message) message = j.error.message;
    } catch (_) {}
    emit("error", { error: "NETWORK_ERROR", message });
    return;
  }

  if (!res.body) {
    emit("error", { error: "NETWORK_ERROR", message: "No response body" });
    return;
  }

  emit("status", { status: "writing" });

  let content = "";
  let reasoningContent = "";
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  function parseDelta(parsed) {
    const choice = parsed.choices?.[0];
    if (!choice?.delta) return;
    const d = choice.delta;
    // Main assistant content (OpenAI / OpenRouter standard)
    const main = d.content;
    if (typeof main === "string") {
      content += main;
      emit("delta", { chunk: main });
    }
    // Reasoning/thinking (optional; OpenAI o1-style: thinking_content; some providers: reasoning)
    const reasoningChunk =
      typeof d.thinking_content === "string"
        ? d.thinking_content
        : typeof d.reasoning === "string"
          ? d.reasoning
          : null;
    if (reasoningChunk) {
      reasoningContent += reasoningChunk;
      emit("reasoning", { chunk: reasoningChunk });
    }
  }

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") continue;
          try {
            parseDelta(JSON.parse(data));
          } catch (_) {}
        }
      }
    }
    if (buffer.startsWith("data: ")) {
      const data = buffer.slice(6).trim();
      if (data && data !== "[DONE]") {
        try {
          parseDelta(JSON.parse(data));
        } catch (_) {}
      }
    }
  } finally {
    reader.releaseLock();
  }

  if (reasoningContent) emit("reasoning_done", {});
  emit("done", { role: "assistant", content });
}

module.exports = {
  send,
  sendStream,
  sendStreamWithEvents,
  generateTitle,
  ERROR_CODES,
};
