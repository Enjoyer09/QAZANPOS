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
    // 1. Ensure Tenant 1 (demo) exists
    const demoTenant = await db.query.tenants.findFirst({
      where: (t, { eq }) => eq(t.id, 1)
    });
    if (!demoTenant) {
      console.log("Creating default demo tenant...");
      await db.insert(schema.tenants).values({
        id: 1,
        name: "Mətbəx Dünyası",
        slug: "demo",
        status: "active",
        releaseTier: "stable",
        createdAt: new Date().toISOString(),
      });
    }

    // 2. Ensure Tenant 2 (super) exists
    const superTenant = await db.query.tenants.findFirst({
      where: (t, { eq }) => eq(t.id, 2)
    });
    if (!superTenant) {
      console.log("Creating default super tenant...");
      await db.insert(schema.tenants).values({
        id: 2,
        name: "Super Platform Admin",
        slug: "super",
        status: "active",
        releaseTier: "stable",
        createdAt: new Date().toISOString(),
      });
    }

    // 3. Ensure Settings exist for Tenant 1
    const demoSettings = await db.query.settings.findFirst({
      where: (s, { eq }) => eq(s.tenantId, 1)
    });
    if (!demoSettings) {
      console.log("Initializing settings for demo tenant...");
      await db.insert(schema.settings).values({
        tenantId: 1,
        storeName: "Mətbəx Dünyası",
        phone: "055-123-4567",
        address: "Yuxarı Göyçay",
      });
    }

    // 4. Ensure Settings exist for Tenant 2
    const superSettings = await db.query.settings.findFirst({
      where: (s, { eq }) => eq(s.tenantId, 2)
    });
    if (!superSettings) {
      console.log("Initializing settings for super tenant...");
      await db.insert(schema.settings).values({
        tenantId: 2,
        storeName: "SaaS Control Plane",
        phone: "010-000-0000",
        address: "Mərkəz bulud serverləri",
      });
    }

    // 5. Ensure Users exist for Tenant 1
    const demoAdmin = await db.query.users.findFirst({
      where: (u, { eq, and }) => and(eq(u.tenantId, 1), eq(u.username, "admin"))
    });
    if (!demoAdmin) {
      console.log("Creating admin user for demo tenant...");
      await db.insert(schema.users).values({
        tenantId: 1,
        username: "admin",
        password: "admin123",
        role: "Admin",
      });
    }

    const demoStaff = await db.query.users.findFirst({
      where: (u, { eq, and }) => and(eq(u.tenantId, 1), eq(u.username, "satici"))
    });
    if (!demoStaff) {
      console.log("Creating staff user for demo tenant...");
      await db.insert(schema.users).values({
        tenantId: 1,
        username: "satici",
        password: "satici123",
        role: "Staff",
      });
    }

    // 6. Ensure User exists for Tenant 2
    const superAdminUser = await db.query.users.findFirst({
      where: (u, { eq, and }) => and(eq(u.tenantId, 2), eq(u.username, "superadmin"))
    });
    if (!superAdminUser) {
      console.log("Creating superadmin user...");
      await db.insert(schema.users).values({
        tenantId: 2,
        username: "superadmin",
        password: "superadmin123",
        role: "Admin",
      });
    }

    console.log("Startup seeder: All default records verified/initialized.");
  } catch (error) {
    console.error("Failed to ensure default tenants/users on startup:", error);
  }
}

app.listen(PORT, async () => {
  console.log(`Server listening on port ${PORT}`);
  await ensureDefaultTenantsAndUsers();
});

