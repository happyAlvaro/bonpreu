import express from "express";
import cors from "cors";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { HappyRobotClient } from "@happyrobot-ai/sdk";

function loadLocalEnv(path = ".env") {
  if (!fs.existsSync(path)) return;

  const lines = fs.readFileSync(path, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    process.env[key] = rawValue.replace(/^["']|["']$/g, "");
  }
}

loadLocalEnv();
loadLocalEnv("server/.env");

const PORT = Number(process.env.PORT ?? 3001);
const API_KEY = process.env.HAPPYROBOT_API_KEY;
const WORKFLOW_ID = process.env.WORKFLOW_ID;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? "http://localhost:5173";
const HAPPYROBOT_CLUSTER = process.env.HAPPYROBOT_CLUSTER === "us" ? "us" : "eu";

if (!API_KEY) {
  console.error("Missing HAPPYROBOT_API_KEY environment variable");
  process.exit(1);
}

if (!WORKFLOW_ID) {
  console.error("Missing WORKFLOW_ID environment variable");
  process.exit(1);
}

const client = new HappyRobotClient({ apiKey: API_KEY, cluster: HAPPYROBOT_CLUSTER });
const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDistPath = path.resolve(__dirname, "../../client/dist");
const clientIndexPath = path.join(clientDistPath, "index.html");

app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/voice/token", async (_req, res) => {
  try {
    const result = await client.voice.createToken({
      workflow_id: WORKFLOW_ID,
      ttl_seconds: 3600,
    });

    res.json(result);
  } catch (err) {
    console.error("Failed to create voice token:", err);
    const apiError = err as { status?: number; body?: { error?: string }; message?: string };
    res.status(apiError.status ?? 500).json({
      error: apiError.body?.error ?? apiError.message ?? "Failed to create voice token",
    });
  }
});

if (fs.existsSync(clientIndexPath)) {
  app.use(express.static(clientDistPath));
  app.use((req, res, next) => {
    if (req.method === "GET" && !req.path.startsWith("/api/")) {
      res.sendFile(clientIndexPath);
      return;
    }

    next();
  });
}

const server = app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

server.on("error", (err) => {
  console.error("Server failed:", err);
  process.exit(1);
});
