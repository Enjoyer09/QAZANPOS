import { Router } from "express";
import { db } from "./db/index.js";
import * as schema from "./db/schema.js";
import { eq, and, lte, gte, sql, desc, asc, inArray } from "drizzle-orm";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { verifyTOTP, generateSecret, getOTPAuthURI } from "./db/totp.js";
import { sendTelegramNotification } from "./lib/telegram.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


declare global {
  namespace Express {
    interface Request {
      tenantId: number;
      tenantSlug: string;
      tenantReleaseTier: string;
    }
  }
}

const router = Router();

const normalizeName = (text: string): string => {
  return text
    .trim()
    .toLowerCase()
    .replace(/ı/g, "i")
    .replace(/ə/g, "e")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g");
};

// ----------------------------------------------------
// MIDDLEWARES
// ----------------------------------------------------

// Middleware to resolve tenant dynamically based on subdomain Host
async function resolveTenant(req: any, res: any, next: any) {
  const rawHost = req.headers["x-tenant-host"];
  const host = typeof rawHost === "string" ? rawHost : (req.headers.host || "");
  const parts = host.split(".");
  
  // Default tenant fallback for bare domains or localhost testing
  let slug = "demo";
  
  if (parts.length > 1 && parts[0] !== "www" && parts[0] !== "localhost" && parts[0] !== "qazanpos-production" && !parts[0].includes("127.0.0.1")) {
    slug = parts[0].toLowerCase();
  }

  try {
    const tenant = await db.query.tenants.findFirst({
      where: eq(schema.tenants.slug, slug)
    });

    if (!tenant) {
      return res.status(404).json({ errorType: "TENANT_NOT_FOUND", message: `Biznes tapılmadı: '${slug}'` });
    }

    if (tenant.status === "suspended") {
      return res.status(403).json({ message: "Bu biznes hesabı müvəqqəti olaraq dayandırılıb." });
    }

    req.tenantId = tenant.id;
    req.tenantSlug = tenant.slug;
    req.tenantReleaseTier = tenant.releaseTier;
    next();
  } catch (error) {
    res.status(500).json({ message: "Biznes yoxlanılarkən daxili xəta baş verdi" });
  }
}

// Mount the resolver globally for all API endpoints under this router
router.use(resolveTenant);

// Middleware to verify user role is Admin
function requireAdmin(req: any, res: any, next: any) {
  const role = req.headers["x-user-role"] || req.query.role;
  if (role !== "Admin") {
    return res.status(403).json({ message: "Bu əməliyyat üçün yalnız Administrator səlahiyyəti tələb olunur." });
  }
  next();
}

async function checkUserPermission(
  req: any,
  permissionKey: 'staffCanViewSalesHistory' | 'staffCanViewStock' | 'staffCanViewCustomers' | 'staffCanViewVendors' | 'staffCanViewExpenses' | 'staffCanViewStockBalances' | 'staffCanViewDebts' | 'staffCanManageCatalog'
): Promise<boolean> {
  const role = req.headers["x-user-role"] as string;
  if (role === "Admin") return true;

  const username = req.headers["x-user-username"] as string;
  if (!username) return false;

  const user = await db.query.users.findFirst({
    where: and(
      eq(schema.users.username, username.trim().toLowerCase()),
      eq(schema.users.tenantId, req.tenantId)
    )
  });

  if (!user) return false;
  return user[permissionKey] !== 0;
}

// FIFO Inventory Valuation Helper Functions
async function computeFIFOMetrics(productId: number, tenantId: number) {
  // Fetch all stock entries ordered by entryDate and ID ascending (oldest first)
  const entries = await db
    .select({
      id: schema.stockEntries.id,
      quantity: schema.stockEntries.quantity,
      purchasePrice: schema.stockEntries.purchasePrice
    })
    .from(schema.stockEntries)
    .where(and(eq(schema.stockEntries.productId, productId), eq(schema.stockEntries.tenantId, tenantId)))
    .orderBy(asc(schema.stockEntries.entryDate), asc(schema.stockEntries.id));

  // Fetch total net quantity sold (totalSold - totalReturned)
  const soldResult = await db
    .select({ total: sql`SUM(quantity)` })
    .from(schema.saleItems)
    .where(and(eq(schema.saleItems.productId, productId), eq(schema.saleItems.tenantId, tenantId)));
  const totalSold = parseFloat((soldResult[0]?.total as string) || "0");

  const returnedResult = await db
    .select({ total: sql`SUM(quantity)` })
    .from(schema.returnItems)
    .where(
      and(
        eq(schema.returnItems.productId, productId),
        eq(schema.returnItems.tenantId, tenantId),
        eq(schema.returnItems.status, "returned_to_stock")
      )
    );
  const totalReturned = parseFloat((returnedResult[0]?.total as string) || "0");

  const netSold = Math.max(0, totalSold - totalReturned);

  // Consume netSold from the oldest entries to find remaining batches
  let soldRemaining = netSold;
  let totalValue = 0;
  let nextUnitCost = 0;
  let foundNextUnit = false;

  for (const entry of entries) {
    if (soldRemaining >= entry.quantity) {
      soldRemaining -= entry.quantity;
    } else {
      const qtyLeft = entry.quantity - soldRemaining;
      soldRemaining = 0;
      totalValue += qtyLeft * entry.purchasePrice;
      if (!foundNextUnit) {
        nextUnitCost = entry.purchasePrice;
        foundNextUnit = true;
      }
    }
  }

  // Fallback nextUnitCost to last entry's price or 0 if all consumed
  if (!foundNextUnit && entries.length > 0) {
    nextUnitCost = entries[entries.length - 1].purchasePrice;
  }

  return {
    totalValue,
    nextUnitCost
  };
}

async function fetchTenantStockMetrics(tenantId: number) {
  // 1. Fetch all products
  const allProducts = await db.select().from(schema.products).where(eq(schema.products.tenantId, tenantId));

  // 2. Fetch bulk sums
  const restockedGroup = await db
    .select({
      productId: schema.stockEntries.productId,
      totalRestocked: sql`SUM(${schema.stockEntries.quantity})`
    })
    .from(schema.stockEntries)
    .where(eq(schema.stockEntries.tenantId, tenantId))
    .groupBy(schema.stockEntries.productId);

  const soldGroup = await db
    .select({
      productId: schema.saleItems.productId,
      totalSold: sql`SUM(${schema.saleItems.quantity})`
    })
    .from(schema.saleItems)
    .where(eq(schema.saleItems.tenantId, tenantId))
    .groupBy(schema.saleItems.productId);

  const returnedGroup = await db
    .select({
      productId: schema.returnItems.productId,
      totalReturned: sql`SUM(${schema.returnItems.quantity})`
    })
    .from(schema.returnItems)
    .where(
      and(
        eq(schema.returnItems.tenantId, tenantId),
        eq(schema.returnItems.status, "returned_to_stock")
      )
    )
    .groupBy(schema.returnItems.productId);

  const allEntries = await db
    .select({
      id: schema.stockEntries.id,
      productId: schema.stockEntries.productId,
      quantity: schema.stockEntries.quantity,
      purchasePrice: schema.stockEntries.purchasePrice,
      entryDate: schema.stockEntries.entryDate,
    })
    .from(schema.stockEntries)
    .where(eq(schema.stockEntries.tenantId, tenantId))
    .orderBy(asc(schema.stockEntries.productId), asc(schema.stockEntries.entryDate), asc(schema.stockEntries.id));

  // Map groups
  const restockedMap = new Map<number, number>();
  restockedGroup.forEach(g => restockedMap.set(g.productId, parseFloat((g.totalRestocked as string) || "0")));

  const soldMap = new Map<number, number>();
  soldGroup.forEach(g => soldMap.set(g.productId, parseFloat((g.totalSold as string) || "0")));

  const returnedMap = new Map<number, number>();
  returnedGroup.forEach(g => returnedMap.set(g.productId, parseFloat((g.totalReturned as string) || "0")));

  const entriesMap = new Map<number, typeof allEntries>();
  allEntries.forEach(entry => {
    if (!entriesMap.has(entry.productId)) {
      entriesMap.set(entry.productId, []);
    }
    entriesMap.get(entry.productId)!.push(entry);
  });

  // Calculate metrics per product
  const metrics = new Map<number, {
    currentQuantity: number;
    totalValue: number;
    nextUnitCost: number;
    lastPurchaseDate: string | null;
  }>();

  for (const product of allProducts) {
    const productId = product.id;
    const totalRestocked = restockedMap.get(productId) || 0;
    const totalSold = soldMap.get(productId) || 0;
    const totalReturned = returnedMap.get(productId) || 0;
    const currentQuantity = totalRestocked - totalSold + totalReturned;

    const productEntries = entriesMap.get(productId) || [];
    const netSold = Math.max(0, totalSold - totalReturned);

    let soldRemaining = netSold;
    let totalValue = 0;
    let nextUnitCost = 0;
    let foundNextUnit = false;

    for (const entry of productEntries) {
      if (soldRemaining >= entry.quantity) {
        soldRemaining -= entry.quantity;
      } else {
        const qtyLeft = entry.quantity - soldRemaining;
        soldRemaining = 0;
        totalValue += qtyLeft * entry.purchasePrice;
        if (!foundNextUnit) {
          nextUnitCost = entry.purchasePrice;
          foundNextUnit = true;
        }
      }
    }

    if (!foundNextUnit && productEntries.length > 0) {
      nextUnitCost = productEntries[productEntries.length - 1].purchasePrice;
    }

    const lastPurchaseDate = productEntries.length > 0 ? productEntries[productEntries.length - 1].entryDate : null;

    metrics.set(productId, {
      currentQuantity,
      totalValue,
      nextUnitCost,
      lastPurchaseDate,
    });
  }

  return {
    allProducts,
    metrics
  };
}

async function computeFIFOSaleCost(productId: number, tenantId: number, quantityToSell: number): Promise<number> {
  const entries = await db
    .select({
      id: schema.stockEntries.id,
      quantity: schema.stockEntries.quantity,
      purchasePrice: schema.stockEntries.purchasePrice
    })
    .from(schema.stockEntries)
    .where(and(eq(schema.stockEntries.productId, productId), eq(schema.stockEntries.tenantId, tenantId)))
    .orderBy(asc(schema.stockEntries.entryDate), asc(schema.stockEntries.id));

  const soldResult = await db
    .select({ total: sql`SUM(quantity)` })
    .from(schema.saleItems)
    .where(and(eq(schema.saleItems.productId, productId), eq(schema.saleItems.tenantId, tenantId)));
  const totalSold = parseFloat((soldResult[0]?.total as string) || "0");

  const returnedResult = await db
    .select({ total: sql`SUM(quantity)` })
    .from(schema.returnItems)
    .where(
      and(
        eq(schema.returnItems.productId, productId),
        eq(schema.returnItems.tenantId, tenantId),
        eq(schema.returnItems.status, "returned_to_stock")
      )
    );
  const totalReturned = parseFloat((returnedResult[0]?.total as string) || "0");

  const netSold = Math.max(0, totalSold - totalReturned);

  let soldRemaining = netSold;
  const activeEntries = [];
  for (const entry of entries) {
    if (soldRemaining >= entry.quantity) {
      soldRemaining -= entry.quantity;
    } else {
      const qtyLeft = entry.quantity - soldRemaining;
      soldRemaining = 0;
      activeEntries.push({
        ...entry,
        quantityLeft: qtyLeft
      });
    }
  }

  let sellRemaining = quantityToSell;
  let totalCost = 0;
  for (const entry of activeEntries) {
    if (sellRemaining <= 0) break;
    const take = Math.min(sellRemaining, entry.quantityLeft);
    totalCost += take * entry.purchasePrice;
    sellRemaining -= take;
  }

  if (sellRemaining > 0 && entries.length > 0) {
    const lastEntryPrice = entries[entries.length - 1].purchasePrice;
    totalCost += sellRemaining * lastEntryPrice;
  }

  return quantityToSell > 0 ? (totalCost / quantityToSell) : 0;
}

// Middleware to verify active tenant is the Super Admin control plane
function requireSuperAdmin(req: any, res: any, next: any) {
  const role = req.headers["x-user-role"] || req.query.role;
  if (req.tenantSlug !== "super" || role !== "Admin") {
    return res.status(403).json({ message: "Bu əməliyyat üçün yalnız Platforma Administratoru səlahiyyəti tələb olunur." });
  }
  next();
}

// Helper to log user activities with tenant scope
async function logActivity(req: any, action: string, description: string) {
  try {
    const role = req.headers["x-user-role"] || req.query.role;
    const username = req.headers["x-user-username"] || req.query.username || (role === "Admin" ? "admin" : "satici") || "Sistem";
    await db.insert(schema.activityLogs).values({
      tenantId: req.tenantId,
      username,
      action,
      description,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Failed to log activity:", error);
  }
}

// Helper to get date boundaries
function getMonthBoundaries() {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
  return { firstDay, lastDay };
}

// SaaS Tier Limits mapping
const TIER_LIMITS: Record<string, { products: number; sales: number; users: number }> = {
  free: { products: 10, sales: 20, users: 1 },
  mini: { products: 100, sales: 500, users: 3 },
  pro: { products: 1000, sales: 5000, users: 10 },
  enterprise: { products: Infinity, sales: Infinity, users: Infinity }
};

// Helper to check and verify tenant limits
async function verifyTenantLimit(tenantId: number, type: "products" | "sales" | "users") {
  // 1. Fetch tenant's current billing tier
  const tenant = await db.query.tenants.findFirst({
    where: eq(schema.tenants.id, tenantId)
  });

  const tier = tenant?.billingTier || "free";
  const limits = TIER_LIMITS[tier] || TIER_LIMITS.free;
  const maxLimit = limits[type];

  if (maxLimit === Infinity) {
    return { allowed: true, current: 0, max: Infinity, tier };
  }

  // 2. Count current records in the database for this tenant
  let currentCount = 0;
  if (type === "products") {
    const result = await db
      .select({ count: sql`COUNT(id)` })
      .from(schema.products)
      .where(eq(schema.products.tenantId, tenantId));
    currentCount = parseInt((result[0]?.count as string) || "0");
  } else if (type === "sales") {
    const result = await db
      .select({ count: sql`COUNT(id)` })
      .from(schema.sales)
      .where(eq(schema.sales.tenantId, tenantId));
    currentCount = parseInt((result[0]?.count as string) || "0");
  } else if (type === "users") {
    const result = await db
      .select({ count: sql`COUNT(id)` })
      .from(schema.users)
      .where(eq(schema.users.tenantId, tenantId));
    currentCount = parseInt((result[0]?.count as string) || "0");
  }

  return {
    allowed: currentCount < maxLimit,
    current: currentCount,
    max: maxLimit,
    tier
  };
}

// ----------------------------------------------------
// 0. AUTH ENDPOINTS
// ----------------------------------------------------

router.post("/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: "İstifadəçi adı və şifrə daxil edilməlidir" });
    }

    const user = await db.query.users.findFirst({
      where: and(
        eq(schema.users.username, username.trim().toLowerCase()),
        eq(schema.users.password, password),
        eq(schema.users.tenantId, req.tenantId)
      )
    });

    if (!user) {
      return res.status(401).json({ message: "İstifadəçi adı və ya şifrə yanlışdır" });
    }

    // Fetch tenant name
    const tenant = await db.query.tenants.findFirst({
      where: eq(schema.tenants.id, req.tenantId)
    });

    // Check if 2FA is enabled for the user
    if (user.twoFactorEnabled === 1) {
      const clientIp = ((req.headers["x-forwarded-for"] as string) || req.ip || "127.0.0.1").split(",")[0].trim();
      const trustToken = req.headers["x-2fa-trust-token"];
      const trustTokenStr = Array.isArray(trustToken) ? trustToken[0] : (trustToken || "");

      let trustedDevices: Array<{ deviceToken: string; ip: string; expireAt: number }> = [];
      if (user.twoFactorTrustedDevices) {
        try {
          trustedDevices = JSON.parse(user.twoFactorTrustedDevices);
        } catch (e) {}
      }

      const now = Date.now();
      const isTrusted = trustedDevices.some((d) => {
        const isTokenMatch = trustTokenStr && d.deviceToken === trustTokenStr;
        const isIpMatch = d.ip === clientIp;
        const isNotExpired = d.expireAt > now;
        return (isTokenMatch || isIpMatch) && isNotExpired;
      });

      if (!isTrusted) {
        return res.json({
          require2FA: true,
          userId: user.id
        });
      }
    }

    res.json({
      id: user.id,
      username: user.username,
      role: user.role,
      tenantId: req.tenantId,
      tenantName: tenant?.name || "Qazan POS",
      tenantSlug: req.tenantSlug
    });
  } catch (error) {
    res.status(500).json({ message: "Giriş zamanı xəta baş verdi" });
  }
});

// 2FA setups & verification routes
router.post("/auth/2fa-setup", async (req, res) => {
  try {
    const username = req.headers["x-user-username"];
    if (!username) {
      return res.status(401).json({ message: "Səlahiyyətləndirmə xətası: İstifadəçi adı göndərilməyib" });
    }

    const user = await db.query.users.findFirst({
      where: and(
        eq(schema.users.username, String(username)),
        eq(schema.users.tenantId, req.tenantId)
      )
    });

    if (!user) {
      return res.status(404).json({ message: "İstifadəçi tapılmadı" });
    }

    const secret = generateSecret();
    const tenant = await db.query.tenants.findFirst({
      where: eq(schema.tenants.id, req.tenantId)
    });
    const issuer = tenant?.name || "BirSaaS";
    const label = `${user.username}`;
    const otpauthURI = getOTPAuthURI({ secret, label, issuer });

    res.json({ secret, otpauthURI });
  } catch (error) {
    res.status(500).json({ message: "2FA qurulması zamanı xəta baş verdi" });
  }
});

router.post("/auth/2fa-activate", async (req, res) => {
  try {
    const username = req.headers["x-user-username"];
    const { secret, token } = req.body;

    if (!username) {
      return res.status(401).json({ message: "Səlahiyyətləndirmə xətası" });
    }
    if (!secret || !token) {
      return res.status(400).json({ message: "Gizli açar və OTP kod daxil edilməlidir" });
    }

    const user = await db.query.users.findFirst({
      where: and(
        eq(schema.users.username, String(username)),
        eq(schema.users.tenantId, req.tenantId)
      )
    });

    if (!user) {
      return res.status(404).json({ message: "İstifadəçi tapılmadı" });
    }

    const isValid = verifyTOTP(token, secret);
    if (!isValid) {
      return res.status(400).json({ message: "Daxil edilən OTP kod yanlışdır" });
    }

    await db.update(schema.users)
      .set({
        twoFactorSecret: secret,
        twoFactorEnabled: 1,
        twoFactorTrustedDevices: JSON.stringify([])
      })
      .where(eq(schema.users.id, user.id));

    await logActivity(req, "2FA Aktiv Edildi", `İstifadəçi '${user.username}' 2FA təhlükəsizliyini aktiv etdi`);

    res.json({ success: true, message: "İki-mərhələli təhlükəsizlik (2FA) uğurla aktiv edildi!" });
  } catch (error) {
    res.status(500).json({ message: "2FA aktivləşdirilməsi zamanı xəta baş verdi" });
  }
});

