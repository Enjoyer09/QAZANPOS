import express from "express";
import cors from "cors";
import router from "./routes.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

// API routes
app.use("/api", router);

// Serve static client assets in production
const clientBuildPath = path.resolve(__dirname, "../../client/dist");
app.use(express.static(clientBuildPath));

// For wouter / SPA routing: fallback all non-api GET requests to index.html
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) {
    return next();
  }
  res.sendFile(path.join(clientBuildPath, "index.html"), (err) => {
    if (err) {
      res.status(404).send("Client build not found. Run npm run build first.");
    }
  });
});

import { db } from "./db/index.js";
import * as schema from "./db/schema.js";

async function ensureDefaultUsers() {
  try {
    const existingUsers = await db.select().from(schema.users).limit(1);
    if (existingUsers.length === 0) {
      console.log("No users found. Creating default accounts...");
      await db.insert(schema.users).values([
        {
          username: "admin",
          password: "admin123",
          role: "Admin",
        },
        {
          username: "satici",
          password: "satici123",
          role: "Staff",
        },
      ]);
      console.log("Default accounts created: admin/admin123, satici/satici123");
    }
  } catch (error) {
    console.error("Failed to ensure default users on startup:", error);
  }
}

app.listen(PORT, async () => {
  console.log(`Server listening on port ${PORT}`);
  await ensureDefaultUsers();
});

