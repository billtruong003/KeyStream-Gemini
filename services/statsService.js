const fs = require("fs");
const config = require("../config");

let stats = {
  totalRequests: 0,
  totalSuccess: 0,
  totalErrors: 0,
  dailyStats: {}, // Format: "YYYY-MM-DD": { requests: 0, errors: 0 }
  modelUsage: {}, // Format: "model-name": count
  keyUsage: {}, // Format: "key": { requests: 0, errors: 0 }
};

let saveTimer = null;

const initialize = () => {
  try {
    if (fs.existsSync(config.HISTORY_FILE)) {
      const raw = fs.readFileSync(config.HISTORY_FILE, "utf8");
      const loaded = JSON.parse(raw);
      // Merge loaded stats to ensure structure compatibility
      stats = { ...stats, ...loaded };
      console.log("📊 Stats loaded successfully.");
    } else {
      console.log("✨ Creating new history database.");
      saveStats();
    }
  } catch (e) {
    console.error("⚠️ Error loading stats:", e.message);
  }
};

const saveStats = async () => {
  try {
    await fs.promises.writeFile(
      config.HISTORY_FILE,
      JSON.stringify(stats, null, 2),
    );
  } catch (e) {
    console.error("⚠️ Error saving stats:", e.message);
  }
};

// Debounce save to avoid disk I/O spam
const scheduleSave = () => {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(saveStats, 10000); // Save every 10 seconds if active
};

const trackRequest = (key, model, isSuccess) => {
  const today = new Date().toISOString().split("T")[0];

  // 1. Global Stats
  stats.totalRequests++;
  if (isSuccess) stats.totalSuccess++;
  else stats.totalErrors++;

  // 2. Daily Stats
  if (!stats.dailyStats[today]) {
    stats.dailyStats[today] = { requests: 0, errors: 0 };
  }
  stats.dailyStats[today].requests++;
  if (!isSuccess) stats.dailyStats[today].errors++;

  // 3. Model Usage
  if (model) {
    const cleanModel = model.replace("models/", "");
    if (!stats.modelUsage[cleanModel]) stats.modelUsage[cleanModel] = 0;
    stats.modelUsage[cleanModel]++;
  }

  // 4. Key Usage
  if (key) {
    // Use full key to allow mapping back to KeyService
    if (!stats.keyUsage[key]) stats.keyUsage[key] = { requests: 0, errors: 0 };
    stats.keyUsage[key].requests++;
    if (!isSuccess) stats.keyUsage[key].errors++;
  }

  scheduleSave();
};

const getStats = () => {
  return { ...stats };
};

module.exports = {
  initialize,
  trackRequest,
  getStats,
};