router.post("/auth/2fa-verify", async (req, res) => {
  try {
    const { userId, token, rememberDevice } = req.body;
    if (!userId || !token) {
      return res.status(400).json({ message: "İstifadəçi ID və OTP kod daxil edilməlidir" });
    }

    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, Number(userId))
    });

    if (!user || !user.twoFactorSecret) {
      return res.status(404).json({ message: "İstifadəçi və ya 2FA tənzimləmələri tapılmadı" });
    }

    const isValid = verifyTOTP(token, user.twoFactorSecret);
    if (!isValid) {
      return res.status(400).json({ message: "Daxil edilən OTP kod yanlışdır" });
    }

    let deviceToken = "";
    if (rememberDevice) {
      deviceToken = crypto.randomUUID();
      const clientIp = ((req.headers["x-forwarded-for"] as string) || req.ip || "127.0.0.1").split(",")[0].trim();
      const expireAt = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days
      const newDevice = { deviceToken, ip: clientIp, expireAt };

      let trustedDevices: any[] = [];
      if (user.twoFactorTrustedDevices) {
        try {
          trustedDevices = JSON.parse(user.twoFactorTrustedDevices);
        } catch (e) {}
      }
      trustedDevices.push(newDevice);

      await db.update(schema.users)
        .set({ twoFactorTrustedDevices: JSON.stringify(trustedDevices) })
        .where(eq(schema.users.id, user.id));
    }

    const tenant = await db.query.tenants.findFirst({
      where: eq(schema.tenants.id, user.tenantId)
    });

    res.json({
      id: user.id,
      username: user.username,
      role: user.role,
      tenantId: user.tenantId,
      tenantName: tenant?.name || "Qazan POS",
      tenantSlug: tenant?.slug || "demo",
      deviceToken: rememberDevice ? deviceToken : undefined
    });
  } catch (error) {
    res.status(500).json({ message: "2FA təsdiqlənməsi zamanı xəta baş verdi" });
  }
});

router.post("/auth/2fa-disable", async (req, res) => {
  try {
    const username = req.headers["x-user-username"];
    if (!username) {
      return res.status(401).json({ message: "Səlahiyyətləndirmə xətası" });
    }

    const user = await db.query.users.findFirst({
      where: and(
        eq(schema.users.username, String(username)),
        eq(schema.users.tenantId, req.tenantId)
      )
    });

    if (!user) {
      return res.status(404).json({ message: "İstifadəçi tapılmadı" });
    }

    await db.update(schema.users)
      .set({
        twoFactorSecret: null,
        twoFactorEnabled: 0,
        twoFactorTrustedDevices: JSON.stringify([])
      })
      .where(eq(schema.users.id, user.id));

    await logActivity(req, "2FA Deaktiv Edildi", `İstifadəçi '${user.username}' 2FA təhlükəsizliyini söndürdü`);

    res.json({ success: true, message: "İki-mərhələli təhlükəsizlik deaktiv edildi!" });
  } catch (error) {
    res.status(500).json({ message: "2FA söndürülməsi zamanı xəta baş verdi" });
  }
});

// Serve QZ Digital Certificate
router.get("/auth/qz-certificate", async (req, res) => {
  try {
    const certPath = path.resolve(__dirname, "../auth/digital-certificate.txt");
    if (!fs.existsSync(certPath)) {
      return res.status(404).json({ message: "Rəqəmsal sertifikat tapılmadı" });
    }
    const cert = fs.readFileSync(certPath, "utf8");
    res.type("text/plain").send(cert);
  } catch (error) {
    res.status(500).json({ message: "Sertifikatı gətirərkən xəta baş verdi" });
  }
});

// Sign QZ messages (using SHA-512)
router.post("/auth/qz-sign", async (req, res) => {
  try {
    const { request } = req.body;
    if (!request) {
      return res.status(400).json({ message: "İmzalanacaq məlumat daxil edilməyib" });
    }

    const keyPath = path.resolve(__dirname, "../auth/private-key.pem");
    if (!fs.existsSync(keyPath)) {
      return res.status(500).json({ message: "Rəqəmsal imza açarı tapılmadı" });
    }

    const privateKey = fs.readFileSync(keyPath, "utf8");
    const signer = crypto.createSign("RSA-SHA512");
    signer.update(request);
    const signature = signer.sign(privateKey, "base64");

    res.type("text/plain").send(signature);
  } catch (error) {
    res.status(500).json({ message: "İmzalama zamanı xəta baş verdi" });
  }
});

// ----------------------------------------------------
// 1. PRODUCTS ENDPOINTS
// ----------------------------------------------------

// List all products
router.get("/products", async (req, res) => {
  try {
    const list = await db
      .select()
      .from(schema.products)
      .where(eq(schema.products.tenantId, req.tenantId));
    res.json(list);
  } catch (error) {
    res.status(500).json({ message: "Məhsulları gətirərkən xəta baş verdi" });
  }
});

// Create product
router.post("/products", async (req, res) => {
  try {
    if (!await checkUserPermission(req, "staffCanManageCatalog")) {
      return res.status(403).json({ message: "Bu əməliyyat üçün səlahiyyətiniz yoxdur." });
    }
    const { name, category, unit, description, barcode, trackingType, serialNumber, warrantyMonths } = req.body;
    if (!name) return res.status(400).json({ message: "Ad tələb olunur" });

    // Validate product name uniqueness and keyword collision (case-insensitive, normalized)
    const normalizedNewName = normalizeName(name);
    const newKeywords = description ? description.split(/[,;]+/).map((k: string) => normalizeName(k)).filter(Boolean) : [];

    const allProducts = await db.query.products.findMany({
      where: eq(schema.products.tenantId, req.tenantId)
    });

    for (const p of allProducts) {
      const existingNameNormalized = normalizeName(p.name);
      const existingKeywords = p.description ? p.description.split(/[,;]+/).map((k: string) => normalizeName(k)).filter(Boolean) : [];

      // 1. Does the new name match an existing product's name?
      if (existingNameNormalized === normalizedNewName) {
        return res.status(400).json({ 
          message: `Bu adda məhsul artıq kataloqda mövcuddur: '${p.name}'. Təkrarlanmanın qarşısını almaq üçün mövcud məhsulu istifadə edin və ya redaktə edin.` 
        });
      }

      // 2. Does the new name match an existing product's keywords?
      if (existingKeywords.includes(normalizedNewName)) {
        return res.status(400).json({ 
          message: `Bu məhsul artıq mövcuddur (Açar sözlər ilə eşləşdi: '${p.name}'). Təkrarlanmanın qarşısını almaq üçün mövcud məhsulu istifadə edin.` 
        });
      }

      // 3. Do any of the new keywords collide with an existing product's name or keywords?
      for (const newKw of newKeywords) {
        if (existingNameNormalized === newKw || existingKeywords.includes(newKw)) {
          return res.status(400).json({
            message: `Daxil etdiyiniz '${newKw}' təsvir/açar sözü artıq '${p.name}' məhsulunda istifadə olunub. Təkrarlanan açar sözlərdən istifadə etmək olmaz.`
          });
        }
      }
    }

    // Validate barcode uniqueness
    if (barcode) {
      const existingProduct = await db.query.products.findFirst({
        where: and(eq(schema.products.barcode, barcode), eq(schema.products.tenantId, req.tenantId))
      });
      if (existingProduct) {
        return res.status(400).json({ message: "Bu barkod artıq başqa məhsula təyin edilib" });
      }
    }

    // Validate serial number uniqueness if provided
    if (trackingType === "serialized" && serialNumber) {
      const cleaned = serialNumber.trim().toUpperCase();
      const existing = await db.query.productSerials.findFirst({
        where: and(
          eq(schema.productSerials.serialNumber, cleaned),
          eq(schema.productSerials.tenantId, req.tenantId),
          inArray(schema.productSerials.status, ["in_stock", "sold"])
        ),
      });
      if (existing) {
        return res.status(400).json({ 
          message: `Daxil etdiyiniz serial nömrə (${cleaned}) artıq bazada mövcuddur (Status: ${existing.status})` 
        });
      }
    }

    // Enforce SaaS resource limits
    const limitCheck = await verifyTenantLimit(req.tenantId, "products");
    if (!limitCheck.allowed) {
      return res.status(402).json({
        limitReached: true,
        limitType: "products",
        current: limitCheck.current,
        max: limitCheck.max,
        tier: limitCheck.tier,
        message: `Məhsul limitinə çatdınız! Mövcud planınızda limit: ${limitCheck.max} məhsul.`
      });
    }

    const createdProduct = await db.transaction(async (tx) => {
      // 1. Insert product
      const productRows = await tx
        .insert(schema.products)
        .values({
          tenantId: req.tenantId,
          name,
          category: category || null,
          unit: unit || "ədəd",
          description: description || null,
          barcode: barcode || null,
          trackingType: trackingType || "none",
          warrantyMonths: warrantyMonths ? parseInt(String(warrantyMonths)) : null,
        })
        .returning();

      const prod = productRows[0];

      // 2. Insert stock entry & serial number if serialNumber is supplied
      if (trackingType === "serialized" && serialNumber) {
        const cleanedSerial = serialNumber.trim().toUpperCase();
        
        // Create matching stock entry
        const entryRows = await tx
          .insert(schema.stockEntries)
          .values({
            tenantId: req.tenantId,
            productId: prod.id,
            quantity: 1,
            purchasePrice: 0,
            supplier: "İlkin Mədaxil",
            notes: "Məhsul yaradılarkən avtomatik əlavə edilib",
            paymentType: "Nəğd",
            paidStatus: "paid",
            entryDate: new Date().toISOString(),
          })
          .returning();

        const entryId = entryRows[0].id;

        // Create product serial record
        await tx.insert(schema.productSerials).values({
          tenantId: req.tenantId,
          productId: prod.id,
          stockEntryId: entryId,
          serialNumber: cleanedSerial,
          status: "in_stock",
          createdAt: new Date().toISOString(),
        });
      }

      return prod;
    });

    await logActivity(req, "CREATE_PRODUCT", `Yeni məhsul yaratdı: '${name}' (Kateqoriya: ${category || "yoxdur"}, Vahid: ${unit || "ədəd"}, İzləmə: ${trackingType || "none"})${serialNumber ? ` (İlkin S/N: ${serialNumber.trim().toUpperCase()})` : ""}`);

    res.json(createdProduct);
  } catch (error) {
    console.error("Product creation error:", error);
    res.status(500).json({ message: "Məhsul yaradılarkən xəta baş verdi" });
  }
});

// Update product
router.put("/products/:id", async (req, res) => {
  try {
    if (!await checkUserPermission(req, "staffCanManageCatalog")) {
      return res.status(403).json({ message: "Bu əməliyyat üçün səlahiyyətiniz yoxdur." });
    }
    const id = parseInt(req.params.id);
    const { name, category, unit, description, barcode, trackingType, warrantyMonths } = req.body;

    // Fetch existing product to resolve current name/description if missing in req.body
    const currentProduct = await db.query.products.findFirst({
      where: and(eq(schema.products.id, id), eq(schema.products.tenantId, req.tenantId))
    });
    if (!currentProduct) {
      return res.status(404).json({ message: "Məhsul tapılmadı" });
    }

    const resolvedName = name !== undefined ? name : currentProduct.name;
    const resolvedDescription = description !== undefined ? description : currentProduct.description;

    if (resolvedName) {
      const normalizedNewName = normalizeName(resolvedName);
      const newKeywords = resolvedDescription ? resolvedDescription.split(/[,;]+/).map((k: string) => normalizeName(k)).filter(Boolean) : [];

      const allProducts = await db.query.products.findMany({
        where: and(
          eq(schema.products.tenantId, req.tenantId),
          sql`${schema.products.id} != ${id}`
        )
      });

      for (const p of allProducts) {
        const existingNameNormalized = normalizeName(p.name);
        const existingKeywords = p.description ? p.description.split(/[,;]+/).map((k: string) => normalizeName(k)).filter(Boolean) : [];

        // 1. Does the new name match another product's name?
        if (existingNameNormalized === normalizedNewName) {
          return res.status(400).json({ 
            message: `Bu adda məhsul artıq kataloqda mövcuddur: '${p.name}'. Təkrarlanmanın qarşısını almaq üçün fərqli bir ad seçin.` 
          });
        }

        // 2. Does the new name match another product's keywords?
        if (existingKeywords.includes(normalizedNewName)) {
          return res.status(400).json({ 
            message: `Bu məhsul artıq mövcuddur (Açar sözlər ilə eşləşdi: '${p.name}'). Təkrarlanmanın qarşısını almaq üçün fərqli bir ad seçin.` 
          });
        }

        // 3. Do any of the new keywords collide with another product's name or keywords?
        for (const newKw of newKeywords) {
          if (existingNameNormalized === newKw || existingKeywords.includes(newKw)) {
            return res.status(400).json({
              message: `Daxil etdiyiniz '${newKw}' təsvir/açar sözü artıq '${p.name}' məhsulunda istifadə olunub. Təkrarlanan açar sözlərdən istifadə etmək olmaz.`
            });
          }
        }
      }
    }

    // Validate barcode uniqueness
    if (barcode) {
      const existingProduct = await db.query.products.findFirst({
        where: and(
          eq(schema.products.barcode, barcode),
          eq(schema.products.tenantId, req.tenantId),
          sql`${schema.products.id} != ${id}`
        )
      });
      if (existingProduct) {
        return res.status(400).json({ message: "Bu barkod artıq başqa məhsula təyin edilib" });
      }
    }

    const updated = await db
      .update(schema.products)
      .set({
        name,
        category: category || null,
        unit: unit || "ədəd",
        description: description || null,
        barcode: barcode || null,
        trackingType: trackingType || "none",
        warrantyMonths: warrantyMonths ? parseInt(String(warrantyMonths)) : null,
      })
      .where(and(eq(schema.products.id, id), eq(schema.products.tenantId, req.tenantId)))
      .returning();

    if (updated.length === 0)
      return res.status(404).json({ message: "Məhsul tapılmadı" });

    await logActivity(req, "UPDATE_PRODUCT", `'${name}' (ID: ${id}) məhsulunun məlumatlarını yenilədi`);

    res.json(updated[0]);
  } catch (error) {
    res.status(500).json({ message: "Məhsul yenilənərkən xəta baş verdi" });
  }
});

// Delete product
router.delete("/products/:id", async (req, res) => {
  try {
    if (!await checkUserPermission(req, "staffCanManageCatalog")) {
      return res.status(403).json({ message: "Bu əməliyyat üçün səlahiyyətiniz yoxdur." });
    }
    const id = parseInt(req.params.id);
    const deleted = await db
      .delete(schema.products)
      .where(and(eq(schema.products.id, id), eq(schema.products.tenantId, req.tenantId)))
      .returning();

    if (deleted.length === 0)
      return res.status(404).json({ message: "Məhsul tapılmadı" });

    await logActivity(req, "DELETE_PRODUCT", `'${deleted[0].name}' (ID: ${id}) məhsulunu kataloqdan sildi`);

    res.json({ message: "Məhsul silindi" });
  } catch (error) {
    res.status(500).json({ message: "Məhsul silinərkən xəta baş verdi" });
  }
});

// ----------------------------------------------------
// 2. STOCK ENDPOINTS
// ----------------------------------------------------

router.get("/stock/entries", async (req, res) => {
  try {
    if (!await checkUserPermission(req, "staffCanViewStock")) {
      return res.status(403).json({ message: "Anbar mədaxil tarixçəsinə giriş administrator tərəfindən məhdudlaşdırılıb" });
    }
    const entries = await db.query.stockEntries.findMany({
      where: eq(schema.stockEntries.tenantId, req.tenantId),
      with: { product: true },
      orderBy: [desc(schema.stockEntries.entryDate)],
    });

    const result = entries.map((entry) => ({
      id: entry.id,
      productId: entry.productId,
      productName: entry.product.name,
      vendorId: entry.vendorId,
      quantity: entry.quantity,
      purchasePrice: entry.purchasePrice,
      supplier: entry.supplier,
      notes: entry.notes,
      paymentType: entry.paymentType,
      creditDueDate: entry.creditDueDate,
      entryDate: entry.entryDate,
      paidStatus: entry.paidStatus,
    }));

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: "Mədaxilləri gətirərkən xəta baş verdi" });
  }
});

// Create stock entry
router.post("/stock/entries", async (req, res) => {
  try {
    if (!await checkUserPermission(req, "staffCanViewStock")) {
      return res.status(403).json({ message: "Anbara mədaxil etmək səlahiyyətiniz yoxdur" });
    }

    const { productId, quantity, purchasePrice, supplier, notes, paymentType, creditDueDate, vendorId, serialNumbers, bankName, applyEdv } = req.body;

    if (!productId || !quantity || !purchasePrice || !paymentType) {
      return res.status(400).json({ message: "Məcburi sahələri doldurun" });
    }

    const isCredit = paymentType === "Nisyə";
    if (isCredit && !creditDueDate) {
      return res.status(400).json({ message: "Nisyə üçün son tarix daxil edilməlidir" });
    }

    // 1. Fetch product to check trackingType
    const productList = await db
      .select()
      .from(schema.products)
      .where(and(eq(schema.products.id, productId), eq(schema.products.tenantId, req.tenantId)))
      .limit(1);

    if (productList.length === 0) {
      return res.status(404).json({ message: "Məhsul tapılmadı" });
    }

    const product = productList[0];
    const isSerialized = product.trackingType === "serialized";
    const isSerializedInput = (serialNumbers && Array.isArray(serialNumbers) && serialNumbers.length > 0);

    if (isSerialized || isSerializedInput) {
      if (!serialNumbers || !Array.isArray(serialNumbers) || serialNumbers.length !== parseInt(quantity)) {
        return res.status(400).json({ 
          message: `Serial nömrəli daxiletmə üçün dəqiq ${parseInt(quantity)} ədəd serial nömrəsi daxil edilməlidir` 
        });
      }

      // Check for duplicates in the current input
      const uniqueSerialsInput = new Set(serialNumbers.map(s => s.trim().toUpperCase()));
      if (uniqueSerialsInput.size !== serialNumbers.length) {
        return res.status(400).json({ message: "Daxil edilən serial nömrələrində təkrarlanma var" });
      }

      // Check for duplicates in the database for this tenant
      for (const sNum of serialNumbers) {
        const cleaned = sNum.trim().toUpperCase();
        const existing = await db.query.productSerials.findFirst({
          where: and(
            eq(schema.productSerials.serialNumber, cleaned),
            eq(schema.productSerials.tenantId, req.tenantId),
            inArray(schema.productSerials.status, ["in_stock", "sold"])
          ),
        });
        if (existing) {
          return res.status(400).json({ 
            message: `Serial nömrə (${cleaned}) artıq bazada mövcuddur (Status: ${existing.status})` 
          });
        }
      }
    }

    const newEntry = await db.transaction(async (tx) => {
      // 2. Insert stock entry
      const entry = await tx
        .insert(schema.stockEntries)
        .values({
          tenantId: req.tenantId,
          productId,
          vendorId: vendorId ? parseInt(vendorId) : null,
          quantity: parseFloat(quantity),
          purchasePrice: parseFloat(purchasePrice),
          supplier: supplier || null,
          notes: notes || null,
          paymentType,
          bankName: paymentType === "Kart" ? (bankName || null) : null,
          creditDueDate: isCredit ? creditDueDate : null,
          entryDate: new Date().toISOString(),
          paidStatus: isCredit ? "credit" : "paid",
          applyEdv: applyEdv !== undefined && applyEdv !== null ? (applyEdv ? 1 : 0) : 1,
        })
        .returning();

      const entryId = entry[0].id;

      // 3. Insert serial numbers if serialized
      if ((isSerialized || isSerializedInput) && serialNumbers) {
        for (const sNum of serialNumbers) {
          await tx.insert(schema.productSerials).values({
            tenantId: req.tenantId,
            productId,
            stockEntryId: entryId,
            serialNumber: sNum.trim().toUpperCase(),
            status: "in_stock",
            createdAt: new Date().toISOString(),
          });
        }
      }

      return entry[0];
    });

    const productName = product.name;
    const unit = product.unit;
    await logActivity(
      req,
      "CREATE_STOCK_ENTRY",
      `Anbara mədaxil etdi: ${quantity} ${unit} '${productName}' (Alış qiyməti: ${purchasePrice} ₼, Tədarükçü: ${supplier || "Yoxdur"}, Ödəniş: ${paymentType})`
    );

    res.json(newEntry);

    // Send Telegram Notification in fire-and-forget background thread
    sendTelegramNotification(req.tenantId, `📦 <b>Yeni Mal Mədaxili!</b>\n\n<b>Məhsul:</b> ${productName}\n<b>Miqdar:</b> ${quantity} ${unit}\n<b>Alış Qiyməti:</b> <code>${purchasePrice} ₼</code>\n<b>Tədarükçü:</b> ${supplier || "Yoxdur"}\n<b>Ödəniş Üsulu:</b> ${paymentType}`).catch(err => console.error("Telegram notification failed:", err));
  } catch (error: any) {
    console.error("Stock entry error:", error);
    res.status(500).json({ message: "Mədaxil edilərkən xəta baş verdi: " + error.message });
  }
});

