import { useCallback, useEffect, useState, type ReactNode } from "react";
import { IconChevronRight } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

const STORAGE_PREFIX = "boson.sidebar.section.";
export type SidebarSectionActionsVisibility =
  | "default"
  | "whenExpanded"
  | "always";

function readExpanded(sectionId: string, defaultOpen: boolean): boolean {
  if (typeof window === "undefined") return defaultOpen;
  const key = STORAGE_PREFIX + sectionId.replace(/\./g, "_");
  const raw = localStorage.getItem(key);
  if (raw === null) return defaultOpen;
  return raw === "1";
}

function writeExpanded(sectionId: string, open: boolean): void {
  if (typeof window === "undefined") return;
  const key = STORAGE_PREFIX + sectionId.replace(/\./g, "_");
  localStorage.setItem(key, open ? "1" : "0");
}

/**
 * VS Code–style sidebar pane header: twisty + uppercase label + trailing toolbar.
 */
export function WorkbenchSidebarSection({
  sectionId,
  title,
  collapsible = true,
  defaultExpanded = true,
  trailing,
  showActions = "default",
  children,
  className,
  bodyClassName,
}: {
  sectionId: string;
  title: ReactNode;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  trailing?: ReactNode;
  showActions?: SidebarSectionActionsVisibility;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  const [expanded, setExpanded] = useState(() =>
    readExpanded(sectionId, defaultExpanded),
  );

  useEffect(() => {
    writeExpanded(sectionId, expanded);
  }, [sectionId, expanded]);

  const toggle = useCallback(() => {
    if (collapsible) setExpanded((e) => !e);
  }, [collapsible]);

  return (
    <div
      className={cn(
        "group/section flex min-w-0 flex-col border-t border-border/80 first:border-t-0",
        className,
      )}
    >
      <div
        data-sidebar-section-header
        role={collapsible ? "button" : undefined}
        tabIndex={collapsible ? 0 : undefined}
        aria-expanded={collapsible ? expanded : undefined}
        className={cn(
          "flex h-[22px] shrink-0 items-center gap-0.5 border-b border-border/80 bg-muted/15 pl-0.5 pr-1",
          collapsible &&
            "cursor-pointer select-none hover:bg-muted-foreground/10",
        )}
        onClick={toggle}
        onKeyDown={(e) => {
          if (!collapsible) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggle();
          }
        }}
      >
        {collapsible ? (
          <span className="text-muted-foreground flex size-5 shrink-0 items-center justify-center">
            <IconChevronRight
              size={14}
              stroke={1.75}
              className={cn(
                "transition-transform duration-150",
                expanded && "rotate-90",
              )}
              aria-hidden
            />
          </span>
        ) : (
          <span className="w-1 shrink-0" aria-hidden />
        )}
        <span className="text-muted-foreground min-w-0 flex-1 truncate text-left text-[11px] leading-none font-semibold tracking-wide uppercase">
          {title}
        </span>
        {trailing ? (
          <div
            className={cn(
              "text-muted-foreground flex shrink-0 items-center gap-0.5 transition-opacity",
              showActions === "always" && "opacity-100",
              showActions === "whenExpanded" &&
                (expanded ? "opacity-100" : "pointer-events-none opacity-0"),
              showActions === "default" &&
                "opacity-0 group-hover/section:opacity-100 group-focus-within/section:opacity-100",
            )}
            data-tauri-no-drag
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            {trailing}
          </div>
        ) : null}
      </div>
      {expanded ? (
        <div className={cn("min-h-0 min-w-0", bodyClassName)}>{children}</div>
      ) : null}
    </div>
  );
}
