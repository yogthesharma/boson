import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { pathToMonacoLanguage } from "./path-to-language";

export type EditorTab = {
  id: string;
  path: string;
  name: string;
};

type EditorApi = {
  monaco: typeof import("monaco-editor");
  editor: import("monaco-editor").editor.IStandaloneCodeEditor;
};

type EditorSessionValue = {
  tabs: EditorTab[];
  activeTabId: string | null;
  activeFilePath: string | null;
  cursorLine: number | null;
  cursorColumn: number | null;
  encoding: string | null;
  eol: "LF" | "CRLF" | null;
  languageId: string | null;
  runEditorAction: (actionId: string) => Promise<boolean>;
  toggleEol: () => void;
  showMessage: (message: string) => void;
  monacoTheme: "vs" | "vs-dark";
  editorError: string | null;
  clearError: () => void;
  isDirty: (tabId: string) => boolean;
  openFile: (path: string) => Promise<void>;
  saveActive: () => Promise<void>;
  saveTab: (id: string) => Promise<void>;
  saveAllDirty: () => Promise<void>;
  closeAllTabs: () => void;
  closeTabs: (ids: string[]) => void;
  closeOtherTabs: (id: string) => void;
  closeTabsToRight: (id: string) => void;
  moveTab: (tabId: string, targetId: string, position: "before" | "after") => void;
  selectTab: (id: string) => void;
  closeTab: (id: string) => void;
  bindEditor: (api: EditorApi) => void;
  unbindEditor: () => void;
};

const EditorSessionContext = createContext<EditorSessionValue | null>(null);