// Fetch stock levels (current quantities, latest purchase prices, total value)
router.get("/stock/levels", async (req, res) => {
  try {
    const { allProducts, metrics } = await fetchTenantStockMetrics(req.tenantId);

    // Get latest sale prices in bulk
    const maxSaleIds = db
      .select({
        productId: schema.saleItems.productId,
        maxId: sql`max(${schema.saleItems.id})`.as("max_id")
      })
      .from(schema.saleItems)
      .where(eq(schema.saleItems.tenantId, req.tenantId))
      .groupBy(schema.saleItems.productId)
      .as("max_sale_ids");

    const latestSales = await db
      .select({
        productId: schema.saleItems.productId,
        price: schema.saleItems.salePrice
      })
      .from(schema.saleItems)
      .innerJoin(maxSaleIds, eq(schema.saleItems.id, maxSaleIds.maxId));

    const latestSalesMap = new Map<number, number>();
    latestSales.forEach(s => latestSalesMap.set(s.productId, s.price));

    // Get active serials in bulk
    const allSerials = await db
      .select({
        productId: schema.productSerials.productId,
        serialNumber: schema.productSerials.serialNumber
      })
      .from(schema.productSerials)
      .where(
        and(
          eq(schema.productSerials.tenantId, req.tenantId),
          eq(schema.productSerials.status, "in_stock")
        )
      );

    const serialsMap = new Map<number, string[]>();
    allSerials.forEach(s => {
      if (!serialsMap.has(s.productId)) {
        serialsMap.set(s.productId, []);
      }
      serialsMap.get(s.productId)!.push(s.serialNumber);
    });

    const stockLevels = [];
    for (const product of allProducts) {
      const metric = metrics.get(product.id)!;
      const lastPurchasePrice = metric.nextUnitCost;
      const lastSalePrice = latestSalesMap.get(product.id) ?? lastPurchasePrice;
      const activeSerials = serialsMap.get(product.id) || [];

      stockLevels.push({
        productId: product.id,
        productName: product.name,
        category: product.category,
        unit: product.unit,
        currentQuantity: metric.currentQuantity,
        lastPurchasePrice,
        lastSalePrice,
        totalValue: metric.totalValue,
        trackingType: product.trackingType,
        activeSerials,
        lastPurchaseDate: metric.lastPurchaseDate,
        barcode: product.barcode,
        description: product.description,
      });
    }

    res.json(stockLevels);
  } catch (error: any) {
    console.error("Stock levels calculation error:", error);
    res.status(500).json({ message: "Anbar qalıqlarını hesablayarkən xəta baş verdi" });
  }
});

// Get our debts to suppliers (stockEntries with credit status)
router.get("/stock/my-debts", requireAdmin, async (req, res) => {
  try {
    const debts = await db.query.stockEntries.findMany({
      where: and(eq(schema.stockEntries.paidStatus, "credit"), eq(schema.stockEntries.tenantId, req.tenantId)),
      with: { product: true },
      orderBy: [desc(schema.stockEntries.entryDate)],
    });

    const result = debts.map((d) => ({
      id: d.id,
      productId: d.productId,
      productName: d.product.name,
      quantity: d.quantity,
      purchasePrice: d.purchasePrice,
      totalAmount: d.quantity * d.purchasePrice,
      supplier: d.supplier,
      creditDueDate: d.creditDueDate,
      entryDate: d.entryDate,
    }));

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: "Borclarımızı gətirərkən xəta baş verdi" });
  }
});

// Pay supplier debt
router.patch("/stock/entries/:id/pay", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { paymentType, paymentFrom, notes } = req.body;

    const entry = await db.query.stockEntries.findFirst({
      where: and(eq(schema.stockEntries.id, id), eq(schema.stockEntries.tenantId, req.tenantId))
    });

    if (!entry) {
      return res.status(404).json({ message: "Mədaxil tapılmadı" });
    }

    await db
      .update(schema.stockEntries)
      .set({ paidStatus: "paid" })
      .where(eq(schema.stockEntries.id, id));

    const productList = await db.select().from(schema.products).where(and(eq(schema.products.id, entry.productId), eq(schema.products.tenantId, req.tenantId))).limit(1);
    const productName = productList[0] ? productList[0].name : `ID: ${entry.productId}`;
    const debtAmount = entry.quantity * entry.purchasePrice;

    // Link and automatically insert record in global vendorPayments
    let vendorId = entry.vendorId;
    if (!vendorId && entry.supplier) {
      const v = await db.query.vendors.findFirst({
        where: and(eq(schema.vendors.name, entry.supplier), eq(schema.vendors.tenantId, req.tenantId))
      });
      if (v) vendorId = v.id;
    }

    if (vendorId) {
      await db.insert(schema.vendorPayments).values({
        tenantId: req.tenantId,
        vendorId,
        amount: debtAmount,
        paymentDate: new Date().toISOString(),
        paymentType: paymentType || "Nəğd",
        notes: notes || `Mədaxil №${entry.id} (${productName}) üzrə borc ödənişi (Mənbə: ${paymentFrom || "Əsas"})`,
      });
    }

    await logActivity(
      req,
      "PAY_SUPPLIER_DEBT",
      `Tədarükçüyə olan borcu ödədi: ${debtAmount.toFixed(2)} ₼ (Məhsul: '${productName}', Tədarükçü: ${entry.supplier || "Yoxdur"}, Kassadan: ${paymentFrom || "Əsas"})`
    );

    res.json({ message: "Borc uğurla ödənildi" });
  } catch (error) {
    res.status(500).json({ message: "Borc ödənilərkən xəta baş verdi" });
  }
});

// Edit stock entry with admin password verification
router.put("/stock/entries/:id", async (req, res) => {
  try {
    if (!await checkUserPermission(req, "staffCanViewStock")) {
      return res.status(403).json({ message: "Anbar mədaxilini redaktə etmək səlahiyyətiniz yoxdur" });
    }

    const id = parseInt(req.params.id);
    const { quantity, purchasePrice, paymentType, creditDueDate, supplier, notes, vendorId, adminPassword, bankName, applyEdv } = req.body;

    if (quantity === undefined || purchasePrice === undefined || !paymentType) {
      return res.status(400).json({ message: "Məcburi sahələri doldurun" });
    }

    if (!adminPassword) {
      return res.status(400).json({ message: "Düzəliş üçün Admin şifrəsi tələb olunur" });
    }

    // Verify admin password
    const correctAdmin = await db.query.users.findFirst({
      where: and(
        eq(schema.users.tenantId, req.tenantId),
        eq(schema.users.role, "Admin"),
        eq(schema.users.password, adminPassword.trim())
      )
    });

    if (!correctAdmin) {
      return res.status(401).json({ message: "Daxil etdiyiniz Admin şifrəsi yanlışdır" });
    }

    // Fetch the existing entry
    const entry = await db.query.stockEntries.findFirst({
      where: and(eq(schema.stockEntries.id, id), eq(schema.stockEntries.tenantId, req.tenantId))
    });

    if (!entry) {
      return res.status(404).json({ message: "Mədaxil tapılmadı" });
    }

    // Fetch the product
    const productList = await db
      .select()
      .from(schema.products)
      .where(and(eq(schema.products.id, entry.productId), eq(schema.products.tenantId, req.tenantId)))
      .limit(1);

    if (productList.length === 0) {
      return res.status(404).json({ message: "Məhsul tapılmadı" });
    }

    const product = productList[0];
    const isSerialized = product.trackingType === "serialized";

    const serialCountResult = await db
      .select({ count: sql`count(*)` })
      .from(schema.productSerials)
      .where(eq(schema.productSerials.stockEntryId, id));
    const entryHasSerials = parseInt((serialCountResult[0]?.count as string) || "0") > 0;

    const parsedQty = parseFloat(quantity);
    const parsedPrice = parseFloat(purchasePrice);

    if ((isSerialized || entryHasSerials) && parsedQty !== entry.quantity) {
      return res.status(400).json({ message: "Serial nömrəli məhsulun miqdarını birbaşa dəyişmək olmaz" });
    }

    // Calculate current stock to prevent negative stock level
    if (parsedQty < entry.quantity) {
      // 1. Calculate total restocked
      const restockedResult = await db
        .select({ total: sql`SUM(quantity)` })
        .from(schema.stockEntries)
        .where(and(eq(schema.stockEntries.productId, product.id), eq(schema.stockEntries.tenantId, req.tenantId)));
      const totalRestocked = parseFloat((restockedResult[0]?.total as string) || "0");

      // 2. Calculate total sold
      const soldResult = await db
        .select({ total: sql`SUM(quantity)` })
        .from(schema.saleItems)
        .where(and(eq(schema.saleItems.productId, product.id), eq(schema.saleItems.tenantId, req.tenantId)));
      const totalSold = parseFloat((soldResult[0]?.total as string) || "0");

      // 3. Calculate total returned
      const returnedResult = await db
        .select({ total: sql`SUM(quantity)` })
        .from(schema.returnItems)
        .where(
          and(
            eq(schema.returnItems.productId, product.id),
            eq(schema.returnItems.tenantId, req.tenantId),
            eq(schema.returnItems.status, "returned_to_stock")
          )
        );
      const totalReturned = parseFloat((returnedResult[0]?.total as string) || "0");

      const currentQuantity = totalRestocked - totalSold + totalReturned;
      const difference = parsedQty - entry.quantity; // will be negative
      if (currentQuantity + difference < 0) {
        return res.status(400).json({ 
          message: `Düzəliş mümkün deyil: Qalıq miqdar mənfi ola bilməz (Mövcud qalıq: ${currentQuantity} ${product.unit}, Azaldılan miqdar: ${Math.abs(difference)} ${product.unit})` 
        });
      }
    }

    let newPaidStatus = entry.paidStatus;
    if (paymentType === "Nisyə") {
      if (entry.paymentType !== "Nisyə") {
        newPaidStatus = "credit";
      }
    } else {
      newPaidStatus = "paid";
    }

    // Update entry
    const updated = await db
      .update(schema.stockEntries)
      .set({
        quantity: parsedQty,
        purchasePrice: parsedPrice,
        paymentType,
        bankName: paymentType === "Kart" ? (bankName || null) : null,
        creditDueDate: paymentType === "Nisyə" ? creditDueDate : null,
        paidStatus: newPaidStatus,
        supplier: supplier || null,
        notes: notes || null,
        vendorId: vendorId ? parseInt(vendorId) : null,
        applyEdv: applyEdv !== undefined && applyEdv !== null ? (applyEdv ? 1 : 0) : entry.applyEdv,
      })
      .where(eq(schema.stockEntries.id, id))
      .returning();

    await logActivity(
      req,
      "UPDATE_STOCK_ENTRY",
      `Mədaxil №${id} düzəliş edildi: Miqdar: ${entry.quantity} -> ${parsedQty}, Alış: ${entry.purchasePrice} -> ${parsedPrice}, Ödəniş: ${entry.paymentType} -> ${paymentType}`
    );

    res.json(updated[0]);
  } catch (error: any) {
    console.error("Update stock entry error:", error);
    res.status(500).json({ message: "Mədaxil düzəlişi zamanı xəta baş verdi: " + error.message });
  }
});

// ----------------------------------------------------
// 3. CUSTOMERS ENDPOINTS
// ----------------------------------------------------

// List all customers
router.get("/customers", async (req, res) => {
  try {
    const role = req.headers["x-user-role"] as string;
    const username = req.headers["x-user-username"] as string;

    let conditions = eq(schema.customers.tenantId, req.tenantId);
    if (role !== "Admin") {
      const normalizedUsername = username ? username.trim().toLowerCase() : "";
      conditions = and(conditions, eq(schema.customers.createdByName, normalizedUsername)) as any;
    }

    const list = await db
      .select()
      .from(schema.customers)
      .where(conditions);
    res.json(list);
  } catch (error) {
    res.status(500).json({ message: "Müştəriləri gətirərkən xəta baş verdi" });
  }
});

// Create customer
router.post("/customers", async (req, res) => {
  try {
    const { name, phone, email, address, notes } = req.body;
    if (!name) return res.status(400).json({ message: "Müştəri adı tələb olunur" });

    const rawCreator = req.headers["x-user-username"] as string;
    const createdByName = rawCreator ? rawCreator.trim().toLowerCase() : (req.headers["x-user-role"] === "Admin" ? "admin" : "satici");

    const newCustomer = await db
      .insert(schema.customers)
      .values({
        tenantId: req.tenantId,
        name,
        phone: phone || null,
        email: email || null,
        address: address || null,
        notes: notes || null,
        createdByName,
      })
      .returning();

    await logActivity(req, "CREATE_CUSTOMER", `Yeni müştəri profili yaratdı: '${name}' (Tel: ${phone || "yoxdur"})`);

    res.json(newCustomer[0]);
  } catch (error) {
    res.status(500).json({ message: "Müştəri yaradılarkən xəta baş verdi" });
  }
});

// Update customer
router.put("/customers/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, phone, email, address, notes } = req.body;

    const customer = await db.query.customers.findFirst({
      where: and(eq(schema.customers.id, id), eq(schema.customers.tenantId, req.tenantId))
    });
    if (!customer) return res.status(404).json({ message: "Müştəri tapılmadı" });

    const role = req.headers["x-user-role"] as string;
    const username = req.headers["x-user-username"] as string;

    if (role !== "Admin") {
      const normalizedUsername = username ? username.trim().toLowerCase() : "";
      if (customer.createdByName !== normalizedUsername) {
        return res.status(403).json({ message: "Bu müştəri profilini yeniləmək üçün səlahiyyətiniz yoxdur" });
      }
    }

    const updated = await db
      .update(schema.customers)
      .set({
        name,
        phone: phone || null,
        email: email || null,
        address: address || null,
        notes: notes || null,
      })
      .where(and(eq(schema.customers.id, id), eq(schema.customers.tenantId, req.tenantId)))
      .returning();

    if (updated.length === 0)
      return res.status(404).json({ message: "Müştəri tapılmadı" });

    await logActivity(req, "UPDATE_CUSTOMER", `'${name}' (ID: ${id}) müştərisinin əlaqə məlumatlarını yenilədi`);

    res.json(updated[0]);
  } catch (error) {
    res.status(500).json({ message: "Müştəri yenilənərkən xəta baş verdi" });
  }
});

// Delete customer
router.delete("/customers/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const deleted = await db
      .delete(schema.customers)
      .where(and(eq(schema.customers.id, id), eq(schema.customers.tenantId, req.tenantId)))
      .returning();

    if (deleted.length === 0)
      return res.status(404).json({ message: "Müştəri tapılmadı" });

    await logActivity(req, "DELETE_CUSTOMER", `'${deleted[0].name}' (ID: ${id}) müştəri profilini sistemdən sildi`);

    res.json({ message: "Müştəri silindi" });
  } catch (error) {
    res.status(500).json({ message: "Müştəri silinərkən xəta baş verdi" });
  }
});

// Get customer sales and overall debts summary
router.get("/customers/:id/sales", async (req, res) => {
  try {
    if (!await checkUserPermission(req, "staffCanViewCustomers") || !await checkUserPermission(req, "staffCanViewSalesHistory")) {
      return res.status(403).json({ message: "Giriş məhdudlaşdırılıb" });
    }

    const customerId = parseInt(req.params.id);
    const role = req.headers["x-user-role"] as string;
    const username = req.headers["x-user-username"] as string;

    let conditions = and(eq(schema.sales.customerId, customerId), eq(schema.sales.tenantId, req.tenantId));
    if (role !== "Admin") {
      const normalizedUsername = username ? username.trim().toLowerCase() : "";
      conditions = and(conditions, eq(schema.sales.sellerName, normalizedUsername)) as any;
    }

    const customerSales = await db.query.sales.findMany({
      where: conditions,
      with: { items: { with: { product: true } }, payments: true },
      orderBy: [desc(schema.sales.saleDate)],
    });

    res.json(customerSales);
  } catch (error) {
    res.status(500).json({ message: "Müştəri satışlarını gətirərkən xəta baş verdi" });
  }
});

// ----------------------------------------------------
// 4. SALES ENDPOINTS
// ----------------------------------------------------

router.get("/sales", async (req, res) => {
  try {
    const { from, to } = req.query;
    let conditions = eq(schema.sales.tenantId, req.tenantId);

    if (from) {
      conditions = and(conditions, gte(schema.sales.saleDate, `${from}T00:00:00.000Z`)) as any;
    }
    if (to) {
      conditions = and(conditions, lte(schema.sales.saleDate, `${to}T23:59:59.999Z`)) as any;
    }

    const role = req.headers["x-user-role"] as string;
    const username = req.headers["x-user-username"] as string;

    if (!await checkUserPermission(req, "staffCanViewSalesHistory")) {
      return res.status(403).json({ message: "Satış tarixçəsinə giriş administrator tərəfindən məhdudlaşdırılıb" });
    }

    if (role !== "Admin") {
      const normalizedUsername = username ? username.trim().toLowerCase() : "";
      conditions = and(conditions, eq(schema.sales.sellerName, normalizedUsername)) as any;
    }

    const list = await db.query.sales.findMany({
      where: conditions,
      with: { 
        payments: true, 
        returns: { with: { items: true } },
        items: { with: { product: true } }
      },
      orderBy: [desc(schema.sales.saleDate)],
    });
    res.json(list);
  } catch (error) {
    res.status(500).json({ message: "Satış tarixçəsini gətirərkən xəta baş verdi" });
  }
});

