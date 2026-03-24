import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { open } from "@tauri-apps/plugin-dialog";

const WORKSPACE_KEY = "boson.workspace.root";
const RECENTS_KEY = "boson.workspace.recents";

type WorkspaceContextValue = {
  rootPath: string | null;
  recentProjects: string[];
  setWorkspaceRoot: (path: string | null) => void;
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

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [rootPath, setRootPath] = useState<string | null>(() => readStorage(WORKSPACE_KEY));
  const [recentProjects, setRecentProjects] = useState<string[]>(() => readRecentProjects());

  const setWorkspaceRoot = (path: string | null) => {
    setRootPath(path);
    if (typeof window !== "undefined") {
      if (!path) {
        localStorage.removeItem(WORKSPACE_KEY);
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

  const openProjectDialog = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      recursive: true,
      title: "Open project folder",
    });
    if (!selected) return;
    const path = Array.isArray(selected) ? selected[0] : selected;
    if (path) setWorkspaceRoot(path);
  };

  const clearWorkspace = () => setWorkspaceRoot(null);

  const value = useMemo<WorkspaceContextValue>(
    () => ({ rootPath, recentProjects, setWorkspaceRoot, openProjectDialog, clearWorkspace }),
    [rootPath, recentProjects],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}
