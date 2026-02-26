import { create } from "zustand";

const initial = {
  general: {
    defaultOpenDestination: "cursor",
    threadOutputMode: "steps_with_code_commands",
    preventSleepWhileRunning: true,
    requireCmdEnterForMultiline: false,
    followUpBehavior: "queue",
    showReasoning: false,
  },
  appearance: {
    theme: "system",
    opaqueWindowBackground: false,
    pointerCursors: true,
    sansFontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    sansFontSizePx: 13,
    codeFontFamily: 'ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace',
    codeFontSizePx: 12,
  },
  notifications: {
    completionNotifications: "only_when_unfocused",
    permissionNotifications: true,
  },
  personalization: {
    personality: "pragmatic",
    customInstructions: "",
  },
};

export const useSettingsStore = create((set, get) => ({
  ...initial,
  _loaded: false,

  load: async () => {
    try {
      const data = await window.api.appSettings.get();
      if (data && typeof data === "object") {
        set({
          general: { ...initial.general, ...data.general },
          appearance: { ...initial.appearance, ...data.appearance },
          notifications: { ...initial.notifications, ...data.notifications },
          personalization: { ...initial.personalization, ...data.personalization },
          _loaded: true,
        });
      } else {
        set({ _loaded: true });
      }
    } catch {
      set({ _loaded: true });
    }
  },

  setGeneral: (patch) => {
    const next = { ...get().general, ...patch };
    set({ general: next });
    persist({ general: next });
  },

  setAppearance: (patch) => {
    const next = { ...get().appearance, ...patch };
    set({ appearance: next });
    persist({ appearance: next });
  },

  setNotifications: (patch) => {
    const next = { ...get().notifications, ...patch };
    set({ notifications: next });
    persist({ notifications: next });
  },

  setPersonalization: (patch) => {
    const next = { ...get().personalization, ...patch };
    set({ personalization: next });
    persist({ personalization: next });
  },

  setAll: (payload) => {
    set(payload);
    persist(payload);
  },
}));

async function persist(payload) {
  try {
    await window.api.appSettings.set(payload);
  } catch (_) {}
}