// Process a POS sale / checkout
router.post("/sales", async (req, res) => {
  try {
    const { customerId, paymentType, creditDueDate, notes, items, totalAmount, totalCost, paidAmount, offlineId, salesChannel, marketplaceFee, bankName, applyEdv } = req.body;

    if (!items || items.length === 0 || !paymentType) {
      return res.status(400).json({ message: "Çek məlumatları boş ola bilməz" });
    }

    // Idempotency check for offline sync
    if (offlineId) {
      const existingSale = await db.query.sales.findFirst({
        where: and(eq(schema.sales.offlineId, offlineId), eq(schema.sales.tenantId, req.tenantId))
      });
      if (existingSale) {
        console.warn(`Duplicate sale with offlineId ${offlineId} ignored.`);
        return res.json(existingSale);
      }
    }

    // Enforce SaaS resource limits
    const limitCheck = await verifyTenantLimit(req.tenantId, "sales");
    if (!limitCheck.allowed) {
      return res.status(402).json({
        limitReached: true,
        limitType: "sales",
        current: limitCheck.current,
        max: limitCheck.max,
        tier: limitCheck.tier,
        message: `Satış limitinə çatdınız! Mövcud planınızda limit: ${limitCheck.max} satış.`
      });
    }

    const isCredit = paymentType === "Nisyə";
    if (isCredit && !creditDueDate) {
      return res.status(400).json({ message: "Nisyə satış üçün ödəniş tarixi mütləqdir" });
    }

    let customerName = "Anonim Müştəri";
    let customerPhone = "";
    if (customerId) {
      const existingCust = await db.query.customers.findFirst({
        where: and(eq(schema.customers.id, customerId), eq(schema.customers.tenantId, req.tenantId))
      });
      if (existingCust) {
        customerName = existingCust.name;
        customerPhone = existingCust.phone || "";
      }
    }

    const rawSeller = req.headers["x-user-username"] as string;
    const sellerName = rawSeller ? rawSeller.trim().toLowerCase() : (req.headers["x-user-role"] === "Admin" ? "admin" : "satici");

    // Calculate FIFO costs for all items
    const processedItems: {
      productId: number;
      quantity: number;
      salePrice: number;
      purchasePrice: number;
      serialNumbers?: string[];
    }[] = [];
    let calculatedTotalCost = 0;
    for (const item of items) {
      const qty = parseFloat(item.quantity);
      const fifoCost = await computeFIFOSaleCost(item.productId, req.tenantId, qty);
      calculatedTotalCost += qty * fifoCost;
      processedItems.push({
        productId: item.productId,
        quantity: qty,
        salePrice: parseFloat(item.salePrice),
        purchasePrice: fifoCost,
        serialNumbers: item.serialNumbers
      });
    }

    // Execute database operations in a transaction
    const saleResult = await db.transaction(async (tx) => {
      // Insert sale
      const newSale = await tx
        .insert(schema.sales)
        .values({
          tenantId: req.tenantId,
          customerId: customerId || null,
          customerName,
          customerPhone,
          paymentType,
          bankName: paymentType === "Kart" ? (bankName || null) : null,
          creditDueDate: isCredit ? creditDueDate : null,
          notes: notes || null,
          saleDate: new Date().toISOString(),
          totalAmount: parseFloat(totalAmount),
          totalCost: parseFloat(calculatedTotalCost.toFixed(2)),
          paymentStatus: isCredit ? "credit" : "paid",
          offlineId: offlineId || null,
          salesChannel: salesChannel || "Mağaza",
          marketplaceFee: marketplaceFee ? parseFloat(marketplaceFee) : 0,
          sellerName,
          applyEdv: applyEdv !== undefined && applyEdv !== null ? (applyEdv ? 1 : 0) : 1,
        })
        .returning();

      const saleId = newSale[0].id;

      // Insert items
      for (const item of processedItems) {
        await tx.insert(schema.saleItems).values({
          tenantId: req.tenantId,
          saleId,
          productId: item.productId,
          quantity: item.quantity,
          salePrice: item.salePrice,
          purchasePrice: item.purchasePrice,
        });

        // Link serial numbers if provided
        if (item.serialNumbers && Array.isArray(item.serialNumbers) && item.serialNumbers.length > 0) {
          for (const sNum of item.serialNumbers) {
            const cleaned = sNum.trim().toUpperCase();
            await tx
              .update(schema.productSerials)
              .set({
                status: "sold",
                saleId,
                soldAt: new Date().toISOString(),
              })
              .where(
                and(
                  eq(schema.productSerials.serialNumber, cleaned),
                  eq(schema.productSerials.tenantId, req.tenantId),
                  eq(schema.productSerials.status, "in_stock")
                )
              );
          }
        }
      }

      // If partial initial payment was made on credit
      if (isCredit && paidAmount && parseFloat(paidAmount) > 0) {
        await tx.insert(schema.creditPayments).values({
          tenantId: req.tenantId,
          saleId,
          paymentDate: new Date().toISOString(),
          amount: parseFloat(paidAmount),
        });
      }

      // If sale has marketplace commission, automatically record a matching platform commission expense!
      if (marketplaceFee && parseFloat(marketplaceFee) > 0) {
        await tx.insert(schema.expenses).values({
          tenantId: req.tenantId,
          amount: parseFloat(marketplaceFee),
          category: "Marketplace Komissiyası",
          description: `birmarket.az satışı üzrə platforma komissiyası (Çek № ${saleId})`,
          date: new Date().toISOString(),
        });
      }

      return newSale[0];
    });

    await logActivity(
      req,
      "CHECKOUT_SALE",
      `POS satışı həyata keçirdi: Çek № ${saleResult.id} (Məbləğ: ${totalAmount} ₼, Müştəri: ${customerName}, Ödəniş: ${paymentType})`
    );

    res.json(saleResult);

    // Send Telegram Notification in background
    sendTelegramNotification(req.tenantId, `⚡ <b>Yeni POS Satışı!</b>\n\n<b>Çek №:</b> <code>${saleResult.id}</code>\n<b>Müştəri:</b> ${customerName}\n<b>Ödəniş Üsulu:</b> ${paymentType}\n<b>Ümumi Məbləğ:</b> <code>${parseFloat(totalAmount).toFixed(2)} ₼</code>\n<b>Maya Dəyəri:</b> <code>${parseFloat(totalCost).toFixed(2)} ₼</code>\n<b>Gəlir:</b> <code>${(parseFloat(totalAmount) - parseFloat(totalCost)).toFixed(2)} ₼</code>`).catch(err => console.error("Telegram notification failed:", err));
  } catch (error) {
    res.status(500).json({ message: "Satış tamamlanarkən xəta baş verdi" });
  }
});

// Get invoice by ID
router.get("/sales/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const sale = await db.query.sales.findFirst({
      where: and(eq(schema.sales.id, id), eq(schema.sales.tenantId, req.tenantId)),
      with: { 
        items: { with: { product: true } }, 
        payments: true,
        returns: { with: { items: { with: { product: true } } } },
        serials: true,
      },
    });

    if (!sale) return res.status(404).json({ message: "Çek tapılmadı" });

    const role = req.headers["x-user-role"] as string;
    const username = req.headers["x-user-username"] as string;

    if (!await checkUserPermission(req, "staffCanViewSalesHistory")) {
      return res.status(403).json({ message: "Satış tarixçəsinə giriş administrator tərəfindən məhdudlaşdırılıb" });
    }

    if (role !== "Admin") {
      const normalizedUsername = username ? username.trim().toLowerCase() : "";
      if (sale.sellerName !== normalizedUsername) {
        return res.status(403).json({ message: "Bu satış məlumatına baxmaq üçün səlahiyyətiniz yoxdur" });
      }
    }

    res.json(sale);
  } catch (error) {
    res.status(500).json({ message: "Çek məlumatlarını gətirərkən xəta baş verdi" });
  }
});

// Pay customer credit debt fully
router.patch("/sales/:id/pay-credit", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const sale = await db.query.sales.findFirst({
      where: and(eq(schema.sales.id, id), eq(schema.sales.tenantId, req.tenantId)),
      with: { payments: true, returns: true },
    });

    if (!sale) return res.status(404).json({ message: "Satış tapılmadı" });

    const role = req.headers["x-user-role"] as string;
    const username = req.headers["x-user-username"] as string;

    if (!await checkUserPermission(req, "staffCanViewSalesHistory")) {
      return res.status(403).json({ message: "Satış tarixçəsinə giriş administrator tərəfindən məhdudlaşdırılıb" });
    }

    if (role !== "Admin") {
      const normalizedUsername = username ? username.trim().toLowerCase() : "";
      if (sale.sellerName !== normalizedUsername) {
        return res.status(403).json({ message: "Bu satışın borcunu ödəmək üçün səlahiyyətiniz yoxdur" });
      }
    }

    // Calculate total already paid
    const alreadyPaid = sale.payments.reduce((acc, p) => acc + p.amount, 0);
    const returned = sale.returns ? sale.returns.reduce((acc, r) => acc + r.totalAmount, 0) : 0;
    const remaining = Math.max(0, Math.round((sale.totalAmount - alreadyPaid - returned) * 100) / 100);

    if (remaining > 0) {
      await db.insert(schema.creditPayments).values({
        tenantId: req.tenantId,
        saleId: id,
        paymentDate: new Date().toISOString(),
        amount: remaining,
      });
    }

    await db
      .update(schema.sales)
      .set({ paymentStatus: "paid" })
      .where(eq(schema.sales.id, id));

    await logActivity(
      req,
      "COLLECT_CUSTOMER_DEBT",
      `Müştəri nisyə borcunun hamısını topladı: ${remaining.toFixed(2)} ₼ (Çek № ${id}, Müştəri: ${sale.customerName || "Anonim"})`
    );

    res.json({ message: "Nisyə borc tam olaraq ödənildi" });
  } catch (error) {
    res.status(500).json({ message: "Borc ödənilərkən xəta baş verdi" });
  }
});

// Add partial credit payment
router.patch("/sales/:id/add-payment", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { amount } = req.body;
    const paymentAmount = parseFloat(amount);

    if (!paymentAmount || paymentAmount <= 0) {
      return res.status(400).json({ message: "Düzgün ödəniş məbləği daxil edilməlidir" });
    }

    const sale = await db.query.sales.findFirst({
      where: and(eq(schema.sales.id, id), eq(schema.sales.tenantId, req.tenantId)),
      with: { payments: true, returns: true },
    });

    if (!sale) return res.status(404).json({ message: "Satış tapılmadı" });

    const role = req.headers["x-user-role"] as string;
    const username = req.headers["x-user-username"] as string;

    if (!await checkUserPermission(req, "staffCanViewSalesHistory")) {
      return res.status(403).json({ message: "Satış tarixçəsinə giriş administrator tərəfindən məhdudlaşdırılıb" });
    }

    if (role !== "Admin") {
      const normalizedUsername = username ? username.trim().toLowerCase() : "";
      if (sale.sellerName !== normalizedUsername) {
        return res.status(403).json({ message: "Bu satışın borcunu ödəmək üçün səlahiyyətiniz yoxdur" });
      }
    }

    // Insert payment
    await db.insert(schema.creditPayments).values({
      tenantId: req.tenantId,
      saleId: id,
      paymentDate: new Date().toISOString(),
      amount: paymentAmount,
    });

    // Check if fully paid now
    const updatedPayments = await db.query.creditPayments.findMany({
      where: and(eq(schema.creditPayments.saleId, id), eq(schema.creditPayments.tenantId, req.tenantId))
    });
    const totalPaid = updatedPayments.reduce((acc, p) => acc + p.amount, 0);
    const returned = sale.returns ? sale.returns.reduce((acc, r) => acc + r.totalAmount, 0) : 0;

    const totalPaidCents = Math.round(totalPaid * 100);
    const remainingDebtCents = Math.round((sale.totalAmount - returned) * 100);

    if (totalPaidCents >= remainingDebtCents) {
      await db
        .update(schema.sales)
        .set({ paymentStatus: "paid" })
        .where(eq(schema.sales.id, id));
    }

    await logActivity(
      req,
      "COLLECT_CUSTOMER_DEBT_PARTIAL",
      `Müştəri nisyə borcundan qismən ödəniş aldı: ${paymentAmount.toFixed(2)} ₼ (Çek № ${id}, Müştəri: ${sale.customerName || "Anonim"})`
    );

    res.json({ message: "Qismən ödəniş uğurla qeydə alındı" });
  } catch (error) {
    res.status(500).json({ message: "Ödəniş qeydə alınarkən xəta baş verdi" });
  }
});

// Delete/rollback customer credit payment
router.delete("/sales/payments/:paymentId", requireAdmin, async (req, res) => {
  try {
    const paymentId = parseInt(req.params.paymentId);
    
    // 1. Find the payment record
    const payment = await db.query.creditPayments.findFirst({
      where: and(
        eq(schema.creditPayments.id, paymentId),
        eq(schema.creditPayments.tenantId, req.tenantId)
      ),
    });

    if (!payment) {
      return res.status(404).json({ message: "Ödəniş qeydi tapılmadı" });
    }

    const saleId = payment.saleId;

    // 2. Delete the payment
    await db
      .delete(schema.creditPayments)
      .where(eq(schema.creditPayments.id, paymentId));

    // 3. Fetch parent sale record
    const sale = await db.query.sales.findFirst({
      where: and(eq(schema.sales.id, saleId), eq(schema.sales.tenantId, req.tenantId)),
      with: { payments: true, returns: true },
    });

    if (sale) {
      // 4. Calculate total paid and check if it is still fully paid
      const totalPaid = sale.payments.reduce((acc, p) => acc + p.amount, 0);
      const returned = sale.returns ? sale.returns.reduce((acc, r) => acc + r.totalAmount, 0) : 0;
      
      const totalPaidCents = Math.round(totalPaid * 100);
      const remainingDebtCents = Math.round((sale.totalAmount - returned) * 100);

      if (totalPaidCents < remainingDebtCents) {
        // Change status back to credit since it has unpaid balance
        await db
          .update(schema.sales)
          .set({ paymentStatus: "credit" })
          .where(eq(schema.sales.id, saleId));
      }

      await logActivity(
        req,
        "ROLLBACK_CUSTOMER_DEBT_PAYMENT",
        `Müştəri nisyə borc ödənişini ləğv etdi: ${payment.amount.toFixed(2)} ₼ (Çek № ${saleId}, Müştəri: ${sale.customerName || "Anonim"})`
      );
    }

    res.json({ message: "Ödəniş uğurla ləğv edildi və borc balansı yeniləndi" });
  } catch (error) {
    res.status(500).json({ message: "Ödəniş ləğv edilərkən xəta baş verdi" });
  }
});

// Fix past credit statuses for sales that are already fully paid
router.post("/sales/fix-past-credits", requireAdmin, async (req, res) => {
  try {
    const creditSales = await db.query.sales.findMany({
      where: and(
        eq(schema.sales.paymentStatus, "credit"),
        eq(schema.sales.tenantId, req.tenantId)
      ),
      with: { payments: true, returns: true },
    });

    let fixCount = 0;
    const fixedSales = [];

    for (const sale of creditSales) {
      const totalPaid = sale.payments.reduce((sum, p) => sum + p.amount, 0);
      const returned = sale.returns ? sale.returns.reduce((sum, r) => sum + r.totalAmount, 0) : 0;
      
      const totalPaidCents = Math.round(totalPaid * 100);
      const remainingDebtCents = Math.round((sale.totalAmount - returned) * 100);

      if (totalPaidCents >= remainingDebtCents) {
        await db
          .update(schema.sales)
          .set({ paymentStatus: "paid" })
          .where(eq(schema.sales.id, sale.id));
        
        fixedSales.push({
          id: sale.id,
          customerName: sale.customerName,
          totalAmount: sale.totalAmount,
          totalPaid,
          returned,
        });
        fixCount++;
      }
    }

    if (fixCount > 0) {
      await logActivity(
        req,
        "CORRECT_CREDIT_STATUSES",
        `Verilənlər bazasında tam ödənilmiş ${fixCount} nisyə satışın statusu 'Ödənilib' olaraq yeniləndi.`
      );
    }

    res.json({
      message: `${fixCount} nisyə satışın statusu uğurla 'Ödənilib' olaraq düzəldildi.`,
      fixedCount: fixCount,
      fixedSales,
    });
  } catch (error: any) {
    res.status(500).json({ message: "Köhnə nisyə statuslarını düzəldərkən xəta baş verdi: " + error.message });
  }
});

// ----------------------------------------------------
// 4b. RETURN / REFUND ENDPOINTS
// ----------------------------------------------------

// List all returns
router.get("/returns", async (req, res) => {
  try {
    const list = await db.query.returns.findMany({
      where: eq(schema.returns.tenantId, req.tenantId),
      with: { items: { with: { product: true } } },
      orderBy: [desc(schema.returns.returnDate)],
    });
    res.json(list);
  } catch (error) {
    res.status(500).json({ message: "Geri qaytarış tarixçəsini gətirərkən xəta baş verdi" });
  }
});

// Fetch return details by ID
router.get("/returns/:id", async (req, res) => {
  try {
    const returnId = parseInt(req.params.id);
    const ret = await db.query.returns.findFirst({
      where: and(eq(schema.returns.id, returnId), eq(schema.returns.tenantId, req.tenantId)),
      with: {
        items: {
          with: {
            product: true
          }
        },
        sale: true,
        serials: true,
      },
    });

    if (!ret) {
      return res.status(404).json({ message: "Qaytarış tapılmadı" });
    }

    res.json(ret);
  } catch (error: any) {
    console.error("Fetch return error:", error);
    res.status(500).json({ message: "Geri qaytarış məlumatlarını gətirərkən xəta baş verdi: " + error.message });
  }
});

// Process a return
router.post("/returns", async (req, res) => {
  try {
    const { saleId, reason, items } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ message: "Qaytarılan məhsullar daxil edilməlidir" });
    }

    let calculatedTotalAmount = 0;

    // 1. If linked to a sale, validate quantities
    if (saleId) {
      const sale = await db.query.sales.findFirst({
        where: and(eq(schema.sales.id, saleId), eq(schema.sales.tenantId, req.tenantId)),
        with: { items: true, returns: { with: { items: true } } },
      });

      if (!sale) {
        return res.status(404).json({ message: "Satış tapılmadı" });
      }

      // Check quantities
      for (const returnItem of items) {
        const originallySoldItem = sale.items.find(i => i.productId === returnItem.productId);
        if (!originallySoldItem) {
          return res.status(400).json({ 
            message: `Məhsul (ID: ${returnItem.productId}) bu satışa aid deyil` 
          });
        }

        // Calculate already returned quantity for this product
        let alreadyReturnedQty = 0;
        if (sale.returns) {
          for (const ret of sale.returns) {
            const retItem = ret.items.find(ri => ri.productId === returnItem.productId);
            if (retItem) {
              alreadyReturnedQty += retItem.quantity;
            }
          }
        }

        const remainingReturnable = originallySoldItem.quantity - alreadyReturnedQty;
        if (returnItem.quantity > remainingReturnable) {
          return res.status(400).json({
            message: `Məhsulun (ID: ${returnItem.productId}) qaytarılma miqdarı satılandan artıq ola bilməz. Maksimum qaytarıla bilən: ${remainingReturnable}`
          });
        }
      }
    }

    // Calculate total return amount based on items
    for (const item of items) {
      calculatedTotalAmount += parseFloat(item.quantity) * parseFloat(item.salePrice);
    }

    // Execute return creation inside transaction
    const returnResult = await db.transaction(async (tx) => {
      // 2. Create the Return record
      const newReturn = await tx
        .insert(schema.returns)
        .values({
          tenantId: req.tenantId,
          saleId: saleId || null,
          returnDate: new Date().toISOString(),
          totalAmount: calculatedTotalAmount,
          reason: reason || null,
        })
        .returning();

      const returnId = newReturn[0].id;

      // 3. Create Return Items records
      for (const item of items) {
        await tx.insert(schema.returnItems).values({
          tenantId: req.tenantId,
          returnId,
          productId: item.productId,
          quantity: parseFloat(item.quantity),
          salePrice: parseFloat(item.salePrice),
          purchasePrice: parseFloat(item.purchasePrice || "0"),
          status: item.status, // "returned_to_stock" or "defective"
        });

        // Link and update returned serial numbers
        if (item.serialNumbers && Array.isArray(item.serialNumbers) && item.serialNumbers.length > 0) {
          for (const sNum of item.serialNumbers) {
            const cleaned = sNum.trim().toUpperCase();
            await tx
              .update(schema.productSerials)
              .set({
                status: item.status === "returned_to_stock" ? "in_stock" : "defective",
                returnId,
              })
              .where(
                and(
                  eq(schema.productSerials.serialNumber, cleaned),
                  eq(schema.productSerials.tenantId, req.tenantId),
                  eq(schema.productSerials.productId, item.productId)
                )
              );
          }
        }
      }

      return newReturn[0];
    });

    // 4. Log Activity
    const saleLogMsg = saleId ? ` (Çek № ${saleId})` : "";
    await logActivity(
      req,
      "RETURN_ITEMS",
      `Malların geri qaytarılması həyata keçirildi: Qaytarış № ${returnResult.id}${saleLogMsg} (Məbləğ: ${calculatedTotalAmount.toFixed(2)} ₼, Səbəb: ${reason || "Qeyd edilməyib"})`
    );

    res.json(returnResult);
  } catch (error) {
    console.error("Return error:", error);
    res.status(500).json({ message: "Geri qaytarış tamamlanarkən xəta baş verdi" });
  }
});

