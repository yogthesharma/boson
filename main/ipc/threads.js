const { ipcMain, app } = require("electron/main");
const threadStore = require("../services/threadStore");
const chatClient = require("../services/chatClient");

function getUserDataPath() {
  return app.getPath("userData");
}

function register() {
  ipcMain.handle("threads:list", async (_e, projectId) => {
    return threadStore.list(getUserDataPath(), projectId);
  });

  ipcMain.handle("threads:listArchived", async (_e, projectId) => {
    return threadStore.listArchived(getUserDataPath(), projectId);
  });

  ipcMain.handle("threads:archive", async (_e, threadId) => {
    return threadStore.archive(getUserDataPath(), threadId);
  });

  ipcMain.handle("threads:unarchive", async (_e, threadId) => {
    return threadStore.unarchive(getUserDataPath(), threadId);
  });

  ipcMain.handle("threads:create", async (_e, projectId, title) => {
    return threadStore.create(getUserDataPath(), projectId, title);
  });

  ipcMain.handle("threads:get", async (_e, threadId) => {
    return threadStore.get(getUserDataPath(), threadId);
  });

  ipcMain.handle("threads:appendMessage", async (_e, threadId, message) => {
    return threadStore.appendMessage(getUserDataPath(), threadId, message);
  });

  ipcMain.handle("threads:sendMessage", async (_e, threadId, text, modelProfileId) => {
    const userDataPath = getUserDataPath();
    const userMsg = threadStore.appendMessage(userDataPath, threadId, {
      role: "user",
      content: text,
    });
    if (!userMsg) return { error: "THREAD_NOT_FOUND", message: "Thread not found" };
    const thread = threadStore.get(userDataPath, threadId);
    const messageHistory = (thread?.messages || []).map((m) => ({
      role: m.role,
      content: m.content,
    }));
    const result = await chatClient.send(userDataPath, {
      modelProfileId,
      messages: messageHistory,
    });
    if (result.error) return result;
    const assistantMsg = threadStore.appendMessage(userDataPath, threadId, {
      role: result.role,
      content: result.content,
    });
    return { userMessage: userMsg, assistantMessage: assistantMsg };
  });

  ipcMain.handle(
    "threads:sendMessageStream",
    async (e, threadId, text, modelProfileId) => {
      const userDataPath = getUserDataPath();
      const sender = e.sender;
      const userMsg = threadStore.appendMessage(userDataPath, threadId, {
        role: "user",
        content: text,
      });
      if (!userMsg)
        return { error: "THREAD_NOT_FOUND", message: "Thread not found" };
      const thread = threadStore.get(userDataPath, threadId);
      const messageHistory = (thread?.messages || []).map((m) => ({
        role: m.role,
        content: m.content,
      }));
      const result = await chatClient.sendStream(
        userDataPath,
        { modelProfileId, messages: messageHistory },
        (chunk) => {
          if (!sender.isDestroyed()) {
            sender.send("chat:streamChunk", { chunk });
          }
        }
      );
      if (result.error) return result;
      const assistantMsg = threadStore.appendMessage(userDataPath, threadId, {
        role: result.role,
        content: result.content,
      });
      return { userMessage: userMsg, assistantMessage: assistantMsg };
    }
  );
}

module.exports = { register };
