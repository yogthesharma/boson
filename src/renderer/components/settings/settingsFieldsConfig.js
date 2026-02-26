/**
 * Metadata for the dynamic Settings UI. Labels/descriptions match reference design.
 * Keep in sync with main/settings/settingsSchema.js.
 */

export const GENERAL_FIELDS = [
  {
    key: "defaultOpenDestination",
    label: "Default open destination",
    description: "Where files and folders open by default",
    type: "enum",
    options: [
      { value: "cursor", label: "Cursor" },
      { value: "thread_detail", label: "Thread detail" },
    ],
  },
  {
    key: "threadOutputMode",
    label: "Thread detail",
    description: "Choose how much command output to show in threads",
    type: "enum",
    options: [
      { value: "steps_with_code_commands", label: "Steps with code commands" },
      { value: "full", label: "Full" },
    ],
  },
  {
    key: "preventSleepWhileRunning",
    label: "Prevent sleep while running",
    description: "Keep your computer awake while Codex is running a thread.",
    type: "boolean",
  },
  {
    key: "requireCmdEnterForMultiline",
    label: "Require ⌘ + enter to send long prompts",
    description: "When enabled, multiline prompts require ⌘ + enter to send.",
    type: "boolean",
  },
  {
    key: "followUpBehavior",
    label: "Follow-up behavior",
    description:
      "Queue follow-ups while Codex runs or steer the current run. Press ⇧⌘Enter to do the opposite for one message.",
    type: "segmented",
    options: [
      { value: "queue", label: "Queue" },
      { value: "steer", label: "Steer" },
    ],
  },
  {
    key: "showReasoning",
    label: "Show reasoning / thinking",
    description:
      "When enabled, show reasoning or chain-of-thought output from models that support it (e.g. o1, o3) while the response is streaming.",
    type: "boolean",
  },
];

export const APPEARANCE_FIELDS = [
  {
    key: "theme",
    label: "Theme",
    description: "Use light, dark, or match your system",
    type: "theme",
    options: [
      { value: "light", label: "Light" },
      { value: "dark", label: "Dark" },
      { value: "system", label: "System" },
    ],
  },
  {
    key: "opaqueWindowBackground",
    label: "Use opaque window background",
    description: "Make windows use a solid background rather than system translucency",
    type: "boolean",
  },
  {
    key: "pointerCursors",
    label: "Use pointer cursors",
    description: "Change the cursor to a pointer when hovering over interactive elements",
    type: "boolean",
  },
  {
    key: "sansFont",
    label: "Sans font family",
    description: "Adjust the font used for the Codex UI",
    type: "font",
    sizeKey: "sansFontSizePx",
    familyKey: "sansFontFamily",
    min: 10,
    max: 24,
  },
  {
    key: "codeFont",
    label: "Code font",
    description: "Adjust font and size used for code across chats and diffs",
    type: "font",
    sizeKey: "codeFontSizePx",
    familyKey: "codeFontFamily",
    min: 10,
    max: 24,
  },
];

export const NOTIFICATIONS_FIELDS = [
  {
    key: "completionNotifications",
    label: "Turn completion notifications",
    description: "Set when Codex alerts you that it's finished",
    type: "enum",
    options: [
      { value: "always", label: "Always" },
      { value: "only_when_unfocused", label: "Only when unfocused" },
      { value: "never", label: "Never" },
    ],
  },
  {
    key: "permissionNotifications",
    label: "Enable permission notifications",
    description: "Show alerts when notification permissions are required",
    type: "checkbox",
  },
];