// Lookup serial number details (Warranty & IMEI lookup)
router.get("/serials/lookup", async (req, res) => {
  try {
    const { serialNumber } = req.query;
    if (!serialNumber) {
      return res.status(400).json({ message: "Serial nömrəsi daxil edilməlidir" });
    }

    const sNum = (serialNumber as string).trim().toUpperCase();
    const record = await db.query.productSerials.findFirst({
      where: and(
        eq(schema.productSerials.serialNumber, sNum),
        eq(schema.productSerials.tenantId, req.tenantId)
      ),
      with: {
        product: true,
        stockEntry: true,
        sale: true,
        return: true,
      },
    });

    if (!record) {
      return res.status(404).json({ message: "Bu serial nömrəsi ilə məhsul tapılmadı" });
    }

    res.json(record);
  } catch (error: any) {
    console.error("Serial lookup error:", error);
    res.status(500).json({ message: "Zəmanət axtarışı zamanı xəta baş verdi: " + error.message });
  }
});

// ----------------------------------------------------
// 5. CREDIT MONITORING ENDPOINTS
// ----------------------------------------------------

// List overdue customer credits
router.get("/credits/overdue", async (req, res) => {
  try {
    if (!await checkUserPermission(req, "staffCanViewDebts")) {
      return res.status(403).json({ message: "Bu məlumatı görmək üçün səlahiyyətiniz yoxdur." });
    }
    const today = new Date().toISOString().split("T")[0];
    const overdueSales = await db.query.sales.findMany({
      where: and(
        eq(schema.sales.paymentStatus, "credit"),
        lte(schema.sales.creditDueDate, today),
        eq(schema.sales.tenantId, req.tenantId)
      ),
      with: { payments: true, returns: true },
      orderBy: [desc(schema.sales.creditDueDate)],
    });

    const result = overdueSales.map((sale) => {
      const paid = sale.payments.reduce((sum, p) => sum + p.amount, 0);
      const returned = sale.returns ? sale.returns.reduce((sum, r) => sum + r.totalAmount, 0) : 0;
      return {
        id: sale.id,
        customerId: sale.customerId,
        customerName: sale.customerName,
        customerPhone: sale.customerPhone,
        totalAmount: sale.totalAmount,
        remainingDebt: Math.max(0, sale.totalAmount - paid - returned),
        creditDueDate: sale.creditDueDate,
        saleDate: sale.saleDate,
      };
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: "Gecikmiş borcları gətirərkən xəta baş verdi" });
  }
});

// List pending (non-overdue) customer credits
router.get("/credits/pending", async (req, res) => {
  try {
    if (!await checkUserPermission(req, "staffCanViewDebts")) {
      return res.status(403).json({ message: "Bu məlumatı görmək üçün səlahiyyətiniz yoxdur." });
    }
    const today = new Date().toISOString().split("T")[0];
    const pendingSales = await db.query.sales.findMany({
      where: and(
        eq(schema.sales.paymentStatus, "credit"),
        gte(schema.sales.creditDueDate, today),
        eq(schema.sales.tenantId, req.tenantId)
      ),
      with: { payments: true, returns: true },
      orderBy: [desc(schema.sales.creditDueDate)],
    });

    const result = pendingSales.map((sale) => {
      const paid = sale.payments.reduce((sum, p) => sum + p.amount, 0);
      const returned = sale.returns ? sale.returns.reduce((sum, r) => sum + r.totalAmount, 0) : 0;
      return {
        id: sale.id,
        customerId: sale.customerId,
        customerName: sale.customerName,
        customerPhone: sale.customerPhone,
        totalAmount: sale.totalAmount,
        remainingDebt: Math.max(0, sale.totalAmount - paid - returned),
        creditDueDate: sale.creditDueDate,
        saleDate: sale.saleDate,
      };
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: "Aktiv nisyələri gətirərkən xəta baş verdi" });
  }
});

// ----------------------------------------------------
// 6. EXPENSES ENDPOINTS
// ----------------------------------------------------

// List expenses with category and description filters
router.get("/expenses", async (req, res) => {
  try {
    if (!await checkUserPermission(req, "staffCanViewExpenses")) {
      return res.status(403).json({ message: "Xərclər modulu məlumatlarına giriş administrator tərəfindən məhdudlaşdırılıb" });
    }

    const { category, search } = req.query;
    const queryConditions = [eq(schema.expenses.tenantId, req.tenantId)];

    if (category) {
      queryConditions.push(eq(schema.expenses.category, category as string));
    }
    if (search) {
      queryConditions.push(sql`${schema.expenses.description} ILIKE ${"%" + search + "%"}`);
    }

    const list = await db
      .select()
      .from(schema.expenses)
      .where(and(...queryConditions))
      .orderBy(desc(schema.expenses.date));

    res.json(list);
  } catch (error) {
    res.status(500).json({ message: "Xərcləri gətirərkən xəta baş verdi" });
  }
});

// Create expense
router.post("/expenses", requireAdmin, async (req, res) => {
  try {
    const { amount, category, description } = req.body;
    if (!amount || !category) {
      return res.status(400).json({ message: "Məbləğ və kateqoriya daxil edilməlidir" });
    }

    const newExpense = await db
      .insert(schema.expenses)
      .values({
        tenantId: req.tenantId,
        amount: parseFloat(amount),
        category,
        description: description || null,
        date: new Date().toISOString(),
      })
      .returning();

    await logActivity(req, "CREATE_EXPENSE", `Yeni xərc maddəsi əlavə etdi: ${amount} ₼ (Kateqoriya: ${category}, Təsvir: ${description || "yoxdur"})`);

    res.json(newExpense[0]);
  } catch (error) {
    res.status(500).json({ message: "Xərc yaradılarkən xəta baş verdi" });
  }
});

// Delete expense
router.delete("/expenses/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const deleted = await db
      .delete(schema.expenses)
      .where(and(eq(schema.expenses.id, id), eq(schema.expenses.tenantId, req.tenantId)))
      .returning();

    if (deleted.length === 0)
      return res.status(404).json({ message: "Xərc maddəsi tapılmadı" });

    await logActivity(req, "DELETE_EXPENSE", `Xərc maddəsini silindi: ${deleted[0].amount} ₼ (Kateqoriya: ${deleted[0].category})`);

    res.json({ message: "Xərc silindi" });
  } catch (error) {
    res.status(500).json({ message: "Xərc silinərkən xəta baş verdi" });
  }
});

// ----------------------------------------------------
// 7. DASHBOARD ANALYTICS ENDPOINTS
// ----------------------------------------------------

router.get("/dashboard/summary", requireAdmin, async (req, res) => {
  try {
    const todayStr = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    const { firstDay, lastDay } = getMonthBoundaries();

    // 1. Today's Sales & Returns
    const todaySalesList = await db.select().from(schema.sales).where(
      and(
        sql`SUBSTRING(${schema.sales.saleDate}, 1, 10) = ${todayStr}`,
        eq(schema.sales.tenantId, req.tenantId)
      )
    );
    const rawTodayRevenue = todaySalesList.reduce((sum, sale) => sum + sale.totalAmount, 0);
    const rawTodayCost = todaySalesList.reduce((sum, sale) => sum + sale.totalCost, 0);

    const todayReturnsList = await db.select().from(schema.returns).where(
      and(
        sql`SUBSTRING(${schema.returns.returnDate}, 1, 10) = ${todayStr}`,
        eq(schema.returns.tenantId, req.tenantId)
      )
    );
    const todayRefundedAmount = todayReturnsList.reduce((sum, r) => sum + r.totalAmount, 0);

    let todayRecoveredCost = 0;
    for (const ret of todayReturnsList) {
      const retItems = await db
        .select()
        .from(schema.returnItems)
        .where(
          and(
            eq(schema.returnItems.returnId, ret.id),
            eq(schema.returnItems.status, "returned_to_stock")
          )
        );
      todayRecoveredCost += retItems.reduce((sum, item) => sum + item.quantity * item.purchasePrice, 0);
    }

    const todayRevenue = rawTodayRevenue - todayRefundedAmount;
    const todayCostVal = rawTodayCost - todayRecoveredCost;
    const todayCost = Math.max(0, todayCostVal);
    const todayProfit = todayRevenue - todayCostVal;

    // Today's Expenses
    const todayExpensesResult = await db
      .select({ sum: sql`SUM(amount)` })
      .from(schema.expenses)
      .where(
        and(
          sql`SUBSTRING(${schema.expenses.date}, 1, 10) = ${todayStr}`,
          eq(schema.expenses.tenantId, req.tenantId)
        )
      );
    const todayExpenses = parseFloat((todayExpensesResult[0]?.sum as string) || "0");
    const todayNetProfit = todayProfit - todayExpenses;
    const todaySales = todaySalesList.length;

    // 2. Monthly Sales & Returns
    const monthSalesList = await db.select().from(schema.sales).where(
      and(
        gte(schema.sales.saleDate, firstDay),
        lte(schema.sales.saleDate, lastDay),
        eq(schema.sales.tenantId, req.tenantId)
      )
    );
    const rawMonthRevenue = monthSalesList.reduce((sum, sale) => sum + sale.totalAmount, 0);
    const rawMonthCost = monthSalesList.reduce((sum, sale) => sum + sale.totalCost, 0);

    const monthReturnsList = await db.select().from(schema.returns).where(
      and(
        gte(schema.returns.returnDate, firstDay),
        lte(schema.returns.returnDate, lastDay),
        eq(schema.returns.tenantId, req.tenantId)
      )
    );
    const monthRefundedAmount = monthReturnsList.reduce((sum, r) => sum + r.totalAmount, 0);

    let monthRecoveredCost = 0;
    for (const ret of monthReturnsList) {
      const retItems = await db
        .select()
        .from(schema.returnItems)
        .where(
          and(
            eq(schema.returnItems.returnId, ret.id),
            eq(schema.returnItems.status, "returned_to_stock")
          )
        );
      monthRecoveredCost += retItems.reduce((sum, item) => sum + item.quantity * item.purchasePrice, 0);
    }

    const monthRevenue = rawMonthRevenue - monthRefundedAmount;
    const monthCostVal = rawMonthCost - monthRecoveredCost;
    const monthCost = Math.max(0, monthCostVal);
    const monthProfit = monthRevenue - monthCostVal;

    // Monthly Expenses
    const monthExpensesResult = await db
      .select({ sum: sql`SUM(amount)` })
      .from(schema.expenses)
      .where(
        and(
          gte(schema.expenses.date, firstDay),
          lte(schema.expenses.date, lastDay),
          eq(schema.expenses.tenantId, req.tenantId)
        )
      );
    const monthExpenses = parseFloat((monthExpensesResult[0]?.sum as string) || "0");
    const monthNetProfit = monthProfit - monthExpenses;

    // 3. Dynamic stock valuation & low stock count
    const { allProducts, metrics } = await fetchTenantStockMetrics(req.tenantId);
    let totalStockValue = 0;
    let lowStockCount = 0;

    // Fetch alert limit
    const settingsList = await db.select().from(schema.settings).where(eq(schema.settings.tenantId, req.tenantId)).limit(1);
    const lowStockAlertCount = settingsList[0]?.lowStockAlertCount || 5;

    for (const product of allProducts) {
      const metric = metrics.get(product.id)!;
      totalStockValue += metric.totalValue;

      if (metric.currentQuantity < lowStockAlertCount) {
        lowStockCount++;
      }
    }

    // 4. Calculate Customer Credit Debts
    const activeCredits = await db.query.sales.findMany({
      where: and(eq(schema.sales.paymentStatus, "credit"), eq(schema.sales.tenantId, req.tenantId)),
      with: { payments: true, returns: true }
    });

    const totalCreditDebt = activeCredits.reduce((sum, sale) => {
      const paid = sale.payments.reduce((pSum, p) => pSum + p.amount, 0);
      const returned = sale.returns ? sale.returns.reduce((rSum, r) => rSum + r.totalAmount, 0) : 0;
      return sum + Math.max(0, sale.totalAmount - paid - returned);
    }, 0);

    const overdueCreditsCount = activeCredits.filter(sale => {
      if (!sale.creditDueDate) return false;
      const today = new Date().toISOString().split("T")[0];
      return sale.creditDueDate <= today;
    }).length;

    // 5. Calculate our own debts to suppliers (aggregating balances per vendor and including anonymous debts)
    const allVendors = await db.select().from(schema.vendors).where(eq(schema.vendors.tenantId, req.tenantId));
    let myTotalDebt = 0;
    for (const vendor of allVendors) {
      const purchases = await db.select().from(schema.stockEntries).where(
        and(
          eq(schema.stockEntries.vendorId, vendor.id),
          eq(schema.stockEntries.tenantId, req.tenantId)
        )
      );
      const creditPurchases = purchases.filter(p => p.paidStatus === "credit" || p.paymentType === "Nisyə");
      const totalDebtCreated = creditPurchases.reduce((acc, p) => acc + (p.quantity * p.purchasePrice), 0);
      
      const payments = await db.select().from(schema.vendorPayments).where(
        and(
          eq(schema.vendorPayments.vendorId, vendor.id),
          eq(schema.vendorPayments.tenantId, req.tenantId)
        )
      );
      const totalPayments = payments.reduce((acc, pay) => acc + pay.amount, 0);
      
      const balance = totalDebtCreated - totalPayments;
      if (balance > 0) {
        myTotalDebt += balance;
      }
    }

    const anonymousDebts = await db.select().from(schema.stockEntries).where(
      and(
        sql`${schema.stockEntries.vendorId} IS NULL`,
        eq(schema.stockEntries.paidStatus, "credit"),
        eq(schema.stockEntries.tenantId, req.tenantId)
      )
    );
    const totalAnonDebt = anonymousDebts.reduce((acc, p) => acc + (p.quantity * p.purchasePrice), 0);
    myTotalDebt += totalAnonDebt;

    res.json({
      todayRevenue,
      todayCost,
      todayProfit,
      todayExpenses,
      todayNetProfit,
      todaySales,
      monthRevenue,
      monthProfit,
      monthExpenses,
      monthNetProfit,
      totalStockValue,
      lowStockCount,
      totalCreditDebt,
      overdueCreditsCount,
      myTotalDebt
    });
  } catch (error) {
    res.status(500).json({ message: "Dashboard verilənlərini hesablayarkən xəta baş verdi" });
  }
});

