import { ThemeToggler } from "@/components/widgets/title-bar/theme-picker";
import { registerCommand } from "@/extensions/commands/command-service";
import { registerTitlebarContribution } from "./registry";
import { TitlebarOmnibox } from "./omnibox";

let registered = false;

export function registerBuiltinTitlebarContributions(): void {
  if (registered) {
    return;
  }
  registered = true;

  registerCommand("boson.nav.back", () => {});
  registerCommand("boson.nav.forward", () => {});

  registerTitlebarContribution({
    kind: "command",
    id: "boson.titlebar.navBack",
    group: "center",
    order: 10,
    command: "boson.nav.back",
    icon: "chevronLeft",
    ariaLabel: "Go back",
  });

  registerTitlebarContribution({
    kind: "command",
    id: "boson.titlebar.navForward",
    group: "center",
    order: 20,
    command: "boson.nav.forward",
    icon: "chevronRight",
    ariaLabel: "Go forward",
  });

  registerTitlebarContribution({
    kind: "custom",
    id: "boson.titlebar.omnibox",
    group: "center",
    order: 30,
    render: () => <TitlebarOmnibox />,
  });

  registerTitlebarContribution({
    kind: "command",
    id: "boson.titlebar.layoutBottom",
    group: "end",
    order: 10,
    command: "boson.layout.toggleBottom",
    icon: "layoutBottom",
    ariaLabel: "Toggle bottom panel",
  });

  registerTitlebarContribution({
    kind: "command",
    id: "boson.titlebar.layoutLeft",
    group: "end",
    order: 20,
    command: "boson.layout.toggleLeft",
    icon: "layoutLeft",
    ariaLabel: "Toggle left sidebar",
  });

  registerTitlebarContribution({
    kind: "command",
    id: "boson.titlebar.layoutRight",
    group: "end",
    order: 30,
    command: "boson.layout.toggleRight",
    icon: "layoutRight",
    ariaLabel: "Toggle right sidebar",
  });

  registerTitlebarContribution({
    kind: "custom",
    id: "boson.titlebar.theme",
    group: "end",
    order: 40,
    render: () => <ThemeToggler />,
  });
}
