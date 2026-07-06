import express from "express";
import cors from "cors";
import router from "./routes/index.js";
import path from "path";
import { fileURLToPath } from "url";
import { eq, desc, isNull, and } from "drizzle-orm";
import fs from "fs";
import https from "https";
import { hashPassword } from "./lib/auth.js";


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
        password: hashPassword("admin123"),
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
        password: hashPassword("satici123"),
        role: "Staff",
      });
    }

    // 6. Ensure User exists for Tenant 2
    const superAdminUser = await db.query.users.findFirst({
      where: (u, { eq }) => eq(u.tenantId, 2)
    });
    if (!superAdminUser) {
      console.log("Creating superadmin user...");
      await db.insert(schema.users).values({
        tenantId: 2,
        username: "superadmin",
        password: hashPassword("superadmin123"),
        role: "Admin",
      });
    }

    // 7. Ensure Default Warehouses and Migrate NULL values
    console.log("Startup seeder: Checking default warehouses...");
    let demoWarehouse = await db.query.warehouses.findFirst({
      where: (w, { eq, and }) => and(eq(w.tenantId, 1), eq(w.isDefault, 1))
    });
    if (!demoWarehouse) {
      console.log("Creating default warehouse for demo tenant...");
      const result = await db.insert(schema.warehouses).values({
        tenantId: 1,
        name: "Əsas Anbar",
        location: "Mərkəz",
        isDefault: 1,
        createdAt: new Date().toISOString(),
      }).returning();
      demoWarehouse = result[0];
    }

    let superWarehouse = await db.query.warehouses.findFirst({
      where: (w, { eq, and }) => and(eq(w.tenantId, 2), eq(w.isDefault, 1))
    });
    if (!superWarehouse) {
      console.log("Creating default warehouse for super tenant...");
      const result = await db.insert(schema.warehouses).values({
        tenantId: 2,
        name: "Əsas Anbar",
        location: "Mərkəz",
        isDefault: 1,
        createdAt: new Date().toISOString(),
      }).returning();
      superWarehouse = result[0];
    }

    // Auto-migrate null warehouseIds
    if (demoWarehouse) {
      const tablesToMigrate = [
        schema.stockEntries,
        schema.sales,
        schema.returns,
        schema.vendorReturns,
        schema.productSerials,
        schema.users
      ];
      for (const table of tablesToMigrate) {
        await db.update(table)
          .set({ warehouseId: demoWarehouse.id })
          .where(
            and(
              eq(table.tenantId, 1),
              isNull(table.warehouseId)
            )
          );
      }
    }

    if (superWarehouse) {
      const tablesToMigrateSuper = [
        schema.stockEntries,
        schema.sales,
        schema.returns,
        schema.vendorReturns,
        schema.productSerials,
        schema.users
      ];
      for (const table of tablesToMigrateSuper) {
        await db.update(table)
          .set({ warehouseId: superWarehouse.id })
          .where(
            and(
              eq(table.tenantId, 2),
              isNull(table.warehouseId)
            )
          );
      }
    }

    console.log("Startup seeder: All default records verified/initialized.");
  } catch (error) {
    console.error("Failed to ensure default tenants/users on startup:", error);
  }
}