function useResolvedDark(): boolean {
  const [dark, setDark] = useState(() =>
    typeof document !== "undefined" ? document.documentElement.classList.contains("dark") : false,
  );

  useEffect(() => {
    const el = document.documentElement;
    const obs = new MutationObserver(() => setDark(el.classList.contains("dark")));
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  return dark;
}

export function EditorSessionProvider({ children }: { children: ReactNode }) {
  const dark = useResolvedDark();
  const monacoTheme = dark ? "vs-dark" : "vs";

  const [tabs, setTabs] = useState<EditorTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [dirtyVersion, setDirtyVersion] = useState(0);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [cursorLine, setCursorLine] = useState<number | null>(null);
  const [cursorColumn, setCursorColumn] = useState<number | null>(null);
  const [encoding, setEncoding] = useState<string | null>(null);
  const [eol, setEol] = useState<"LF" | "CRLF" | null>(null);
  const [languageId, setLanguageId] = useState<string | null>(null);

  const apiRef = useRef<EditorApi | null>(null);
  const modelsRef = useRef<Map<string, import("monaco-editor").editor.ITextModel>>(new Map());
  const savedVersionRef = useRef<Map<string, number>>(new Map());
  const pendingOpenPathRef = useRef<string | null>(null);
  const editorDisposablesRef = useRef<import("monaco-editor").IDisposable[]>([]);

  const activeTabIdRef = useRef(activeTabId);
  activeTabIdRef.current = activeTabId;
  const monacoThemeRef = useRef(monacoTheme);
  monacoThemeRef.current = monacoTheme;
  const saveActiveRef = useRef<() => Promise<void>>(async () => {});
  const openFileRef = useRef<(path: string) => Promise<void>>(async () => {});

  const syncEditorStatus = useCallback(() => {
    const editor = apiRef.current?.editor;
    const active = activeTabIdRef.current;
    const model = active ? modelsRef.current.get(active) ?? null : null;
    if (!editor || !model) {
      setCursorLine(null);
      setCursorColumn(null);
      setLanguageId(null);
      setEncoding(null);
      setEol(null);
      return;
    }

    const pos = editor.getPosition();
    setCursorLine(pos?.lineNumber ?? 1);
    setCursorColumn(pos?.column ?? 1);
    setLanguageId(model.getLanguageId() || null);
    setEncoding("UTF-8");
    setEol(model.getEOL() === "\r\n" ? "CRLF" : "LF");
  }, []);

  const switchToPath = useCallback((filePath: string) => {
    const editor = apiRef.current?.editor;
    const model = modelsRef.current.get(filePath);
    if (editor && model) {
      editor.setModel(model);
      queueMicrotask(syncEditorStatus);
    }
  }, [syncEditorStatus]);

  const showMessage = useCallback((message: string) => {
    setEditorError(message);
  }, []);

  const runEditorAction = useCallback(async (actionId: string): Promise<boolean> => {
    const editor = apiRef.current?.editor;
    if (!editor) return false;
    const action = editor.getAction(actionId);
    if (!action) return false;
    try {
      await action.run();
      return true;
    } catch (e) {
      setEditorError(e instanceof Error ? e.message : String(e));
      return false;
    }
  }, []);

  const toggleEol = useCallback(() => {
    const api = apiRef.current;
    const active = activeTabIdRef.current;
    const model = active ? modelsRef.current.get(active) : null;
    if (!api || !model) return;
    const next =
      model.getEOL() === "\r\n"
        ? api.monaco.editor.EndOfLineSequence.LF
        : api.monaco.editor.EndOfLineSequence.CRLF;
    model.pushEOL(next);
    syncEditorStatus();
  }, [syncEditorStatus]);

  const saveActive = useCallback(async () => {
    const path = activeTabIdRef.current;
    if (!path) return;
    const model = modelsRef.current.get(path);
    if (!model) return;
    try {
      const { writeTextFile } = await import("@tauri-apps/plugin-fs");
      await writeTextFile(path, model.getValue());
      savedVersionRef.current.set(path, model.getAlternativeVersionId());
      setDirtyVersion((v) => v + 1);
      setEditorError(null);
    } catch (e) {
      setEditorError(e instanceof Error ? e.message : String(e));
    }
  }, []);
  saveActiveRef.current = saveActive;

  const saveTab = useCallback(async (id: string) => {
    const model = modelsRef.current.get(id);
    if (!model) return;
    try {
      const { writeTextFile } = await import("@tauri-apps/plugin-fs");
      await writeTextFile(id, model.getValue());
      savedVersionRef.current.set(id, model.getAlternativeVersionId());
      setDirtyVersion((v) => v + 1);
      setEditorError(null);
    } catch (e) {
      setEditorError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const saveAllDirty = useCallback(async () => {
    setEditorError(null);
    const { writeTextFile } = await import("@tauri-apps/plugin-fs");
    for (const [path, model] of modelsRef.current.entries()) {
      const saved = savedVersionRef.current.get(path);
      if (saved === undefined) continue;
      if (model.getAlternativeVersionId() === saved) continue;
      try {
        await writeTextFile(path, model.getValue());
        savedVersionRef.current.set(path, model.getAlternativeVersionId());
      } catch (e) {
        setEditorError(e instanceof Error ? e.message : String(e));
        return;
      }
    }
    setDirtyVersion((v) => v + 1);
  }, []);

  const bindEditor = useCallback((api: EditorApi) => {
    apiRef.current = api;
    const { monaco, editor } = api;
    editorDisposablesRef.current.forEach((d) => d.dispose());
    editorDisposablesRef.current = [];

    monaco.editor.setTheme(monacoThemeRef.current);
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      void saveActiveRef.current();
    });
    editorDisposablesRef.current.push(
      editor.onDidChangeCursorPosition(() => {
        syncEditorStatus();
      }),
    );
    editorDisposablesRef.current.push(
      editor.onDidChangeModel(() => {
        syncEditorStatus();
      }),
    );

    const pending = pendingOpenPathRef.current;
    if (pending) {
      pendingOpenPathRef.current = null;
      void openFileRef.current(pending);
      return;
    }
    const active = activeTabIdRef.current;
    if (active && modelsRef.current.has(active)) {
      editor.setModel(modelsRef.current.get(active)!);
    } else {
      editor.setModel(null);
    }
    syncEditorStatus();
  }, [syncEditorStatus]);

  const unbindEditor = useCallback(() => {
    editorDisposablesRef.current.forEach((d) => d.dispose());
    editorDisposablesRef.current = [];
    apiRef.current = null;
    syncEditorStatus();
  }, [syncEditorStatus]);

  useEffect(() => {
    void import("monaco-editor").then((m) => m.editor.setTheme(monacoTheme));
  }, [monacoTheme]);

  const openFile = useCallback(
    async (filePath: string) => {
      if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) {
        setEditorError("Open files in the Tauri desktop app.");
        return;
      }

      setEditorError(null);
      const api = apiRef.current;
      const monaco = api?.monaco ?? (await import("monaco-editor"));
      const editor = api?.editor ?? null;
      if (modelsRef.current.has(filePath)) {
        setActiveTabId(filePath);
        switchToPath(filePath);
        if (!editor) {
          pendingOpenPathRef.current = filePath;
        }
        return;
      }

      try {
        const { readTextFile } = await import("@tauri-apps/plugin-fs");
        const text = await readTextFile(filePath);
        const language = pathToMonacoLanguage(filePath);
        const uri = monaco.Uri.file(filePath);
        const existing = monaco.editor.getModel(uri);
        const model = existing ?? monaco.editor.createModel(text, language, uri);
        if (existing) model.setValue(text);
        monaco.editor.setModelLanguage(model, language);
        model.onDidChangeContent(() => setDirtyVersion((v) => v + 1));
        modelsRef.current.set(filePath, model);
        savedVersionRef.current.set(filePath, model.getAlternativeVersionId());

        const name = filePath.split(/[/\\]/).pop() ?? filePath;
        setTabs((t) => (t.some((x) => x.id === filePath) ? t : [...t, { id: filePath, path: filePath, name }]));
        setActiveTabId(filePath);
        if (editor) {
          editor.setModel(model);
        } else {
          pendingOpenPathRef.current = filePath;
        }
      } catch (e) {
        setEditorError(e instanceof Error ? e.message : String(e));
      }
    },
    [switchToPath],
  );
  openFileRef.current = openFile;

  useEffect(() => {
    syncEditorStatus();
  }, [activeTabId, tabs, syncEditorStatus]);

  const selectTab = useCallback((id: string) => {
    setActiveTabId(id);
    switchToPath(id);
  }, [switchToPath]);

  const closeTab = useCallback(
    (id: string) => {
      const model = modelsRef.current.get(id);
      if (!model) return;
      const saved = savedVersionRef.current.get(id);
      const dirty = saved !== undefined && model.getAlternativeVersionId() != saved;
      if (dirty && !window.confirm("Discard unsaved changes for this file?")) return;

      model.dispose();
      modelsRef.current.delete(id);
      savedVersionRef.current.delete(id);

      setTabs((prev) => {
        const next = prev.filter((t) => t.id !== id);
        setActiveTabId((cur) => {
          if (cur !== id) return cur;
          const na = next[next.length - 1]?.id ?? null;
          queueMicrotask(() => {
            if (na) switchToPath(na);
            else apiRef.current?.editor.setModel(null);
          });
          return na;
        });
        return next;
      });
      setDirtyVersion((v) => v + 1);
    },
    [switchToPath],
  );

  const closeTabsByIdSet = useCallback((ids: Set<string>) => {
    if (ids.size === 0) return;
    let hasDirty = false;
    for (const id of ids) {
      const m = modelsRef.current.get(id);
      if (!m) continue;
      const saved = savedVersionRef.current.get(id);
      if (saved !== undefined && m.getAlternativeVersionId() !== saved) {
        hasDirty = true;
        break;
      }
    }
    if (hasDirty && !window.confirm("Discard unsaved changes for selected editors?")) {
      return;
    }

    setTabs((prev) => {
      for (const id of ids) {
        const model = modelsRef.current.get(id);
        model?.dispose();
        modelsRef.current.delete(id);
        savedVersionRef.current.delete(id);
      }
      const next = prev.filter((t) => !ids.has(t.id));
      setActiveTabId((cur) => (cur && !ids.has(cur) ? cur : (next[next.length - 1]?.id ?? null)));
      queueMicrotask(() => {
        const nextActive = next[next.length - 1]?.id;
        if (nextActive) switchToPath(nextActive);
        else apiRef.current?.editor.setModel(null);
      });
      return next;
    });
    setDirtyVersion((v) => v + 1);
  }, [switchToPath]);

  const closeTabs = useCallback((ids: string[]) => {
    closeTabsByIdSet(new Set(ids));
  }, [closeTabsByIdSet]);

  const closeAllTabs = useCallback(() => {
    const dirtyTabs = tabs.filter((t) => {
      const m = modelsRef.current.get(t.id);
      if (!m) return false;
      const saved = savedVersionRef.current.get(t.id);
      if (saved === undefined) return false;
      return m.getAlternativeVersionId() !== saved;
    });
    if (
      dirtyTabs.length > 0 &&
      !window.confirm("Discard unsaved changes and close all editors?")
    ) {
      return;
    }

    for (const tab of tabs) {
      const model = modelsRef.current.get(tab.id);
      model?.dispose();
      modelsRef.current.delete(tab.id);
      savedVersionRef.current.delete(tab.id);
    }
    setTabs([]);
    setActiveTabId(null);
    apiRef.current?.editor.setModel(null);
    setDirtyVersion((v) => v + 1);
    syncEditorStatus();
  }, [tabs, syncEditorStatus]);

  const closeOtherTabs = useCallback((id: string) => {
    const ids = new Set(tabs.filter((t) => t.id !== id).map((t) => t.id));
    closeTabsByIdSet(ids);
  }, [tabs, closeTabsByIdSet]);

  const closeTabsToRight = useCallback((id: string) => {
    const idx = tabs.findIndex((t) => t.id === id);
    if (idx < 0) return;
    const ids = new Set(tabs.slice(idx + 1).map((t) => t.id));
    closeTabsByIdSet(ids);
  }, [tabs, closeTabsByIdSet]);

  const moveTab = useCallback(
    (tabId: string, targetId: string, position: "before" | "after") => {
      if (tabId === targetId) return;
      setTabs((prev) => {
        const from = prev.findIndex((t) => t.id === tabId);
        const to = prev.findIndex((t) => t.id === targetId);
        if (from < 0 || to < 0) return prev;
        const next = [...prev];
        const [moved] = next.splice(from, 1);
        const toAfterRemoval = from < to ? to - 1 : to;
        const insertAt = position === "before" ? toAfterRemoval : toAfterRemoval + 1;
        next.splice(Math.max(0, Math.min(next.length, insertAt)), 0, moved);
        return next;
      });
    },
    [],
  );

  const isDirty = useCallback(
    (tabId: string) => {
      const m = modelsRef.current.get(tabId);
      if (!m) return false;
      const saved = savedVersionRef.current.get(tabId);
      if (saved === undefined) return false;
      return m.getAlternativeVersionId() !== saved;
    },
    [dirtyVersion],
  );

  const value = useMemo<EditorSessionValue>(
    () => ({
      tabs,
      activeTabId,
      activeFilePath: activeTabId,
      cursorLine,
      cursorColumn,
      encoding,
      eol,
      languageId,
      runEditorAction,
      toggleEol,
      showMessage,
      monacoTheme,
      editorError,
      clearError: () => setEditorError(null),
      isDirty,
      openFile,
      saveActive,
      saveTab,
      saveAllDirty,
      closeAllTabs,
      closeTabs,
      closeOtherTabs,
      closeTabsToRight,
      moveTab,
      selectTab,
      closeTab,
      bindEditor,
      unbindEditor,
    }),
    [
      tabs,
      activeTabId,
      cursorLine,
      cursorColumn,
      encoding,
      eol,
      languageId,
      runEditorAction,
      toggleEol,
      showMessage,
      monacoTheme,
      editorError,
      isDirty,
      openFile,
      saveActive,
      saveTab,
      saveAllDirty,
      closeAllTabs,
      closeTabs,
      closeOtherTabs,
      closeTabsToRight,
      moveTab,
      selectTab,
      closeTab,
      bindEditor,
      unbindEditor,
    ],
  );

  return <EditorSessionContext.Provider value={value}>{children}</EditorSessionContext.Provider>;
}

export function useEditorSession(): EditorSessionValue {
  const ctx = useContext(EditorSessionContext);
  if (!ctx) throw new Error("useEditorSession must be used within EditorSessionProvider");
  return ctx;
}

export function useOptionalEditorSession(): EditorSessionValue | null {
  return useContext(EditorSessionContext);
}
