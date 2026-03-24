import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { FitAddon } from "@xterm/addon-fit";
import { SearchAddon } from "@xterm/addon-search";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

type TerminalSession = {
  id: number;
  name: string;
  shell: string;
  cwd: string;
  createdAt: string;
  status: "running" | "exited";
};

type TerminalDataEvent = {
  sessionId: number;
  data: string;
};

type TerminalExitEvent = {
  sessionId: number;
};

type TerminalCreateResponse = {
  sessionId: number;
  shell: string;
};

type PersistedSessionSeed = {
  name: string;
  cwd: string;
};

const TERMINAL_SESSIONS_KEY = "boson.terminal.sessions";

let terminalSessions: TerminalSession[] = [];
const terminalListeners = new Set<() => void>();
const terminalsById = new Map<number, Terminal>();
const fitById = new Map<number, FitAddon>();
const searchById = new Map<number, SearchAddon>();
const pendingData = new Map<number, string[]>();
let activeSessionIdGlobal: number | null = null;
let lastSearchTerm = "";

export function getActiveTerminalSessionId(): number | null {
  return activeSessionIdGlobal;
}

function emitTerminalChange() {
  terminalListeners.forEach((l) => l());
}

function subscribeTerminal(listener: () => void) {
  terminalListeners.add(listener);
  return () => terminalListeners.delete(listener);
}

function getTerminalSnapshot() {
  return terminalSessions;
}

function persistSessionSeeds() {
  if (typeof window === "undefined") return;
  const seeds: PersistedSessionSeed[] = terminalSessions.map((s) => ({
    name: s.name,
    cwd: s.cwd,
  }));
  localStorage.setItem(TERMINAL_SESSIONS_KEY, JSON.stringify(seeds));
}

function readSessionSeeds(): PersistedSessionSeed[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(TERMINAL_SESSIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (x) => x && typeof x.name === "string" && typeof x.cwd === "string",
      )
      .map((x) => ({ name: x.name, cwd: x.cwd }));
  } catch {
    return [];
  }
}

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function readThemeVar(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return value || fallback;
}

function applyTerminalTheme(term: Terminal) {
  term.options.theme = {
    background: readThemeVar("--background", "#111111"),
    foreground: readThemeVar("--foreground", "#f5f5f5"),
    cursor: readThemeVar("--foreground", "#f5f5f5"),
    selectionBackground: readThemeVar("--primary", "#3b82f6"),
  };
}

function createXterm(sessionId: number): Terminal {
  const term = new Terminal({
    cursorBlink: true,
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    fontSize: 12,
    scrollback: 2000,
    convertEol: true,
  });
  applyTerminalTheme(term);
  const fitAddon = new FitAddon();
  const searchAddon = new SearchAddon();
  term.loadAddon(fitAddon);
  term.loadAddon(searchAddon);
  terminalsById.set(sessionId, term);
  fitById.set(sessionId, fitAddon);
  searchById.set(sessionId, searchAddon);
  term.onData((data) => {
    void invoke("terminal_write", { sessionId, data });
  });
  return term;
}

async function createTerminalSessionInternal(seed?: PersistedSessionSeed) {
  if (!isTauriRuntime()) return null;
  const cwd = seed?.cwd || "/Volumes/External/Code/boson";
  try {
    const created = await invoke<TerminalCreateResponse>("terminal_create", {
      cwd,
    });
    const session: TerminalSession = {
      id: created.sessionId,
      name: seed?.name || `${created.shell} ${created.sessionId}`,
      shell: created.shell,
      cwd,
      createdAt: new Date().toLocaleTimeString(),
      status: "running",
    };
    terminalSessions = [...terminalSessions, session];
    persistSessionSeeds();
    emitTerminalChange();
    return session;
  } catch {
    return null;
  }
}

export function createTerminalSession() {
  void createTerminalSessionInternal();
}

export function killTerminalSession(sessionId: number) {
  const session = terminalSessions.find((s) => s.id === sessionId);
  if (!session) return;
  void invoke("terminal_kill", { sessionId });
  terminalsById.get(session.id)?.dispose();
  terminalsById.delete(session.id);
  fitById.delete(session.id);
  searchById.delete(session.id);
  pendingData.delete(session.id);
  terminalSessions = terminalSessions.filter((s) => s.id !== session.id);
  persistSessionSeeds();
  emitTerminalChange();
}

export function killOtherTerminalSessions(sessionId: number) {
  terminalSessions
    .filter((s) => s.id !== sessionId)
    .forEach((s) => killTerminalSession(s.id));
}

export function clearTerminalSessions() {
  [...terminalSessions].forEach((s) => killTerminalSession(s.id));
}

