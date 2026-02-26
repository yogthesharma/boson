const fs = require("node:fs");
const path = require("node:path");

const FILENAME = "boson-settings.json";

function getPath(userDataPath) {
  return path.join(userDataPath, FILENAME);
}

function read(userDataPath) {
  const filePath = getPath(userDataPath);
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === "ENOENT") return { endpointProfiles: [], modelProfiles: [] };
    throw err;
  }
}

function write(userDataPath, data) {
  const filePath = getPath(userDataPath);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 0), "utf8");
}

module.exports = {
  read,
  write,
  getPath,
};