router.get("/dashboard/analytics", requireAdmin, async (req, res) => {
  try {
    // 1. Fetch sales, expenses, returns, returnItems, and saleItems with product details
    const sales = await db.select().from(schema.sales).where(eq(schema.sales.tenantId, req.tenantId));
    const expenses = await db.select().from(schema.expenses).where(eq(schema.expenses.tenantId, req.tenantId));
    const returns = await db.select().from(schema.returns).where(eq(schema.returns.tenantId, req.tenantId));
    
    const saleItemsList = await db.query.saleItems.findMany({
      where: eq(schema.saleItems.tenantId, req.tenantId),
      with: { product: true }
    });

    const returnItemsList = await db.query.returnItems.findMany({
      where: eq(schema.returnItems.tenantId, req.tenantId),
      with: { product: true, return: true }
    });

    // --- A. Monthly Trend (Past 6 Months) ---
    // Generate last 6 months (including current month)
    const monthlyData: Record<string, { month: string; revenue: number; expenses: number; cost: number; profit: number }> = {};
    const monthNames = ["Yan", "Fev", "Mar", "Apr", "May", "İyun", "İyul", "Avq", "Sen", "Okt", "Noy", "Dek"];
    
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const year = d.getFullYear();
      const monthNum = d.getMonth();
      const key = `${year}-${String(monthNum + 1).padStart(2, "0")}`; // YYYY-MM
      const label = `${monthNames[monthNum]} ${year}`;
      monthlyData[key] = { month: label, revenue: 0, expenses: 0, cost: 0, profit: 0 };
    }

    // Accumulate sales revenue and cost per month
    for (const sale of sales) {
      const key = sale.saleDate.substring(0, 7); // YYYY-MM
      if (monthlyData[key]) {
        monthlyData[key].revenue += sale.totalAmount;
        monthlyData[key].cost += sale.totalCost;
      }
    }

    // Accumulate returns (reducing revenue and cost) per month
    for (const ret of returns) {
      const key = ret.returnDate.substring(0, 7); // YYYY-MM
      if (monthlyData[key]) {
        monthlyData[key].revenue -= ret.totalAmount;
      }
    }

    for (const retItem of returnItemsList) {
      if (retItem.status === "returned_to_stock" && retItem.return) {
        const key = retItem.return.returnDate.substring(0, 7); // YYYY-MM
        if (monthlyData[key]) {
          monthlyData[key].cost -= retItem.quantity * retItem.purchasePrice;
        }
      }
    }

    // Accumulate expenses per month
    for (const exp of expenses) {
      const key = exp.date.substring(0, 7); // YYYY-MM
      if (monthlyData[key]) {
        monthlyData[key].expenses += exp.amount;
      }
    }

    // Calculate profits per month
    const monthlyTrend = Object.keys(monthlyData).sort().map(key => {
      const m = monthlyData[key];
      m.profit = m.revenue - m.cost - m.expenses;
      return {
        month: m.month,
        revenue: parseFloat(m.revenue.toFixed(2)),
        expenses: parseFloat(m.expenses.toFixed(2)),
        profit: parseFloat(m.profit.toFixed(2))
      };
    });

    // --- B. Weekly Sales peak day ---
    const weekdays = ["Bazar", "Bazar ertəsi", "Çərşənbə axşamı", "Çərşənbə", "Cümə axşamı", "Cümə", "Şənbə"];
    const weeklyData: Record<string, { day: string; sales: number; revenue: number }> = {};
    for (const day of weekdays) {
      weeklyData[day] = { day, sales: 0, revenue: 0 };
    }

    for (const sale of sales) {
      const dayIndex = new Date(sale.saleDate).getDay();
      const dayName = weekdays[dayIndex];
      if (weeklyData[dayName]) {
        weeklyData[dayName].sales += 1;
        weeklyData[dayName].revenue += sale.totalAmount;
      }
    }

    for (const ret of returns) {
      const dayIndex = new Date(ret.returnDate).getDay();
      const dayName = weekdays[dayIndex];
      if (weeklyData[dayName]) {
        weeklyData[dayName].revenue -= ret.totalAmount;
      }
    }

    const weeklyDistribution = weekdays.map(day => ({
      day,
      sales: weeklyData[day].sales,
      revenue: parseFloat(weeklyData[day].revenue.toFixed(2))
    }));

    // --- C. Top 5 Product Categories ---
    const categoryTotals: Record<string, { category: string; salesCount: number; revenue: number }> = {};
    for (const item of saleItemsList) {
      const cat = item.product?.category || "Kateqoriyasız";
      if (!categoryTotals[cat]) {
        categoryTotals[cat] = { category: cat, salesCount: 0, revenue: 0 };
      }
      categoryTotals[cat].salesCount += item.quantity;
      categoryTotals[cat].revenue += item.quantity * item.salePrice;
    }

    for (const item of returnItemsList) {
      const cat = item.product?.category || "Kateqoriyasız";
      if (categoryTotals[cat]) {
        categoryTotals[cat].salesCount -= item.quantity;
        categoryTotals[cat].revenue -= item.quantity * item.salePrice;
      }
    }

    const topCategories = Object.values(categoryTotals)
      .sort((a, b) => b.salesCount - a.salesCount)
      .slice(0, 5)
      .map(cat => ({
        category: cat.category,
        salesCount: parseFloat(Math.max(0, cat.salesCount).toFixed(2)),
        revenue: parseFloat(Math.max(0, cat.revenue).toFixed(2))
      }));

    // --- D. COGS Margin Audit ---
    const rawTotalRevenue = sales.reduce((sum, sale) => sum + sale.totalAmount, 0);
    const rawTotalCost = sales.reduce((sum, sale) => sum + sale.totalCost, 0);
    
    const totalRefunded = returns.reduce((sum, r) => sum + r.totalAmount, 0);
    const totalRecoveredCost = returnItemsList.reduce((sum, ri) => {
      if (ri.status === "returned_to_stock") {
        return sum + ri.quantity * ri.purchasePrice;
      }
      return sum;
    }, 0);

    const totalRevenue = rawTotalRevenue - totalRefunded;
    const totalCostVal = rawTotalCost - totalRecoveredCost;
    const totalCost = Math.max(0, totalCostVal);
    const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);

    const grossProfit = totalRevenue - totalCostVal;
    const netProfit = grossProfit - totalExpenses;

    const grossMargin = totalRevenue > 0 ? parseFloat(((grossProfit / totalRevenue) * 100).toFixed(2)) : 0;
    const netMargin = totalRevenue > 0 ? parseFloat(((netProfit / totalRevenue) * 100).toFixed(2)) : 0;

    res.json({
      monthlyTrend,
      weeklyDistribution,
      topCategories,
      cogsAudit: {
        totalRevenue: parseFloat(totalRevenue.toFixed(2)),
        totalCost: parseFloat(totalCost.toFixed(2)),
        totalExpenses: parseFloat(totalExpenses.toFixed(2)),
        grossProfit: parseFloat(grossProfit.toFixed(2)),
        netProfit: parseFloat(netProfit.toFixed(2)),
        grossMargin,
        netMargin
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Analitika hesablanarkən xəta baş verdi" });
  }
});

router.get("/dashboard/recent-sales", async (req, res) => {
  try {
    const recent = await db.query.sales.findMany({
      where: eq(schema.sales.tenantId, req.tenantId),
      limit: 5,
      orderBy: [desc(schema.sales.saleDate)]
    });
    res.json(recent);
  } catch (error) {
    res.status(500).json({ message: "Son satışları gətirərkən xəta baş verdi" });
  }
});

router.get("/dashboard/low-stock", async (req, res) => {
  try {
    // Fetch limits
    const settingsList = await db.select().from(schema.settings).where(eq(schema.settings.tenantId, req.tenantId)).limit(1);
    const limitCount = settingsList[0]?.lowStockAlertCount || 5;

    const { allProducts, metrics } = await fetchTenantStockMetrics(req.tenantId);
    const lowStockAlerts = [];

    for (const product of allProducts) {
      const metric = metrics.get(product.id)!;
      if (metric.currentQuantity <= limitCount) {
        lowStockAlerts.push({
          productId: product.id,
          productName: product.name,
          currentQuantity: metric.currentQuantity,
          unit: product.unit,
        });
      }
    }

    res.json(lowStockAlerts);
  } catch (error) {
    res.status(500).json({ message: "Kritik anbar qalıqlarını gətirərkən xəta baş verdi" });
  }
});

// ----------------------------------------------------
// 8. SETTINGS ENDPOINTS
// ----------------------------------------------------

router.get("/settings", async (req, res) => {
  try {
    let list = await db.select().from(schema.settings).where(eq(schema.settings.tenantId, req.tenantId)).limit(1);
    
    // Fetch tenant's details to expose billing plan
    const tenant = await db.query.tenants.findFirst({
      where: eq(schema.tenants.id, req.tenantId)
    });

    // Auto-provision settings card if not found for some reason
    if (list.length === 0) {
      const newSettings = await db
        .insert(schema.settings)
        .values({
          tenantId: req.tenantId,
          storeName: tenant?.name || "Yeni Mağaza",
        })
        .returning();
      return res.json({
        ...newSettings[0],
        billingTier: tenant?.billingTier || "free",
        tenantSlug: tenant?.slug || "demo",
        tenantName: tenant?.name || "BirSaaS Store"
      });
    }
    
    res.json({
      ...list[0],
      billingTier: tenant?.billingTier || "free",
      tenantSlug: tenant?.slug || "demo",
      tenantName: tenant?.name || "BirSaaS Store"
    });
  } catch (error) {
    res.status(500).json({ message: "Ayarları gətirərkən xəta baş verdi" });
  }
});

router.put("/settings", requireAdmin, async (req, res) => {
  try {
    const payload = req.body;
    console.log("Settings PUT payload received:", payload);
    const list = await db.select().from(schema.settings).where(eq(schema.settings.tenantId, req.tenantId)).limit(1);

    let updated;
    if (list.length === 0) {
      updated = await db
        .insert(schema.settings)
        .values({
          tenantId: req.tenantId,
          ...payload,
        })
        .returning();
    } else {
      updated = await db
        .update(schema.settings)
        .set(payload)
        .where(eq(schema.settings.tenantId, req.tenantId))
        .returning();
    }

    await logActivity(req, "UPDATE_SETTINGS", "Sistem profil və çek dizayn ayarlarını yenilədi");

    res.json(updated[0]);
  } catch (error) {
    res.status(500).json({ message: "Ayarları yeniləyərkən xəta baş verdi" });
  }
});

router.post("/settings/test-telegram", requireAdmin, async (req, res) => {
  try {
    const { token, chatId } = req.body;
    if (!token || !chatId) {
      return res.status(400).json({ message: "Bot tokeni və Chat ID daxil edilməlidir" });
    }

    const testMessage = `🤖 <b>BirSaaS POS Telegram Bot bağlantısı uğurludur!</b>\n\nBu çat vasitəsilə mağazanızda baş verən anlıq satışlar, anbar mədaxilləri və əməkhaqqı ödənişləri barədə anlıq bildirişlər alacaqsınız.\n\n<b>Vaxt:</b> <code>${new Date().toLocaleString("az-AZ")}</code>`;

    // Make manual request to test credentials
    const url = `https://api.telegram.org/bot${token.trim()}/sendMessage`;
    const payload = JSON.stringify({
      chat_id: chatId.trim(),
      text: testMessage,
      parse_mode: "HTML",
    });

    const https = await import("https");
    const options = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
      },
    };

    const request = https.request(url, options, (response) => {
      let data = "";
      response.on("data", (chunk) => { data += chunk; });
      response.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.ok) {
            res.json({ success: true, message: "Test mesajı uğurla göndərildi!" });
          } else {
            res.status(400).json({ message: `Telegram xətası: ${parsed.description}` });
          }
        } catch (e) {
          res.status(500).json({ message: "Telegram cavabını oxuyarkən xəta baş verdi" });
        }
      });
    });

    request.on("error", (e) => {
      res.status(500).json({ message: `Bağlantı xətası: ${e.message}` });
    });

    request.write(payload);
    request.end();
  } catch (error) {
    res.status(500).json({ message: "Sınaq göndərişi zamanı texniki xəta baş verdi" });
  }
});

router.post("/settings/reset", requireAdmin, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ message: "Sıfırlama üçün şifrə daxil edilməlidir" });
    }

    // Verify the admin user's password
    const adminUser = await db.query.users.findFirst({
      where: and(
        eq(schema.users.tenantId, req.tenantId),
        eq(schema.users.role, "Admin")
      )
    });

    if (!adminUser || adminUser.password !== password.trim()) {
      return res.status(401).json({ message: "Daxil etdiyiniz Admin şifrəsi yanlışdır" });
    }

    // Perform database transaction to delete all transactional data for this tenant
    await db.transaction(async (tx) => {
      // 1. Delete Return Items
      await tx.delete(schema.returnItems).where(eq(schema.returnItems.tenantId, req.tenantId));
      
      // 2. Delete Returns
      await tx.delete(schema.returns).where(eq(schema.returns.tenantId, req.tenantId));

      // 3. Delete Sale Items
      await tx.delete(schema.saleItems).where(eq(schema.saleItems.tenantId, req.tenantId));

      // 4. Delete Sales
      await tx.delete(schema.sales).where(eq(schema.sales.tenantId, req.tenantId));

      // 5. Delete Serial Numbers
      await tx.delete(schema.productSerials).where(eq(schema.productSerials.tenantId, req.tenantId));

      // 6. Delete Credit Payments
      await tx.delete(schema.creditPayments).where(eq(schema.creditPayments.tenantId, req.tenantId));

      // 7. Delete Supplier Payments (Wholesale payouts)
      await tx.delete(schema.vendorPayments).where(eq(schema.vendorPayments.tenantId, req.tenantId));

      // 8. Delete Stock Entries
      await tx.delete(schema.stockEntries).where(eq(schema.stockEntries.tenantId, req.tenantId));

      // 9. Delete Expenses
      await tx.delete(schema.expenses).where(eq(schema.expenses.tenantId, req.tenantId));

      // 10. Delete Payroll log
      await tx.delete(schema.payroll).where(eq(schema.payroll.tenantId, req.tenantId));

      // 11. Delete Customers
      await tx.delete(schema.customers).where(eq(schema.customers.tenantId, req.tenantId));

      // 12. Delete Products
      await tx.delete(schema.products).where(eq(schema.products.tenantId, req.tenantId));

      // 13. Delete Activity Logs
      await tx.delete(schema.activityLogs).where(eq(schema.activityLogs.tenantId, req.tenantId));
      
      // 14. Reset vendors
      await tx.delete(schema.vendors).where(eq(schema.vendors.tenantId, req.tenantId));

      // 15. Reset Store Settings to default brand name
      await tx.update(schema.settings)
        .set({
          storeName: "Yeni Mağaza",
          phone: null,
          address: null,
          invoiceFooter: null,
          lowStockAlertCount: 5,
          defaultCreditDays: 30,
          telegramBotToken: null,
          telegramChatId: null,
          telegramNotificationsEnabled: 0,
        })
        .where(eq(schema.settings.tenantId, req.tenantId));

      // Log the major wipe activity
      await tx.insert(schema.activityLogs).values({
        tenantId: req.tenantId,
        username: adminUser.username,
        action: "SYSTEM_RESET",
        description: "İstifadəçi admin şifrəsi ilə bütün sistem verilənlərini tamamilə sıfırladı və təmizlədi.",
        timestamp: new Date().toISOString(),
        archived: 0,
      });
    });

    res.json({ success: true, message: "Bütün sistem məlumatları tamamilə sıfırlandı!" });
  } catch (error: any) {
    console.error("System reset error:", error);
    res.status(500).json({ message: "Sistemi sıfırlayarkən xəta baş verdi: " + error.message });
  }
});

// ----------------------------------------------------
// 9. ACTIVITY LOGS ENDPOINTS
// ----------------------------------------------------

router.get("/activity-logs", requireAdmin, async (req, res) => {
  try {
    const { date, archived } = req.query;

    const queryFilters = [eq(schema.activityLogs.tenantId, req.tenantId)];

    if (archived !== undefined) {
      queryFilters.push(eq(schema.activityLogs.archived, parseInt(archived as string)));
    } else {
      queryFilters.push(eq(schema.activityLogs.archived, 0));
    }

    if (date) {
      queryFilters.push(sql`${schema.activityLogs.timestamp} LIKE ${date as string + "%"}`);
    }

    const logs = await db
      .select()
      .from(schema.activityLogs)
      .where(and(...queryFilters))
      .orderBy(desc(schema.activityLogs.timestamp))
      .limit(100);

    res.json(logs);
  } catch (error) {
    res.status(500).json({ message: "Fəaliyyət loqlarını gətirərkən xəta baş verdi" });
  }
});

router.post("/activity-logs/archive", requireAdmin, async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    
    // Archive logs older than today
    await db
      .update(schema.activityLogs)
      .set({ archived: 1 })
      .where(
        and(
          eq(schema.activityLogs.archived, 0),
          sql`${schema.activityLogs.timestamp} < ${today}`,
          eq(schema.activityLogs.tenantId, req.tenantId)
        )
      );

    await logActivity(req, "ARCHIVE_LOGS", "Köhnə fəaliyyət loqlarını arxivləşdirdi.");

    res.json({ message: "Köhnə loqlar uğurla arxivləşdirildi" });
  } catch (error) {
    res.status(500).json({ message: "Loqları arxivləşdirərkən xəta baş verdi" });
  }
});

// ----------------------------------------------------
// 10. USER MANAGEMENT ENDPOINTS (Admin Only)
// ----------------------------------------------------

// Get currently logged-in user profile & permissions
router.get("/users/me", async (req, res) => {
  try {
    const username = req.headers["x-user-username"] as string;
    if (!username) {
      return res.status(401).json({ message: "Giriş edilməyib" });
    }

    const user = await db.query.users.findFirst({
      where: and(
        eq(schema.users.username, username.trim().toLowerCase()),
        eq(schema.users.tenantId, req.tenantId)
      )
    });

    if (!user) {
      return res.status(404).json({ message: "İstifadəçi tapılmadı" });
    }

    res.json({
      id: user.id,
      username: user.username,
      role: user.role,
      staffCanViewSalesHistory: user.staffCanViewSalesHistory,
      staffCanViewStock: user.staffCanViewStock,
      staffCanViewCustomers: user.staffCanViewCustomers,
      staffCanViewVendors: user.staffCanViewVendors,
      staffCanViewExpenses: user.staffCanViewExpenses,
      staffCanViewStockBalances: user.staffCanViewStockBalances,
      staffCanViewDebts: user.staffCanViewDebts,
      staffCanManageCatalog: user.staffCanManageCatalog,
    });
  } catch (error) {
    res.status(500).json({ message: "İstifadəçi məlumatlarını gətirərkən xəta baş verdi" });
  }
});

// List all users
router.get("/users", requireAdmin, async (req, res) => {
  try {
    const list = await db
      .select({
        id: schema.users.id,
        username: schema.users.username,
        role: schema.users.role,
        twoFactorEnabled: schema.users.twoFactorEnabled,
        staffCanViewSalesHistory: schema.users.staffCanViewSalesHistory,
        staffCanViewStock: schema.users.staffCanViewStock,
        staffCanViewCustomers: schema.users.staffCanViewCustomers,
        staffCanViewVendors: schema.users.staffCanViewVendors,
        staffCanViewExpenses: schema.users.staffCanViewExpenses,
        staffCanViewStockBalances: schema.users.staffCanViewStockBalances,
        staffCanViewDebts: schema.users.staffCanViewDebts,
        staffCanManageCatalog: schema.users.staffCanManageCatalog,
      })
      .from(schema.users)
      .where(eq(schema.users.tenantId, req.tenantId))
      .orderBy(schema.users.username);
    res.json(list);
  } catch (error) {
    res.status(500).json({ message: "İstifadəçiləri gətirərkən xəta baş verdi" });
  }
});

// Update specific user's individual permissions
router.put("/users/:id/permissions", requireAdmin, async (req, res) => {
  try {
    const targetUserId = parseInt(req.params.id);
    const {
      staffCanViewSalesHistory,
      staffCanViewStock,
      staffCanViewCustomers,
      staffCanViewVendors,
      staffCanViewExpenses,
      staffCanViewStockBalances,
      staffCanViewDebts,
      staffCanManageCatalog
    } = req.body;

    const targetUser = await db.query.users.findFirst({
      where: and(eq(schema.users.id, targetUserId), eq(schema.users.tenantId, req.tenantId))
    });
    if (!targetUser) {
      return res.status(404).json({ message: "İstifadəçi tapılmadı" });
    }

    const updated = await db
      .update(schema.users)
      .set({
        staffCanViewSalesHistory: staffCanViewSalesHistory !== undefined ? parseInt(staffCanViewSalesHistory as any) : undefined,
        staffCanViewStock: staffCanViewStock !== undefined ? parseInt(staffCanViewStock as any) : undefined,
        staffCanViewCustomers: staffCanViewCustomers !== undefined ? parseInt(staffCanViewCustomers as any) : undefined,
        staffCanViewVendors: staffCanViewVendors !== undefined ? parseInt(staffCanViewVendors as any) : undefined,
        staffCanViewExpenses: staffCanViewExpenses !== undefined ? parseInt(staffCanViewExpenses as any) : undefined,
        staffCanViewStockBalances: staffCanViewStockBalances !== undefined ? parseInt(staffCanViewStockBalances as any) : undefined,
        staffCanViewDebts: staffCanViewDebts !== undefined ? parseInt(staffCanViewDebts as any) : undefined,
        staffCanManageCatalog: staffCanManageCatalog !== undefined ? parseInt(staffCanManageCatalog as any) : undefined,
      })
      .where(eq(schema.users.id, targetUserId))
      .returning();

    await logActivity(req, "UPDATE_USER_PERMISSIONS", `'${targetUser.username}' istifadəçisinin individual səlahiyyətlərini yenilədi`);

    res.json(updated[0]);
  } catch (error) {
    res.status(500).json({ message: "Səlahiyyətləri yeniləyərkən xəta baş verdi" });
  }
});

// Create user
router.post("/users", requireAdmin, async (req, res) => {
  try {
    const { username, password, role } = req.body;
    if (!username || !password || !role) {
      return res.status(400).json({ message: "Məcburi sahələri doldurun" });
    }

    const normalizedUsername = username.trim().toLowerCase();
    
    // Check if user already exists in this tenant
    const existing = await db.query.users.findFirst({
      where: and(eq(schema.users.username, normalizedUsername), eq(schema.users.tenantId, req.tenantId))
    });
    if (existing) {
      return res.status(400).json({ message: "Bu istifadəçi adı bu biznesdə artıq mövcuddur" });
    }

    // Enforce SaaS resource limits
    const limitCheck = await verifyTenantLimit(req.tenantId, "users");
    if (!limitCheck.allowed) {
      return res.status(402).json({
        limitReached: true,
        limitType: "users",
        current: limitCheck.current,
        max: limitCheck.max,
        tier: limitCheck.tier,
        message: `İstifadəçi limitinə çatdınız! Mövcud planınızda limit: ${limitCheck.max} istifadəçi.`
      });
    }

    const newUser = await db
      .insert(schema.users)
      .values({
        tenantId: req.tenantId,
        username: normalizedUsername,
        password: password.trim(),
        role: role || "Staff",
      })
      .returning();

    await logActivity(req, "CREATE_USER", `Yeni istifadəçi hesabı yaradıldı: '${normalizedUsername}' (Rol: ${role})`);

    res.json({
      id: newUser[0].id,
      username: newUser[0].username,
      role: newUser[0].role,
    });
  } catch (error) {
    res.status(500).json({ message: "İstifadəçi yaradılarkən xəta baş verdi" });
  }
});

