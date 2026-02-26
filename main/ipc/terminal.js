const { ipcMain } = require("electron/main");
const { spawn } = require("node:child_process");
const os = require("node:os");

const sessions = new Map();

function getDefaultShell() {
  if (process.platform === "win32") return process.env.COMSPEC || "cmd.exe";
  return process.env.SHELL || (process.platform === "darwin" ? "/bin/zsh" : "/bin/bash");
}

function cleanupSession(webContentsId) {
  const session = sessions.get(webContentsId);
  if (!session) return;
  try {
    session.proc.kill();
  } catch {
    // no-op: process may already be closed
  }
  sessions.delete(webContentsId);
}

function register() {
  ipcMain.handle("terminal:start", (event, options = {}) => {
    const wc = event.sender;
    const key = wc.id;
    const existing = sessions.get(key);
    if (existing && !existing.proc.killed) {
      return {
        started: true,
        shell: existing.shell,
        cwd: existing.cwd,
        pid: existing.proc.pid ?? null,
      };
    }

    const shell = getDefaultShell();
    const cwd =
      typeof options.cwd === "string" && options.cwd.trim().length > 0
        ? options.cwd
        : process.cwd();

    const args = process.platform === "win32" ? [] : ["-l"];
    const proc = spawn(shell, args, {
      cwd,
      env: {
        ...process.env,
        TERM: "xterm-256color",
        COLORTERM: "truecolor",
      },
      stdio: "pipe",
    });

    proc.stdout.on("data", (chunk) => {
      if (!wc.isDestroyed()) wc.send("terminal:data", chunk.toString("utf8"));
    });
    proc.stderr.on("data", (chunk) => {
      if (!wc.isDestroyed()) wc.send("terminal:data", chunk.toString("utf8"));
    });
    proc.on("close", (code, signal) => {
      if (!wc.isDestroyed()) wc.send("terminal:exit", { code, signal });
      sessions.delete(key);
    });

    wc.once("destroyed", () => cleanupSession(key));

    sessions.set(key, { proc, shell, cwd });
    return {
      started: true,
      shell,
      cwd,
      pid: proc.pid ?? null,
    };
  });

  ipcMain.handle("terminal:write", (event, input) => {
    const session = sessions.get(event.sender.id);
    if (!session || session.proc.killed) return { ok: false, error: "TERMINAL_NOT_STARTED" };
    const text = typeof input === "string" ? input : "";
    if (text.length > 8192) return { ok: false, error: "INPUT_TOO_LARGE" };
    session.proc.stdin.write(text);
    return { ok: true };
  });

  ipcMain.handle("terminal:stop", (event) => {
    cleanupSession(event.sender.id);
    return { ok: true };
  });
}

module.exports = { register };
