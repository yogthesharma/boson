import type { ComponentType } from "react";
import {
  IconChevronLeft,
  IconChevronRight,
  IconLayoutBottombarFilled,
  IconLayoutSidebarFilled,
  IconLayoutSidebarRightFilled,
} from "@tabler/icons-react";
import type { TitlebarIconId } from "./types";

export const TITLEBAR_ICONS: Record<
  TitlebarIconId,
  ComponentType<{ size?: number | string }>
> = {
  chevronLeft: IconChevronLeft,
  chevronRight: IconChevronRight,
  layoutBottom: IconLayoutBottombarFilled,
  layoutLeft: IconLayoutSidebarFilled,
  layoutRight: IconLayoutSidebarRightFilled,
};