export function renameTerminalSession(sessionId: number, name: string) {
  const trimmed = name.trim();
  if (!trimmed) return;
  terminalSessions = terminalSessions.map((s) =>
    s.id === sessionId ? { ...s, name: trimmed } : s,
  );
  persistSessionSeeds();
  emitTerminalChange();
}

export function clearActiveTerminalBuffer() {
  if (!activeSessionIdGlobal) return;
  terminalsById.get(activeSessionIdGlobal)?.clear();
}

export function searchInActiveTerminal(term: string) {
  if (!activeSessionIdGlobal) return;
  const search = searchById.get(activeSessionIdGlobal);
  if (!search) return;
  lastSearchTerm = term;
  search.findNext(term, { caseSensitive: false });
}

export function findNextInActiveTerminal() {
  if (!activeSessionIdGlobal || !lastSearchTerm) return;
  searchById
    .get(activeSessionIdGlobal)
    ?.findNext(lastSearchTerm, { caseSensitive: false });
}

export function findPreviousInActiveTerminal() {
  if (!activeSessionIdGlobal || !lastSearchTerm) return;
  searchById
    .get(activeSessionIdGlobal)
    ?.findPrevious(lastSearchTerm, { caseSensitive: false });
}

export async function copyActiveTerminalSelection() {
  if (!activeSessionIdGlobal || typeof navigator === "undefined") return;
  const term = terminalsById.get(activeSessionIdGlobal);
  const selected = term?.getSelection() ?? "";
  if (!selected.trim()) return;
  await navigator.clipboard.writeText(selected);
}

export async function pasteIntoActiveTerminal() {
  if (!activeSessionIdGlobal || typeof navigator === "undefined") return;
  const text = await navigator.clipboard.readText();
  const term = terminalsById.get(activeSessionIdGlobal);
  if (!term || !text) return;
  term.paste(text);
}

export function focusActiveTerminal() {
  if (!activeSessionIdGlobal) return;
  terminalsById.get(activeSessionIdGlobal)?.focus();
}

function selectAllActiveTerminal() {
  if (!activeSessionIdGlobal) return;
  terminalsById.get(activeSessionIdGlobal)?.selectAll();
}

function markSessionExited(sessionId: number) {
  terminalSessions = terminalSessions.map((s) =>
    s.id === sessionId ? { ...s, status: "exited" } : s,
  );
  emitTerminalChange();
}

