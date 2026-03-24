import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { IconPlus, IconTrash, IconX } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { registerCommand, unregisterCommand } from "@/extensions/commands/command-service";
import { clearOutputLines } from "@/components/workbench/panel-output-view";
import { clearTerminalSessions, createTerminalSession } from "@/components/workbench/terminal-view";
import { cn } from "@/lib/utils";
import { workbenchViewRegistry } from "./registry";
import { useRegistrySubscription } from "./use-registry-subscription";
import { useWorkbenchState } from "./workbench-state";

const PANEL_TAB_KEY = "boson.panel.activeTabId";
const PANEL_HEIGHT_KEY = "boson.panel.height";
const PANEL_DEFAULT_HEIGHT = 224;
const PANEL_MIN_HEIGHT = 160;
const PANEL_MAX_HEIGHT = 520;

export function WorkbenchPanel() {
  const { dispatch } = useWorkbenchState();
  const allViews = useRegistrySubscription(workbenchViewRegistry.subscribe, () =>
    workbenchViewRegistry.get(),
  );

  const panelViews = useMemo(
    () =>
      [...allViews].filter((v) => v.location === "panel").sort((a, b) => a.order - b.order),
    [allViews],
  );

  const [tabIndex, setTabIndex] = useState(0);
  const [panelHeight, setPanelHeight] = useState<number>(() => {
    if (typeof window === "undefined") return PANEL_DEFAULT_HEIGHT;
    const raw = Number.parseInt(localStorage.getItem(PANEL_HEIGHT_KEY) ?? "", 10);
    if (Number.isNaN(raw)) return PANEL_DEFAULT_HEIGHT;
    return Math.max(PANEL_MIN_HEIGHT, Math.min(PANEL_MAX_HEIGHT, raw));
  });
  const defaultTabApplied = useRef(false);
  const dragStartRef = useRef<{ y: number; h: number } | null>(null);
  const headerButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (panelViews.length === 0) {
      return;
    }
    setTabIndex((i) => {
      if (i >= panelViews.length) {
        return panelViews.length - 1;
      }
      return i;
    });
  }, [panelViews]);

  useEffect(() => {
    if (defaultTabApplied.current || panelViews.length === 0) {
      return;
    }
    const saved = typeof window !== "undefined" ? localStorage.getItem(PANEL_TAB_KEY) : null;
    const savedIdx = saved ? panelViews.findIndex((v) => v.id === saved) : -1;
    if (savedIdx >= 0) {
      setTabIndex(savedIdx);
      defaultTabApplied.current = true;
      return;
    }
    const terminalIdx = panelViews.findIndex((v) => v.id === "workbench.views.terminal");
    if (terminalIdx >= 0) {
      setTabIndex(terminalIdx);
    }
    defaultTabApplied.current = true;
  }, [panelViews]);

  useEffect(() => {
    const active = panelViews[tabIndex];
    if (!active || typeof window === "undefined") return;
    localStorage.setItem(PANEL_TAB_KEY, active.id);
  }, [panelViews, tabIndex]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(PANEL_HEIGHT_KEY, String(panelHeight));
  }, [panelHeight]);

  if (panelViews.length === 0) {
    return null;
  }

  const showTabs = panelViews.length > 1;
  const active = panelViews[tabIndex] ?? panelViews[0];
  const activePanelId = active?.id ?? "";

  useEffect(() => {
    registerCommand("boson.panel.close", () => {
      dispatch({ type: "togglePanel" });
    });
    registerCommand("boson.panel.newTerminal", () => {
      createTerminalSession();
    });
    registerCommand("boson.panel.clearActive", () => {
      if (activePanelId === "workbench.views.terminal") {
        clearTerminalSessions();
        return;
      }
      if (activePanelId === "workbench.views.output") {
        clearOutputLines();
      }
    });
    return () => {
      unregisterCommand("boson.panel.close");
      unregisterCommand("boson.panel.newTerminal");
      unregisterCommand("boson.panel.clearActive");
    };
  }, [activePanelId, dispatch]);

  const onResizeStart = (event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragStartRef.current = { y: event.clientY, h: panelHeight };
    const onMove = (e: globalThis.MouseEvent) => {
      const start = dragStartRef.current;
      if (!start) return;
      const delta = start.y - e.clientY;
      const next = Math.max(PANEL_MIN_HEIGHT, Math.min(PANEL_MAX_HEIGHT, start.h + delta));
      setPanelHeight(next);
    };
    const onUp = () => {
      dragStartRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const onTabKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!showTabs) return;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      const next = (tabIndex + 1) % panelViews.length;
      setTabIndex(next);
      headerButtonRefs.current[next]?.focus();
      return;
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      const next = (tabIndex - 1 + panelViews.length) % panelViews.length;
      setTabIndex(next);
      headerButtonRefs.current[next]?.focus();
      return;
    }
    if (e.key === "Home") {
      e.preventDefault();
      setTabIndex(0);
      headerButtonRefs.current[0]?.focus();
      return;
    }
    if (e.key === "End") {
      e.preventDefault();
      const last = panelViews.length - 1;
      setTabIndex(last);
      headerButtonRefs.current[last]?.focus();
    }
  };

  return (
    <div
      className="flex shrink-0 flex-col border-t border-border bg-muted"
      style={{ height: `${panelHeight}px` }}
      data-tauri-no-drag
    >
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize panel"
        className="h-1 shrink-0 cursor-row-resize bg-transparent hover:bg-muted-foreground/20"
        onMouseDown={onResizeStart}
      />
      {showTabs ? (
        <div
          className="group/paneltabs flex h-8 shrink-0 items-end gap-0 border-b border-border bg-muted px-1 pt-1"
          role="tablist"
          aria-label="Panel"
          onKeyDown={onTabKeyDown}
        >
          {panelViews.map((v, i) => {
            const selected = i === tabIndex;
            const tabId = `panel-tab-${v.id}`;
            const panelId = `panel-view-${v.id}`;
            return (
              <button
                key={v.id}
                type="button"
                role="tab"
                id={tabId}
                aria-controls={panelId}
                aria-selected={selected}
                tabIndex={selected ? 0 : -1}
                ref={(el) => {
                  headerButtonRefs.current[i] = el;
                }}
                className={cn(
                  "relative rounded-t-sm px-3 pb-1.5 pt-1 text-[11px] font-medium tracking-wide transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                  selected
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground/90 hover:bg-muted-foreground/8 hover:text-foreground",
                )}
                onClick={() => setTabIndex(i)}
              >
                {v.title}
                {selected ? (
                  <span
                    aria-hidden
                    className="absolute inset-x-1 bottom-0 h-px rounded bg-primary/80"
                  />
                ) : null}
              </button>
            );
          })}
          <div
            className="ml-auto flex items-center gap-0.5 border-l border-border/70 pb-1 pl-1 pr-0.5 opacity-75 transition-opacity group-hover/paneltabs:opacity-100 group-focus-within/paneltabs:opacity-100"
            data-tauri-no-drag
          >
            {activePanelId === "workbench.views.terminal" ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="h-5 w-5 text-muted-foreground hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring/60"
                title="New Terminal"
                aria-label="New Terminal"
                onClick={createTerminalSession}
              >
                <IconPlus size={12} />
              </Button>
            ) : null}
            {(activePanelId === "workbench.views.terminal" || activePanelId === "workbench.views.output") ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="h-5 w-5 text-muted-foreground hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring/60"
                title="Clear"
                aria-label="Clear"
                onClick={() => {
                  if (activePanelId === "workbench.views.terminal") {
                    clearTerminalSessions();
                    return;
                  }
                  if (activePanelId === "workbench.views.output") {
                    clearOutputLines();
                  }
                }}
              >
                <IconTrash size={12} />
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="h-5 w-5 text-muted-foreground hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring/60"
              title="Close Panel"
              aria-label="Close Panel"
              onClick={() => dispatch({ type: "togglePanel" })}
            >
              <IconX size={12} />
            </Button>
          </div>
        </div>
      ) : panelViews[0].title.trim() ? (
        <div className="flex h-8 shrink-0 items-center border-b border-border px-3 text-sm font-medium">
          {panelViews[0].title}
        </div>
      ) : null}

      <div
        id={`panel-view-${activePanelId}`}
        role="tabpanel"
        aria-labelledby={showTabs ? `panel-tab-${activePanelId}` : undefined}
        className="min-h-0 flex-1 overflow-hidden bg-background"
      >
        {active ? <div className="h-full min-h-0 overflow-auto">{active.render()}</div> : null}
      </div>
    </div>
  );
}
