import { useSyncExternalStore } from "react";

type TerminalSession = {
  id: number;
  command: string;
  cwd: string;
  createdAt: string;
};

let nextTerminalId = 2;
let terminalSessions: TerminalSession[] = [
  {
    id: 1,
    command: "pnpm tauri dev",
    cwd: "~/Code/boson",
    createdAt: "Tue Mar 24 09:00:00",
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
      command: "",
      cwd: "~/Code/boson",
      createdAt: new Date().toLocaleTimeString(),
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

  return (
    <div className="flex h-full min-h-0 flex-col bg-zinc-950 px-3 py-2 font-mono text-[13px] leading-6 text-zinc-100 dark:bg-black/80">
      {sessions.length === 0 ? (
        <div className="flex h-full items-center justify-center text-zinc-500">
          No active terminals.
        </div>
      ) : (
        sessions.map((session) => (
          <div key={session.id} className="mb-3 last:mb-0">
            <div className="text-zinc-500">Last login: {session.createdAt} on ttys00{session.id}</div>
            <div className="mt-1">
              <span className="text-emerald-400">➜</span> <span className="text-sky-400">{session.cwd}</span>{" "}
              <span className="text-zinc-400">main</span>
            </div>
            <div className="mt-1 flex items-center gap-1">
              <span className="text-emerald-400">➜</span>{" "}
              <span className="text-sky-400">{session.cwd}</span>{" "}
              <span className="text-zinc-300">{session.command || "(new terminal)"}</span>
            </div>
            <div className="mt-2 flex items-center gap-1">
              <span className="text-emerald-400">➜</span> <span className="text-sky-400">{session.cwd}</span>{" "}
              <span className="inline-block h-4 w-2 animate-pulse bg-emerald-400/90" aria-hidden />
            </div>
          </div>
        ))
      )}
    </div>
  );
}
