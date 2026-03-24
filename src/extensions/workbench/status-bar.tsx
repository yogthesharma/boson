import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { IconDots } from "@tabler/icons-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { executeCommand } from "@/extensions/commands/command-service";
import { useEditorSession } from "@/editor/editor-session-context";
import { workbenchStatusBarRegistry } from "./registry";
import { useRegistrySubscription } from "./use-registry-subscription";
import { useWorkbenchState } from "./workbench-state";
import type { StatusBarItemContribution, StatusBarVisibilityContext } from "./types";

function StatusBarItem({
  children,
  alignRight = false,
  interactive = false,
  title,
  ariaLabel,
  onActivate,
}: {
  children: ReactNode;
  alignRight?: boolean;
  interactive?: boolean;
  title?: string;
  ariaLabel?: string;
  onActivate?: () => void;
}) {
  const baseClass = cn(
    "inline-flex h-5 max-w-full items-center rounded-sm px-1.5",
    "transition-colors duration-100",
    interactive
      ? "cursor-pointer hover:bg-muted-foreground/20"
      : "hover:bg-muted-foreground/20",
    "focus-visible:bg-muted-foreground/25 focus-visible:outline-none",
    alignRight ? "justify-end" : "justify-start",
  );

  if (interactive) {
    return (
      <button
        type="button"
        className={baseClass}
        title={title}
        aria-label={ariaLabel ?? title}
        onClick={onActivate}
      >
        <span className="min-w-0 truncate">{children}</span>
      </button>
    );
  }

  return (
    <span className={baseClass} title={title}>
      <span className="min-w-0 truncate">{children}</span>
    </span>
  );
}

function sortStatusItems(a: StatusBarItemContribution, b: StatusBarItemContribution): number {
  if (a.order !== b.order) return a.order - b.order;
  return (b.priority ?? 0) - (a.priority ?? 0);
}

function resolveItemContent(item: StatusBarItemContribution): ReactNode {
  if (item.render) return item.render();
  return item.label ?? null;
}

function resolveAriaLabel(item: StatusBarItemContribution): string | undefined {
  if (item.label && item.label.trim()) return item.label;
  if (item.tooltip && item.tooltip.trim()) return item.tooltip;
  return undefined;
}

function fitByPriority(items: StatusBarItemContribution[], maxCount: number): StatusBarItemContribution[] {
  if (items.length <= maxCount) return items;
  const selected = [...items]
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
    .slice(0, Math.max(0, maxCount));
  const selectedIds = new Set(selected.map((i) => i.id));
  return items.filter((i) => selectedIds.has(i.id));
}

function runStatusCommand(item: StatusBarItemContribution) {
  if (!item.commandId) return;
  void executeCommand(item.commandId);
}

export function WorkbenchStatusBar() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  const { activeFilePath } = useEditorSession();
  const {
    state: { panelVisible, primarySidebarVisible, auxiliaryBarVisible },
  } = useWorkbenchState();
  const items = useRegistrySubscription(workbenchStatusBarRegistry.subscribe, () =>
    workbenchStatusBarRegistry.get(),
  );

  const visibilityContext = useMemo<StatusBarVisibilityContext>(
    () => ({
      hasActiveEditor: Boolean(activeFilePath),
      panelVisible,
      primarySidebarVisible,
      auxiliaryBarVisible,
    }),
    [activeFilePath, panelVisible, primarySidebarVisible, auxiliaryBarVisible],
  );

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const sync = () => setWidth(el.clientWidth);
    sync();
    const obs = new ResizeObserver(sync);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const left = useMemo(
    () =>
      [...items]
        .filter(
          (i) =>
            i.alignment === "left" &&
            (i.when ? i.when(visibilityContext) : true) &&
            (!i.minVisibleWidth || width >= i.minVisibleWidth),
        )
        .sort(sortStatusItems),
    [items, width, visibilityContext],
  );
  const right = useMemo(
    () => {
      const visible = [...items]
        .filter(
          (i) =>
            i.alignment === "right" &&
            (i.when ? i.when(visibilityContext) : true) &&
            (!i.minVisibleWidth || width >= i.minVisibleWidth),
        )
        .sort(sortStatusItems);

      const maxCount =
        width < 620 ? 2 :
        width < 760 ? 3 :
        width < 920 ? 4 :
        width < 1080 ? 5 :
        Number.POSITIVE_INFINITY;

      return fitByPriority(visible, maxCount);
    },
    [items, width, visibilityContext],
  );

  const overflowItems = useMemo(() => {
    const allVisibleRight = [...items]
      .filter(
        (i) =>
          i.alignment === "right" &&
          (i.when ? i.when(visibilityContext) : true) &&
          (!i.minVisibleWidth || width >= i.minVisibleWidth),
      )
      .sort(sortStatusItems);
    const visibleIds = new Set(right.map((i) => i.id));
    return allVisibleRight.filter((i) => !visibleIds.has(i.id));
  }, [items, right, visibilityContext, width]);

  return (
    <div
      ref={rootRef}
      role="status"
      aria-live="polite"
      aria-label="Status bar"
      className="flex h-[22px] shrink-0 items-center border-t border-border bg-muted px-1.5 text-[11px] text-foreground"
    >
      <div className="flex min-w-0 flex-1 items-center gap-0.5">
        {left.map((item) => (
          <StatusBarItem
            key={item.id}
            interactive={Boolean(item.commandId)}
            title={item.tooltip}
            ariaLabel={resolveAriaLabel(item)}
            onActivate={
              item.commandId
                ? () => runStatusCommand(item)
                : undefined
            }
          >
            {resolveItemContent(item)}
          </StatusBarItem>
        ))}
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        {right.map((item) => (
          <StatusBarItem
            key={item.id}
            alignRight
            interactive={Boolean(item.commandId)}
            title={item.tooltip}
            ariaLabel={resolveAriaLabel(item)}
            onActivate={
              item.commandId
                ? () => runStatusCommand(item)
                : undefined
            }
          >
            {resolveItemContent(item)}
          </StatusBarItem>
        ))}
        {overflowItems.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex h-5 w-5 items-center justify-center rounded-sm text-foreground hover:bg-muted-foreground/20 focus-visible:bg-muted-foreground/25 focus-visible:outline-none"
                title="More status items"
                aria-label="More status items"
              >
                <IconDots size={12} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {overflowItems.map((item) => (
                <DropdownMenuItem
                  key={item.id}
                  disabled={!item.commandId}
                  onSelect={() => runStatusCommand(item)}
                >
                  {item.label ?? item.tooltip ?? item.id}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </div>
  );
}
