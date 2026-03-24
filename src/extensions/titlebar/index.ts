export type {
  TitlebarCommandContribution,
  TitlebarContribution,
  TitlebarCustomContribution,
  TitlebarGroup,
  TitlebarIconId,
} from "./types";
export {
  registerCommand,
  unregisterCommand,
  executeCommand,
} from "@/extensions/commands/command-service";
export {
  registerTitlebarContribution,
  unregisterTitlebarContribution,
  getTitlebarContributions,
  subscribeTitlebarContributions,
} from "./registry";
export {
  TitlebarExtensionProvider,
  useTitlebarExtensions,
  useOptionalTitlebarExtensions,
  type TitlebarExtensionApi,
} from "./titlebar-extension-provider";
export { TitlebarContributionList, useTitlebarContributionsForGroup } from "./titlebar-contribution";