// Change user password
router.put("/users/:id/password", async (req, res) => {
  try {
    const targetUserId = parseInt(req.params.id);
    const { password } = req.body;
    if (!password || !password.trim()) {
      return res.status(400).json({ message: "Şifrə daxil edilməlidir" });
    }

    // Verify permission: Must be Admin OR updating self
    const reqRole = req.headers["x-user-role"];
    const reqUsername = req.headers["x-user-username"];
    
    const targetUser = await db.query.users.findFirst({
      where: and(eq(schema.users.id, targetUserId), eq(schema.users.tenantId, req.tenantId))
    });
    if (!targetUser) {
      return res.status(404).json({ message: "İstifadəçi tapılmadı" });
    }

    const reqUsernameStr = typeof reqUsername === "string" ? reqUsername.trim().toLowerCase() : "";
    const isSelf = reqUsernameStr && targetUser.username === reqUsernameStr;
    const isAdmin = reqRole === "Admin";

    if (!isAdmin && !isSelf) {
      return res.status(403).json({ message: "Bu şifrəni dəyişmək üçün kifayət qədər səlahiyyətiniz yoxdur." });
    }

    await db
      .update(schema.users)
      .set({ password: password.trim() })
      .where(eq(schema.users.id, targetUserId));

    await logActivity(req, "CHANGE_PASSWORD", `'${targetUser.username}' istifadəçisinin sistem şifrəsini yenilədi`);

    res.json({ message: "Şifrə uğurla dəyişdirildi" });
  } catch (error) {
    res.status(500).json({ message: "Şifrə yenilənərkən xəta baş verdi" });
  }
});

// Delete user
router.delete("/users/:id", requireAdmin, async (req, res) => {
  try {
    const targetUserId = parseInt(req.params.id);
    const reqUsername = req.headers["x-user-username"];

    const targetUser = await db.query.users.findFirst({
      where: and(eq(schema.users.id, targetUserId), eq(schema.users.tenantId, req.tenantId))
    });
    if (!targetUser) {
      return res.status(404).json({ message: "İstifadəçi tapılmadı" });
    }

    // Cannot delete themselves
    const reqUsernameStr = typeof reqUsername === "string" ? reqUsername.trim().toLowerCase() : "";
    if (reqUsernameStr && targetUser.username === reqUsernameStr) {
      return res.status(400).json({ message: "Öz hesabınızı silə bilməzsiniz!" });
    }

    await db
      .delete(schema.users)
      .where(eq(schema.users.id, targetUserId));

    await logActivity(req, "DELETE_USER", `'${targetUser.username}' (Rol: ${targetUser.role}) istifadəçi hesabını sistemdən sildi`);

    res.json({ message: "İstifadəçi silindi" });
  } catch (error) {
    res.status(500).json({ message: "İstifadəçi silinərkən xəta baş verdi" });
  }
});

// ----------------------------------------------------
// 11. DATA BACKUP EXPORT ENDPOINTS (CSV)
// ----------------------------------------------------

router.get("/backup/export/:table", requireAdmin, async (req, res) => {
  try {
    const { table } = req.params;
    let data: any[] = [];

    if (table === "products") {
      data = await db.select().from(schema.products).where(eq(schema.products.tenantId, req.tenantId));
    } else if (table === "customers") {
      data = await db.select().from(schema.customers).where(eq(schema.customers.tenantId, req.tenantId));
    } else if (table === "expenses") {
      data = await db.select().from(schema.expenses).where(eq(schema.expenses.tenantId, req.tenantId));
    } else if (table === "sales") {
      data = await db.select().from(schema.sales).where(eq(schema.sales.tenantId, req.tenantId));
    } else if (table === "stock_entries") {
      data = await db.select().from(schema.stockEntries).where(eq(schema.stockEntries.tenantId, req.tenantId));
    } else {
      return res.status(400).json({ message: "Yanlış yedəkləmə cədvəli" });
    }

    if (data.length === 0) {
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename=backup_${table}.csv`);
      return res.send("");
    }

    const headers = Object.keys(data[0]).join(",");
    const rows = data.map((row) =>
      Object.values(row)
        .map((val) => {
          if (val === null || val === undefined) return "";
          const str = String(val).replace(/"/g, '""');
          return str.includes(",") || str.includes("\n") || str.includes('"') ? `"${str}"` : str;
        })
        .join(",")
    );

    const csvContent = [headers, ...rows].join("\n");

    await logActivity(req, "BACKUP_EXPORT", `Sistem verilənlərini yedəklədi: '${table}' cədvəlini CSV formatında ixrac etdi`);

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=backup_${table}.csv`);
    res.send(csvContent);
  } catch (error) {
    res.status(500).json({ message: "Verilənləri ixrac edərkən xəta baş verdi" });
  }
});

// ----------------------------------------------------
// 12. SAAS SUPER ADMIN ENDPOINTS (super.birsaas.com control plane)
// ----------------------------------------------------

// List all tenants with stats (Super Admin only)
router.get("/super/tenants", requireSuperAdmin, async (req, res) => {
  try {
    const allTenants = await db.select().from(schema.tenants).orderBy(desc(schema.tenants.id));
    const result = [];

    for (const tenant of allTenants) {
      // Fetch user count for this tenant
      const userCountResult = await db
        .select({ count: sql`COUNT(id)` })
        .from(schema.users)
        .where(eq(schema.users.tenantId, tenant.id));
      const userCount = parseInt((userCountResult[0]?.count as string) || "0");

      // Fetch sale count
      const saleCountResult = await db
        .select({ count: sql`COUNT(id)` })
        .from(schema.sales)
        .where(eq(schema.sales.tenantId, tenant.id));
      const saleCount = parseInt((saleCountResult[0]?.count as string) || "0");

      result.push({
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        status: tenant.status,
        releaseTier: tenant.releaseTier,
        createdAt: tenant.createdAt,
        userCount,
        saleCount
      });
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: "Biznesləri gətirərkən xəta baş verdi" });
  }
});

// Create/Provision a new Tenant (SaaS sign up)
router.post("/super/tenants", requireSuperAdmin, async (req, res) => {
  try {
    const { name, slug, adminUsername, adminPassword } = req.body;
    if (!name || !slug || !adminUsername || !adminPassword) {
      return res.status(400).json({ message: "Bütün məlumatları doldurun" });
    }

    const normalizedSlug = slug.trim().toLowerCase();
    
    // Check if slug is already taken
    const existingTenant = await db.query.tenants.findFirst({
      where: eq(schema.tenants.slug, normalizedSlug)
    });
    if (existingTenant) {
      return res.status(400).json({ message: "Bu Biznes Kodu artıq istifadə olunur" });
    }

    // Insert tenant
    const newTenant = await db
      .insert(schema.tenants)
      .values({
        name,
        slug: normalizedSlug,
        status: "active",
        releaseTier: "stable",
        createdAt: new Date().toISOString()
      })
      .returning();

    const tenantId = newTenant[0].id;

    // Initialize Settings for the new tenant
    await db.insert(schema.settings).values({
      tenantId,
      storeName: name,
    });

    // Create the initial admin user for this tenant
    const normalizedUsername = adminUsername.trim().toLowerCase();
    await db.insert(schema.users).values({
      tenantId,
      username: normalizedUsername,
      password: adminPassword.trim(),
      role: "Admin"
    });

    await logActivity(req, "PROVISION_TENANT", `Yeni biznes hesabını aktivləşdirdi: '${name}' (Kod: ${normalizedSlug}, Admin: ${normalizedUsername})`);

    res.json(newTenant[0]);
  } catch (error: any) {
    console.error("Tenant provisioning error:", error);
    res.status(500).json({ message: `Biznes yaradılarkən xəta baş verdi: ${error.message || error}` });
  }
});

// Toggle tenant active/suspended status
router.put("/super/tenants/:id/status", requireSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { status } = req.body;

    if (id === 2) {
      return res.status(400).json({ message: "Super platforma admin tenantı dayandırıla bilməz!" });
    }

    const updated = await db
      .update(schema.tenants)
      .set({ status })
      .where(eq(schema.tenants.id, id))
      .returning();

    if (updated.length === 0) {
      return res.status(404).json({ message: "Biznes tapılmadı" });
    }

    await logActivity(req, "TOGGLE_TENANT_STATUS", `'${updated[0].name}' biznesinin statusunu yenilədi: ${status}`);

    res.json(updated[0]);
  } catch (error) {
    res.status(500).json({ message: "Biznes statusu dəyişdirilərkən xəta baş verdi" });
  }
});

// Set tenant release updates tier
router.put("/super/tenants/:id/tier", requireSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { releaseTier } = req.body;

    const updated = await db
      .update(schema.tenants)
      .set({ releaseTier })
      .where(eq(schema.tenants.id, id))
      .returning();

    if (updated.length === 0) {
      return res.status(404).json({ message: "Biznes tapılmadı" });
    }

    await logActivity(req, "UPDATE_TENANT_TIER", `'${updated[0].name}' biznesinin yenilənmə dərəcəsini dəyişdi: ${releaseTier}`);

    res.json(updated[0]);
  } catch (error) {
    res.status(500).json({ message: "Biznes dərəcəsi dəyişdirilərkən xəta baş verdi" });
  }
});

// Get all users for a specific tenant (only for Super Admin)
router.get("/super/tenants/:id/users", requireSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const tenantUsers = await db.query.users.findMany({
      where: eq(schema.users.tenantId, id)
    });
    res.json(tenantUsers);
  } catch (error: any) {
    console.error("Error fetching tenant users:", error);
    res.status(500).json({ message: "Biznes istifadəçilərini gətirərkən xəta baş verdi" });
  }
});

// Delete a tenant (requires super admin privileges & verifying super admin password)
router.delete("/super/tenants/:id", requireSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ message: "Təsdiqləmək üçün Super Admin şifrəsini daxil edin" });
    }

    if (id === 2) {
      return res.status(400).json({ message: "Super platforma admin tenantı silinə bilməz!" });
    }

    // Verify the super admin user's password
    const headerUsername = req.headers["x-user-username"];
    const superAdminUsername = (Array.isArray(headerUsername) ? (headerUsername[0] || "superadmin") : (headerUsername || "superadmin")).trim().toLowerCase();
    const superAdminUser = await db.query.users.findFirst({
      where: and(
        eq(schema.users.username, superAdminUsername),
        eq(schema.users.tenantId, req.tenantId)
      )
    });

    if (!superAdminUser || superAdminUser.password !== password.trim()) {
      return res.status(401).json({ message: "Daxil edilən Super Admin şifrəsi yanlışdır!" });
    }

    // Fetch tenant name before deleting
    const tenantToDelete = await db.query.tenants.findFirst({
      where: eq(schema.tenants.id, id)
    });

    if (!tenantToDelete) {
      return res.status(404).json({ message: "Silinəcək biznes tapılmadı" });
    }

    // Delete the tenant
    await db.delete(schema.tenants).where(eq(schema.tenants.id, id));

    await logActivity(req, "DELETE_TENANT", `'${tenantToDelete.name}' (Kod: ${tenantToDelete.slug}) biznesini tamamilə sildi`);

    res.json({ message: `Biznes hesabınız ('${tenantToDelete.name}') uğurla silindi` });
  } catch (error: any) {
    console.error("Error deleting tenant:", error);
    res.status(500).json({ message: "Biznes silinərkən xəta baş verdi" });
  }
});

// Set tenant billing plan (only for Super Admin)
router.put("/super/tenants/:id/billing-tier", requireSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { billingTier } = req.body;

    if (!billingTier || !["free", "mini", "pro", "enterprise"].includes(billingTier)) {
      return res.status(400).json({ message: "Yanlış tarif planı daxil edilib" });
    }

    const updated = await db
      .update(schema.tenants)
      .set({ billingTier })
      .where(eq(schema.tenants.id, id))
      .returning();

    if (updated.length === 0) {
      return res.status(404).json({ message: "Biznes tapılmadı" });
    }

    await logActivity(req, "UPDATE_TENANT_BILLING_TIER", `'${updated[0].name}' biznesinin abunəlik tarifini dəyişdi: ${billingTier}`);

    res.json(updated[0]);
  } catch (error) {
    console.error("Error updating tenant billing tier:", error);
    res.status(500).json({ message: "Biznes tarifi yenilənərkən xəta baş verdi" });
  }
});

// Update Super Admin profile credentials (username & password)
router.put("/super/profile", requireSuperAdmin, async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: "İstifadəçi adı və şifrə boş ola bilməz!" });
    }

    // Find the active super admin user (tenantId = 2, role = Admin)
    const superUser = await db.query.users.findFirst({
      where: and(
        eq(schema.users.tenantId, 2),
        eq(schema.users.role, "Admin")
      )
    });

    if (!superUser) {
      return res.status(404).json({ message: "Super Admin hesabı tapılmadı!" });
    }

    // Update in database
    await db.update(schema.users)
      .set({
        username: username.trim().toLowerCase(),
        password: password.trim()
      })
      .where(eq(schema.users.id, superUser.id));

    await logActivity(req, "UPDATE_SUPER_PROFILE", `Super Admin profil məlumatlarını yenilədi: '${username}'`);

    res.json({ success: true, message: "Super Admin profil məlumatları uğurla yeniləndi!" });
  } catch (error) {
    console.error("Error updating super admin profile:", error);
    res.status(500).json({ message: "Profil məlumatlarını yeniləyərkən xəta baş verdi" });
  }
});

// ----------------------------------------------------
// 13. VENDOR / SUPPLIER ENDPOINTS
// ----------------------------------------------------

// List all vendor payments globally (wholesale payouts ledger)
router.get("/vendors/payments", requireAdmin, async (req, res) => {
  try {
    const payments = await db
      .select({
        id: schema.vendorPayments.id,
        amount: schema.vendorPayments.amount,
        paymentDate: schema.vendorPayments.paymentDate,
        paymentType: schema.vendorPayments.paymentType,
        notes: schema.vendorPayments.notes,
        vendorName: schema.vendors.name,
      })
      .from(schema.vendorPayments)
      .innerJoin(schema.vendors, eq(schema.vendorPayments.vendorId, schema.vendors.id))
      .where(eq(schema.vendorPayments.tenantId, req.tenantId))
      .orderBy(desc(schema.vendorPayments.paymentDate));

    res.json(payments);
  } catch (error: any) {
    console.error("Global vendor payments error:", error);
    res.status(500).json({ message: "Bütün tədarükçü ödənişlərini gətirərkən xəta baş verdi: " + error.message });
  }
});

// List all vendors with aggregated balances
router.get("/vendors", async (req, res) => {
  try {
    if (!await checkUserPermission(req, "staffCanViewVendors")) {
      return res.status(403).json({ message: "Tədarükçü məlumatlarına giriş administrator tərəfindən məhdudlaşdırılıb" });
    }

    const allVendors = await db.select().from(schema.vendors).where(eq(schema.vendors.tenantId, req.tenantId));
    const result = [];
    
    for (const vendor of allVendors) {
      // Calculate total credit purchases (where paidStatus = 'credit' or paymentType = 'Nisyə')
      const purchases = await db.select().from(schema.stockEntries).where(
        and(
          eq(schema.stockEntries.vendorId, vendor.id),
          eq(schema.stockEntries.tenantId, req.tenantId)
        )
      );
      
      const totalPurchases = purchases.reduce((acc, p) => acc + (p.quantity * p.purchasePrice), 0);
      
      const creditPurchases = purchases.filter(p => p.paidStatus === "credit" || p.paymentType === "Nisyə");
      const totalDebtCreated = creditPurchases.reduce((acc, p) => acc + (p.quantity * p.purchasePrice), 0);
      
      // Calculate total payments made to this vendor
      const payments = await db.select().from(schema.vendorPayments).where(
        and(
          eq(schema.vendorPayments.vendorId, vendor.id),
          eq(schema.vendorPayments.tenantId, req.tenantId)
        )
      );
      const totalPayments = payments.reduce((acc, pay) => acc + pay.amount, 0);
      
      const balance = totalDebtCreated - totalPayments;
      
      result.push({
        id: vendor.id,
        name: vendor.name,
        phone: vendor.phone,
        email: vendor.email,
        address: vendor.address,
        notes: vendor.notes,
        createdAt: vendor.createdAt,
        totalPurchases,
        totalPaid: totalPayments,
        balance: Math.max(0, balance),
      });
    }
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: "Tədarükçüləri gətirərkən xəta baş verdi" });
  }
});

// Create vendor
router.post("/vendors", requireAdmin, async (req, res) => {
  try {
    const { name, phone, email, address, notes } = req.body;
    if (!name) {
      return res.status(400).json({ message: "Tədarükçü adı məcburidir" });
    }
    
    const newVendor = await db.insert(schema.vendors).values({
      tenantId: req.tenantId,
      name,
      phone: phone || null,
      email: email || null,
      address: address || null,
      notes: notes || null,
      createdAt: new Date().toISOString(),
    }).returning();
    
    await logActivity(req, "CREATE_VENDOR", `Yeni tədarükçü əlavə etdi: ${name}`);
    res.json(newVendor[0]);
  } catch (error) {
    res.status(500).json({ message: "Tədarükçü yaradılarkən xəta baş verdi" });
  }
});

// Update vendor
router.put("/vendors/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, phone, email, address, notes } = req.body;
    if (!name) {
      return res.status(400).json({ message: "Tədarükçü adı məcburidir" });
    }
    
    const updated = await db.update(schema.vendors).set({
      name,
      phone: phone || null,
      email: email || null,
      address: address || null,
      notes: notes || null,
    })
    .where(and(eq(schema.vendors.id, id), eq(schema.vendors.tenantId, req.tenantId)))
    .returning();
    
    if (updated.length === 0) {
      return res.status(404).json({ message: "Tədarükçü tapılmadı" });
    }
    
    await logActivity(req, "UPDATE_VENDOR", `Tədarükçü məlumatlarını yenilədi: ${name}`);
    res.json(updated[0]);
  } catch (error) {
    res.status(500).json({ message: "Tədarükçü yenilənərkən xəta baş verdi" });
  }
});

// Delete vendor
router.delete("/vendors/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const deleted = await db.delete(schema.vendors)
      .where(and(eq(schema.vendors.id, id), eq(schema.vendors.tenantId, req.tenantId)))
      .returning();
    
    if (deleted.length === 0) {
      return res.status(404).json({ message: "Tədarükçü tapılmadı" });
    }
    
    await logActivity(req, "DELETE_VENDOR", `Tədarükçünü sildi: ${deleted[0].name}`);
    res.json({ message: "Tədarükçü uğurla silindi" });
  } catch (error) {
    res.status(500).json({ message: "Tədarükçü silinərkən xəta baş verdi" });
  }
});

// List payments for vendor
router.get("/vendors/:id/payments", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const payments = await db.select().from(schema.vendorPayments).where(
      and(
        eq(schema.vendorPayments.vendorId, id),
        eq(schema.vendorPayments.tenantId, req.tenantId)
      )
    ).orderBy(desc(schema.vendorPayments.paymentDate));
    
    res.json(payments);
  } catch (error) {
    res.status(500).json({ message: "Tədarükçü ödənişlərini gətirərkən xəta baş verdi" });
  }
});

