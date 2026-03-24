import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import {
  readDir,
  type DirEntry,
  mkdir,
  remove,
  rename,
  writeTextFile,
} from "@tauri-apps/plugin-fs";
import { basename, dirname, join } from "@tauri-apps/api/path";
import {
  IconChevronRight,
  IconDots,
  IconFile,
  IconFilePlus,
  IconFolder,
  IconFolderOpen,
  IconFolderPlus,
  IconRefresh,
} from "@tabler/icons-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { WorkbenchSidebarSection } from "@/components/workbench/workbench-sidebar-section";
import { useEditorSession } from "@/editor/editor-session-context";
import {
  executeCommand,
  registerCommand,
  unregisterCommand,
} from "@/extensions/commands/command-service";
import {
  explorerDecorationRegistry,
  type ExplorerDecorationBadge,
} from "@/extensions/workbench/explorer-decorations";
import { useRegistrySubscription } from "@/extensions/workbench/use-registry-subscription";
import { useWorkbenchState } from "@/extensions/workbench/workbench-state";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/workspace/workspace-context";

const HIDDEN_KEY = "boson.explorer.showHidden";
const SORT_KEY = "boson.explorer.sortMode";
const COMPACT_KEY = "boson.explorer.compactFolders";
const AUTO_REVEAL_KEY = "boson.explorer.autoReveal";
const SCM_STATUS_EVENT = "boson:scm-status-changed";
const MOCK_SCM_COMMAND_ID = "boson.explorer.dev.mockScmDecorations";
const CLEAR_SCM_COMMAND_ID = "boson.explorer.dev.clearScmDecorations";
const DEV_MODE = import.meta.env.DEV;

type SortMode = "type" | "name";

type ExplorerNode = {
  name: string;
  fullPath: string;
  parentPath: string;
  depth: number;
  isDirectory: boolean;
  isFile: boolean;
  nested?: boolean;
};

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function readBool(key: string, fallback: boolean): boolean {
  if (typeof window === "undefined") return fallback;
  const raw = localStorage.getItem(key);
  if (raw === null) return fallback;
  return raw === "1";
}

function readSortMode(): SortMode {
  if (typeof window === "undefined") return "type";
  const raw = localStorage.getItem(SORT_KEY);
  return raw === "name" ? "name" : "type";
}

function readAutoReveal(): boolean {
  if (typeof window === "undefined") return true;
  const raw = localStorage.getItem(AUTO_REVEAL_KEY);
  if (raw === null) return true;
  return raw === "1";
}

function writePrefs(
  showHidden: boolean,
  sortMode: SortMode,
  compactFolders: boolean,
  autoReveal: boolean,
): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(HIDDEN_KEY, showHidden ? "1" : "0");
  localStorage.setItem(SORT_KEY, sortMode);
  localStorage.setItem(COMPACT_KEY, compactFolders ? "1" : "0");
  localStorage.setItem(AUTO_REVEAL_KEY, autoReveal ? "1" : "0");
}

function shouldHideName(name: string, showHidden: boolean): boolean {
  return !showHidden && name.startsWith(".");
}

/** Canonical path key so cache / expanded Sets stay consistent (slashes, trailing /, file://). */
function explorerPathKey(p: string): string {
  let s = p.trim().replace(/\\/g, "/");
  if (s.toLowerCase().startsWith("file://")) {
    try {
      const u = new URL(s);
      if (u.protocol === "file:") {
        s = decodeURIComponent(u.pathname);
      }
    } catch {
      s = s.replace(/^file:\/\//i, "");
    }
  }
  s = s.replace(/\/+/g, "/");
  while (s.length > 1 && s.endsWith("/")) s = s.slice(0, -1);
  return s;
}

function joinPath(parent: string, name: string): string {
  const base = explorerPathKey(parent);
  const seg = name.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!seg) return base;
  return explorerPathKey(`${base}/${seg}`);
}

function sortEntries(entries: DirEntry[], sortMode: SortMode): DirEntry[] {
  const list = [...entries];
  if (sortMode === "name") {
    return list.sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    );
  }
  return list.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
}

function nestingParentName(fileName: string): string | null {
  const patterns = [".test.", ".spec.", ".stories.", ".d.ts"];
  for (const p of patterns) {
    const i = fileName.indexOf(p);
    if (i > 0) {
      if (p === ".d.ts") return `${fileName.slice(0, i)}.ts`;
      return `${fileName.slice(0, i)}.${fileName.slice(i + p.length)}`;
    }
  }
  return null;
}

function ancestorsFromRoot(rootPath: string, fullPath: string): string[] {
  const root = explorerPathKey(rootPath);
  const target = explorerPathKey(fullPath);
  if (!target.startsWith(root)) return [];
  const rel = target.slice(root.length).replace(/^[\\/]+/, "");
  if (!rel) return [];
  const parts = rel.split(/[\\/]+/).filter(Boolean);
  const ancestors: string[] = [];
  let cur = root;
  for (let i = 0; i < parts.length - 1; i += 1) {
    cur = joinPath(cur, parts[i]);
    ancestors.push(cur);
  }
  return ancestors;
}

/** Prefer explicit directory flag so nested files are not misclassified when `isFile` is wrong. */
function entryIsDirectory(e: DirEntry): boolean {
  return e.isDirectory === true;
}

function entryIsFile(e: DirEntry): boolean {
  return e.isFile === true && !e.isDirectory;
}

