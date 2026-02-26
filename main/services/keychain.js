const keytar = require("keytar");

const SERVICE = "boson.desktop";

function accountKey(endpointProfileId) {
  return `endpoint:${endpointProfileId}`;
}

async function getApiKey(endpointProfileId) {
  return keytar.getPassword(SERVICE, accountKey(endpointProfileId));
}

async function setApiKey(endpointProfileId, apiKey) {
  await keytar.setPassword(SERVICE, accountKey(endpointProfileId), apiKey);
}

async function deleteApiKey(endpointProfileId) {
  return keytar.deletePassword(SERVICE, accountKey(endpointProfileId));
}

module.exports = {
  getApiKey,
  setApiKey,
  deleteApiKey,
};
