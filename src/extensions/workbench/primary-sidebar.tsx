import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Button } from "@/components/ui/button";
import { WorkbenchSidebarSection } from "@/components/workbench/workbench-sidebar-section";
import { cn } from "@/lib/utils";
import {
  workbenchViewContainerRegistry,
  workbenchViewRegistry,
} from "./registry";
import { useRegistrySubscription } from "./use-registry-subscription";
import { useWorkbenchState } from "./workbench-state";
import { WORKBENCH_ACTIVITY_ICONS } from "./workbench-icons";

const SIDEBAR_WIDTH_KEY = "boson.workbench.primarySidebar.width";
const SIDEBAR_MIN_WIDTH = 220;
const SIDEBAR_MAX_WIDTH = 560;

function readSidebarWidth(): number {
  if (typeof window === "undefined") return 240;
  const raw = Number(window.localStorage.getItem(SIDEBAR_WIDTH_KEY));
  if (!Number.isFinite(raw)) return 240;
  return Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, raw));
}

export function PrimarySidebar() {
  const { state, dispatch } = useWorkbenchState();
  const [sidebarWidth, setSidebarWidth] = useState<number>(() =>
    readSidebarWidth(),
  );
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startWidth: number;
  } | null>(null);
  const containers = useRegistrySubscription(
    workbenchViewContainerRegistry.subscribe,
    () =>
      [...workbenchViewContainerRegistry.get()].sort(
        (a, b) => a.order - b.order,
      ),
  );
  const allViews = useRegistrySubscription(
    workbenchViewRegistry.subscribe,
    () => workbenchViewRegistry.get(),
  );

  const primaryViews = useMemo(
    () =>
      [...allViews]
        .filter(
          (v) =>
            v.location === "primary" &&
            v.containerId === state.activeActivityId,
        )
        .sort((a, b) => a.order - b.order),
    [allViews, state.activeActivityId],
  );

  const activeContainer = containers.find(
    (c) => c.id === state.activeActivityId,
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      SIDEBAR_WIDTH_KEY,
      String(Math.round(sidebarWidth)),
    );
  }, [sidebarWidth]);

  const onResizerPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startWidth: sidebarWidth,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onResizerPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const next = drag.startWidth + (e.clientX - drag.startX);
    setSidebarWidth(
      Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, next)),
    );
  };

  const onResizerPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    dragRef.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const onResizerKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 32 : 16;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      setSidebarWidth((w) => Math.max(SIDEBAR_MIN_WIDTH, w - step));
      return;
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      setSidebarWidth((w) => Math.min(SIDEBAR_MAX_WIDTH, w + step));
      return;
    }
    if (e.key === "Home") {
      e.preventDefault();
      setSidebarWidth(SIDEBAR_MIN_WIDTH);
      return;
    }
    if (e.key === "End") {
      e.preventDefault();
      setSidebarWidth(SIDEBAR_MAX_WIDTH);
    }
  };

  return (
    <div
      className="relative flex min-h-0 shrink-0 flex-col self-stretch border-r border-border bg-background"
      style={{ width: `${sidebarWidth}px` }}
    >
      <div
        className="flex items-center justify-center h-11 shrink-0 items-center gap-0.5 border-b border-border px-1.5 py-1"
        data-tauri-no-drag
      >
        {containers.map((c) => {
          const Icon = WORKBENCH_ACTIVITY_ICONS[c.iconId];
          const active = state.activeActivityId === c.id;
          return (
            <Button
              key={c.id}
              type="button"
              variant="ghost"
              size="icon-sm"
              title={c.title}
              aria-label={c.title}
              aria-pressed={active}
              className={cn(
                "shrink-0",
                active && "bg-muted-foreground/15 text-foreground",
              )}
              onClick={() => dispatch({ type: "setActiveActivity", id: c.id })}
            >
              <Icon size={17} />
            </Button>
          );
        })}
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        {primaryViews.length === 0 ? (
          <>
            <div className="flex h-8 shrink-0 items-center border-b border-border px-3 text-sm font-medium text-muted-foreground">
              {activeContainer?.title ?? "Sidebar"}
            </div>
            <div className="text-muted-foreground p-3 text-sm">
              No views contributed.
            </div>
          </>
        ) : (
          primaryViews.map((view) => {
            const compact = view.sectionLayout === "compact";
            const label = view.title.trim();

            if (label) {
              return (
                <WorkbenchSidebarSection
                  key={view.id}
                  sectionId={view.id}
                  title={label}
                  trailing={view.sidebarHeaderActions?.()}
                  showActions="whenExpanded"
                  className={cn(compact ? "shrink-0" : "min-h-0 flex-1")}
                  bodyClassName={cn(
                    compact
                      ? "max-h-28 overflow-y-auto"
                      : "min-h-0 flex-1 overflow-auto",
                  )}
                >
                  {view.render()}
                </WorkbenchSidebarSection>
              );
            }

            return (
              <div
                key={view.id}
                className={cn(
                  "flex min-h-0 min-w-0 flex-col",
                  compact ? "shrink-0" : "flex-1",
                )}
              >
                {view.render()}
              </div>
            );
          })
        )}
      </div>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize primary sidebar"
        aria-valuemin={SIDEBAR_MIN_WIDTH}
        aria-valuemax={SIDEBAR_MAX_WIDTH}
        aria-valuenow={Math.round(sidebarWidth)}
        tabIndex={0}
        className="absolute top-0 right-[-2px] h-full w-1.5 cursor-col-resize bg-transparent hover:bg-border/60"
        onPointerDown={onResizerPointerDown}
        onPointerMove={onResizerPointerMove}
        onPointerUp={onResizerPointerUp}
        onPointerCancel={onResizerPointerUp}
        onKeyDown={onResizerKeyDown}
      />
    </div>
  );
}
