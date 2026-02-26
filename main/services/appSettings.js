const store = require("./store");
const { getDefaults, migrate, CURRENT_SETTINGS_VERSION } = require("../settings/settingsSchema");

function getAppSettings(userDataPath) {
  try {
    const data = store.read(userDataPath);
    const app = migrate(data);
    return Promise.resolve(app);
  } catch (_) {
    return Promise.resolve(getDefaults());
  }
}

function setAppSettings(userDataPath, payload) {
  const data = store.read(userDataPath);
  const current = migrate(data);
  const next = {
    ...current,
    ...payload,
    general: { ...current.general, ...(payload.general ?? {}) },
    appearance: { ...current.appearance, ...(payload.appearance ?? {}) },
    notifications: { ...current.notifications, ...(payload.notifications ?? {}) },
    personalization: { ...current.personalization, ...(payload.personalization ?? {}) },
  };
  next.settingsVersion = CURRENT_SETTINGS_VERSION;
  const { parseOrDefaults } = require("../settings/settingsSchema");
  const validated = parseOrDefaults(next);
  data.appSettings = validated;
  store.write(userDataPath, data);
  return Promise.resolve(validated);
}

module.exports = {
  getAppSettings,
  setAppSettings,
  getDefaults,
};
