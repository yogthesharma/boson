const { ipcMain, app, powerSaveBlocker } = require("electron/main");
const chatClient = require("../services/chatClient");
const appSettingsService = require("../services/appSettings");
const threadStore = require("../services/threadStore");

function getUserDataPath() {
  return app.getPath("userData");
}

function register() {
  ipcMain.handle("chat:send", async (_e, payload) => {
    const settings = await appSettingsService.getAppSettings(getUserDataPath());
    const preventSleep = settings?.general?.preventSleepWhileRunning !== false;
    let saveBlockerId = null;
    if (preventSleep) {
      saveBlockerId = powerSaveBlocker.start("prevent-app-suspension");
    }
    try {
      return await chatClient.send(getUserDataPath(), payload);
    } finally {
      if (saveBlockerId != null) {
        powerSaveBlocker.stop(saveBlockerId);
      }
    }
  });

  ipcMain.handle("chat:startStream", async (e, payload, threadId) => {
    const sender = e.sender;
    const userDataPath = getUserDataPath();
    const settings = await appSettingsService.getAppSettings(userDataPath);
    const preventSleep = settings?.general?.preventSleepWhileRunning !== false;
    let saveBlockerId = null;
    if (preventSleep) {
      saveBlockerId = powerSaveBlocker.start("prevent-app-suspension");
    }

    const emit = (event, data) => {
      if (!sender.isDestroyed()) sender.send("chat:stream:" + event, data);
    };

    let userMsg = null;
    if (threadId && payload.messages?.length) {
      const last = payload.messages[payload.messages.length - 1];
      if (last.role === "user" && typeof last.content === "string") {
        userMsg = threadStore.appendMessage(userDataPath, threadId, {
          role: "user",
          content: last.content,
        });
        // As soon as user sends first message, fire an LLM call to name the thread (runs in parallel with main response)
        const thread = threadStore.get(userDataPath, threadId);
        const currentTitle = thread?.title?.trim() || "";
        const isDefaultTitle = !currentTitle || currentTitle === "New thread";
        const firstUserContent = last.content.trim();
        if (isDefaultTitle && firstUserContent && payload.modelProfileId) {
          (async () => {
            try {
              if (process.env.NODE_ENV === "development") {
                console.log("[threads] Generating title for thread", threadId);
              }
              const title = await chatClient.generateTitle(
                userDataPath,
                payload.modelProfileId,
                firstUserContent
              );
              if (title && !sender.isDestroyed()) {
                const updated = threadStore.updateTitle(userDataPath, threadId, title);
                if (updated) {
                  sender.send("threads:titleUpdated", { threadId, title });
                  if (process.env.NODE_ENV === "development") {
                    console.log("[threads] Title updated:", threadId, title);
                  }
                }
              } else if (process.env.NODE_ENV === "development" && !title) {
                console.warn("[threads] generateTitle returned empty for thread", threadId);
              }
            } catch (err) {
              if (process.env.NODE_ENV === "development") {
                console.error("[threads] Title generation failed:", threadId, err?.message || err);
              }
            }
          })();
        }
      }
    }

    try {
      await chatClient.sendStreamWithEvents(userDataPath, payload, (event, data) => {
        if (event === "done" && threadId && userMsg) {
          const assistantMsg = threadStore.appendMessage(userDataPath, threadId, {
            role: data.role,
            content: data.content,
          });
          emit("done", { threadId, userMessage: userMsg, assistantMessage: assistantMsg });
        } else {
          emit(event, data);
        }
      });
    } finally {
      if (saveBlockerId != null) {
        powerSaveBlocker.stop(saveBlockerId);
      }
    }
  });
}

module.exports = { register };
