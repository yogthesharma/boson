import { IconCircleFilled, IconX } from "@tabler/icons-react";
import { useEffect, useMemo, useState } from "react";
import { type EditorTab, useEditorSession } from "@/editor/editor-session-context";
import { cn } from "@/lib/utils";
import {
  OpenEditorsToolbar,
  type OpenEditorsSortMode,
} from "@/components/workbench/open-editors-toolbar";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { WorkbenchSidebarSection } from "@/components/workbench/workbench-sidebar-section";

const OPEN_EDITORS_SORT_KEY = "boson.openEditors.sortMode";

function extractDroppedPaths(data: DataTransfer): string[] {
  const out = new Set<string>();
  const uriList = data.getData("text/uri-list");
  if (uriList) {
    for (const line of uriList.split("\n")) {
      const value = line.trim();
      if (!value || value.startsWith("#")) continue;
      if (value.startsWith("file://")) {
        try {
          const u = new URL(value);
          out.add(decodeURIComponent(u.pathname));
        } catch {
          out.add(value.replace(/^file:\/\//i, ""));
        }
      }
    }
  }
  const text = data.getData("text/plain");
  if (text) {
    for (const token of text.split(/\r?\n/)) {
      const t = token.trim();
      if (!t) continue;
      if (t.startsWith("/") || t.startsWith("file://")) {
        if (t.startsWith("file://")) {
          try {
            const u = new URL(t);
            out.add(decodeURIComponent(u.pathname));
          } catch {
            out.add(t.replace(/^file:\/\//i, ""));
          }
        } else {
          out.add(t);
        }
      }
    }
  }
  return [...out];
}

function readOpenEditorsSortMode(): OpenEditorsSortMode {
  if (typeof window === "undefined") return "editorOrder";
  const raw = localStorage.getItem(OPEN_EDITORS_SORT_KEY);
  if (raw === "alphabetical" || raw === "fullPath" || raw === "editorOrder") {
    return raw;
  }
  return "editorOrder";
}

/** Open Editors list only; use {@link OpenEditorsPane} in the workbench. */
export function OpenEditorsView({
  tabs,
  sortMode,
}: {
  tabs: EditorTab[];
  sortMode: OpenEditorsSortMode;
}) {
  const {
    groups,
    activeGroupId,
    activeTabId,
    setActiveGroup,
    selectTab,
    closeTab,
    closeAllTabs,
    closeGroup,
    closeOtherTabs,
    closeTabs,
    moveTab,
    moveTabToGroup,
    saveGroupDirty,
    saveTab,
    isDirty,
    openFile,
  } = useEditorSession();
  const [draggingTabId, setDraggingTabId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    id: string;
    position: "before" | "after";
  } | null>(null);
  const dndEnabled = sortMode === "editorOrder";
  const tabsByGroup = useMemo(() => {
    const map = new Map<string, EditorTab[]>();
    for (const g of groups) map.set(g.id, []);
    for (const tab of tabs) {
      const bucket = map.get(tab.groupId);
      if (bucket) bucket.push(tab);
      else map.set(tab.groupId, [tab]);
    }
    return map;
  }, [groups, tabs]);

  return (
    <div
      className="flex flex-col py-0.5 pb-1"
      role="list"
      aria-label="Open editors"
      onDragOver={(e) => {
        if (!dndEnabled && e.dataTransfer.types.includes("text/uri-list")) {
          e.preventDefault();
        }
      }}
      onDrop={(e) => {
        const droppedPaths = extractDroppedPaths(e.dataTransfer);
        if (droppedPaths.length === 0) return;
        e.preventDefault();
        void (async () => {
          for (const p of droppedPaths) {
            await openFile(p);
          }
        })();
      }}
    >
      {groups.map((group) => {
        const groupTabs = tabsByGroup.get(group.id) ?? [];
        if (groupTabs.length === 0) return null;
        const groupDirtyCount = groupTabs.filter((t) => isDirty(t.id)).length;
        return (
          <div key={group.id} className="mb-1">
            <div
              className={cn(
                "text-muted-foreground flex h-5 items-center gap-1 px-2 text-[10px] font-semibold tracking-wide uppercase",
                activeGroupId === group.id && "text-foreground",
              )}
              onClick={() => setActiveGroup(group.id)}
              onDragOver={(e) => {
                if (!dndEnabled || !draggingTabId) return;
                e.preventDefault();
              }}
              onDrop={(e) => {
                if (!dndEnabled || !draggingTabId) return;
                e.preventDefault();
                moveTabToGroup(draggingTabId, group.id);
                setDropTarget(null);
                setDraggingTabId(null);
              }}
            >
              <span className="truncate">{group.label}</span>
              {groupDirtyCount > 0 ? (
                <span className="rounded-sm border border-border/80 bg-muted px-1 leading-3">
                  {groupDirtyCount}
                </span>
              ) : null}
              <div className="ml-auto flex items-center gap-0.5">
                <button
                  type="button"
                  className="hover:text-foreground hover:bg-muted-foreground/15 rounded-sm p-0.5"
                  title="Save group"
                  onClick={(e) => {
                    e.stopPropagation();
                    void saveGroupDirty(group.id);
                  }}
                >
                  <IconCircleFilled size={7} />
                </button>
                <button
                  type="button"
                  className="hover:text-foreground hover:bg-muted-foreground/15 rounded-sm p-0.5"
                  title="Close group"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeGroup(group.id);
                  }}
                >
                  <IconX size={10} />
                </button>
              </div>
            </div>
            {groupTabs.map((tab) => {
        const active = tab.id === activeTabId;
        const dirty = isDirty(tab.id);
        return (
          <ContextMenu key={tab.id}>
            <ContextMenuTrigger asChild>
              <div
                role="listitem"
                draggable={dndEnabled}
                className={cn(
                  "group flex min-h-[22px] items-center gap-0.5 rounded-sm pr-0.5 pl-2 text-left text-[12px] leading-tight",
                  active
                    ? "bg-muted-foreground/20 text-foreground font-medium"
                    : "text-foreground hover:bg-muted-foreground/10",
                  draggingTabId === tab.id && "opacity-55",
                  dropTarget?.id === tab.id &&
                    dropTarget.position === "before" &&
                    "border-t border-primary",
                  dropTarget?.id === tab.id &&
                    dropTarget.position === "after" &&
                    "border-b border-primary",
                )}
                onDragStart={(e) => {
                  if (!dndEnabled) return;
                  setDraggingTabId(tab.id);
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", tab.id);
                }}
                onDragOver={(e) => {
                  if (!dndEnabled || !draggingTabId || draggingTabId === tab.id) return;
                  e.preventDefault();
                  const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                  const position: "before" | "after" =
                    e.clientY < rect.top + rect.height / 2 ? "before" : "after";
                  setDropTarget({ id: tab.id, position });
                }}
                onDrop={(e) => {
                  if (!dndEnabled) return;
                  e.preventDefault();
                  const source = e.dataTransfer.getData("text/plain");
                  if (!source || source === tab.id) return;
                  const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                  const position: "before" | "after" =
                    e.clientY < rect.top + rect.height / 2 ? "before" : "after";
                  moveTab(source, tab.id, position);
                  moveTabToGroup(source, tab.groupId);
                  setDropTarget(null);
                  setDraggingTabId(null);
                }}
                onDragEnd={() => {
                  setDropTarget(null);
                  setDraggingTabId(null);
                }}
              >
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-1.5 py-0.5 text-left outline-none"
                  onClick={() => selectTab(tab.id)}
                >
                  {dirty ? (
                    <IconCircleFilled
                      size={6}
                      className="shrink-0 text-primary opacity-90"
                      aria-label="Modified"
                    />
                  ) : (
                    <span className="w-1.5 shrink-0" aria-hidden />
                  )}
                  <span className="min-w-0 truncate">{tab.name}</span>
                </button>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground shrink-0 rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100"
                  title="Close editor"
                  aria-label={`Close ${tab.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                >
                  <IconX size={14} stroke={1.75} />
                </button>
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent className="min-w-44">
              <ContextMenuItem
                disabled={!dirty}
                onSelect={() => void saveTab(tab.id)}
              >
                Save
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem onSelect={() => closeTab(tab.id)}>
                Close
              </ContextMenuItem>
              <ContextMenuItem
                disabled={tabs.length <= 1}
                onSelect={() => closeOtherTabs(tab.id)}
              >
                Close Others
              </ContextMenuItem>
              <ContextMenuItem
                disabled={tabs[tabs.length - 1]?.id === tab.id}
                onSelect={() => {
                  const idx = tabs.findIndex((t) => t.id === tab.id);
                  if (idx < 0) return;
                  const toClose = tabs.slice(idx + 1).map((t) => t.id);
                  closeTabs(toClose);
                }}
              >
                Close to the Right
              </ContextMenuItem>
              <ContextMenuItem
                disabled={tabs.length === 0}
                onSelect={closeAllTabs}
              >
                Close All
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        );
      })}
          </div>
        );
      })}
    </div>
  );
}

/** Collapsible OPEN EDITORS section; hidden entirely when there are no tabs. */
export function OpenEditorsPane() {
  const { tabs, isDirty } = useEditorSession();
  const [sortMode, setSortMode] = useState<OpenEditorsSortMode>(() =>
    readOpenEditorsSortMode(),
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(OPEN_EDITORS_SORT_KEY, sortMode);
  }, [sortMode]);

  const sortedTabs = useMemo(() => {
    if (sortMode === "editorOrder") return tabs;
    const list = [...tabs];
    if (sortMode === "alphabetical") {
      return list.sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
      );
    }
    return list.sort((a, b) =>
      a.path.localeCompare(b.path, undefined, { sensitivity: "base" }),
    );
  }, [tabs, sortMode]);

  const dirtyCount = tabs.reduce((count, t) => count + (isDirty(t.id) ? 1 : 0), 0);

  if (tabs.length === 0) {
    return null;
  }

  return (
    <WorkbenchSidebarSection
      sectionId="workbench.views.explorer.openEditors"
      title={
        <span className="flex items-center gap-1.5">
          <span>OPEN EDITORS</span>
          {dirtyCount > 0 ? (
            <span className="rounded-sm border border-border/80 bg-muted px-1 text-[10px] leading-4">
              {dirtyCount}
            </span>
          ) : null}
        </span>
      }
      trailing={<OpenEditorsToolbar sortMode={sortMode} setSortMode={setSortMode} />}
      showActions="whenExpanded"
      className="shrink-0"
      bodyClassName="max-h-28 overflow-y-auto"
    >
      <OpenEditorsView tabs={sortedTabs} sortMode={sortMode} />
    </WorkbenchSidebarSection>
  );
}
