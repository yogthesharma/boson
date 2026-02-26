const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron,
  },
  ping: () => ipcRenderer.invoke("app:ping"),
  getTheme: () => ipcRenderer.invoke("get-theme"),
  getThemeSource: () => ipcRenderer.invoke("get-theme-source"),
  setTheme: (source) => ipcRenderer.invoke("set-theme", source),
  onThemeChange: (callback) => {
    const handler = (_event, theme) => callback(theme);
    ipcRenderer.on("theme-changed", handler);
    return () => ipcRenderer.removeListener("theme-changed", handler);
  },
  settings: {
    listEndpoints: () => ipcRenderer.invoke("settings:listEndpoints"),
    createEndpoint: (input) => ipcRenderer.invoke("settings:createEndpoint", input),
    updateEndpoint: (id, patch) => ipcRenderer.invoke("settings:updateEndpoint", id, patch),
    deleteEndpoint: (id) => ipcRenderer.invoke("settings:deleteEndpoint", id),
    saveApiKey: (endpointId, apiKey) => ipcRenderer.invoke("settings:saveApiKey", endpointId, apiKey),
    clearApiKey: (endpointId) => ipcRenderer.invoke("settings:clearApiKey", endpointId),
    testConnection: (endpointId) => ipcRenderer.invoke("settings:testConnection", endpointId),
    fetchModels: (endpointId) => ipcRenderer.invoke("settings:fetchModels", endpointId),
    listModels: () => ipcRenderer.invoke("settings:listModels"),
    addModel: (input) => ipcRenderer.invoke("settings:addModel", input),
    updateModel: (id, patch) => ipcRenderer.invoke("settings:updateModel", id, patch),
    deleteModel: (id) => ipcRenderer.invoke("settings:deleteModel", id),
    setDefaultModel: (modelId) => ipcRenderer.invoke("settings:setDefaultModel", modelId),
    getModelSelection: () => ipcRenderer.invoke("settings:getModelSelection"),
    setVoiceModelId: (modelId) => ipcRenderer.invoke("settings:setVoiceModelId", modelId),
    setImageModelId: (modelId) => ipcRenderer.invoke("settings:setImageModelId", modelId),
  },
  appSettings: {
    get: () => ipcRenderer.invoke("appSettings:get"),
    set: (payload) => ipcRenderer.invoke("appSettings:set", payload),
  },
  chat: {
    send: (payload) => ipcRenderer.invoke("chat:send", payload),
    startStream: (payload, threadId) => ipcRenderer.invoke("chat:startStream", payload, threadId),
    onStreamStart: (callback) => {
      const handler = (_e, data) => callback(data);
      ipcRenderer.on("chat:stream:start", handler);
      return () => ipcRenderer.removeListener("chat:stream:start", handler);
    },
    onStreamStatus: (callback) => {
      const handler = (_e, data) => callback(data);
      ipcRenderer.on("chat:stream:status", handler);
      return () => ipcRenderer.removeListener("chat:stream:status", handler);
    },
    onStreamDelta: (callback) => {
      const handler = (_e, data) => callback(data);
      ipcRenderer.on("chat:stream:delta", handler);
      return () => ipcRenderer.removeListener("chat:stream:delta", handler);
    },
    onStreamToolEvent: (callback) => {
      const startHandler = (_e, data) => callback({ type: "tool_start", ...data });
      const endHandler = (_e, data) => callback({ type: "tool_end", ...data });
      ipcRenderer.on("chat:stream:tool_start", startHandler);
      ipcRenderer.on("chat:stream:tool_end", endHandler);
      return () => {
        ipcRenderer.removeListener("chat:stream:tool_start", startHandler);
        ipcRenderer.removeListener("chat:stream:tool_end", endHandler);
      };
    },
    onStreamDone: (callback) => {
      const handler = (_e, data) => callback(data);
      ipcRenderer.on("chat:stream:done", handler);
      return () => ipcRenderer.removeListener("chat:stream:done", handler);
    },
    onStreamError: (callback) => {
      const handler = (_e, data) => callback(data);
      ipcRenderer.on("chat:stream:error", handler);
      return () => ipcRenderer.removeListener("chat:stream:error", handler);
    },
    onStreamReasoning: (callback) => {
      const handler = (_e, data) => callback(data);
      ipcRenderer.on("chat:stream:reasoning", handler);
      return () => ipcRenderer.removeListener("chat:stream:reasoning", handler);
    },
    onStreamReasoningDone: (callback) => {
      const handler = (_e, data) => callback(data);
      ipcRenderer.on("chat:stream:reasoning_done", handler);
      return () => ipcRenderer.removeListener("chat:stream:reasoning_done", handler);
    },
  },
  threads: {
    list: (projectId) => ipcRenderer.invoke("threads:list", projectId),
    listArchived: (projectId) => ipcRenderer.invoke("threads:listArchived", projectId),
    archive: (threadId) => ipcRenderer.invoke("threads:archive", threadId),
    unarchive: (threadId) => ipcRenderer.invoke("threads:unarchive", threadId),
    create: (projectId, title) => ipcRenderer.invoke("threads:create", projectId, title),
    get: (threadId) => ipcRenderer.invoke("threads:get", threadId),
    appendMessage: (threadId, message) => ipcRenderer.invoke("threads:appendMessage", threadId, message),
    sendMessage: (threadId, text, modelProfileId) =>
      ipcRenderer.invoke("threads:sendMessage", threadId, text, modelProfileId),
    sendMessageStream: (threadId, text, modelProfileId) =>
      ipcRenderer.invoke("threads:sendMessageStream", threadId, text, modelProfileId),
    onTitleUpdated: (callback) => {
      const handler = (_e, data) => callback(data);
      ipcRenderer.on("threads:titleUpdated", handler);
      return () => ipcRenderer.removeListener("threads:titleUpdated", handler);
    },
  },
  onChatStreamChunk: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on("chat:streamChunk", handler);
    return () => ipcRenderer.removeListener("chat:streamChunk", handler);
  },
  dialog: {
    showOpenDirectory: () => ipcRenderer.invoke("dialog:showOpenDirectory"),
  },
  terminal: {
    start: (options) => ipcRenderer.invoke("terminal:start", options),
    write: (input) => ipcRenderer.invoke("terminal:write", input),
    stop: () => ipcRenderer.invoke("terminal:stop"),
    onData: (callback) => {
      const handler = (_event, chunk) => callback(chunk);
      ipcRenderer.on("terminal:data", handler);
      return () => ipcRenderer.removeListener("terminal:data", handler);
    },
    onExit: (callback) => {
      const handler = (_event, payload) => callback(payload);
      ipcRenderer.on("terminal:exit", handler);
      return () => ipcRenderer.removeListener("terminal:exit", handler);
    },
  },
});
