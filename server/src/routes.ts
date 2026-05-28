import { Router } from "express";
import { db } from "./db/index.js";
import * as schema from "./db/schema.js";
import { eq, and, lte, gte, sql, desc } from "drizzle-orm";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

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
  const role = req.headers["x-user-role"];
  if (role !== "Admin") {
    return res.status(403).json({ message: "Bu əməliyyat üçün yalnız Administrator səlahiyyəti tələb olunur." });
  }
  next();
}

// Middleware to verify active tenant is the Super Admin control plane
function requireSuperAdmin(req: any, res: any, next: any) {
  const role = req.headers["x-user-role"];
  if (req.tenantSlug !== "super" || role !== "Admin") {
    return res.status(403).json({ message: "Bu əməliyyat üçün yalnız Platforma Administratoru səlahiyyəti tələb olunur." });
  }
  next();
}

// Helper to log user activities with tenant scope
async function logActivity(req: any, action: string, description: string) {
  try {
    const username = req.headers["x-user-username"] || (req.headers["x-user-role"] === "Admin" ? "admin" : "satici") || "Sistem";
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
router.post("/products", requireAdmin, async (req, res) => {
  try {
    const { name, category, unit, description, barcode } = req.body;
    if (!name) return res.status(400).json({ message: "Ad tələb olunur" });

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

    const newProduct = await db
      .insert(schema.products)
      .values({
        tenantId: req.tenantId,
        name,
        category: category || null,
        unit: unit || "ədəd",
        description: description || null,
        barcode: barcode || null,
      })
      .returning();

    await logActivity(req, "CREATE_PRODUCT", `Yeni məhsul yaratdı: '${name}' (Kateqoriya: ${category || "yoxdur"}, Vahid: ${unit || "ədəd"})`);

    res.json(newProduct[0]);
  } catch (error) {
    res.status(500).json({ message: "Məhsul yaradılarkən xəta baş verdi" });
  }
});

// Update product
router.put("/products/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, category, unit, description, barcode } = req.body;

    const updated = await db
      .update(schema.products)
      .set({
        name,
        category: category || null,
        unit: unit || "ədəd",
        description: description || null,
        barcode: barcode || null,
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
router.delete("/products/:id", requireAdmin, async (req, res) => {
  try {
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

// List all stock entries (mədaxillər)
router.get("/stock/entries", async (req, res) => {
  try {
    const entries = await db.query.stockEntries.findMany({
      where: eq(schema.stockEntries.tenantId, req.tenantId),
      with: { product: true },
      orderBy: [desc(schema.stockEntries.entryDate)],
    });

    const result = entries.map((entry) => ({
      id: entry.id,
      productId: entry.productId,
      productName: entry.product.name,
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
router.post("/stock/entries", requireAdmin, async (req, res) => {
  try {
    const { productId, quantity, purchasePrice, supplier, notes, paymentType, creditDueDate } = req.body;

    if (!productId || !quantity || !purchasePrice || !paymentType) {
      return res.status(400).json({ message: "Məcburi sahələri doldurun" });
    }

    const isCredit = paymentType === "Nisyə";
    if (isCredit && !creditDueDate) {
      return res.status(400).json({ message: "Nisyə üçün son tarix daxil edilməlidir" });
    }

    const newEntry = await db
      .insert(schema.stockEntries)
      .values({
        tenantId: req.tenantId,
        productId,
        quantity: parseFloat(quantity),
        purchasePrice: parseFloat(purchasePrice),
        supplier: supplier || null,
        notes: notes || null,
        paymentType,
        creditDueDate: isCredit ? creditDueDate : null,
        entryDate: new Date().toISOString(),
        paidStatus: isCredit ? "credit" : "paid",
      })
      .returning();

    const productList = await db.select().from(schema.products).where(and(eq(schema.products.id, productId), eq(schema.products.tenantId, req.tenantId))).limit(1);
    const productName = productList[0] ? productList[0].name : `ID: ${productId}`;
    const unit = productList[0] ? productList[0].unit : "ədəd";
    await logActivity(
      req,
      "CREATE_STOCK_ENTRY",
      `Anbara mədaxil etdi: ${quantity} ${unit} '${productName}' (Alış qiyməti: ${purchasePrice} ₼, Tədarükçü: ${supplier || "Yoxdur"}, Ödəniş: ${paymentType})`
    );

    res.json(newEntry[0]);
  } catch (error) {
    res.status(500).json({ message: "Mədaxil edilərkən xəta baş verdi" });
  }
});

// Fetch stock levels (current quantities, latest purchase prices, total value)
router.get("/stock/levels", async (req, res) => {
  try {
    const allProducts = await db.select().from(schema.products).where(eq(schema.products.tenantId, req.tenantId));
    const stockLevels = [];

    for (const product of allProducts) {
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

      // 3. Calculate total returned back to stock
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

      // 4. Get latest purchase price
      const latestEntry = await db
        .select({ price: schema.stockEntries.purchasePrice })
        .from(schema.stockEntries)
        .where(and(eq(schema.stockEntries.productId, product.id), eq(schema.stockEntries.tenantId, req.tenantId)))
        .orderBy(desc(schema.stockEntries.entryDate))
        .limit(1);
      const lastPurchasePrice = latestEntry[0]?.price || 0;

      stockLevels.push({
        productId: product.id,
        productName: product.name,
        category: product.category,
        unit: product.unit,
        currentQuantity,
        lastPurchasePrice,
        totalValue: currentQuantity * lastPurchasePrice,
      });
    }

    res.json(stockLevels);
  } catch (error) {
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

// ----------------------------------------------------
// 3. CUSTOMERS ENDPOINTS
// ----------------------------------------------------

// List all customers
router.get("/customers", async (req, res) => {
  try {
    const list = await db
      .select()
      .from(schema.customers)
      .where(eq(schema.customers.tenantId, req.tenantId));
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

    const newCustomer = await db
      .insert(schema.customers)
      .values({
        tenantId: req.tenantId,
        name,
        phone: phone || null,
        email: email || null,
        address: address || null,
        notes: notes || null,
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
    const customerId = parseInt(req.params.id);
    const customerSales = await db.query.sales.findMany({
      where: and(eq(schema.sales.customerId, customerId), eq(schema.sales.tenantId, req.tenantId)),
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

// List sales history
router.get("/sales", async (req, res) => {
  try {
    const list = await db.query.sales.findMany({
      where: eq(schema.sales.tenantId, req.tenantId),
      with: { payments: true, returns: { with: { items: true } } },
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
    const { customerId, paymentType, creditDueDate, notes, items, totalAmount, totalCost, paidAmount } = req.body;

    if (!items || items.length === 0 || !paymentType) {
      return res.status(400).json({ message: "Çek məlumatları boş ola bilməz" });
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

    // Insert sale
    const newSale = await db
      .insert(schema.sales)
      .values({
        tenantId: req.tenantId,
        customerId: customerId || null,
        customerName,
        customerPhone,
        paymentType,
        creditDueDate: isCredit ? creditDueDate : null,
        notes: notes || null,
        saleDate: new Date().toISOString(),
        totalAmount: parseFloat(totalAmount),
        totalCost: parseFloat(totalCost),
        paymentStatus: isCredit ? "credit" : "paid",
      })
      .returning();

    const saleId = newSale[0].id;

    // Insert items
    for (const item of items) {
      await db.insert(schema.saleItems).values({
        tenantId: req.tenantId,
        saleId,
        productId: item.productId,
        quantity: parseFloat(item.quantity),
        salePrice: parseFloat(item.salePrice),
        purchasePrice: parseFloat(item.purchasePrice || "0"),
      });
    }

    // If partial initial payment was made on credit
    if (isCredit && paidAmount && parseFloat(paidAmount) > 0) {
      await db.insert(schema.creditPayments).values({
        tenantId: req.tenantId,
        saleId,
        paymentDate: new Date().toISOString(),
        amount: parseFloat(paidAmount),
      });
    }

    await logActivity(
      req,
      "CHECKOUT_SALE",
      `POS satışı həyata keçirdi: Çek № ${saleId} (Məbləğ: ${totalAmount} ₼, Müştəri: ${customerName}, Ödəniş: ${paymentType})`
    );

    res.json(newSale[0]);
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
        returns: { with: { items: true } }
      },
    });

    if (!sale) return res.status(404).json({ message: "Çek tapılmadı" });
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
      with: { payments: true },
    });

    if (!sale) return res.status(404).json({ message: "Satış tapılmadı" });

    // Calculate total already paid
    const alreadyPaid = sale.payments.reduce((acc, p) => acc + p.amount, 0);
    const remaining = sale.totalAmount - alreadyPaid;

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
      with: { payments: true },
    });

    if (!sale) return res.status(404).json({ message: "Satış tapılmadı" });

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

    if (totalPaid >= sale.totalAmount) {
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

    // 2. Create the Return record
    const newReturn = await db
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
      await db.insert(schema.returnItems).values({
        tenantId: req.tenantId,
        returnId,
        productId: item.productId,
        quantity: parseFloat(item.quantity),
        salePrice: parseFloat(item.salePrice),
        purchasePrice: parseFloat(item.purchasePrice || "0"),
        status: item.status, // "returned_to_stock" or "defective"
      });
    }

    // 4. Log Activity
    const saleLogMsg = saleId ? ` (Çek № ${saleId})` : "";
    await logActivity(
      req,
      "RETURN_ITEMS",
      `Malların geri qaytarılması həyata keçirildi: Qaytarış № ${returnId}${saleLogMsg} (Məbləğ: ${calculatedTotalAmount.toFixed(2)} ₼, Səbəb: ${reason || "Qeyd edilməyib"})`
    );

    res.json(newReturn[0]);
  } catch (error) {
    console.error("Return error:", error);
    res.status(500).json({ message: "Geri qaytarış tamamlanarkən xəta baş verdi" });
  }
});

// ----------------------------------------------------
// 5. CREDIT MONITORING ENDPOINTS
// ----------------------------------------------------

// List overdue customer credits
router.get("/credits/overdue", async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const overdueSales = await db.query.sales.findMany({
      where: and(
        eq(schema.sales.paymentStatus, "credit"),
        lte(schema.sales.creditDueDate, today),
        eq(schema.sales.tenantId, req.tenantId)
      ),
      with: { payments: true },
      orderBy: [desc(schema.sales.creditDueDate)],
    });

    const result = overdueSales.map((sale) => {
      const paid = sale.payments.reduce((sum, p) => sum + p.amount, 0);
      return {
        id: sale.id,
        customerId: sale.customerId,
        customerName: sale.customerName,
        customerPhone: sale.customerPhone,
        totalAmount: sale.totalAmount,
        remainingDebt: sale.totalAmount - paid,
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
    const today = new Date().toISOString().split("T")[0];
    const pendingSales = await db.query.sales.findMany({
      where: and(
        eq(schema.sales.paymentStatus, "credit"),
        gte(schema.sales.creditDueDate, today),
        eq(schema.sales.tenantId, req.tenantId)
      ),
      with: { payments: true },
      orderBy: [desc(schema.sales.creditDueDate)],
    });

    const result = pendingSales.map((sale) => {
      const paid = sale.payments.reduce((sum, p) => sum + p.amount, 0);
      return {
        id: sale.id,
        customerId: sale.customerId,
        customerName: sale.customerName,
        customerPhone: sale.customerPhone,
        totalAmount: sale.totalAmount,
        remainingDebt: sale.totalAmount - paid,
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
    const todayCost = Math.max(0, rawTodayCost - todayRecoveredCost);
    const todayProfit = todayRevenue - todayCost;

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
    const monthCost = Math.max(0, rawMonthCost - monthRecoveredCost);
    const monthProfit = monthRevenue - monthCost;

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
    const allProducts = await db.select().from(schema.products).where(eq(schema.products.tenantId, req.tenantId));
    let totalStockValue = 0;
    let lowStockCount = 0;

    // Fetch alert limit
    const settingsList = await db.select().from(schema.settings).where(eq(schema.settings.tenantId, req.tenantId)).limit(1);
    const lowStockAlertCount = settingsList[0]?.lowStockAlertCount || 5;

    for (const product of allProducts) {
      const restockedResult = await db
        .select({ total: sql`SUM(quantity)` })
        .from(schema.stockEntries)
        .where(and(eq(schema.stockEntries.productId, product.id), eq(schema.stockEntries.tenantId, req.tenantId)));
      const totalRestocked = parseFloat((restockedResult[0]?.total as string) || "0");

      const soldResult = await db
        .select({ total: sql`SUM(quantity)` })
        .from(schema.saleItems)
        .where(and(eq(schema.saleItems.productId, product.id), eq(schema.saleItems.tenantId, req.tenantId)));
      const totalSold = parseFloat((soldResult[0]?.total as string) || "0");

      // Calculate total returned back to stock
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

      const currentQty = totalRestocked - totalSold + totalReturned;

      const latestEntry = await db
        .select({ price: schema.stockEntries.purchasePrice })
        .from(schema.stockEntries)
        .where(and(eq(schema.stockEntries.productId, product.id), eq(schema.stockEntries.tenantId, req.tenantId)))
        .orderBy(desc(schema.stockEntries.entryDate))
        .limit(1);
      const lastPurchasePrice = latestEntry[0]?.price || 0;

      totalStockValue += currentQty * lastPurchasePrice;

      if (currentQty < lowStockAlertCount) {
        lowStockCount++;
      }
    }

    // 4. Calculate Customer Credit Debts
    const activeCredits = await db.query.sales.findMany({
      where: and(eq(schema.sales.paymentStatus, "credit"), eq(schema.sales.tenantId, req.tenantId)),
      with: { payments: true }
    });

    const totalCreditDebt = activeCredits.reduce((sum, sale) => {
      const paid = sale.payments.reduce((pSum, p) => pSum + p.amount, 0);
      return sum + (sale.totalAmount - paid);
    }, 0);

    const overdueCreditsCount = activeCredits.filter(sale => {
      if (!sale.creditDueDate) return false;
      const today = new Date().toISOString().split("T")[0];
      return sale.creditDueDate <= today;
    }).length;

    // 5. Calculate our own debts to suppliers
    const myDebts = await db.query.stockEntries.findMany({
      where: and(eq(schema.stockEntries.paidStatus, "credit"), eq(schema.stockEntries.tenantId, req.tenantId))
    });
    const myTotalDebt = myDebts.reduce((sum, d) => sum + (d.quantity * d.purchasePrice), 0);

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

    const allProducts = await db.select().from(schema.products).where(eq(schema.products.tenantId, req.tenantId));
    const lowStockAlerts = [];

    for (const product of allProducts) {
      const restockedResult = await db
        .select({ total: sql`SUM(quantity)` })
        .from(schema.stockEntries)
        .where(and(eq(schema.stockEntries.productId, product.id), eq(schema.stockEntries.tenantId, req.tenantId)));
      const totalRestocked = parseFloat((restockedResult[0]?.total as string) || "0");

      const soldResult = await db
        .select({ total: sql`SUM(quantity)` })
        .from(schema.saleItems)
        .where(and(eq(schema.saleItems.productId, product.id), eq(schema.saleItems.tenantId, req.tenantId)));
      const totalSold = parseFloat((soldResult[0]?.total as string) || "0");

      const currentQty = totalRestocked - totalSold;

      if (currentQty <= limitCount) {
        lowStockAlerts.push({
          productId: product.id,
          productName: product.name,
          currentQuantity: currentQty,
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
    
    // Auto-provision settings card if not found for some reason
    if (list.length === 0) {
      const newSettings = await db
        .insert(schema.settings)
        .values({
          tenantId: req.tenantId,
          storeName: "Yeni Mağaza",
        })
        .returning();
      return res.json(newSettings[0]);
    }
    
    res.json(list[0]);
  } catch (error) {
    res.status(500).json({ message: "Ayarları gətirərkən xəta baş verdi" });
  }
});

router.put("/settings", requireAdmin, async (req, res) => {
  try {
    const payload = req.body;
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

// List all users
router.get("/users", requireAdmin, async (req, res) => {
  try {
    const list = await db
      .select({
        id: schema.users.id,
        username: schema.users.username,
        role: schema.users.role,
      })
      .from(schema.users)
      .where(eq(schema.users.tenantId, req.tenantId))
      .orderBy(schema.users.username);
    res.json(list);
  } catch (error) {
    res.status(500).json({ message: "İstifadəçiləri gətirərkən xəta baş verdi" });
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

export default router;