export function TerminalView() {
  const sessions = useSyncExternalStore(subscribeTerminal, getTerminalSnapshot);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const mountRef = useRef<HTMLDivElement | null>(null);

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeSessionId) ?? null,
    [sessions, activeSessionId],
  );

  useEffect(() => {
    activeSessionIdGlobal = activeSessionId;
  }, [activeSessionId]);

  useEffect(() => {
    if (!isTauriRuntime()) return;
    const unlistenData = listen<TerminalDataEvent>("terminal-data", (event) => {
      const payload = event.payload;
      const term = terminalsById.get(payload.sessionId);
      if (term) {
        term.write(payload.data);
      } else {
        const queue = pendingData.get(payload.sessionId) ?? [];
        queue.push(payload.data);
        pendingData.set(payload.sessionId, queue);
      }
    });
    const unlistenExit = listen<TerminalExitEvent>("terminal-exit", (event) => {
      markSessionExited(event.payload.sessionId);
    });
    return () => {
      void unlistenData.then((u) => u());
      void unlistenExit.then((u) => u());
    };
  }, []);

  useEffect(() => {
    if (!isTauriRuntime()) return;
    if (sessions.length === 0) {
      setActiveSessionId(null);
      return;
    }
    if (!activeSessionId || !sessions.some((s) => s.id === activeSessionId)) {
      setActiveSessionId(sessions[sessions.length - 1]?.id ?? null);
    }
  }, [sessions, activeSessionId]);

  useEffect(() => {
    if (!isTauriRuntime()) return;
    if (!activeSessionId || !mountRef.current) return;

    let term = terminalsById.get(activeSessionId);
    if (!term) {
      term = createXterm(activeSessionId);
    }

    const host = mountRef.current;
    host.innerHTML = "";
    term.open(host);
    const fitAddon = fitById.get(activeSessionId);
    fitAddon?.fit();
    term.focus();

    void invoke("terminal_resize", {
      sessionId: activeSessionId,
      cols: term.cols,
      rows: term.rows,
    });

    const queued = pendingData.get(activeSessionId);
    if (queued && queued.length > 0) {
      queued.forEach((chunk) => term!.write(chunk));
      pendingData.delete(activeSessionId);
    }

    const observer = new ResizeObserver(() => {
      fitAddon?.fit();
      void invoke("terminal_resize", {
        sessionId: activeSessionId,
        cols: term!.cols,
        rows: term!.rows,
      });
    });
    observer.observe(host);
    return () => observer.disconnect();
  }, [activeSessionId]);

  useEffect(() => {
    if (!isTauriRuntime()) return;
    if (sessions.length > 0) return;
    const seeds = readSessionSeeds();
    if (seeds.length === 0) {
      createTerminalSession();
      return;
    }
    void (async () => {
      for (const seed of seeds) {
        await createTerminalSessionInternal(seed);
      }
    })();
  }, [sessions.length]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const syncTheme = () => {
      terminalsById.forEach((term) => applyTerminalTheme(term));
    };
    const observer = new MutationObserver(syncTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style"],
    });
    return () => observer.disconnect();
  }, []);

  if (!isTauriRuntime()) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center p-3">
        Terminal is available in the Tauri desktop runtime.
      </div>
    );
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          className="flex h-full min-h-0 flex-col bg-background text-foreground"
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "f") {
              e.preventDefault();
              const term = window.prompt("Find in terminal");
              if (term) searchInActiveTerminal(term);
            }
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "c") {
              void copyActiveTerminalSelection();
            }
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "v") {
              e.preventDefault();
              void pasteIntoActiveTerminal();
            }
          }}
          tabIndex={0}
        >
          {sessions.length === 0 ? (
            <div className="text-muted-foreground flex h-full items-center justify-center">
              Starting terminal...
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-row overflow-hidden">
              <div className="min-h-0 min-w-0 flex-1 p-2">
                <div
                  ref={mountRef}
                  className="bg-background h-full w-full overflow-hidden rounded-sm"
                />
              </div>
              <aside className="bg-background w-36 shrink-0 border-l border-border">
                <div className="p-1.5">
                  {sessions.map((session) => {
                    const active = session.id === activeSessionId;
                    return (
                      <div
                        key={session.id}
                        className={`mb-1 flex w-full items-center gap-1 rounded-sm px-1.5 py-1 text-left text-[11px] ${
                          active
                            ? "bg-background text-foreground"
                            : "text-muted-foreground hover:bg-muted-foreground/10 hover:text-foreground"
                        }`}
                        role="button"
                        tabIndex={0}
                        onClick={() => setActiveSessionId(session.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setActiveSessionId(session.id);
                          }
                        }}
                      >
                        <span
                          className={`inline-block size-1.5 rounded-full ${
                            session.status === "running"
                              ? "bg-primary"
                              : "bg-muted-foreground"
                          }`}
                        />
                        <span className="min-w-0 flex-1 truncate">
                          {session.name}
                        </span>
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground inline-flex size-4 items-center justify-center rounded-sm hover:bg-muted/60"
                          aria-label={`Terminate ${session.name}`}
                          title="Terminate terminal"
                          onClick={(e) => {
                            e.stopPropagation();
                            killTerminalSession(session.id);
                          }}
                        >
                          x
                        </button>
                      </div>
                    );
                  })}
                </div>
              </aside>
            </div>
          )}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem onSelect={() => createTerminalSession()}>
          New Terminal
        </ContextMenuItem>
        <ContextMenuItem
          disabled={!activeSession}
          onSelect={() => {
            if (!activeSession) return;
            const renamed = window.prompt(
              "Rename terminal",
              activeSession.name,
            );
            if (renamed) renameTerminalSession(activeSession.id, renamed);
          }}
        >
          Rename
        </ContextMenuItem>
        <ContextMenuItem
          disabled={!activeSession}
          onSelect={() => {
            if (!activeSession) return;
            killTerminalSession(activeSession.id);
          }}
        >
          Kill Terminal
        </ContextMenuItem>
        <ContextMenuItem
          disabled={!activeSession || sessions.length <= 1}
          onSelect={() => {
            if (!activeSession) return;
            killOtherTerminalSessions(activeSession.id);
          }}
        >
          Kill Others
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={() => clearActiveTerminalBuffer()}>
          Clear
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => selectAllActiveTerminal()}>
          Select All
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => void copyActiveTerminalSelection()}>
          Copy
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => void pasteIntoActiveTerminal()}>
          Paste
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          onSelect={() => {
            const term = window.prompt("Find in terminal");
            if (term) searchInActiveTerminal(term);
          }}
        >
          Find...
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => findNextInActiveTerminal()}>
          Find Next
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => findPreviousInActiveTerminal()}>
          Find Previous
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
