const path = require("path");

module.exports = {
  PORT: process.env.PORT || 13337,
  KEY_FILE: path.join(__dirname, "../keys.json"),
  HISTORY_FILE: path.join(__dirname, "../history.json"),
  GEMINI_API_BASE_URL: "https://generativelanguage.googleapis.com/v1beta/models",
  KEY_COOLDOWN_TIME: 60000, // 1 minute
  MODEL_FETCH_INTERVAL: 3600000, // 1 hour
  INITIAL_MODEL_FETCH_DELAY: 2000, // 2 seconds
};