async function selfHealDatabaseTotals() {
  try {
    console.log("Database Self-Healing: Checking for incomplete financial records...");
    
    // Fetch all sales (with their items loaded)
    const salesList = await db.query.sales.findMany({
      with: { items: true }
    });
    
    let healedSalesCount = 0;
    
    for (const sale of salesList) {
      const isTotalAmountCorrupt = !sale.totalAmount || isNaN(sale.totalAmount) || sale.totalAmount === 0;
      
      if (isTotalAmountCorrupt) {
        console.log(`Self-Healing: Repairing Sale #${sale.id.toString().padStart(5, "0")}...`);
        
        let calculatedTotalAmount = 0;
        let calculatedTotalCost = 0;
        
        for (const item of sale.items) {
          const qty = item.quantity || 0;
          const price = item.salePrice || 0;
          let cost = item.purchasePrice || 0;
          
          // If purchasePrice is 0 (missing snapshot), try to find the product's actual last purchase price from stock entries
          if (cost === 0) {
            const latestEntry = await db
              .select({ price: schema.stockEntries.purchasePrice })
              .from(schema.stockEntries)
              .where(eq(schema.stockEntries.productId, item.productId))
              .orderBy(desc(schema.stockEntries.entryDate))
              .limit(1);
            
            if (latestEntry && latestEntry.length > 0) {
              cost = latestEntry[0].price || price;
            } else {
              cost = price;
            }
            
            // Update the saleItem with the reconstructed purchasePrice
            await db.update(schema.saleItems)
              .set({ purchasePrice: cost })
              .where(eq(schema.saleItems.id, item.id));
            console.log(`  -> Repaired SaleItem #${item.id} (Product ID: ${item.productId}, Reconstructed Cost: ${cost} ₼)`);
          }
          
          calculatedTotalAmount += qty * price;
          calculatedTotalCost += qty * cost;
        }
        
        // Update the main sale record with corrected totals
        await db.update(schema.sales)
          .set({
            totalAmount: calculatedTotalAmount,
            totalCost: calculatedTotalCost
          })
          .where(eq(schema.sales.id, sale.id));
          
        console.log(`  -> Completed Sale #${sale.id}: Set Total Amount = ${calculatedTotalAmount} ₼, Total Cost = ${calculatedTotalCost} ₼`);
        healedSalesCount++;
      }
    }
    
    if (healedSalesCount > 0) {
      console.log(`Database Self-Healing: Successfully repaired ${healedSalesCount} sale transaction(s)!`);
    } else {
      console.log("Database Self-Healing: All financial transaction records are healthy.");
    }
  } catch (error) {
    console.error("Database Self-Healing error:", error);
  }
}

