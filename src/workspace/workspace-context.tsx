import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { open } from "@tauri-apps/plugin-dialog";

const WORKSPACE_KEY = "boson.workspace.root";
const WORKSPACE_ROOTS_KEY = "boson.workspace.roots";
const RECENTS_KEY = "boson.workspace.recents";

type WorkspaceContextValue = {
  rootPath: string | null;
  workspaceRoots: string[];
  recentProjects: string[];
  setWorkspaceRoot: (path: string | null) => void;
  addWorkspaceRoot: (path: string) => void;
  removeWorkspaceRoot: (path: string) => void;
  openProjectDialog: () => Promise<void>;
  clearWorkspace: () => void;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

function readStorage(key: string): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(key);
}

function readRecentProjects(): string[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(RECENTS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeRecentProjects(paths: string[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(RECENTS_KEY, JSON.stringify(paths));
}

function readWorkspaceRoots(): string[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(WORKSPACE_ROOTS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeWorkspaceRoots(paths: string[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(WORKSPACE_ROOTS_KEY, JSON.stringify(paths));
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [rootPath, setRootPath] = useState<string | null>(() => readStorage(WORKSPACE_KEY));
  const [workspaceRoots, setWorkspaceRoots] = useState<string[]>(() => {
    const roots = readWorkspaceRoots();
    if (roots.length > 0) return roots;
    const single = readStorage(WORKSPACE_KEY);
    return single ? [single] : [];
  });
  const [recentProjects, setRecentProjects] = useState<string[]>(() => readRecentProjects());

  const setWorkspaceRoot = (path: string | null) => {
    setRootPath(path);
    setWorkspaceRoots((prev) => {
      let next = prev;
      if (!path) next = [];
      else if (!prev.includes(path)) next = [path, ...prev];
      writeWorkspaceRoots(next);
      return next;
    });
    if (typeof window !== "undefined") {
      if (!path) {
        localStorage.removeItem(WORKSPACE_KEY);
        localStorage.removeItem(WORKSPACE_ROOTS_KEY);
        return;
      }
      localStorage.setItem(WORKSPACE_KEY, path);
      setRecentProjects((prev) => {
        const next = [path, ...prev.filter((p) => p !== path)].slice(0, 8);
        writeRecentProjects(next);
        return next;
      });
    }
  };

  const addWorkspaceRoot = (path: string) => {
    if (!path) return;
    setWorkspaceRoots((prev) => {
      const next = prev.includes(path) ? prev : [...prev, path];
      writeWorkspaceRoots(next);
      return next;
    });
    setRootPath(path);
    if (typeof window !== "undefined") {
      localStorage.setItem(WORKSPACE_KEY, path);
    }
    setRecentProjects((prev) => {
      const next = [path, ...prev.filter((p) => p !== path)].slice(0, 8);
      writeRecentProjects(next);
      return next;
    });
  };

  const removeWorkspaceRoot = (path: string) => {
    setWorkspaceRoots((prev) => {
      const next = prev.filter((p) => p !== path);
      writeWorkspaceRoots(next);
      const nextActive = next[0] ?? null;
      setRootPath(nextActive);
      if (typeof window !== "undefined") {
        if (nextActive) localStorage.setItem(WORKSPACE_KEY, nextActive);
        else localStorage.removeItem(WORKSPACE_KEY);
      }
      return next;
    });
  };

  const openProjectDialog = async () => {
    const selected = await open({
      directory: true,
      multiple: true,
      recursive: true,
      title: "Open project folder",
    });
    if (!selected) return;
    const paths = Array.isArray(selected) ? selected : [selected];
    if (paths.length === 0) return;
    for (const path of paths) {
      if (path) addWorkspaceRoot(path);
    }
  };

  const clearWorkspace = () => setWorkspaceRoot(null);

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      rootPath,
      workspaceRoots,
      recentProjects,
      setWorkspaceRoot,
      addWorkspaceRoot,
      removeWorkspaceRoot,
      openProjectDialog,
      clearWorkspace,
    }),
    [rootPath, workspaceRoots, recentProjects],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}
