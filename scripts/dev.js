const { spawn } = require("node:child_process");
const path = require("node:path");
const http = require("node:http");

const VITE_PORT = 5173;
const DEV_SERVER_URL = `http://127.0.0.1:${VITE_PORT}`;

function waitForServer(maxAttempts = 40, intervalMs = 300) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const check = () => {
      const req = http.get(DEV_SERVER_URL, (res) => {
        res.resume();
        resolve();
      });
      req.on("error", () => {
        attempts++;
        if (attempts >= maxAttempts) {
          reject(new Error(`Vite did not become ready at ${DEV_SERVER_URL}`));
          return;
        }
        setTimeout(check, intervalMs);
      });
      req.setTimeout(2000, () => {
        req.destroy();
      });
    };
    check();
  });
}

const root = path.join(__dirname, "..");
const isWin = process.platform === "win32";
const electronCli = path.join(root, "node_modules", "electron", "cli.js");
const viteBin = path.join(root, "node_modules", ".bin", isWin ? "vite.cmd" : "vite");

console.log("[dev] Starting Vite...");
const vite = spawn(viteBin, [], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, FORCE_COLOR: "1" },
});

vite.on("error", (err) => {
  console.error("[dev] Failed to start Vite:", err);
  process.exit(1);
});

waitForServer()
  .then(() => {
    console.log("[dev] Vite ready. Launching Electron...");
    const devEnv = {
      ...process.env,
      NODE_ENV: "development",
      VITE_DEV_SERVER_URL: DEV_SERVER_URL,
    };
    const electron = spawn(process.execPath, [electronCli, root], {
      cwd: root,
      stdio: "inherit",
      env: devEnv,
    });
    electron.on("close", (code, signal) => {
      console.log("[dev] Electron closed. Stopping Vite.");
      vite.kill();
      process.exit(code !== null && code !== undefined ? code : 0);
    });
    electron.on("error", (err) => {
      console.error("[dev] Failed to start Electron:", err);
      vite.kill();
      process.exit(1);
    });
  })
  .catch((err) => {
    console.error("[dev]", err.message);
    vite.kill();
    process.exit(1);
  });

process.on("SIGINT", () => {
  vite.kill();
  process.exit(0);
});
process.on("SIGTERM", () => {
  vite.kill();
  process.exit(0);
});
