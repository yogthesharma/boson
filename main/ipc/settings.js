const { ipcMain } = require("electron/main");
const { app } = require("electron/main");
const endpoints = require("../services/endpoints");
const models = require("../services/models");
const appSettings = require("../services/appSettings");

function getUserDataPath() {
  return app.getPath("userData");
}

function register() {
  ipcMain.handle("settings:listEndpoints", () => endpoints.listEndpoints(getUserDataPath()));
  ipcMain.handle("settings:createEndpoint", (_e, input) =>
    endpoints.createEndpoint(getUserDataPath(), input)
  );
  ipcMain.handle("settings:updateEndpoint", (_e, id, patch) =>
    endpoints.updateEndpoint(getUserDataPath(), id, patch)
  );
  ipcMain.handle("settings:deleteEndpoint", (_e, id) =>
    endpoints.deleteEndpoint(getUserDataPath(), id)
  );
  ipcMain.handle("settings:saveApiKey", (_e, endpointId, apiKey) =>
    endpoints.saveApiKey(endpointId, apiKey)
  );
  ipcMain.handle("settings:clearApiKey", (_e, endpointId) => endpoints.clearApiKey(endpointId));
  ipcMain.handle("settings:testConnection", (_e, endpointId) =>
    endpoints.testConnection(getUserDataPath(), endpointId)
  );
  ipcMain.handle("settings:fetchModels", (_e, endpointId) =>
    endpoints.fetchModels(getUserDataPath(), endpointId)
  );
  ipcMain.handle("settings:listModels", () => models.listModels(getUserDataPath()));
  ipcMain.handle("settings:addModel", (_e, input) => models.addModel(getUserDataPath(), input));
  ipcMain.handle("settings:updateModel", (_e, id, patch) =>
    models.updateModel(getUserDataPath(), id, patch)
  );
  ipcMain.handle("settings:deleteModel", (_e, id) => models.deleteModel(getUserDataPath(), id));
  ipcMain.handle("settings:setDefaultModel", (_e, modelId) =>
    models.setDefaultModel(getUserDataPath(), modelId)
  );
  ipcMain.handle("settings:getModelSelection", () =>
    models.getModelSelection(getUserDataPath())
  );
  ipcMain.handle("settings:setVoiceModelId", (_e, modelId) =>
    models.setVoiceModelId(getUserDataPath(), modelId)
  );
  ipcMain.handle("settings:setImageModelId", (_e, modelId) =>
    models.setImageModelId(getUserDataPath(), modelId)
  );
  ipcMain.handle("appSettings:get", () => appSettings.getAppSettings(getUserDataPath()));
  ipcMain.handle("appSettings:set", (_e, payload) =>
    appSettings.setAppSettings(getUserDataPath(), payload)
  );
}

module.exports = { register };
