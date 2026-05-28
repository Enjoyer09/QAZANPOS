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

async function ensureDefaultTenantsAndUsers() {
  try {
    // 1. Ensure Tenants exist
    const existingTenants = await db.select().from(schema.tenants).limit(1);
    if (existingTenants.length === 0) {
      console.log("No tenants found. Creating default tenants (demo & super)...");
      await db.insert(schema.tenants).values([
        {
          id: 1,
          name: "Mətbəx Dünyası",
          slug: "demo",
          status: "active",
          releaseTier: "stable",
          createdAt: new Date().toISOString(),
        },
        {
          id: 2,
          name: "Super Platform Admin",
          slug: "super",
          status: "active",
          releaseTier: "stable",
          createdAt: new Date().toISOString(),
        },
      ]);
      console.log("Default tenants created successfully.");
    }

    // 2. Ensure Settings exist for both tenants
    const existingSettings = await db.select().from(schema.settings).limit(1);
    if (existingSettings.length === 0) {
      console.log("No settings found. Initializing default business settings...");
      await db.insert(schema.settings).values([
        {
          tenantId: 1,
          storeName: "Mətbəx Dünyası",
          phone: "055-123-4567",
          address: "Yuxarı Göyçay",
        },
        {
          tenantId: 2,
          storeName: "SaaS Control Plane",
          phone: "010-000-0000",
          address: "Mərkəz bulud serverləri",
        },
      ]);
      console.log("Default settings initialized.");
    }

    // 3. Ensure default users exist
    const existingUsers = await db.select().from(schema.users).limit(1);
    if (existingUsers.length === 0) {
      console.log("No users found. Creating default accounts...");
      await db.insert(schema.users).values([
        {
          tenantId: 1,
          username: "admin",
          password: "admin123",
          role: "Admin",
        },
        {
          tenantId: 1,
          username: "satici",
          password: "satici123",
          role: "Staff",
        },
        {
          tenantId: 2,
          username: "superadmin",
          password: "superadmin123",
          role: "Admin",
        },
      ]);
      console.log("Default accounts created (admin, satici, superadmin).");
    }
  } catch (error) {
    console.error("Failed to ensure default tenants/users on startup:", error);
  }
}

app.listen(PORT, async () => {
  console.log(`Server listening on port ${PORT}`);
  await ensureDefaultTenantsAndUsers();
});

