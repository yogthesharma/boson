import type { ReactNode } from "react";

export type TitlebarGroup = "center" | "end";

export type TitlebarCommandContribution = {
  kind: "command";
  id: string;
  group: TitlebarGroup;
  order: number;
  command: string;
  icon: TitlebarIconId;
  ariaLabel?: string;
};

export type TitlebarCustomContribution = {
  kind: "custom";
  id: string;
  group: TitlebarGroup;
  order: number;
  render: () => ReactNode;
};

export type TitlebarContribution =
  | TitlebarCommandContribution
  | TitlebarCustomContribution;

export type TitlebarIconId =
  | "chevronLeft"
  | "chevronRight"
  | "layoutBottom"
  | "layoutLeft"
  | "layoutRight";