// Telegram file upload helper for scheduled backups
async function sendTelegramBackupFile(token: string, chatId: string, fileContent: string, fileName: string) {
  return new Promise((resolve, reject) => {
    const boundary = `----WebKitFormBoundary${Math.random().toString(36).substring(2)}`;
    const url = `https://api.telegram.org/bot${token}/sendDocument`;

    const header = [
      `--${boundary}`,
      `Content-Disposition: form-data; name="chat_id"`,
      '',
      chatId,
      `--${boundary}`,
      `Content-Disposition: form-data; name="document"; filename="${fileName}"`,
      'Content-Type: application/json',
      '',
      fileContent,
      `--${boundary}--`,
      ''
    ].join('\r\n');

    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': Buffer.byteLength(header)
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`Telegram responded with status ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.write(header);
    req.end();
  });
}

// Scheduled Backup Engine
async function executeScheduledBackups(timeStr: string) {
  try {
    const settingsList = await db.select().from(schema.settings).where(eq(schema.settings.backupTime, timeStr));
    
    for (const setting of settingsList) {
      const tenantId = setting.tenantId;
      console.log(`Scheduled Backup: Triggering backup for Tenant ${tenantId} at ${timeStr}`);

      const backupData = {
        products: await db.select().from(schema.products).where(eq(schema.products.tenantId, tenantId)),
        vendors: await db.select().from(schema.vendors).where(eq(schema.vendors.tenantId, tenantId)),
        stockEntries: await db.select().from(schema.stockEntries).where(eq(schema.stockEntries.tenantId, tenantId)),
        vendorPayments: await db.select().from(schema.vendorPayments).where(eq(schema.vendorPayments.tenantId, tenantId)),
        employees: await db.select().from(schema.employees).where(eq(schema.employees.tenantId, tenantId)),
        payroll: await db.select().from(schema.payroll).where(eq(schema.payroll.tenantId, tenantId)),
        salaryPayments: await db.select().from(schema.salaryPayments).where(eq(schema.salaryPayments.tenantId, tenantId)),
        customers: await db.select().from(schema.customers).where(eq(schema.customers.tenantId, tenantId)),
        sales: await db.select().from(schema.sales).where(eq(schema.sales.tenantId, tenantId)),
        saleItems: await db.select().from(schema.saleItems).where(eq(schema.saleItems.tenantId, tenantId)),
        creditPayments: await db.select().from(schema.creditPayments).where(eq(schema.creditPayments.tenantId, tenantId)),
        expenses: await db.select().from(schema.expenses).where(eq(schema.expenses.tenantId, tenantId)),
        settings: await db.select().from(schema.settings).where(eq(schema.settings.tenantId, tenantId)),
        users: await db.select().from(schema.users).where(eq(schema.users.tenantId, tenantId)),
        activityLogs: await db.select().from(schema.activityLogs).where(eq(schema.activityLogs.tenantId, tenantId)),
        returns: await db.select().from(schema.returns).where(eq(schema.returns.tenantId, tenantId)),
        returnItems: await db.select().from(schema.returnItems).where(eq(schema.returnItems.tenantId, tenantId)),
      };

      const backupPayload = {
        backupVersion: "1.0",
        scope: "tenant",
        tenantId: tenantId,
        createdAt: new Date().toISOString(),
        data: backupData,
      };

      const backupStr = JSON.stringify(backupPayload, null, 2);
      const dateLabel = new Date().toISOString().split('T')[0];
      const fileName = `qazanpos_backup_tenant_${tenantId}_${dateLabel}.json`;

      // 1. Save locally
      try {
        const backupDir = path.resolve(process.cwd(), "backups", `tenant-${tenantId}`);
        if (!fs.existsSync(backupDir)) {
          fs.mkdirSync(backupDir, { recursive: true });
        }
        const filePath = path.join(backupDir, fileName);
        fs.writeFileSync(filePath, backupStr, "utf-8");
        console.log(`Scheduled Backup: Local backup saved at ${filePath}`);
      } catch (err) {
        console.error(`Scheduled Backup: Failed to save local backup for tenant ${tenantId}:`, err);
      }

      // 2. Telegram Send
      if (setting.telegramBackupEnabled === 1 && setting.telegramBotToken && setting.telegramChatId) {
        try {
          console.log(`Scheduled Backup: Sending Telegram backup document for Tenant ${tenantId}`);
          await sendTelegramBackupFile(setting.telegramBotToken, setting.telegramChatId, backupStr, fileName);
          console.log(`Scheduled Backup: Telegram backup sent successfully for Tenant ${tenantId}`);
        } catch (err) {
          console.error(`Scheduled Backup: Telegram backup upload failed for Tenant ${tenantId}:`, err);
        }
      }
    }
  } catch (error) {
    console.error("Scheduled Backup runner failed:", error);
  }
}

async function migrateUserPasswords() {
  try {
    console.log("Database Migration: Hashing plain text passwords...");
    const allUsers = await db.select().from(schema.users);
    const isSha256 = (str: string) => /^[0-9a-f]{64}$/i.test(str);
    
    let migratedCount = 0;
    for (const user of allUsers) {
      if (!isSha256(user.password)) {
        const hashed = hashPassword(user.password);
        await db.update(schema.users)
          .set({ password: hashed })
          .where(eq(schema.users.id, user.id));
        migratedCount++;
      }
    }
    if (migratedCount > 0) {
      console.log(`Database Migration: Successfully hashed ${migratedCount} plain text password(s).`);
    } else {
      console.log("Database Migration: All passwords are securely hashed.");
    }
  } catch (error) {
    console.error("Database Migration error during password hashing:", error);
  }
}

app.listen(PORT, async () => {
  console.log(`Server listening on port ${PORT}`);
  await ensureDefaultTenantsAndUsers();
  await migrateUserPasswords();
  await selfHealDatabaseTotals();

  // Start the background cron check for backups every 60 seconds
  setInterval(async () => {
    const now = new Date();
    const hour = String(now.getHours()).padStart(2, "0");
    const minute = String(now.getMinutes()).padStart(2, "0");
    const timeStr = `${hour}:${minute}`;
    await executeScheduledBackups(timeStr);
  }, 60000);
});

