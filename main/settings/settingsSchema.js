const { z } = require("zod");

const CURRENT_SETTINGS_VERSION = 1;

const SettingsSchema = z.object({
  settingsVersion: z.number().int().min(1).default(CURRENT_SETTINGS_VERSION),
  general: z.object({
    defaultOpenDestination: z.enum(["cursor", "thread_detail"]).default("cursor"),
    threadOutputMode: z
      .enum(["steps_with_code_commands", "full"])
      .default("steps_with_code_commands"),
    preventSleepWhileRunning: z.boolean().default(true),
    requireCmdEnterForMultiline: z.boolean().default(false),
    followUpBehavior: z.enum(["queue", "steer"]).default("queue"),
    showReasoning: z.boolean().default(false),
  }),
  appearance: z.object({
    theme: z.enum(["light", "dark", "system"]).default("system"),
    opaqueWindowBackground: z.boolean().default(false),
    pointerCursors: z.boolean().default(true),
    sansFontFamily: z
      .string()
      .default('-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'),
    sansFontSizePx: z.number().int().min(10).max(24).default(13),
    codeFontFamily: z
      .string()
      .default('ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace'),
    codeFontSizePx: z.number().int().min(10).max(24).default(12),
  }),
  notifications: z.object({
    completionNotifications: z
      .enum(["always", "only_when_unfocused", "never"])
      .default("only_when_unfocused"),
    permissionNotifications: z.boolean().default(true),
  }),
  personalization: z.object({
    personality: z
      .enum(["pragmatic", "friendly", "concise"])
      .default("pragmatic"),
    customInstructions: z.string().default(""),
  }),
});

function getDefaults() {
  return SettingsSchema.parse({
    settingsVersion: CURRENT_SETTINGS_VERSION,
    general: {},
    appearance: {},
    notifications: {},
    personalization: {},
  });
}

function parseOrDefaults(raw) {
  const result = SettingsSchema.safeParse(raw);
  if (result.success) return result.data;
  return getDefaults();
}

function migrate(data) {
  const app = data.appSettings ?? {};
  const version = typeof app.settingsVersion === "number" ? app.settingsVersion : 0;
  if (version < 1) {
    const merged = parseOrDefaults(app);
    return { ...merged, settingsVersion: 1 };
  }
  return parseOrDefaults(app);
}

module.exports = {
  SettingsSchema,
  getDefaults,
  parseOrDefaults,
  migrate,
  CURRENT_SETTINGS_VERSION,
};
