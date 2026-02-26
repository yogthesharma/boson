import { SettingsConfiguration } from "./SettingsConfiguration";
import { SettingsWrapper } from "./SettingsWrapper";
import { GeneralSettings } from "./GeneralSettings";
import { AppearanceSettings } from "./AppearanceSettings";
import { NotificationsSettings } from "./NotificationsSettings";
import { PersonalizationSettings } from "./PersonalizationSettings";
import { ArchivedThreadsSettings } from "./ArchivedThreadsSettings";

const SECTION_LABELS = {
  general: "General",
  configuration: "Configuration",
  personalization: "Personalization",
  "mcp-servers": "MCP Servers",
  git: "Git",
  worktrees: "Worktrees",
  environments: "Environments",
  "archived-threads": "Archived Threads",
};

export function SettingsPage({ section = "general" }) {
  const title = SECTION_LABELS[section] ?? "General";

  if (section === "configuration") {
    return (
      <SettingsWrapper>
        <SettingsConfiguration />
      </SettingsWrapper>
    );
  }

  if (section === "general") {
    return (
      <SettingsWrapper>
        <GeneralSettings />
        <AppearanceSettings />
        <NotificationsSettings />
      </SettingsWrapper>
    );
  }

  if (section === "personalization") {
    return (
      <SettingsWrapper>
        <PersonalizationSettings />
      </SettingsWrapper>
    );
  }

  if (section === "archived-threads") {
    return (
      <SettingsWrapper>
        <ArchivedThreadsSettings />
      </SettingsWrapper>
    );
  }

  return (
    <SettingsWrapper>
      <h1 className="mb-2 text-lg font-semibold text-foreground">{title}</h1>
      <p className="text-sm text-muted-foreground">
        Placeholder for {title} settings. Content coming soon.
      </p>
    </SettingsWrapper>
  );
}
