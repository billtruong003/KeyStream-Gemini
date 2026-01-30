const express = require("express");
const keyService = require("../services/keyService");
const geminiService = require("../services/geminiService");
const statsService = require("../services/statsService");

const handleRequest = async (req, res, io, attemptedKeys = []) => {
  const keyObj = keyService.getOptimalKey(attemptedKeys);

  if (!keyObj) {
    return res.status(429).json({
      error: {
        message: "All keys are currently exhausted or in cooldown. Please wait.",
        code: 429,
      },
    });
  }

  keyService.updateKeyStatus(keyObj.key, "active");
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  const currentKey = keyObj.key;
  let targetModel = req.body.model || "gemini-pro";
  
  // Clean model name
  targetModel = targetModel
    .replace("models/", "")
    .replace(/^Proxy:\s*/, "");

  io.emit("log", {
    id: requestId,
    type: "info",
    message: `[${targetModel}] -> Attempting Key: ...${currentKey.slice(-4)}`,
    timestamp: new Date().toLocaleTimeString(),
  });

  try {
    const generationConfig = {
        temperature: req.body.temperature,
        maxOutputTokens: req.body.max_tokens,
        topP: req.body.top_p,
        topK: req.body.top_k
    };

    // Clean undefined config values
    Object.keys(generationConfig).forEach(key => generationConfig[key] === undefined && delete generationConfig[key]);

    if (req.body.stream) {
      const result = await geminiService.generateContent(
        currentKey,
        targetModel,
        req.body.messages,
        generationConfig,
        true
      );

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      let isClientConnected = true;
      req.on("close", () => {
        isClientConnected = false;
      });

      try {
        for await (const chunk of result.stream) {
          if (!isClientConnected) break;

          let text = "";
          try {
            text = chunk.text();
          } catch (e) {
            // Safe to ignore safety blocks in stream, just skip chunk
          }

          if (text) {
            res.write(
              `data: ${JSON.stringify({
                id: requestId,
                object: "chat.completion.chunk",
                created: Math.floor(Date.now() / 1000),
                model: targetModel,
                choices: [
                  { delta: { content: text }, index: 0, finish_reason: null },
                ],
              })}\n\n`,
            );
          }
        }

        if (isClientConnected) {
          res.write(`data: [DONE]\n\n`);
          res.end();
        }

        // Success logging after stream finished
        keyService.incrementKeyUsage(currentKey);
        statsService.trackRequest(currentKey, targetModel, true);
        io.emit("traffic_update");
        io.emit("log", {
          id: requestId,
          type: "success",
          message: "Stream Success.",
          timestamp: new Date().toLocaleTimeString(),
        });

      } catch (streamError) {
        console.error("Stream processing error:", streamError.message);
        // Can't send JSON error here because headers are sent. 
        statsService.trackRequest(currentKey, targetModel, false);
        io.emit("log", {
            id: requestId,
            type: "error",
            message: "Stream interrupted: " + streamError.message,
            timestamp: new Date().toLocaleTimeString(),
        });
      }
    } else {
      const result = await geminiService.generateContent(
        currentKey,
        targetModel,
        req.body.messages,
        generationConfig,
        false
      );
      const text = result.response.text();

      keyService.incrementKeyUsage(currentKey);
      statsService.trackRequest(currentKey, targetModel, true);
      io.emit("traffic_update");
      io.emit("log", {
        id: requestId,
        type: "success",
        message: "Request Success.",
        timestamp: new Date().toLocaleTimeString(),
      });

      res.json({
        id: requestId,
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model: targetModel,
        choices: [
          {
            message: { role: "assistant", content: text },
            finish_reason: "stop",
            index: 0,
          },
        ],
      });
      io.emit("stats_update", keyService.getKeyPool());
    }
  } catch (error) {
    const isRateLimit = (
      error.message.includes("429") ||
      error.message.includes("Quota") ||
      error.message.includes("exhausted")
    );

    io.emit("log", {
      id: requestId,
      type: "error",
      message: isRateLimit
        ? `Rate Limit Hit (${attemptedKeys.length + 1}/${keyService.getKeyPool().length})`
        : error.message,
      timestamp: new Date().toLocaleTimeString(),
    });

    if (isRateLimit) {
      keyService.updateKeyStatus(currentKey, "cooldown");
      keyService.incrementKeyErrors(currentKey);
      io.emit("stats_update", keyService.getKeyPool());

      const newAttemptedKeys = [...attemptedKeys, currentKey];

      // Retry logic
      if (newAttemptedKeys.length < keyService.getKeyPool().length) {
        if (!res.headersSent) {
             await new Promise((r) => setTimeout(r, 200));
             return handleRequest(req, res, io, newAttemptedKeys);
        }
      }
    }
    
    // Only send error if headers not sent and NOT retrying
    if (!res.headersSent) {
      statsService.trackRequest(currentKey, targetModel, false);
      res.status(500).json({ error: { message: error.message } });
    }
  }
};

module.exports = (io) => {
  const router = express.Router();

  router.post("/v1/chat/completions", (req, res) => handleRequest(req, res, io, []));

  router.get("/v1/models", (req, res) => {
    res.json({
      object: "list",
      data: geminiService.getDynamicModels().map((id) => ({
        id,
        object: "model",
        created: 1677610602,
        owned_by: "google",
      })),
    });
  });

  router.get("/api/keys", (req, res) => res.json(keyService.getKeyPool()));

  router.get("/api/config-template", async (req, res) => {
    if (geminiService.getDynamicModels().length === 0) await geminiService.fetchGoogleModels();
    res.json(geminiService.getDynamicModels());
  });

  router.post("/api/refresh-models", async (req, res) => {
    await geminiService.fetchGoogleModels();
    io.emit("stats_update", keyService.getKeyPool());
    res.json(geminiService.getDynamicModels());
  });

  router.post("/api/keys", (req, res) => {
    const { key } = req.body;
    if (keyService.addKey(key)) {
      io.emit("stats_update", keyService.getKeyPool());
      res.json({ success: true });
    } else {
      res.status(400).json({ error: "Invalid key or key already exists." });
    }
  });

  router.get("/api/stats", (req, res) => res.json(statsService.getStats()));

  return router;
};