function indentGuideXs(depth: number, compactFolders: boolean): number[] {
  const base = compactFolders ? 5 : 7;
  const step = 10;
  const xs: number[] = [];
  for (let i = 0; i < depth; i += 1) {
    xs.push(base + i * step + 7);
  }
  return xs;
}

function fileIconClass(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".ts") || lower.endsWith(".tsx"))
    return "text-sky-600 dark:text-sky-400";
  if (lower.endsWith(".js") || lower.endsWith(".jsx") || lower.endsWith(".mjs"))
    return "text-amber-600 dark:text-amber-400";
  if (
    lower.endsWith(".json") ||
    lower.endsWith(".yaml") ||
    lower.endsWith(".yml")
  )
    return "text-emerald-600 dark:text-emerald-400";
  if (lower.endsWith(".md") || lower.endsWith(".mdx"))
    return "text-violet-600 dark:text-violet-400";
  if (lower.endsWith(".css") || lower.endsWith(".scss"))
    return "text-pink-600 dark:text-pink-400";
  if (lower.endsWith(".rs")) return "text-orange-600 dark:text-orange-400";
  if (lower.endsWith(".html") || lower.endsWith(".htm"))
    return "text-orange-500 dark:text-orange-400";
  return "text-muted-foreground";
}

function explorerTreeItemId(fullPath: string): string {
  return `explorer-treeitem-${fullPath.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}

function badgeToneClass(tone: ExplorerDecorationBadge["tone"]): string {
  switch (tone) {
    case "accent":
      return "text-primary";
    case "success":
      return "text-emerald-500";
    case "warning":
      return "text-amber-500";
    case "error":
      return "text-destructive";
    default:
      return "text-muted-foreground";
  }
}

function ExplorerTreeRow({
  node,
  expanded,
  loading,
  selected,
  active,
  badges,
  folderDirtyCount,
  compactFolders,
  errorMessage,
  isRenaming,
  renameDraft,
  renameInputRef,
  onRenameChange,
  onRenameKeyDown,
  onRenameBlur,
  onToggleDir,
  onSelect,
  onActivate,
  treeItemId,
  menu,
}: {
  node: ExplorerNode;
  expanded: boolean;
  loading: boolean;
  selected: boolean;
  active: boolean;
  badges: ExplorerDecorationBadge[];
  folderDirtyCount: number;
  compactFolders: boolean;
  errorMessage?: string;
  isRenaming: boolean;
  renameDraft: string;
  renameInputRef: React.RefObject<HTMLInputElement | null>;
  onRenameChange: (v: string) => void;
  onRenameKeyDown: (e: ReactKeyboardEvent<HTMLInputElement>) => void;
  onRenameBlur: () => void;
  onToggleDir: (fullPath: string) => void;
  onSelect: (node: ExplorerNode) => void;
  onActivate: (node: ExplorerNode) => void;
  treeItemId: string;
  menu: ReactNode;
}) {
  const padLeft = compactFolders ? 5 : 7;
  const guideXs = indentGuideXs(node.depth, compactFolders);
  const fileTint = fileIconClass(node.name);

  const rowClass = cn(
    "group relative flex w-full min-h-[22px] items-center gap-1 px-1.5 py-0.5 text-left text-[13px] leading-tight text-foreground outline-none transition-colors",
    compactFolders && "min-h-[20px] py-0",
    !isRenaming &&
      "hover:bg-muted-foreground/10 focus-visible:bg-muted-foreground/12 focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-0",
    selected && "bg-muted-foreground/20",
    active && "bg-primary/12 font-medium border-t border-b border-border/60",
    node.nested && "opacity-95",
  );

  const rowStyle = { paddingLeft: `${padLeft + node.depth * 10}px` } as const;

  const rowChrome = (
    <>
      {guideXs.length > 0 ? (
        <span
          className="pointer-events-none absolute inset-y-0 left-0 overflow-hidden"
          aria-hidden
        >
          {guideXs.map((x) => (
            <span
              key={`${node.fullPath}-g-${x}`}
              className="absolute top-0 h-full border-l border-border/50"
              style={{ left: `${x}px` }}
            />
          ))}
        </span>
      ) : null}
      {node.isDirectory ? (
        <span className="text-muted-foreground relative z-[1] flex h-4 w-[14px] shrink-0 items-center justify-center">
          {loading ? (
            <span className="size-2.5 animate-pulse rounded-sm bg-muted-foreground/45" />
          ) : (
            <IconChevronRight
              size={12}
              stroke={1.75}
              className={cn(
                "opacity-80 transition-transform",
                expanded && "rotate-90",
              )}
            />
          )}
        </span>
      ) : (
        <span className="relative z-[1] h-4 w-[14px] shrink-0" />
      )}
      {node.isDirectory ? (
        expanded ? (
          <IconFolderOpen
            size={15}
            stroke={1.5}
            className="relative z-[1] shrink-0 text-amber-600 dark:text-amber-400"
          />
        ) : (
          <IconFolder
            size={15}
            stroke={1.5}
            className="relative z-[1] shrink-0 text-amber-600/95 dark:text-amber-400/95"
          />
        )
      ) : (
        <IconFile
          size={14}
          stroke={1.5}
          className={cn("relative z-[1] shrink-0", fileTint)}
        />
      )}
      {isRenaming ? (
        <Input
          ref={renameInputRef}
          value={renameDraft}
          onChange={(e) => onRenameChange(e.target.value)}
          onKeyDown={onRenameKeyDown}
          onBlur={onRenameBlur}
          className="relative z-[1] h-6 min-w-0 flex-1 py-0 text-[13px]"
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <>
          <span className="relative z-[1] min-w-0 flex-1 truncate">
            {node.name}
          </span>
          {node.isDirectory && folderDirtyCount > 0 ? (
            <span
              className="relative z-[1] ml-1 inline-flex min-w-4 shrink-0 items-center justify-center rounded-sm border border-border/70 px-1 text-[10px] leading-4 text-primary"
              title={`${folderDirtyCount} modified file${folderDirtyCount === 1 ? "" : "s"}`}
            >
              {folderDirtyCount}
            </span>
          ) : null}
          {node.isFile
            ? badges.slice(0, 2).map((badge) => (
                <span
                  key={`${node.fullPath}-${badge.id}`}
                  className={cn(
                    "relative z-[1] ml-1 shrink-0 text-[14px] leading-none",
                    badgeToneClass(badge.tone),
                  )}
                  aria-label={badge.tooltip}
                  title={badge.tooltip}
                >
                  {badge.label}
                </span>
              ))
            : null}
        </>
      )}
    </>
  );

  const body = isRenaming ? (
    <div
      id={treeItemId}
      role="treeitem"
      aria-level={node.depth + 1}
      aria-selected={selected}
      aria-expanded={node.isDirectory ? expanded : undefined}
      tabIndex={selected ? 0 : -1}
      className={rowClass}
      style={rowStyle}
      title={node.fullPath}
      onFocus={() => onSelect(node)}
      onClick={() => onSelect(node)}
    >
      {rowChrome}
    </div>
  ) : (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <button
          type="button"
          id={treeItemId}
          role="treeitem"
          aria-level={node.depth + 1}
          aria-selected={selected}
          aria-expanded={node.isDirectory ? expanded : undefined}
          tabIndex={selected ? 0 : -1}
          className={rowClass}
          style={rowStyle}
          title={node.fullPath}
          onFocus={() => onSelect(node)}
          onClick={() => {
            onSelect(node);
            if (node.isDirectory) onToggleDir(node.fullPath);
            else onActivate(node);
          }}
        >
          {rowChrome}
        </button>
      </ContextMenuTrigger>
      <ContextMenuContent className="min-w-44">{menu}</ContextMenuContent>
    </ContextMenu>
  );

  return (
    <>
      {body}
      {errorMessage ? (
        <div
          className="text-destructive/90 px-2 py-0.5 text-[11px] leading-snug"
          style={{ paddingLeft: `${12 + padLeft + node.depth * 10}px` }}
        >
          {errorMessage}
        </div>
      ) : null}
    </>
  );
}

export function ExplorerView() {
  const { activeFilePath, openFile, tabs, isDirty } = useEditorSession();
  const { dispatch } = useWorkbenchState();
  const {
    rootPath,
    workspaceRoots,
    setWorkspaceRoot,
    removeWorkspaceRoot,
    openProjectDialog,
  } = useWorkspace();
  const decorationProviders = useRegistrySubscription(
    explorerDecorationRegistry.subscribe,
    () => explorerDecorationRegistry.get(),
  );

  const [entries, setEntries] = useState<DirEntry[]>([]);
  const [cache, setCache] = useState<Map<string, DirEntry[]>>(new Map());
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [loadingPaths, setLoadingPaths] = useState<Set<string>>(new Set());
  const [nodeErrors, setNodeErrors] = useState<Map<string, string>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [loadingRoot, setLoadingRoot] = useState(false);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [compareSelectedPath, setCompareSelectedPath] = useState<string | null>(
    null,
  );
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);
  const renameDraftRef = useRef(renameDraft);
  const renamingPathRef = useRef(renamingPath);
  const skipRenameBlurRef = useRef(false);
  renameDraftRef.current = renameDraft;
  renamingPathRef.current = renamingPath;

  const [showHidden, setShowHidden] = useState<boolean>(() =>
    readBool(HIDDEN_KEY, false),
  );
  const [sortMode, setSortMode] = useState<SortMode>(() => readSortMode());
  const [compactFolders, setCompactFolders] = useState<boolean>(() =>
    readBool(COMPACT_KEY, false),
  );
  const [autoReveal, setAutoReveal] = useState<boolean>(() => readAutoReveal());
  const [markerVersion, setMarkerVersion] = useState(0);
  const [scmVersion, setScmVersion] = useState(0);
  const monacoRef = useRef<typeof import("monaco-editor") | null>(null);
  const scmStateRef = useRef<
    Map<string, "modified" | "added" | "deleted" | "renamed" | "untracked">
  >(new Map());
  const refreshTokenRef = useRef(0);
  const expandedPathsRef = useRef(expandedPaths);
  const cacheRef = useRef(cache);
  expandedPathsRef.current = expandedPaths;
  cacheRef.current = cache;

  useEffect(() => {
    writePrefs(showHidden, sortMode, compactFolders, autoReveal);
  }, [showHidden, sortMode, compactFolders, autoReveal]);

  useEffect(() => {
    let disposed = false;
    let subscription: { dispose: () => void } | null = null;
    void import("monaco-editor").then((monaco) => {
      if (disposed) return;
      monacoRef.current = monaco;
      subscription = monaco.editor.onDidChangeMarkers(() => {
        setMarkerVersion((v) => v + 1);
      });
    });
    return () => {
      disposed = true;
      subscription?.dispose();
      monacoRef.current = null;
    };
  }, []);

  useEffect(() => {
    const onScmEvent = (event: Event) => {
      const custom = event as CustomEvent<{
        statuses?: Record<
          string,
          "modified" | "added" | "deleted" | "renamed" | "untracked"
        >;
      }>;
      const statuses = custom.detail?.statuses;
      if (!statuses || typeof statuses !== "object") return;
      const next = new Map<
        string,
        "modified" | "added" | "deleted" | "renamed" | "untracked"
      >();
      for (const [path, state] of Object.entries(statuses)) {
        next.set(explorerPathKey(path), state);
      }
      scmStateRef.current = next;
      setScmVersion((v) => v + 1);
    };
    window.addEventListener(SCM_STATUS_EVENT, onScmEvent as EventListener);
    return () => {
      window.removeEventListener(SCM_STATUS_EVENT, onScmEvent as EventListener);
    };
  }, []);

  const refreshRoot = useCallback(
    async (dir: string) => {
      const token = ++refreshTokenRef.current;
      setLoadingRoot(true);
      setError(null);
      try {
        const key = explorerPathKey(dir);
        const list = await readDir(key);
        if (token !== refreshTokenRef.current) return;
        setEntries(sortEntries(list, sortMode));
        setCache(new Map());
        setExpandedPaths(new Set());
        setNodeErrors(new Map());
      } catch (e) {
        if (token !== refreshTokenRef.current) return;
        setError(e instanceof Error ? e.message : String(e));
        setEntries([]);
      } finally {
        if (token === refreshTokenRef.current) setLoadingRoot(false);
      }
    },
    [sortMode],
  );

  useEffect(() => {
    if (!isTauriRuntime()) return;
    if (rootPath) {
      void refreshRoot(rootPath);
      return;
    }
    setEntries([]);
    setSelectedPath(null);
    setExpandedPaths(new Set());
  }, [refreshRoot, rootPath]);

  const getVisibleEntries = useCallback(
    (list: DirEntry[]) =>
      sortEntries(list, sortMode).filter(
        (e) => !shouldHideName(e.name, showHidden),
      ),
    [showHidden, sortMode],
  );

  const buildVisibleTree = useMemo(() => {
    if (!rootPath) return [] as ExplorerNode[];
    const result: ExplorerNode[] = [];
    const walk = (parentPath: string, list: DirEntry[], depth: number) => {
      const visible = getVisibleEntries(list);
      const byName = new Map(visible.map((e) => [e.name, e]));
      const nestedChildrenByParent = new Map<string, DirEntry[]>();
      const topLevel: DirEntry[] = [];

      for (const entry of visible) {
        if (entryIsDirectory(entry)) {
          topLevel.push(entry);
          continue;
        }
        if (entryIsFile(entry)) {
          const parentName = nestingParentName(entry.name);
          if (parentName && byName.has(parentName)) {
            const children = nestedChildrenByParent.get(parentName) ?? [];
            children.push(entry);
            nestedChildrenByParent.set(parentName, children);
          } else {
            topLevel.push(entry);
          }
          continue;
        }
        topLevel.push(entry);
      }

      for (const entry of topLevel) {
        const fullPath = joinPath(parentPath, entry.name);
        const isDirectory = entryIsDirectory(entry);
        const isFile =
          !isDirectory &&
          (entryIsFile(entry) || (!entry.isDirectory && !entry.isFile));
        const node: ExplorerNode = {
          name: entry.name,
          fullPath,
          parentPath,
          depth,
          isDirectory,
          isFile,
        };
        result.push(node);
        const nestedChildren = nestedChildrenByParent.get(entry.name);
        if (nestedChildren && nestedChildren.length > 0) {
          for (const child of nestedChildren) {
            result.push({
              name: child.name,
              fullPath: joinPath(parentPath, child.name),
              parentPath,
              depth: depth + 1,
              isDirectory: false,
              isFile: true,
              nested: true,
            });
          }
        }
        if (isDirectory && expandedPaths.has(fullPath)) {
          const children = cache.get(fullPath);
          if (children !== undefined) walk(fullPath, children, depth + 1);
        }
      }
    };
    walk(explorerPathKey(rootPath), entries, 0);
    return result;
  }, [rootPath, entries, cache, expandedPaths, getVisibleEntries]);

  const selectedIndex = useMemo(
    () => buildVisibleTree.findIndex((n) => n.fullPath === selectedPath),
    [buildVisibleTree, selectedPath],
  );
  const selectedTreeItemId = useMemo(
    () => (selectedPath ? explorerTreeItemId(selectedPath) : undefined),
    [selectedPath],
  );
  const dirtyPaths = useMemo(
    () => new Set(tabs.filter((t) => isDirty(t.id)).map((t) => t.path)),
    [tabs, isDirty],
  );
  const folderDirtyCountByPath = useMemo(() => {
    const counts = new Map<string, number>();
    if (!rootPath) return counts;
    const root = explorerPathKey(rootPath);
    for (const dirtyPath of dirtyPaths) {
      const normalized = explorerPathKey(dirtyPath);
      if (!normalized.startsWith(root)) continue;
      const dirs = ancestorsFromRoot(root, normalized);
      for (const dir of dirs) {
        counts.set(dir, (counts.get(dir) ?? 0) + 1);
      }
    }
    return counts;
  }, [dirtyPaths, rootPath]);
  const badgesByPath = useMemo(() => {
    void markerVersion;
    void scmVersion;
    const markerByPath = new Map<
      string,
      { errors: number; warnings: number }
    >();
    try {
      const markers = monacoRef.current?.editor.getModelMarkers({}) ?? [];
      for (const marker of markers) {
        const uriPath = marker.resource.path;
        const path = explorerPathKey(uriPath);
        const cur = markerByPath.get(path) ?? { errors: 0, warnings: 0 };
        if (marker.severity === 8) cur.errors += 1;
        else if (marker.severity === 4) cur.warnings += 1;
        markerByPath.set(path, cur);
      }
    } catch {
      // Best-effort diagnostics decoration.
    }

    const map = new Map<string, ExplorerDecorationBadge[]>();
    for (const node of buildVisibleTree) {
      const nodeBadges: ExplorerDecorationBadge[] = [];
      for (const provider of decorationProviders) {
        const badges = provider.getBadges(node, {
          rootPath,
          isDirtyPath: (path) => dirtyPaths.has(explorerPathKey(path)),
          getMarkerSummary: (path) => markerByPath.get(explorerPathKey(path)),
          getScmState: (path) => scmStateRef.current.get(explorerPathKey(path)),
        });
        if (badges.length > 0) nodeBadges.push(...badges);
      }
      if (nodeBadges.length > 0) {
        map.set(node.fullPath, nodeBadges);
      }
    }
    return map;
  }, [
    buildVisibleTree,
    decorationProviders,
    rootPath,
    dirtyPaths,
    markerVersion,
    scmVersion,
  ]);

  const fetchChildren = useCallback(async (dirPath: string) => {
    const key = explorerPathKey(dirPath);
    setLoadingPaths((p) => new Set(p).add(key));
    setNodeErrors((prev) => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
    try {
      const list = await readDir(key);
      setCache((prev) => {
        const next = new Map(prev);
        next.set(key, list);
        return next;
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setNodeErrors((prev) => {
        const next = new Map(prev);
        next.set(key, message);
        return next;
      });
      setExpandedPaths((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    } finally {
      setLoadingPaths((p) => {
        const next = new Set(p);
        next.delete(key);
        return next;
      });
    }
  }, []);

  const toggleDir = useCallback(
    async (fullPath: string) => {
      const key = explorerPathKey(fullPath);
      const wasExpanded = expandedPathsRef.current.has(key);

      setExpandedPaths((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });

      if (!wasExpanded && !cacheRef.current.has(key)) {
        await fetchChildren(key);
      }
    },
    [fetchChildren],
  );

  const selectedNode = useMemo(
    () => buildVisibleTree.find((n) => n.fullPath === selectedPath) ?? null,
    [buildVisibleTree, selectedPath],
  );

  const resolveCreateBase = useCallback(
    async (ctx: ExplorerNode | null) => {
      if (!rootPath) return null;
      const keyRoot = explorerPathKey(rootPath);
      if (!ctx) return keyRoot;
      if (ctx.isDirectory) return explorerPathKey(ctx.fullPath);
      return explorerPathKey(await dirname(ctx.fullPath));
    },
    [rootPath],
  );

  const runCreateFile = useCallback(
    async (ctx: ExplorerNode | null = null) => {
      if (!rootPath) return;
      const baseDir = await resolveCreateBase(ctx ?? selectedNode);
      if (!baseDir) return;
      const name = window.prompt("New file name");
      if (!name?.trim()) return;
      const targetPath = await join(baseDir, name.trim());
      await writeTextFile(targetPath, "");
      await refreshRoot(rootPath);
      setSelectedPath(explorerPathKey(targetPath));
      void openFile(explorerPathKey(targetPath));
    },
    [rootPath, selectedNode, resolveCreateBase, refreshRoot, openFile],
  );

  const runCreateFolder = useCallback(
    async (ctx: ExplorerNode | null = null) => {
      if (!rootPath) return;
      const baseDir = await resolveCreateBase(ctx ?? selectedNode);
      if (!baseDir) return;
      const name = window.prompt("New folder name");
      if (!name?.trim()) return;
      const targetPath = await join(baseDir, name.trim());
      await mkdir(targetPath);
      await refreshRoot(rootPath);
      setSelectedPath(explorerPathKey(targetPath));
    },
    [rootPath, selectedNode, resolveCreateBase, refreshRoot],
  );

  const commitRename = useCallback(async () => {
    const path = renamingPathRef.current;
    const draft = renameDraftRef.current;
    if (!path || !rootPath) {
      setRenamingPath(null);
      return;
    }
    const trimmed = draft.trim();
    const currentName = await basename(path);
    if (!trimmed || trimmed === currentName) {
      setRenamingPath(null);
      return;
    }
    try {
      const parent = await dirname(path);
      const nextPath = explorerPathKey(await join(parent, trimmed));
      await rename(path, nextPath);
      await refreshRoot(rootPath);
      setSelectedPath(nextPath);
      setRenamingPath(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setRenamingPath(null);
    }
  }, [rootPath, refreshRoot]);

  const startInlineRename = useCallback((node: ExplorerNode) => {
    setRenamingPath(node.fullPath);
    setRenameDraft(node.name);
    queueMicrotask(() => {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    });
  }, []);

  const runDeleteNode = useCallback(
    async (node: ExplorerNode) => {
      if (!window.confirm(`Delete "${node.name}"?`)) return;
      if (renamingPathRef.current === node.fullPath) setRenamingPath(null);
      await remove(node.fullPath, { recursive: true });
      if (rootPath) await refreshRoot(rootPath);
      if (selectedPath === node.fullPath) setSelectedPath(null);
    },
    [rootPath, refreshRoot, selectedPath],
  );

  const runDelete = useCallback(async () => {
    if (!selectedNode) return;
    await runDeleteNode(selectedNode);
  }, [selectedNode, runDeleteNode]);

  const copyPathToClipboard = useCallback(async (fullPath: string) => {
    try {
      await navigator.clipboard.writeText(fullPath);
    } catch {
      setError("Could not copy path to clipboard.");
    }
  }, []);

  const copyRelativePathToClipboard = useCallback(
    async (fullPath: string) => {
      if (!rootPath) {
        await copyPathToClipboard(fullPath);
        return;
      }
      const root = explorerPathKey(rootPath);
      const path = explorerPathKey(fullPath);
      const relative = path.startsWith(root)
        ? path.slice(root.length).replace(/^\/+/, "")
        : fullPath;
      try {
        await navigator.clipboard.writeText(relative || ".");
      } catch {
        setError("Could not copy relative path to clipboard.");
      }
    },
    [rootPath, copyPathToClipboard],
  );

  const runFindInFolder = useCallback(
    async (node: ExplorerNode) => {
      const targetPath = node.isDirectory
        ? node.fullPath
        : explorerPathKey(await dirname(node.fullPath));
      try {
        await navigator.clipboard.writeText(targetPath);
      } catch {
        // Non-blocking: switching to Search still helps the workflow.
      }
      dispatch({ type: "setActiveActivity", id: "workbench.view.search" });
    },
    [dispatch],
  );

  const runOpenToSide = useCallback(
    async (node: ExplorerNode) => {
      if (node.isFile) {
        await openFile(node.fullPath, { sideBySide: true });
      } else {
        await toggleDir(node.fullPath);
      }
    },
    [openFile, toggleDir],
  );

  const runCompareSelected = useCallback(
    async (node: ExplorerNode) => {
      if (!node.isFile) return;
      if (!compareSelectedPath || compareSelectedPath === node.fullPath) {
        setCompareSelectedPath(node.fullPath);
        return;
      }
      await openFile(compareSelectedPath);
      await openFile(node.fullPath, { sideBySide: true });
      setCompareSelectedPath(null);
    },
    [compareSelectedPath, openFile],
  );

  const revealInSystemExplorer = useCallback(async (fullPath: string) => {
    try {
      const { revealItemInDir } = await import("@tauri-apps/plugin-opener");
      await revealItemInDir(fullPath);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const runCollapseAll = useCallback(() => {
    setExpandedPaths(new Set());
  }, []);

  const onRenameKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        skipRenameBlurRef.current = true;
        void commitRename();
      } else if (e.key === "Escape") {
        e.preventDefault();
        skipRenameBlurRef.current = true;
        setRenamingPath(null);
      }
    },
    [commitRename],
  );

  const onRenameBlur = useCallback(() => {
    requestAnimationFrame(() => {
      if (skipRenameBlurRef.current) {
        skipRenameBlurRef.current = false;
        return;
      }
      void commitRename();
    });
  }, [commitRename]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (renamingPath) {
        if (e.key === "Escape") {
          e.preventDefault();
          setRenamingPath(null);
        }
        return;
      }
      if (buildVisibleTree.length === 0) return;
      const idx = selectedIndex >= 0 ? selectedIndex : 0;
      const current = buildVisibleTree[idx];
      if (!current) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        const next =
          buildVisibleTree[Math.min(idx + 1, buildVisibleTree.length - 1)];
        if (next) setSelectedPath(next.fullPath);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        const prev = buildVisibleTree[Math.max(0, idx - 1)];
        if (prev) setSelectedPath(prev.fullPath);
        return;
      }
      if (e.key === "ArrowRight" && current.isDirectory) {
        e.preventDefault();
        if (!expandedPaths.has(current.fullPath)) {
          void toggleDir(current.fullPath);
          return;
        }
        const next = buildVisibleTree[idx + 1];
        if (next && next.parentPath === current.fullPath)
          setSelectedPath(next.fullPath);
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (current.isDirectory && expandedPaths.has(current.fullPath)) {
          void toggleDir(current.fullPath);
          return;
        }
        if (
          rootPath &&
          explorerPathKey(current.parentPath) !== explorerPathKey(rootPath)
        )
          setSelectedPath(current.parentPath);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        if (current.isDirectory) void toggleDir(current.fullPath);
        else void openFile(current.fullPath);
        return;
      }
      if (e.key === "F2") {
        e.preventDefault();
        startInlineRename(current);
        return;
      }
      if (e.key === "Delete") {
        e.preventDefault();
        void runDelete();
      }
    },
    [
      renamingPath,
      buildVisibleTree,
      selectedIndex,
      expandedPaths,
      toggleDir,
      rootPath,
      openFile,
      startInlineRename,
      runDelete,
    ],
  );

  const onTreeContainerFocus = useCallback(
    (e: React.FocusEvent<HTMLDivElement>) => {
      if (e.target !== e.currentTarget) return;
      const selectedNode =
        buildVisibleTree[selectedIndex >= 0 ? selectedIndex : 0] ?? null;
      if (!selectedNode) return;
      const target = document.getElementById(
        explorerTreeItemId(selectedNode.fullPath),
      ) as HTMLElement | null;
      target?.focus();
    },
    [buildVisibleTree, selectedIndex],
  );

  useEffect(() => {
    registerCommand(MOCK_SCM_COMMAND_ID, () => {
      const files = buildVisibleTree.filter((n) => n.isFile).slice(0, 8);
      if (files.length === 0) return;
      const statuses: Record<
        string,
        "modified" | "added" | "deleted" | "renamed" | "untracked"
      > = {};
      const cycle: Array<
        "modified" | "added" | "deleted" | "renamed" | "untracked"
      > = ["modified", "added", "deleted", "renamed", "untracked"];
      files.forEach((f, i) => {
        statuses[f.fullPath] = cycle[i % cycle.length];
      });
      window.dispatchEvent(
        new CustomEvent(SCM_STATUS_EVENT, {
          detail: { statuses },
        }),
      );
    });
    registerCommand(CLEAR_SCM_COMMAND_ID, () => {
      window.dispatchEvent(
        new CustomEvent(SCM_STATUS_EVENT, {
          detail: { statuses: {} },
        }),
      );
    });
    return () => {
      unregisterCommand(MOCK_SCM_COMMAND_ID);
      unregisterCommand(CLEAR_SCM_COMMAND_ID);
    };
  }, [buildVisibleTree]);

  useEffect(() => {
    if (!rootPath || !activeFilePath) return;
    if (!autoReveal) return;
    const root = explorerPathKey(rootPath);
    const active = explorerPathKey(activeFilePath);
    if (!active.startsWith(root)) return;
    setSelectedPath(active);
    const ancestors = ancestorsFromRoot(root, active);
    if (ancestors.length === 0) return;
    setExpandedPaths((prev) => new Set([...prev, ...ancestors]));
    void (async () => {
      for (const dir of ancestors) {
        if (!cacheRef.current.has(dir)) {
          await fetchChildren(dir);
        }
      }
    })();
  }, [activeFilePath, rootPath, fetchChildren, autoReveal]);

  if (!isTauriRuntime()) {
    return (
      <div className="text-muted-foreground p-3 text-sm">
        File explorer runs inside the{" "}
        <strong className="text-foreground">Tauri</strong> app. Run{" "}
        <code className="text-foreground">pnpm tauri dev</code> to browse the
        filesystem.
      </div>
    );
  }

  const folderTitle = rootPath
    ? (rootPath.split(/[/\\]/).pop() ?? rootPath)
    : "FOLDERS";

  const explorerHeaderActions = rootPath ? (
    <>
      <button
        type="button"
        className="hover:text-foreground hover:bg-muted-foreground/10 rounded-sm p-1"
        title="New File"
        onClick={() => void runCreateFile()}
      >
        <IconFilePlus size={14} />
      </button>
      <button
        type="button"
        className="hover:text-foreground hover:bg-muted-foreground/10 rounded-sm p-1"
        title="New Folder"
        onClick={() => void runCreateFolder()}
      >
        <IconFolderPlus size={14} />
      </button>
      <button
        type="button"
        className="hover:text-foreground hover:bg-muted-foreground/10 rounded-sm p-1 disabled:opacity-50"
        title="Refresh"
        onClick={() => rootPath && void refreshRoot(rootPath)}
        disabled={!rootPath || loadingRoot}
      >
        <IconRefresh size={14} />
      </button>
      <button
        type="button"
        className="hover:text-foreground hover:bg-muted-foreground/10 rounded-sm p-1"
        title="Collapse All"
        onClick={runCollapseAll}
      >
        <IconChevronRight size={14} />
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="hover:text-foreground hover:bg-muted-foreground/10 rounded-sm p-1"
            title="Views and more actions"
          >
            <IconDots size={14} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48">
          <DropdownMenuItem onSelect={() => void runCreateFile()}>
            New File
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void runCreateFolder()}>
            New Folder
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!rootPath || loadingRoot}
            onSelect={() => rootPath && void refreshRoot(rootPath)}
          >
            Refresh Explorer
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={runCollapseAll}>
            Collapse Folders in Explorer
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Sort By</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={sortMode}
            onValueChange={(v) => setSortMode(v as SortMode)}
          >
            <DropdownMenuRadioItem value="type">Type</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="name">Name</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem
            checked={showHidden}
            onCheckedChange={(checked) => setShowHidden(checked === true)}
          >
            Show Hidden Files
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={compactFolders}
            onCheckedChange={(checked) => setCompactFolders(checked === true)}
          >
            Compact Folders
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={autoReveal}
            onCheckedChange={(checked) => setAutoReveal(checked === true)}
          >
            Auto Reveal
          </DropdownMenuCheckboxItem>
          {workspaceRoots.length > 1 ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Workspace Folders</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={rootPath ?? ""}
                onValueChange={(v) => setWorkspaceRoot(v || null)}
              >
                {workspaceRoots.map((p) => (
                  <DropdownMenuRadioItem key={p} value={p}>
                    {p.split(/[/\\]/).pop() ?? p}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => void openProjectDialog()}>
            Add Folder to Workspace
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!rootPath}
            onSelect={() => {
              if (rootPath) removeWorkspaceRoot(rootPath);
            }}
          >
            Remove Folder from Workspace
          </DropdownMenuItem>
          {DEV_MODE ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Dev</DropdownMenuLabel>
              <DropdownMenuItem
                onSelect={() => void executeCommand(MOCK_SCM_COMMAND_ID)}
              >
                Mock SCM Decorations
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => void executeCommand(CLEAR_SCM_COMMAND_ID)}
              >
                Clear SCM Decorations
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  ) : (
    <button
      type="button"
      className="hover:text-foreground hover:bg-muted-foreground/10 rounded-sm p-1"
      title="Open Folder"
      onClick={() => void openProjectDialog()}
    >
      <IconFolderOpen size={14} />
    </button>
  );

  return (
    <div
      className="flex min-h-0 flex-1 flex-col text-sm"
      onKeyDown={onKeyDown}
      tabIndex={0}
    >
      <WorkbenchSidebarSection
        sectionId="explorer.folders"
        title={folderTitle}
        trailing={explorerHeaderActions}
        showActions="whenExpanded"
        className="flex min-h-0 min-w-0 flex-1 flex-col"
        bodyClassName="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
      >
        {error ? (
          <div className="text-destructive m-2 shrink-0 rounded border border-destructive/30 bg-destructive/10 p-2 text-xs">
            {error}
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-auto py-0.5">
          {loadingRoot ? (
            <div className="text-muted-foreground px-3 py-2 text-xs">
              Loading workspace...
            </div>
          ) : !rootPath ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
              <div className="text-muted-foreground text-xs">
                No folder opened
              </div>
              <button
                type="button"
                onClick={() => void openProjectDialog()}
                className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted"
              >
                Open Project
              </button>
            </div>
          ) : buildVisibleTree.length === 0 ? (
            <div className="text-muted-foreground px-3 py-2 text-xs">
              {entries.length > 0
                ? "All items are hidden. Enable Hidden to show dotfiles."
                : "This folder is empty."}
            </div>
          ) : (
            <div
              className="px-0.5"
              role="tree"
              aria-label="Explorer files"
              aria-activedescendant={selectedTreeItemId}
              onFocus={onTreeContainerFocus}
            >
              {buildVisibleTree.map((node) => (
                <ExplorerTreeRow
                  key={node.fullPath}
                  treeItemId={explorerTreeItemId(node.fullPath)}
                  node={node}
                  expanded={expandedPaths.has(node.fullPath)}
                  loading={loadingPaths.has(node.fullPath)}
                  selected={selectedPath === node.fullPath}
                  active={activeFilePath === node.fullPath}
                  badges={badgesByPath.get(node.fullPath) ?? []}
                  folderDirtyCount={
                    folderDirtyCountByPath.get(node.fullPath) ?? 0
                  }
                  compactFolders={compactFolders}
                  errorMessage={nodeErrors.get(node.fullPath)}
                  isRenaming={renamingPath === node.fullPath}
                  renameDraft={renameDraft}
                  renameInputRef={renameInputRef}
                  onRenameChange={setRenameDraft}
                  onRenameKeyDown={onRenameKeyDown}
                  onRenameBlur={onRenameBlur}
                  onToggleDir={(p) => void toggleDir(p)}
                  onSelect={(n) => {
                    setSelectedPath(n.fullPath);
                  }}
                  onActivate={(n) => {
                    if (n.isFile) void openFile(n.fullPath);
                  }}
                  menu={
                    <>
                      <ContextMenuItem
                        onSelect={() => {
                          void runCreateFile(node);
                        }}
                      >
                        New File
                      </ContextMenuItem>
                      <ContextMenuItem
                        onSelect={() => {
                          void runCreateFolder(node);
                        }}
                      >
                        New Folder
                      </ContextMenuItem>
                      <ContextMenuSeparator />
                      <ContextMenuItem
                        onSelect={() => {
                          startInlineRename(node);
                        }}
                      >
                        Rename
                      </ContextMenuItem>
                      <ContextMenuItem
                        variant="destructive"
                        onSelect={() => {
                          void runDeleteNode(node);
                        }}
                      >
                        Delete
                      </ContextMenuItem>
                      <ContextMenuSeparator />
                      <ContextMenuItem
                        onSelect={() => {
                          void runOpenToSide(node);
                        }}
                      >
                        Open to Side
                      </ContextMenuItem>
                      <ContextMenuItem
                        onSelect={() => {
                          void runFindInFolder(node);
                        }}
                      >
                        Find in Folder
                      </ContextMenuItem>
                      <ContextMenuItem
                        disabled={!node.isFile}
                        onSelect={() => {
                          void runCompareSelected(node);
                        }}
                      >
                        {!node.isFile
                          ? "Compare Selected"
                          : compareSelectedPath === node.fullPath
                            ? "Selected for Compare"
                            : compareSelectedPath
                              ? "Compare with Selected"
                              : "Select for Compare"}
                      </ContextMenuItem>
                      <ContextMenuSeparator />
                      <ContextMenuItem
                        onSelect={() => {
                          void copyPathToClipboard(node.fullPath);
                        }}
                      >
                        Copy Path
                      </ContextMenuItem>
                      <ContextMenuItem
                        onSelect={() => {
                          void copyRelativePathToClipboard(node.fullPath);
                        }}
                      >
                        Copy Relative Path
                      </ContextMenuItem>
                      <ContextMenuItem
                        onSelect={() => {
                          void revealInSystemExplorer(node.fullPath);
                        }}
                      >
                        Reveal in File Manager
                      </ContextMenuItem>
                      <ContextMenuSeparator />
                      <ContextMenuItem
                        onSelect={() => {
                          if (rootPath) void refreshRoot(rootPath);
                        }}
                      >
                        Refresh
                      </ContextMenuItem>
                    </>
                  }
                />
              ))}
            </div>
          )}
        </div>
      </WorkbenchSidebarSection>
    </div>
  );
}
