const nodeEl = document.getElementById("node-version");
const chromeEl = document.getElementById("chrome-version");
const electronEl = document.getElementById("electron-version");
const pingBtn = document.getElementById("ping-btn");
const pingResult = document.getElementById("ping-result");

nodeEl.textContent = window.api.versions.node;
chromeEl.textContent = window.api.versions.chrome;
electronEl.textContent = window.api.versions.electron;

pingBtn.addEventListener("click", async () => {
  pingResult.textContent = "Pinging...";

  try {
    const response = await window.api.ping();
    pingResult.textContent = `Main replied: ${response}`;
  } catch (error) {
    pingResult.textContent = `Ping failed: ${error.message}`;
  }
});
