const path = require("node:path");
const { app, BrowserWindow, ipcMain, nativeTheme, session, dialog } = require("electron/main");
const settingsIpc = require(path.join(__dirname, "main", "ipc", "settings"));
const chatIpc = require(path.join(__dirname, "main", "ipc", "chat"));
const terminalIpc = require(path.join(__dirname, "main", "ipc", "terminal"));
let threadsIpc;
try {
  threadsIpc = require(path.join(__dirname, "main", "ipc", "threads"));
} catch (err) {
  console.error("[main] Failed to load threads IPC:", err.message);
}

const PRODUCTION_CSP =
  "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'";

function getTheme() {
  return nativeTheme.shouldUseDarkColors ? "dark" : "light";
}

function sendThemeToAllWindows() {
  const theme = getTheme();
  BrowserWindow.getAllWindows().forEach((win) => {
    if (win.webContents && !win.webContents.isDestroyed()) {
      win.webContents.send("theme-changed", theme);
    }
  });
}

const isDev = process.env.NODE_ENV === "development";

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1100,
    height: 700,
    minWidth: 900,
    minHeight: 600,
    show: true,
    title: "Boson",
    frame: true,
    autoHideMenuBar: true,
    titleBarStyle: "hidden",
    ...(process.platform === "darwin" && { titleBarStyle: "hiddenInset" }),
    webPreferences: {
      preload: path.join(__dirname, "src", "preload", "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const loadUrl =
    isDev && process.env.VITE_DEV_SERVER_URL
      ? process.env.VITE_DEV_SERVER_URL
      : "file://" +
        path.join(__dirname, "dist-renderer", "index.html").replace(/\\/g, "/");
  win.loadURL(loadUrl).catch((err) => {
    console.error("Failed to load URL:", err);
    win.show();
  });
  win.once("ready-to-show", () => win.show());
  if (isDev) {
    setTimeout(() => win.show(), 1000);
    win.webContents.openDevTools();
  }
};

nativeTheme.on("updated", sendThemeToAllWindows);

ipcMain.handle("app:ping", () => "pong");
ipcMain.handle("dialog:showOpenDirectory", async () => {
  const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
  return dialog.showOpenDialog(win || BrowserWindow.getAllWindows()[0], {
    properties: ["openDirectory"],
  });
});
ipcMain.handle("get-theme", () => getTheme());
ipcMain.handle("get-theme-source", () => nativeTheme.themeSource);
ipcMain.handle("set-theme", (_event, source) => {
  if (source === "light" || source === "dark" || source === "system") {
    nativeTheme.themeSource = source;
  }
});

app.whenReady().then(() => {
  if (!isDev) {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      const url = details.url || "";
      const isLocalRenderer =
        url.startsWith("file://") && url.includes("dist-renderer");
      if (isLocalRenderer) {
        const headers = { ...details.responseHeaders };
        headers["content-security-policy"] = [PRODUCTION_CSP];
        callback({ responseHeaders: headers });
      } else {
        callback({ responseHeaders: details.responseHeaders });
      }
    });
  }
  settingsIpc.register();
  chatIpc.register();
  terminalIpc.register();
  if (threadsIpc && typeof threadsIpc.register === "function") {
    threadsIpc.register();
  } else {
    console.error("[main] threads IPC not available; create/select thread will not work. Restart the app (kill Electron and run pnpm dev again).");
  }
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
