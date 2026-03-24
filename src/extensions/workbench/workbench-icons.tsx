import type { ComponentType } from "react";
import {
  IconBrandGit,
  IconBug,
  IconFolder,
  IconPuzzle,
  IconSearch,
} from "@tabler/icons-react";
import type { WorkbenchActivityIconId } from "./types";

export const WORKBENCH_ACTIVITY_ICONS: Record<
  WorkbenchActivityIconId,
  ComponentType<{ size?: number | string; className?: string }>
> = {
  files: IconFolder,
  search: IconSearch,
  debug: IconBug,
  git: IconBrandGit,
  extensions: IconPuzzle,
};
