import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

type TerminalSession = {
  id: number;
  cwd: string;
  createdAt: string;
  lines: string[];
};

let nextTerminalId = 2;
let terminalSessions: TerminalSession[] = [
  {
    id: 1,
    cwd: "~/Code/boson",
    createdAt: "Tue Mar 24 09:00:00",
    lines: ["Vite dev server + Tauri running."],
  },
];
const terminalListeners = new Set<() => void>();

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

export function createTerminalSession() {
  terminalSessions = [
    ...terminalSessions,
    {
      id: nextTerminalId++,
      cwd: "~/Code/boson",
      createdAt: new Date().toLocaleTimeString(),
      lines: ["New terminal started."],
    },
  ];
  emitTerminalChange();
}

export function clearTerminalSessions() {
  terminalSessions = [];
  emitTerminalChange();
}

export function TerminalView() {
  const sessions = useSyncExternalStore(subscribeTerminal, getTerminalSnapshot);
  const [draft, setDraft] = useState("");
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (sessions.length === 0) {
      setActiveSessionId(null);
      return;
    }
    if (!activeSessionId || !sessions.some((s) => s.id === activeSessionId)) {
      setActiveSessionId(sessions[sessions.length - 1]?.id ?? null);
    }
  }, [sessions, activeSessionId]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [activeSessionId]);

  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    scroller.scrollTop = scroller.scrollHeight;
  }, [sessions, activeSessionId]);

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeSessionId) ?? null,
    [sessions, activeSessionId],
  );

  const runCommand = (command: string) => {
    const trimmed = command.trim();
    if (!trimmed || !activeSession) return;
    terminalSessions = terminalSessions.map((session) => {
      if (session.id !== activeSession.id) return session;
      const nextLines = [
        ...session.lines,
        `➜ ${session.cwd} ${trimmed}`,
        trimmed === "clear" ? "__BOSON_CLEAR__" : `command not found: ${trimmed}`,
      ];
      const normalized = trimmed === "clear" ? [] : nextLines;
      return { ...session, lines: normalized };
    });
    setDraft("");
    emitTerminalChange();
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-background font-mono text-xs text-foreground">
      {sessions.length === 0 ? (
        <div className="text-muted-foreground flex h-full items-center justify-center">
          No active terminals.
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="border-border bg-muted/40 flex h-7 items-center gap-1 border-b px-2">
            {sessions.map((session) => {
              const active = session.id === activeSessionId;
              return (
                <button
                  key={session.id}
                  type="button"
                  className={`rounded-sm px-2 py-0.5 text-[11px] ${
                    active ? "bg-background text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => setActiveSessionId(session.id)}
                >
                  terminal {session.id}
                </button>
              );
            })}
          </div>
          <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto px-3 py-2 leading-6">
            {activeSession ? (
              <>
                <div className="text-muted-foreground">Last login: {activeSession.createdAt} on ttys00{activeSession.id}</div>
                {activeSession.lines.map((line, index) => (
                  <div key={`${activeSession.id}-${index}`} className="whitespace-pre-wrap break-words">
                    {line}
                  </div>
                ))}
              </>
            ) : null}
          </div>
          {activeSession ? (
            <form
              className="border-border flex items-center gap-2 border-t px-3 py-2"
              onSubmit={(e) => {
                e.preventDefault();
                runCommand(draft);
              }}
            >
              <span className="text-primary">➜</span>
              <span className="text-muted-foreground">{activeSession.cwd}</span>
              <input
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="text-foreground placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent outline-none"
                placeholder="Type a command..."
                aria-label="Terminal command input"
              />
            </form>
          ) : null}
        </div>
      )}
    </div>
  );
}
