import type { ReactNode } from "react";

export type WorkbenchActivityIconId =
  | "files"
  | "search"
  | "debug"
  | "git"
  | "extensions";

export type ViewContainerContribution = {
  id: string;
  order: number;
  title: string;
  iconId: WorkbenchActivityIconId;
};

export type WorkbenchViewLocation = "primary" | "auxiliary" | "panel";

export type WorkbenchViewContribution = {
  id: string;
  location: WorkbenchViewLocation;
  /** Primary: matches `ViewContainerContribution.id`. Auxiliary/panel: logical group id. */
  containerId: string;
  order: number;
  title: string;
  render: () => ReactNode;
  /**
   * Primary sidebar: `compact` = only as tall as content (capped, scroll inside).
   * `fill` or omitted = grows to use remaining sidebar height (default).
   */
  sectionLayout?: "compact" | "fill";
  /** Icons / actions on the right of the collapsible section header (VS Code view toolbar). */
  sidebarHeaderActions?: () => ReactNode;
};

export type StatusBarItemContribution = {
  id: string;
  alignment: "left" | "right";
  order: number;
  /** Optional text label for simple status items. */
  label?: string;
  /** Optional tooltip text for hover affordance. */
  tooltip?: string;
  /** Optional command id to execute on click/keyboard activation. */
  commandId?: string;
  /** Optional priority for tie-break ordering within same `order`. Higher first. */
  priority?: number;
  /** Hide the item when status bar width is below this threshold. */
  minVisibleWidth?: number;
  /** Optional custom renderer for advanced item UIs. */
  render?: () => ReactNode;
};

export type WorkbenchState = {
  primarySidebarVisible: boolean;
  auxiliaryBarVisible: boolean;
  panelVisible: boolean;
  activeActivityId: string;
};

export type WorkbenchAction =
  | { type: "togglePrimarySidebar" }
  | { type: "toggleAuxiliaryBar" }
  | { type: "togglePanel" }
  | { type: "setActiveActivity"; id: string };
