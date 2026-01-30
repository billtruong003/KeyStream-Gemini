const fs = require("fs");
const config = require("../config");

let keyPool = [];

const loadKeys = () => {
  try {
    if (!fs.existsSync(config.KEY_FILE)) {
      fs.writeFileSync(config.KEY_FILE, "[]");
    }
    const raw = fs.readFileSync(config.KEY_FILE, "utf8");
    const keys = JSON.parse(raw);

    // Create a map for O(1) lookup of existing keys
    const existingKeysMap = new Map(keyPool.map((k) => [k.key, k]));

    keyPool = keys.map((k) => {
      const existing = existingKeysMap.get(k);
      return (
        existing || {
          key: k,
          status: "active",
          usage: 0,
          errors: 0,
          lastUsed: 0,
        }
      );
    });
    console.log(`Loaded ${keyPool.length} keys.`);
  } catch (e) {
    console.error("Error loading keys:", e.message);
  }
};

const saveKeys = async () => {
  try {
    await fs.promises.writeFile(
      config.KEY_FILE,
      JSON.stringify(
        keyPool.map((k) => k.key),
        null,
        2,
      ),
    );
  } catch (e) {
    console.error("Error saving keys:", e.message);
  }
};

const getOptimalKey = (excludeKeys = []) => {
  const now = Date.now();
  let bestKey = null;
  let minLastUsed = Infinity;

  // O(N) search for the best active key
  for (const k of keyPool) {
    if (k.status === "active" && !excludeKeys.includes(k.key)) {
      if (k.lastUsed < minLastUsed) {
        minLastUsed = k.lastUsed;
        bestKey = k;
      }
    }
  }

  if (bestKey) return bestKey;

  // Check for recovered cooldown keys
  const recoveredKey = keyPool.find(
    (k) =>
      k.status === "cooldown" &&
      !excludeKeys.includes(k.key) &&
      now - k.lastUsed > config.KEY_COOLDOWN_TIME,
  );

  if (recoveredKey) {
    recoveredKey.status = "active";
    return recoveredKey;
  }

  return null;
};;

const addKey = (key) => {
  if (key && !keyPool.find((k) => k.key === key)) {
    keyPool.push({ key, status: "active", usage: 0, errors: 0, lastUsed: 0 });
    saveKeys();
    return true;
  }
  return false;
};

const updateKeyStatus = (key, status) => {
  const keyObj = keyPool.find((k) => k.key === key);
  if (keyObj) {
    keyObj.status = status;
    keyObj.lastUsed = Date.now();
  }
};

const incrementKeyErrors = (key) => {
  const keyObj = keyPool.find((k) => k.key === key);
  if (keyObj) {
    keyObj.errors++;
  }
};

const incrementKeyUsage = (key) => {
  const keyObj = keyPool.find((k) => k.key === key);
  if (keyObj) {
    keyObj.usage++;
  }
};

const getKeyPool = () => [...keyPool];

module.exports = {
  loadKeys,
  saveKeys,
  getOptimalKey,
  addKey,
  updateKeyStatus,
  incrementKeyErrors,
  incrementKeyUsage,
  getKeyPool,
};
