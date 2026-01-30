const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const config = require("./config");
const keyService = require("./services/keyService");
const geminiService = require("./services/geminiService");
const statsService = require("./services/statsService");
const apiRoutes = require("./routes/apiRoutes");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
const PORT = config.PORT;

// --- Middleware Stack ---
app.use(helmet({
    contentSecurityPolicy: false // Disable CSP for local dev/simplicity with inline scripts
}));
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(morgan('dev')); // Logger
app.use(express.static("public"));

// --- Service Initialization ---
try {
    keyService.loadKeys();
    geminiService.initializeModelFetching();
    statsService.initialize();
} catch (error) {
    console.error("❌ Failed to initialize services:", error);
    process.exit(1);
}

// --- Routes ---
app.use("/", apiRoutes(io));

// --- Global Error Handler ---
app.use((err, req, res, next) => {
    console.error("❌ Unhandled Error:", err.stack);
    res.status(500).json({ error: "Internal Server Error" });
});

// --- Graceful Shutdown ---
const shutdown = () => {
    console.log("\n🛑 Shutting down gracefully...");
    server.close(() => {
        console.log("✅ Server closed.");
        process.exit(0);
    });
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

// --- Start Server ---
server.listen(PORT, () => {
    console.log(`
===========================================`);
    console.log(`🚀 GEMINI PROXY IS RUNNING`);
    console.log(`📡 Local Address: http://localhost:${PORT}`);
    console.log(`===========================================\n`);
});