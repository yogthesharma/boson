export type {
  ViewContainerContribution,
  WorkbenchAction,
  WorkbenchActivityIconId,
  WorkbenchState,
  WorkbenchViewContribution,
  WorkbenchViewLocation,
  StatusBarItemContribution,
} from "./types";
export {
  workbenchViewContainerRegistry,
  workbenchViewRegistry,
  workbenchStatusBarRegistry,
  getViewsForLocation,
  getAuxiliaryViews,
  getPanelViews,
} from "./registry";
export { WorkbenchProvider } from "./workbench-provider";
export { WorkbenchLayout } from "./workbench-layout";
export { useWorkbenchState } from "./workbench-state";
export { registerBuiltinWorkbenchContributions } from "./builtin";
