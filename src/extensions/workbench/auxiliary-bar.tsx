import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { IconChevronLeft, IconChevronRight, IconHistory, IconPlus, IconDots, IconX } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { registerCommand, unregisterCommand } from "@/extensions/commands/command-service";
import { cn } from "@/lib/utils";
import { workbenchViewRegistry } from "./registry";
import { useRegistrySubscription } from "./use-registry-subscription";
import { useWorkbenchState } from "./workbench-state";

const AUX_WIDTH_KEY = "boson.auxiliary.width";
const AUX_ACTIVE_VIEW_KEY = "boson.auxiliary.activeView";
const AUX_DEFAULT_WIDTH = 320;
const AUX_MIN_WIDTH = 288;
const AUX_MAX_WIDTH = 560;
const THREADS_CHANGED_EVENT = "boson.aiChat.threadsChanged";
const SELECT_THREAD_EVENT = "boson.aiChat.selectThread";
const NEW_THREAD_EVENT = "boson.aiChat.newThread";
const CLOSE_THREAD_EVENT = "boson.aiChat.closeThread";

type HeaderThread = { id: string; title: string };

function clampWidth(width: number): number {
  return Math.max(AUX_MIN_WIDTH, Math.min(AUX_MAX_WIDTH, width));
}

export function AuxiliaryBar() {
  const { dispatch } = useWorkbenchState();
  const allViews = useRegistrySubscription(workbenchViewRegistry.subscribe, () =>
    workbenchViewRegistry.get(),
  );

  const auxiliaryViews = useMemo(
    () =>
      [...allViews].filter((v) => v.location === "auxiliary").sort((a, b) => a.order - b.order),
    [allViews],
  );

  const [width, setWidth] = useState(() => {
    if (typeof window === "undefined") return AUX_DEFAULT_WIDTH;
    const raw = Number.parseInt(localStorage.getItem(AUX_WIDTH_KEY) ?? "", 10);
    if (Number.isNaN(raw)) return AUX_DEFAULT_WIDTH;
    return clampWidth(raw);
  });
  const [activeViewId, setActiveViewId] = useState<string>(() => {
    const fallback = auxiliaryViews[0]?.id ?? "";
    if (typeof window === "undefined") return fallback;
    return localStorage.getItem(AUX_ACTIVE_VIEW_KEY) ?? fallback;
  });

  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ x: number; width: number } | null>(null);
  const [chatHeaderThreads, setChatHeaderThreads] = useState<HeaderThread[]>([]);
  const [chatHeaderActiveId, setChatHeaderActiveId] = useState<string>("");
  const [chatHeaderOpenIds, setChatHeaderOpenIds] = useState<string[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(AUX_WIDTH_KEY, String(width));
  }, [width]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(AUX_ACTIVE_VIEW_KEY, activeViewId);
  }, [activeViewId]);

  useEffect(() => {
    if (auxiliaryViews.length === 0) {
      setActiveViewId("");
      return;
    }
    if (auxiliaryViews.some((v) => v.id === activeViewId)) {
      return;
    }
    setActiveViewId(auxiliaryViews[0]?.id ?? "");
  }, [auxiliaryViews, activeViewId]);

  useEffect(() => {
    if (auxiliaryViews.length === 0) return;
    const idx = auxiliaryViews.findIndex((v) => v.id === activeViewId);
    const move = (delta: -1 | 1) => {
      const next = idx < 0 ? 0 : (idx + delta + auxiliaryViews.length) % auxiliaryViews.length;
      setActiveViewId(auxiliaryViews[next].id);
    };
    registerCommand("boson.auxiliary.nextView", () => {
      move(1);
    });
    registerCommand("boson.auxiliary.prevView", () => {
      move(-1);
    });
    registerCommand("boson.auxiliary.focus", () => {
      contentRef.current?.focus();
    });
    registerCommand("boson.auxiliary.hide", () => {
      dispatch({ type: "toggleAuxiliaryBar" });
    });
    registerCommand("boson.auxiliary.resetWidth", () => {
      setWidth(AUX_DEFAULT_WIDTH);
    });
    return () => {
      unregisterCommand("boson.auxiliary.nextView");
      unregisterCommand("boson.auxiliary.prevView");
      unregisterCommand("boson.auxiliary.focus");
      unregisterCommand("boson.auxiliary.hide");
      unregisterCommand("boson.auxiliary.resetWidth");
    };
  }, [activeViewId, auxiliaryViews, dispatch]);

  if (auxiliaryViews.length === 0) {
    return null;
  }

  const activeIndex = auxiliaryViews.findIndex((v) => v.id === activeViewId);
  const activeView = auxiliaryViews[activeIndex] ?? auxiliaryViews[0];
  const showViewTabs = auxiliaryViews.length > 1;
  const showChatThreadTabs = !showViewTabs && activeView.id === "workbench.views.aiChat";

  useEffect(() => {
    if (!showChatThreadTabs) return;
    const syncFromStorage = () => {
      try {
        const raw = localStorage.getItem("boson.ai.threads") ?? "[]";
        const parsed = JSON.parse(raw) as Array<{ id?: string; title?: string }>;
        const next = Array.isArray(parsed)
          ? parsed
              .filter((t) => typeof t?.id === "string")
              .map((t) => ({ id: t.id as string, title: (t.title as string) || "New Chat" }))
          : [];
        setChatHeaderThreads(next.slice(0, 4));
        setChatHeaderActiveId(localStorage.getItem("boson.ai.activeThread") ?? "");
        const openRaw = localStorage.getItem("boson.ai.openThreads") ?? "[]";
        const openParsed = JSON.parse(openRaw);
        setChatHeaderOpenIds(
          Array.isArray(openParsed) ? openParsed.filter((x) => typeof x === "string").slice(0, 4) : [],
        );
      } catch {
        setChatHeaderThreads([]);
        setChatHeaderOpenIds([]);
      }
    };
    syncFromStorage();
    const onChanged = (event: Event) => {
      const detail = (event as CustomEvent<{
        threads?: HeaderThread[];
        activeThreadId?: string;
        openThreadIds?: string[];
      }>).detail;
      if (detail?.threads && Array.isArray(detail.threads)) {
        setChatHeaderThreads(detail.threads.slice(0, 4));
      } else {
        syncFromStorage();
      }
      if (typeof detail?.activeThreadId === "string") {
        setChatHeaderActiveId(detail.activeThreadId);
      }
      if (Array.isArray(detail?.openThreadIds)) {
        setChatHeaderOpenIds(detail.openThreadIds.filter((x) => typeof x === "string").slice(0, 4));
      }
    };
    window.addEventListener(THREADS_CHANGED_EVENT, onChanged as EventListener);
    return () => {
      window.removeEventListener(THREADS_CHANGED_EVENT, onChanged as EventListener);
    };
  }, [showChatThreadTabs]);

  const chatTabs = useMemo(() => {
    const byId = new Map(chatHeaderThreads.map((t) => [t.id, t]));
    const fromOpen = chatHeaderOpenIds
      .map((id) => byId.get(id))
      .filter((x): x is HeaderThread => Boolean(x));
    if (fromOpen.length > 0) return fromOpen;
    return chatHeaderThreads.slice(0, 4);
  }, [chatHeaderThreads, chatHeaderOpenIds]);

  const onResizeStart = (event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragRef.current = { x: event.clientX, width };
    const onMove = (e: globalThis.MouseEvent) => {
      const start = dragRef.current;
      if (!start) return;
      const delta = start.x - e.clientX;
      setWidth(clampWidth(start.width + delta));
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const onTabKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (auxiliaryViews.length < 2) return;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      const next = (activeIndex + 1 + auxiliaryViews.length) % auxiliaryViews.length;
      setActiveViewId(auxiliaryViews[next].id);
      tabRefs.current[next]?.focus();
      return;
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      const next = (activeIndex - 1 + auxiliaryViews.length) % auxiliaryViews.length;
      setActiveViewId(auxiliaryViews[next].id);
      tabRefs.current[next]?.focus();
      return;
    }
    if (e.key === "Home") {
      e.preventDefault();
      setActiveViewId(auxiliaryViews[0].id);
      tabRefs.current[0]?.focus();
      return;
    }
    if (e.key === "End") {
      e.preventDefault();
      const last = auxiliaryViews.length - 1;
      setActiveViewId(auxiliaryViews[last].id);
      tabRefs.current[last]?.focus();
    }
  };

  return (
    <aside
      className="hidden min-h-0 shrink-0 self-stretch border-l border-border bg-muted lg:flex"
      style={{ width: `${width}px` }}
      aria-label="Secondary sidebar"
      data-tauri-no-drag
    >
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize secondary sidebar"
        className="w-1 shrink-0 cursor-col-resize bg-transparent hover:bg-muted-foreground/20"
        onMouseDown={onResizeStart}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div
          className="group/auxhead flex h-8 shrink-0 items-center border-b border-border bg-muted px-1"
          role={showViewTabs ? "tablist" : undefined}
          aria-label={showViewTabs ? "Secondary sidebar views" : "AI chat sidebar"}
          onKeyDown={showViewTabs ? onTabKeyDown : undefined}
        >
          <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto">
            {showViewTabs ? (
              auxiliaryViews.map((view, idx) => {
                const selected = view.id === activeView.id;
                return (
                  <button
                    key={view.id}
                    id={`aux-tab-${view.id}`}
                    ref={(el) => {
                      tabRefs.current[idx] = el;
                    }}
                    role="tab"
                    aria-selected={selected}
                    aria-controls={`aux-view-${view.id}`}
                    tabIndex={selected ? 0 : -1}
                    className={cn(
                      "h-6 max-w-[10rem] truncate rounded px-2 text-[11px] font-medium tracking-wide",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                      selected
                        ? "bg-background text-foreground"
                        : "text-muted-foreground hover:bg-muted-foreground/10 hover:text-foreground",
                    )}
                    onClick={() => setActiveViewId(view.id)}
                    title={view.title || view.id}
                  >
                    {view.title || view.id}
                  </button>
                );
              })
            ) : showChatThreadTabs ? (
              <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
                {chatTabs.map((thread) => {
                  const selected = thread.id === chatHeaderActiveId;
                  return (
                    <div
                      key={thread.id}
                      className={cn(
                        "flex h-6 max-w-[10rem] items-center gap-1 rounded pl-2 pr-1",
                        selected
                          ? "bg-background text-foreground"
                          : "text-muted-foreground hover:bg-muted-foreground/10 hover:text-foreground",
                      )}
                    >
                      <button
                        type="button"
                        className="min-w-0 flex-1 truncate text-left text-[11px] font-medium"
                        onClick={() =>
                          window.dispatchEvent(
                            new CustomEvent(SELECT_THREAD_EVENT, { detail: { id: thread.id } }),
                          )
                        }
                        title={thread.title}
                      >
                        {thread.title}
                      </button>
                      <button
                        type="button"
                        className="flex h-4 w-4 shrink-0 items-center justify-center rounded hover:bg-muted-foreground/15"
                        aria-label={`Close ${thread.title}`}
                        title={`Close ${thread.title}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          window.dispatchEvent(
                            new CustomEvent(CLOSE_THREAD_EVENT, { detail: { id: thread.id } }),
                          );
                        }}
                      >
                        <IconX size={10} />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {activeView.title || "AI Chat"}
              </div>
            )}
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-0.5 pl-1">
            {showChatThreadTabs ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="h-5 w-5 text-muted-foreground hover:text-foreground"
                title="New chat"
                aria-label="New chat"
                onClick={() => {
                  window.dispatchEvent(new CustomEvent(NEW_THREAD_EVENT));
                }}
              >
                <IconPlus size={12} />
              </Button>
            ) : null}
            {showViewTabs ? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="h-5 w-5 text-muted-foreground hover:text-foreground"
                  title="Previous view"
                  aria-label="Previous view"
                  onClick={() => {
                    const next = (activeIndex - 1 + auxiliaryViews.length) % auxiliaryViews.length;
                    setActiveViewId(auxiliaryViews[next].id);
                  }}
                >
                  <IconChevronLeft size={12} />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="h-5 w-5 text-muted-foreground hover:text-foreground"
                  title="Next view"
                  aria-label="Next view"
                  onClick={() => {
                    const next = (activeIndex + 1) % auxiliaryViews.length;
                    setActiveViewId(auxiliaryViews[next].id);
                  }}
                >
                  <IconChevronRight size={12} />
                </Button>
              </>
            ) : null}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="h-5 w-5 text-muted-foreground hover:text-foreground"
                  title="More secondary sidebar actions"
                  aria-label="More secondary sidebar actions"
                >
                  <IconDots size={12} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onSelect={() => setWidth(AUX_DEFAULT_WIDTH)}>
                  Reset width
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => contentRef.current?.focus()}>
                  Focus view
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => dispatch({ type: "toggleAuxiliaryBar" })}>
                  Hide sidebar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {activeView.id === "workbench.views.aiChat" ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="h-5 w-5 text-muted-foreground hover:text-foreground"
                title="Toggle chat history"
                aria-label="Toggle chat history"
                onClick={() => {
                  window.dispatchEvent(new CustomEvent("boson.aiChat.toggleHistory"));
                }}
              >
                <IconHistory size={12} />
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="h-5 w-5 text-muted-foreground hover:text-foreground"
              title="Close secondary sidebar"
              aria-label="Close secondary sidebar"
              onClick={() => dispatch({ type: "toggleAuxiliaryBar" })}
            >
              <IconX size={12} />
            </Button>
          </div>
        </div>
        <div
          id={`aux-view-${activeView.id}`}
          role="tabpanel"
          aria-labelledby={`aux-tab-${activeView.id}`}
          tabIndex={-1}
          ref={contentRef}
          className="flex min-h-0 flex-1 flex-col overflow-hidden outline-none"
        >
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{activeView.render()}</div>
        </div>
      </div>
    </aside>
  );
}