// Create payment to vendor
router.post("/vendors/:id/payments", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { amount, paymentType, notes, paymentDate } = req.body;
    if (!amount || parseFloat(amount) <= 0 || !paymentType) {
      return res.status(400).json({ message: "Məbləğ və ödəniş növü məcburidir" });
    }
    
    const vendor = await db.query.vendors.findFirst({
      where: and(eq(schema.vendors.id, id), eq(schema.vendors.tenantId, req.tenantId))
    });
    
    if (!vendor) {
      return res.status(404).json({ message: "Tədarükçü tapılmadı" });
    }
    
    const parsedAmount = parseFloat(amount);
    
    const newPayment = await db.insert(schema.vendorPayments).values({
      tenantId: req.tenantId,
      vendorId: id,
      amount: parsedAmount,
      paymentType,
      notes: notes || null,
      paymentDate: paymentDate || new Date().toISOString(),
    }).returning();
    
    // Automatically allocate payment to the oldest unpaid credit stock entries of this vendor (FIFO)
    const unpaidEntries = await db.query.stockEntries.findMany({
      where: and(
        eq(schema.stockEntries.vendorId, id),
        eq(schema.stockEntries.paidStatus, "credit"),
        eq(schema.stockEntries.tenantId, req.tenantId)
      ),
      orderBy: [asc(schema.stockEntries.entryDate)], // Oldest first
    });
    
    let remainingPayment = parsedAmount;
    for (const entry of unpaidEntries) {
      const debtAmount = entry.quantity * entry.purchasePrice;
      if (remainingPayment >= debtAmount) {
        await db.update(schema.stockEntries)
          .set({ paidStatus: "paid" })
          .where(eq(schema.stockEntries.id, entry.id));
        remainingPayment -= debtAmount;
      } else {
        break; // Cannot fully cover the next debt entry, stop allocation
      }
    }
    
    await logActivity(req, "CREATE_VENDOR_PAYMENT", `Tədarükçüyə ödəniş etdi: ${vendor.name} (${amount} ₼, Ödəniş: ${paymentType})`);
    res.json(newPayment[0]);
  } catch (error) {
    res.status(500).json({ message: "Tədarükçüyə ödəniş edilərkən xəta baş verdi" });
  }
});

// ----------------------------------------------------
// 14. EMPLOYEES / HR ENDPOINTS
// ----------------------------------------------------

// List all employees
router.get("/employees", async (req, res) => {
  try {
    const allEmployees = await db
      .select()
      .from(schema.employees)
      .where(eq(schema.employees.tenantId, req.tenantId))
      .orderBy(desc(schema.employees.createdAt));
    res.json(allEmployees);
  } catch (error) {
    res.status(500).json({ message: "Əməkdaşları gətirərkən xəta baş verdi" });
  }
});

// Create employee
router.post("/employees", requireAdmin, async (req, res) => {
  try {
    const { name, phone, email, position, baseSalary, hireDate, status, notes } = req.body;
    if (!name || !position || baseSalary === undefined || !hireDate) {
      return res.status(400).json({ message: "Məcburi sahələri doldurun" });
    }

    const newEmployee = await db
      .insert(schema.employees)
      .values({
        tenantId: req.tenantId,
        name,
        phone: phone || null,
        email: email || null,
        position,
        baseSalary: parseFloat(baseSalary),
        hireDate,
        status: status || "active",
        notes: notes || null,
        createdAt: new Date().toISOString(),
      })
      .returning();

    await logActivity(req, "CREATE_EMPLOYEE", `Yeni əməkdaş əlavə etdi: ${name} (${position}, Maaş: ${baseSalary} ₼)`);
    res.json(newEmployee[0]);
  } catch (error) {
    res.status(500).json({ message: "Əməkdaş əlavə edilərkən xəta baş verdi" });
  }
});

// Update employee
router.put("/employees/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, phone, email, position, baseSalary, hireDate, status, notes } = req.body;

    if (!name || !position || baseSalary === undefined || !hireDate) {
      return res.status(400).json({ message: "Məcburi sahələri doldurun" });
    }

    const updated = await db
      .update(schema.employees)
      .set({
        name,
        phone: phone || null,
        email: email || null,
        position,
        baseSalary: parseFloat(baseSalary),
        hireDate,
        status,
        notes: notes || null,
      })
      .where(and(eq(schema.employees.id, id), eq(schema.employees.tenantId, req.tenantId)))
      .returning();

    if (updated.length === 0) {
      return res.status(404).json({ message: "Əməkdaş tapılmadı" });
    }

    await logActivity(req, "UPDATE_EMPLOYEE", `Əməkdaş məlumatlarını yenilədi: ${name} (${position})`);
    res.json(updated[0]);
  } catch (error) {
    res.status(500).json({ message: "Əməkdaş məlumatları yenilənərkən xəta baş verdi" });
  }
});

// Delete employee
router.delete("/employees/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const deleted = await db
      .delete(schema.employees)
      .where(and(eq(schema.employees.id, id), eq(schema.employees.tenantId, req.tenantId)))
      .returning();

    if (deleted.length === 0) {
      return res.status(404).json({ message: "Əməkdaş tapılmadı" });
    }

    await logActivity(req, "DELETE_EMPLOYEE", `Əməkdaşı sildi: ${deleted[0].name}`);
    res.json({ message: "Əməkdaş uğurla silindi" });
  } catch (error) {
    res.status(500).json({ message: "Əməkdaş silinərkən xəta baş verdi" });
  }
});

// ----------------------------------------------------
// 15. PAYROLL ENDPOINTS
// ----------------------------------------------------

// List monthly payroll sheets
router.get("/payroll", async (req, res) => {
  try {
    const month = req.query.month as string;
    if (!month) {
      return res.status(400).json({ message: "Ay məlumatı (payroll_month) daxil edilməlidir" });
    }

    // Join payroll with employee details
    const payrollSheets = await db.query.payroll.findMany({
      where: and(eq(schema.payroll.tenantId, req.tenantId), eq(schema.payroll.payrollMonth, month)),
      with: { employee: true },
      orderBy: [desc(schema.payroll.createdAt)],
    });

    res.json(payrollSheets);
  } catch (error) {
    res.status(500).json({ message: "Maaş cədvəlini gətirərkən xəta baş verdi" });
  }
});

// Generate/Refresh monthly payroll for active employees
router.post("/payroll/calculate", requireAdmin, async (req, res) => {
  try {
    const { month } = req.body; // e.g. "2026-05"
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ message: "Düzgün ay daxil edin (YYYY-MM)" });
    }

    // 1. Fetch active employees
    const activeEmployees = await db
      .select()
      .from(schema.employees)
      .where(and(eq(schema.employees.tenantId, req.tenantId), eq(schema.employees.status, "active")));

    let addedCount = 0;

    for (const emp of activeEmployees) {
      // Check if already exists for this employee and month
      const existing = await db
        .select()
        .from(schema.payroll)
        .where(
          and(
            eq(schema.payroll.tenantId, req.tenantId),
            eq(schema.payroll.employeeId, emp.id),
            eq(schema.payroll.payrollMonth, month)
          )
        )
        .limit(1);

      if (existing.length === 0) {
        // Create payroll row
        await db.insert(schema.payroll).values({
          tenantId: req.tenantId,
          employeeId: emp.id,
          payrollMonth: month,
          baseSalary: emp.baseSalary,
          bonuses: 0,
          deductions: 0,
          netSalary: emp.baseSalary,
          paidAmount: 0,
          paymentStatus: "unpaid",
          createdAt: new Date().toISOString(),
        });
        addedCount++;
      }
    }

    await logActivity(req, "CALCULATE_PAYROLL", `${month} ayı üçün ${addedCount} əməkdaşın maaşını hesabladı.`);
    res.json({ message: "Maaşlar uğurla hesablandı", calculated: addedCount });
  } catch (error) {
    res.status(500).json({ message: "Maaş cədvəli hesablanarkən xəta baş verdi" });
  }
});

// Adjust payroll (bonuses, deductions, notes)
router.put("/payroll/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { bonuses, deductions, notes } = req.body;

    if (bonuses === undefined || deductions === undefined) {
      return res.status(400).json({ message: "Bonus və tutulmalar məcburidir" });
    }

    // 1. Fetch current payroll row
    const record = await db.query.payroll.findFirst({
      where: and(eq(schema.payroll.id, id), eq(schema.payroll.tenantId, req.tenantId)),
      with: { employee: true },
    });

    if (!record) {
      return res.status(404).json({ message: "Maaş hesabatı tapılmadı" });
    }

    const netSalary = record.baseSalary + parseFloat(bonuses) - parseFloat(deductions);
    const paidAmount = record.paidAmount;
    
    // Evaluate status
    let paymentStatus = "unpaid";
    if (paidAmount >= netSalary) {
      paymentStatus = "paid";
    } else if (paidAmount > 0) {
      paymentStatus = "partial";
    }

    const updated = await db
      .update(schema.payroll)
      .set({
        bonuses: parseFloat(bonuses),
        deductions: parseFloat(deductions),
        netSalary,
        paymentStatus,
        notes: notes || null,
      })
      .where(eq(schema.payroll.id, id))
      .returning();

    await logActivity(
      req,
      "ADJUST_PAYROLL",
      `${record.employee.name} üçün ${record.payrollMonth} maaş tənzimlənməsi: Bonus +${bonuses} ₼, Tutulma -${deductions} ₼`
    );

    res.json(updated[0]);
  } catch (error) {
    res.status(500).json({ message: "Maaş hesabatı düzəldilərkən xəta baş verdi" });
  }
});

// ----------------------------------------------------
// 16. SALARY PAYMENT ENDPOINTS
// ----------------------------------------------------

// List payments for a payroll entry
router.get("/payroll/:id/payments", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const payments = await db
      .select()
      .from(schema.salaryPayments)
      .where(
        and(
          eq(schema.salaryPayments.payrollId, id),
          eq(schema.salaryPayments.tenantId, req.tenantId)
        )
      )
      .orderBy(desc(schema.salaryPayments.paymentDate));

    res.json(payments);
  } catch (error) {
    res.status(500).json({ message: "Maaş ödənişlərini gətirərkən xəta baş verdi" });
  }
});

// Register salary payment
router.post("/payroll/:id/payments", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { amount, paymentType, notes } = req.body;

    if (!amount || parseFloat(amount) <= 0 || !paymentType) {
      return res.status(400).json({ message: "Məbləğ və ödəniş növü məcburidir" });
    }

    // 1. Fetch parent payroll record
    const record = await db.query.payroll.findFirst({
      where: and(eq(schema.payroll.id, id), eq(schema.payroll.tenantId, req.tenantId)),
      with: { employee: true },
    });

    if (!record) {
      return res.status(404).json({ message: "Maaş hesabatı tapılmadı" });
    }

    const payVal = parseFloat(amount);
    const newPaidAmount = record.paidAmount + payVal;
    
    // Evaluate status
    let paymentStatus = "unpaid";
    if (newPaidAmount >= record.netSalary) {
      paymentStatus = "paid";
    } else if (newPaidAmount > 0) {
      paymentStatus = "partial";
    }

    // Execute database operations in a transaction
    const paymentResult = await db.transaction(async (tx) => {
      // Insert payment log
      const newPayment = await tx
        .insert(schema.salaryPayments)
        .values({
          tenantId: req.tenantId,
          payrollId: id,
          amount: payVal,
          paymentDate: new Date().toISOString(),
          paymentType,
          notes: notes || null,
        })
        .returning();

      // Update parent paidAmount
      await tx
        .update(schema.payroll)
        .set({
          paidAmount: newPaidAmount,
          paymentStatus,
        })
        .where(eq(schema.payroll.id, id));

      return newPayment[0];
    });

    await logActivity(
      req,
      "DISBURSE_SALARY",
      `Əməkhaqqı ödənişi etdi: ${record.employee.name} (${amount} ₼, ${record.payrollMonth} ayı, Ödəniş: ${paymentType})`
    );

    res.json(paymentResult);

    // Send Telegram Notification in background
    sendTelegramNotification(req.tenantId, `👥 <b>Əməkhaqqı Ödənişi!</b>\n\n<b>Əməkdaş:</b> ${record.employee.name}\n<b>Vəzifə:</b> ${record.employee.position}\n<b>Ödənilən Məbləğ:</b> <code>${parseFloat(amount).toFixed(2)} ₼</code>\n<b>Hesablanma Ayı:</b> ${record.payrollMonth}\n<b>Kassa Ödəniş Üsulu:</b> ${paymentType}`).catch(err => console.error("Telegram notification failed:", err));
  } catch (error) {
    res.status(500).json({ message: "Əməkhaqqı ödənişi edilərkən xəta baş verdi" });
  }
});

// ----------------------------------------------------
// 17. BACKUP & RESTORE ENDPOINTS
// ----------------------------------------------------

// Export Tenant backup data (GET)
router.get("/settings/backup/export", requireAdmin, async (req, res) => {
  try {
    const tenantId = req.tenantId;

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

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename=qazanpos_backup_tenant_${tenantId}_${Date.now()}.json`);
    res.json(backupPayload);
  } catch (error: any) {
    console.error("Backup export error:", error);
    res.status(500).json({ message: "Ehtiyat nüsxə yaradılarkən xəta baş verdi: " + error.message });
  }
});

// Import Tenant backup data (POST)
router.post("/settings/backup/import", requireAdmin, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { backupVersion, scope, tenantId: backupTenantId, data } = req.body;

    if (!data || scope !== "tenant") {
      return res.status(400).json({ message: "Düzgün ehtiyat nüsxəsi faylı seçilməyib." });
    }

    if (parseInt(backupTenantId) !== tenantId) {
      return res.status(403).json({ message: "Bu ehtiyat nüsxəsi başqa bir biznesə aiddir. İdxal etmək olmaz!" });
    }

    await db.transaction(async (tx) => {
      // 1. Delete existing data for this tenant in order to prevent foreign key issues
      await tx.delete(schema.returnItems).where(eq(schema.returnItems.tenantId, tenantId));
      await tx.delete(schema.returns).where(eq(schema.returns.tenantId, tenantId));
      
      await tx.delete(schema.creditPayments).where(eq(schema.creditPayments.tenantId, tenantId));
      await tx.delete(schema.saleItems).where(eq(schema.saleItems.tenantId, tenantId));
      await tx.delete(schema.sales).where(eq(schema.sales.tenantId, tenantId));

      await tx.delete(schema.stockEntries).where(eq(schema.stockEntries.tenantId, tenantId));
      await tx.delete(schema.vendorPayments).where(eq(schema.vendorPayments.tenantId, tenantId));
      await tx.delete(schema.vendors).where(eq(schema.vendors.tenantId, tenantId));

      await tx.delete(schema.salaryPayments).where(eq(schema.salaryPayments.tenantId, tenantId));
      await tx.delete(schema.payroll).where(eq(schema.payroll.tenantId, tenantId));
      await tx.delete(schema.employees).where(eq(schema.employees.tenantId, tenantId));

      await tx.delete(schema.products).where(eq(schema.products.tenantId, tenantId));
      await tx.delete(schema.customers).where(eq(schema.customers.tenantId, tenantId));
      await tx.delete(schema.activityLogs).where(eq(schema.activityLogs.tenantId, tenantId));
      await tx.delete(schema.settings).where(eq(schema.settings.tenantId, tenantId));
      await tx.delete(schema.users).where(eq(schema.users.tenantId, tenantId));

      // 2. Insert rows from backup
      if (data.users && data.users.length > 0) {
        await tx.insert(schema.users).values(data.users);
      }
      if (data.settings && data.settings.length > 0) {
        await tx.insert(schema.settings).values(data.settings);
      }
      if (data.products && data.products.length > 0) {
        await tx.insert(schema.products).values(data.products);
      }
      if (data.vendors && data.vendors.length > 0) {
        await tx.insert(schema.vendors).values(data.vendors);
      }
      if (data.customers && data.customers.length > 0) {
        await tx.insert(schema.customers).values(data.customers);
      }
      if (data.employees && data.employees.length > 0) {
        await tx.insert(schema.employees).values(data.employees);
      }
      if (data.payroll && data.payroll.length > 0) {
        await tx.insert(schema.payroll).values(data.payroll);
      }
      if (data.salaryPayments && data.salaryPayments.length > 0) {
        await tx.insert(schema.salaryPayments).values(data.salaryPayments);
      }
      if (data.stockEntries && data.stockEntries.length > 0) {
        await tx.insert(schema.stockEntries).values(data.stockEntries);
      }
      if (data.vendorPayments && data.vendorPayments.length > 0) {
        await tx.insert(schema.vendorPayments).values(data.vendorPayments);
      }
      if (data.sales && data.sales.length > 0) {
        await tx.insert(schema.sales).values(data.sales);
      }
      if (data.saleItems && data.saleItems.length > 0) {
        await tx.insert(schema.saleItems).values(data.saleItems);
      }
      if (data.creditPayments && data.creditPayments.length > 0) {
        await tx.insert(schema.creditPayments).values(data.creditPayments);
      }
      if (data.expenses && data.expenses.length > 0) {
        await tx.insert(schema.expenses).values(data.expenses);
      }
      if (data.activityLogs && data.activityLogs.length > 0) {
        await tx.insert(schema.activityLogs).values(data.activityLogs);
      }
      if (data.returns && data.returns.length > 0) {
        await tx.insert(schema.returns).values(data.returns);
      }
      if (data.returnItems && data.returnItems.length > 0) {
        await tx.insert(schema.returnItems).values(data.returnItems);
      }

      // 3. Reset primary key sequences for all tables so that subsequent inserts don't collide
      const tables = [
        "users", "settings", "products", "vendors", "customers", "employees", 
        "payroll", "salary_payments", "stock_entries", "vendor_payments", 
        "sales", "sale_items", "credit_payments", "expenses", "activity_logs", 
        "returns", "return_items"
      ];
      for (const table of tables) {
        await tx.execute(sql.raw(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), coalesce(max(id), 1), max(id) IS NOT null) FROM ${table}`));
      }
    });

    await logActivity(req, "RESTORE_BACKUP", "Sistem ehtiyat nüsxədən (backup) məlumatları uğurla bərpa etdi");
    res.json({ success: true, message: "Məlumatlar uğurla bərpa olundu!" });
  } catch (error: any) {
    console.error("Backup import error:", error);
    res.status(500).json({ message: "Ehtiyat nüsxəsi bərpa edilərkən xəta baş verdi: " + error.message });
  }
});

// Export FULL DATABASE backup (Super Admin only)
router.get("/super/backup/export", requireSuperAdmin, async (req, res) => {
  try {
    const data = {
      tenants: await db.select().from(schema.tenants),
      products: await db.select().from(schema.products),
      vendors: await db.select().from(schema.vendors),
      stockEntries: await db.select().from(schema.stockEntries),
      vendorPayments: await db.select().from(schema.vendorPayments),
      employees: await db.select().from(schema.employees),
      payroll: await db.select().from(schema.payroll),
      salaryPayments: await db.select().from(schema.salaryPayments),
      customers: await db.select().from(schema.customers),
      sales: await db.select().from(schema.sales),
      saleItems: await db.select().from(schema.saleItems),
      creditPayments: await db.select().from(schema.creditPayments),
      expenses: await db.select().from(schema.expenses),
      settings: await db.select().from(schema.settings),
      users: await db.select().from(schema.users),
      activityLogs: await db.select().from(schema.activityLogs),
      returns: await db.select().from(schema.returns),
      returnItems: await db.select().from(schema.returnItems),
    };

    const backupPayload = {
      backupVersion: "1.0",
      scope: "full-database",
      createdAt: new Date().toISOString(),
      data,
    };

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename=qazanpos_full_backup_${Date.now()}.json`);
    res.json(backupPayload);
  } catch (error: any) {
    console.error("Full database backup error:", error);
    res.status(500).json({ message: "Tam sistem backup-ı alınarkən xəta baş verdi: " + error.message });
  }
});

export default router;

