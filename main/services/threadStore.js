const fs = require("node:fs");
const path = require("node:path");
const { uuid } = require("./uuid");

const FILENAME = "boson-threads.json";

function getPath(userDataPath) {
  return path.join(userDataPath, FILENAME);
}

function read(userDataPath) {
  const filePath = getPath(userDataPath);
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === "ENOENT") return { threads: [], messagesByThreadId: {} };
    throw err;
  }
}

function write(userDataPath, data) {
  const filePath = getPath(userDataPath);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 0), "utf8");
}

function list(userDataPath, projectId) {
  const data = read(userDataPath);
  const threads = (data.threads || []).filter(
    (t) => t.projectId === projectId && !t.archivedAt
  );
  return threads.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function listArchived(userDataPath, projectId) {
  const data = read(userDataPath);
  const threads = (data.threads || []).filter(
    (t) => t.projectId === projectId && t.archivedAt
  );
  return threads.sort(
    (a, b) => new Date(b.archivedAt) - new Date(a.archivedAt)
  );
}

function create(userDataPath, projectId, title) {
  const data = read(userDataPath);
  if (!data.threads) data.threads = [];
  if (!data.messagesByThreadId) data.messagesByThreadId = {};
  const id = uuid();
  const thread = {
    id,
    projectId,
    title: title || "New thread",
    createdAt: new Date().toISOString(),
  };
  data.threads.push(thread);
  data.messagesByThreadId[id] = [];
  write(userDataPath, data);
  return thread;
}

function get(userDataPath, threadId) {
  const data = read(userDataPath);
  const thread = (data.threads || []).find((t) => t.id === threadId);
  if (!thread) return null;
  const messages = (data.messagesByThreadId || {})[threadId] || [];
  return { ...thread, messages };
}

function appendMessage(userDataPath, threadId, message) {
  const data = read(userDataPath);
  const thread = (data.threads || []).find((t) => t.id === threadId);
  if (!thread) return null;
  if (!data.messagesByThreadId[threadId]) data.messagesByThreadId[threadId] = [];
  const msg = {
    id: message.id || uuid(),
    role: message.role,
    content: message.content,
  };
  data.messagesByThreadId[threadId].push(msg);
  write(userDataPath, data);
  return msg;
}

function updateTitle(userDataPath, threadId, title) {
  if (!title || typeof title !== "string") return false;
  const data = read(userDataPath);
  const thread = (data.threads || []).find((t) => t.id === threadId);
  if (!thread) return false;
  thread.title = title.trim().slice(0, 100) || thread.title;
  write(userDataPath, data);
  return true;
}

function archive(userDataPath, threadId) {
  const data = read(userDataPath);
  const thread = (data.threads || []).find((t) => t.id === threadId);
  if (!thread) return false;
  thread.archivedAt = new Date().toISOString();
  write(userDataPath, data);
  return true;
}

function unarchive(userDataPath, threadId) {
  const data = read(userDataPath);
  const thread = (data.threads || []).find((t) => t.id === threadId);
  if (!thread) return false;
  delete thread.archivedAt;
  write(userDataPath, data);
  return true;
}

module.exports = {
  list,
  listArchived,
  create,
  get,
  appendMessage,
  updateTitle,
  archive,
  unarchive,
  read,
  write,
  getPath,
};
