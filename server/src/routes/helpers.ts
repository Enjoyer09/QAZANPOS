import { Router, Request, Response, NextFunction } from "express";
import { db } from "../db/index.js";
import * as schema from "../db/schema.js";
import { eq, and, sql, asc } from "drizzle-orm";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { hashPassword, verifyToken } from "../lib/auth.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Types ─────────────────────────────────────────────────────────────────

export interface AuthenticatedRequest extends Request {
  tenantId: number;
  tenantSlug: string;
  tenantReleaseTier: string;
  user?: { userId: number; username: string; role: string; tenantId: number };
}

// ─── Express Request Augmentation ───────────────────────────────────────────
declare global {
  namespace Express {
    interface Request {
      tenantId: number;
      tenantSlug: string;
      tenantReleaseTier: string;
    }
  }
}

// ─── Name Normalization ────────────────────────────────────────────────────

export const normalizeName = (text: string): string => {
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

// ─── Middleware ─────────────────────────────────────────────────────────────

export async function resolveTenant(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const rawHost = req.headers["x-tenant-host"];
  const host = typeof rawHost === "string" ? rawHost : (req.headers.host || "");
  const parts = host.split(".");
  
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

export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const publicPaths = ["/auth/login", "/auth/2fa-verify", "/settings"];
  if (publicPaths.includes(req.path)) {
    return next();
  }

  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Giriş edilməyib və ya token tapılmadı" });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ message: "Sessiyanızın vaxtı bitib və ya token etibarsızdır" });
  }

  if (decoded.tenantId !== req.tenantId) {
    return res.status(403).json({ message: "Bu biznes hesabı üzrə sorğu göndərmək səlahiyyətiniz yoxdur" });
  }

  req.user = decoded;
  req.headers["x-user-role"] = decoded.role;
  req.headers["x-user-username"] = decoded.username;
  
  next();
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const role = req.headers["x-user-role"] || req.query.role;
  if (role !== "Admin") {
    return res.status(403).json({ message: "Bu əməliyyat üçün yalnız Administrator səlahiyyəti tələb olunur." });
  }
  next();
}

export function requireSuperAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const role = req.headers["x-user-role"] || req.query.role;
  if (req.tenantSlug !== "super" || role !== "Admin") {
    return res.status(403).json({ message: "Bu əməliyyat üçün yalnız Platforma Administratoru səlahiyyəti tələb olunur." });
  }
  next();
}

export type PermissionKey = 'staffCanViewSalesHistory' | 'staffCanViewStock' | 'staffCanViewCustomers' | 'staffCanViewVendors' | 'staffCanViewExpenses' | 'staffCanViewStockBalances' | 'staffCanViewDebts' | 'staffCanManageCatalog';

export async function checkUserPermission(
  req: AuthenticatedRequest,
  permissionKey: PermissionKey
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

// ─── Activity Logging ──────────────────────────────────────────────────────

export async function logActivity(req: AuthenticatedRequest, action: string, description: string) {
  try {
    const role = req.headers["x-user-role"] || req.query.role;
    const username = req.headers["x-user-username"] || req.query.username || (role === "Admin" ? "admin" : "satici") || "Sistem";
    await db.insert(schema.activityLogs).values({
      tenantId: req.tenantId,
      username: String(username),
      action,
      description,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Failed to log activity:", error);
  }
}

// ─── Remaining Debt Helper ────────────────────────────────────────────────

/**
 * Compute the remaining debt for a credit sale.
 * Formula: max(0, totalAmount - totalPayments - totalReturns - loyaltyDiscount)
 */
export function computeRemainingDebt(
  sale: { totalAmount: number; loyaltyDiscountPaid?: number | null },
  payments: { amount: number }[],
  returns: { totalAmount: number }[] = []
): number {
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const totalReturned = returns.reduce((sum, r) => sum + r.totalAmount, 0);
  const loyaltyDiscount = Number(sale.loyaltyDiscountPaid) || 0;
  return Math.max(0, Math.round((sale.totalAmount - totalPaid - totalReturned - loyaltyDiscount) * 100) / 100);
}

// ─── Date Helpers ──────────────────────────────────────────────────────────

export function getMonthBoundaries() {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
  return { firstDay, lastDay };
}

// ─── SaaS Tier Limits ──────────────────────────────────────────────────────

export const TIER_LIMITS: Record<string, { products: number; sales: number; users: number }> = {
  free: { products: 10, sales: 20, users: 1 },
  mini: { products: 100, sales: 500, users: 3 },
  pro: { products: 1000, sales: 5000, users: 10 },
  enterprise: { products: Infinity, sales: Infinity, users: Infinity }
};

export async function verifyTenantLimit(tenantId: number, type: "products" | "sales" | "users") {
  const tenant = await db.query.tenants.findFirst({
    where: eq(schema.tenants.id, tenantId)
  });

  const tier = tenant?.billingTier || "free";
  const limits = TIER_LIMITS[tier] || TIER_LIMITS.free;
  const maxLimit = limits[type];

  if (maxLimit === Infinity) {
    return { allowed: true, current: 0, max: Infinity, tier };
  }

  let currentCount = 0;
  if (type === "products") {
    const result = await db
      .select({ count: sql`COUNT(id)` })
      .from(schema.products)
      .where(and(eq(schema.products.tenantId, tenantId), eq(schema.products.isArchived, 0)));
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

  return { allowed: currentCount < maxLimit, current: currentCount, max: maxLimit, tier };
}

// ─── FIFO Inventory Helpers ────────────────────────────────────────────────

export async function computeFIFOMetrics(productId: number, tenantId: number) {
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
    .where(and(eq(schema.returnItems.productId, productId), eq(schema.returnItems.tenantId, tenantId), eq(schema.returnItems.status, "returned_to_stock")));
  const totalReturned = parseFloat((returnedResult[0]?.total as string) || "0");

  const netSold = Math.max(0, totalSold - totalReturned);

  const vendorReturns = await db
    .select({
      stockEntryId: schema.vendorReturnItems.stockEntryId,
      totalReturned: sql`SUM(${schema.vendorReturnItems.quantity})`
    })
    .from(schema.vendorReturnItems)
    .where(and(eq(schema.vendorReturnItems.productId, productId), eq(schema.vendorReturnItems.tenantId, tenantId)))
    .groupBy(schema.vendorReturnItems.stockEntryId);

  const vrMap = new Map<number, number>();
  vendorReturns.forEach(v => {
    if (v.stockEntryId) vrMap.set(v.stockEntryId, parseFloat((v.totalReturned as string) || "0"));
  });

  let soldRemaining = netSold;
  let totalValue = 0;
  let nextUnitCost = 0;
  let foundNextUnit = false;

  for (const entry of entries) {
    const vrQty = vrMap.get(entry.id) || 0;
    const adjustedQuantity = Math.max(0, entry.quantity - vrQty);
    if (adjustedQuantity === 0) continue;

    if (soldRemaining >= adjustedQuantity) {
      soldRemaining -= adjustedQuantity;
    } else {
      const qtyLeft = adjustedQuantity - soldRemaining;
      soldRemaining = 0;
      totalValue += qtyLeft * entry.purchasePrice;
      if (!foundNextUnit) {
        nextUnitCost = entry.purchasePrice;
        foundNextUnit = true;
      }
    }
  }

  if (!foundNextUnit && entries.length > 0) {
    nextUnitCost = entries[entries.length - 1].purchasePrice;
  }

  return { totalValue, nextUnitCost };
}

export async function computeFIFOSaleCost(productId: number, tenantId: number, quantityToSell: number): Promise<number> {
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
    .where(and(eq(schema.returnItems.productId, productId), eq(schema.returnItems.tenantId, tenantId), eq(schema.returnItems.status, "returned_to_stock")));
  const totalReturned = parseFloat((returnedResult[0]?.total as string) || "0");

  const netSold = Math.max(0, totalSold - totalReturned);

  const vendorReturns = await db
    .select({
      stockEntryId: schema.vendorReturnItems.stockEntryId,
      totalReturned: sql`SUM(${schema.vendorReturnItems.quantity})`
    })
    .from(schema.vendorReturnItems)
    .where(and(eq(schema.vendorReturnItems.productId, productId), eq(schema.vendorReturnItems.tenantId, tenantId)))
    .groupBy(schema.vendorReturnItems.stockEntryId);

  const vrMap = new Map<number, number>();
  vendorReturns.forEach(v => {
    if (v.stockEntryId) vrMap.set(v.stockEntryId, parseFloat((v.totalReturned as string) || "0"));
  });

  let soldRemaining = netSold;
  const activeEntries = [];
  for (const entry of entries) {
    const vrQty = vrMap.get(entry.id) || 0;
    const adjustedQuantity = Math.max(0, entry.quantity - vrQty);
    if (adjustedQuantity === 0) continue;

    if (soldRemaining >= adjustedQuantity) {
      soldRemaining -= adjustedQuantity;
    } else {
      const qtyLeft = adjustedQuantity - soldRemaining;
      soldRemaining = 0;
      activeEntries.push({ ...entry, quantityLeft: qtyLeft });
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

export async function fetchTenantStockMetrics(tenantId: number, warehouseId?: number) {
  const allProducts = await db
    .select()
    .from(schema.products)
    .where(and(eq(schema.products.tenantId, tenantId), eq(schema.products.isArchived, 0)));

  const globalRestockedGroup = await db
    .select({ productId: schema.stockEntries.productId, totalRestocked: sql`SUM(${schema.stockEntries.quantity})` })
    .from(schema.stockEntries)
    .where(eq(schema.stockEntries.tenantId, tenantId))
    .groupBy(schema.stockEntries.productId);

  const globalSoldGroup = await db
    .select({ productId: schema.saleItems.productId, totalSold: sql`SUM(${schema.saleItems.quantity})` })
    .from(schema.saleItems)
    .where(eq(schema.saleItems.tenantId, tenantId))
    .groupBy(schema.saleItems.productId);

  const globalReturnedGroup = await db
    .select({ productId: schema.returnItems.productId, totalReturned: sql`SUM(${schema.returnItems.quantity})` })
    .from(schema.returnItems)
    .where(and(eq(schema.returnItems.tenantId, tenantId), eq(schema.returnItems.status, "returned_to_stock")))
    .groupBy(schema.returnItems.productId);

  const globalVendorReturnsGroup = await db
    .select({ productId: schema.vendorReturnItems.productId, totalReturned: sql`SUM(${schema.vendorReturnItems.quantity})` })
    .from(schema.vendorReturnItems)
    .where(eq(schema.vendorReturnItems.tenantId, tenantId))
    .groupBy(schema.vendorReturnItems.productId);

  const globalRestockedMap = new Map<number, number>();
  globalRestockedGroup.forEach(g => globalRestockedMap.set(g.productId, parseFloat((g.totalRestocked as string) || "0")));

  const globalSoldMap = new Map<number, number>();
  globalSoldGroup.forEach(g => globalSoldMap.set(g.productId, parseFloat((g.totalSold as string) || "0")));

  const globalReturnedMap = new Map<number, number>();
  globalReturnedGroup.forEach(g => globalReturnedMap.set(g.productId, parseFloat((g.totalReturned as string) || "0")));

  const globalVendorReturnedMap = new Map<number, number>();
  globalVendorReturnsGroup.forEach(g => globalVendorReturnedMap.set(g.productId, parseFloat((g.totalReturned as string) || "0")));

  const globalAdjustmentsGroup = await db
    .select({ productId: schema.stockAdjustments.productId, type: schema.stockAdjustments.type, totalQty: sql`SUM(${schema.stockAdjustments.quantity})` })
    .from(schema.stockAdjustments)
    .where(eq(schema.stockAdjustments.tenantId, tenantId))
    .groupBy(schema.stockAdjustments.productId, schema.stockAdjustments.type);

  const globalAdjustmentsMap = new Map<number, number>();
  globalAdjustmentsGroup.forEach(g => {
    const pid = g.productId;
    const qty = parseFloat((g.totalQty as string) || "0");
    const current = globalAdjustmentsMap.get(pid) || 0;
    const change = g.type === "found" ? qty : -qty;
    globalAdjustmentsMap.set(pid, current + change);
  });

  const adjustmentsMap = new Map<number, number>();
  if (warehouseId) {
    const adjustmentsGroup = await db
      .select({ productId: schema.stockAdjustments.productId, type: schema.stockAdjustments.type, totalQty: sql`SUM(${schema.stockAdjustments.quantity})` })
      .from(schema.stockAdjustments)
      .where(and(eq(schema.stockAdjustments.tenantId, tenantId), eq(schema.stockAdjustments.warehouseId, warehouseId)))
      .groupBy(schema.stockAdjustments.productId, schema.stockAdjustments.type);
    adjustmentsGroup.forEach(g => {
      const pid = g.productId;
      const qty = parseFloat((g.totalQty as string) || "0");
      const current = adjustmentsMap.get(pid) || 0;
      const change = g.type === "found" ? qty : -qty;
      adjustmentsMap.set(pid, current + change);
    });
  } else {
    allProducts.forEach(product => {
      adjustmentsMap.set(product.id, globalAdjustmentsMap.get(product.id) || 0);
    });
  }

  const restockedMap = new Map<number, number>();
  const soldMap = new Map<number, number>();
  const returnedMap = new Map<number, number>();
  const vendorReturnedMap = new Map<number, number>();
  const transferredOutMap = new Map<number, number>();
  const transferredInMap = new Map<number, number>();

  if (warehouseId) {
    const restockedGroup = await db
      .select({ productId: schema.stockEntries.productId, totalRestocked: sql`SUM(${schema.stockEntries.quantity})` })
      .from(schema.stockEntries)
      .where(and(eq(schema.stockEntries.tenantId, tenantId), eq(schema.stockEntries.warehouseId, warehouseId)))
      .groupBy(schema.stockEntries.productId);
    restockedGroup.forEach(g => restockedMap.set(g.productId, parseFloat((g.totalRestocked as string) || "0")));

    const soldGroup = await db
      .select({ productId: schema.saleItems.productId, totalSold: sql`SUM(${schema.saleItems.quantity})` })
      .from(schema.saleItems)
      .innerJoin(schema.sales, eq(schema.saleItems.saleId, schema.sales.id))
      .where(and(eq(schema.saleItems.tenantId, tenantId), eq(schema.sales.warehouseId, warehouseId)))
      .groupBy(schema.saleItems.productId);
    soldGroup.forEach(g => soldMap.set(g.productId, parseFloat((g.totalSold as string) || "0")));

    const returnedGroup = await db
      .select({ productId: schema.returnItems.productId, totalReturned: sql`SUM(${schema.returnItems.quantity})` })
      .from(schema.returnItems)
      .innerJoin(schema.returns, eq(schema.returnItems.returnId, schema.returns.id))
      .where(and(eq(schema.returnItems.tenantId, tenantId), eq(schema.returnItems.status, "returned_to_stock"), eq(schema.returns.warehouseId, warehouseId)))
      .groupBy(schema.returnItems.productId);
    returnedGroup.forEach(g => returnedMap.set(g.productId, parseFloat((g.totalReturned as string) || "0")));

    const vendorReturnsGroup = await db
      .select({ productId: schema.vendorReturnItems.productId, totalReturned: sql`SUM(${schema.vendorReturnItems.quantity})` })
      .from(schema.vendorReturnItems)
      .innerJoin(schema.vendorReturns, eq(schema.vendorReturnItems.vendorReturnId, schema.vendorReturns.id))
      .where(and(eq(schema.vendorReturnItems.tenantId, tenantId), eq(schema.vendorReturns.warehouseId, warehouseId)))
      .groupBy(schema.vendorReturnItems.productId);
    vendorReturnsGroup.forEach(g => vendorReturnedMap.set(g.productId, parseFloat((g.totalReturned as string) || "0")));

    const outGroup = await db
      .select({ productId: schema.stockTransfers.productId, totalQty: sql`SUM(${schema.stockTransfers.quantity})` })
      .from(schema.stockTransfers)
      .where(and(eq(schema.stockTransfers.tenantId, tenantId), eq(schema.stockTransfers.fromWarehouseId, warehouseId)))
      .groupBy(schema.stockTransfers.productId);
    outGroup.forEach(g => transferredOutMap.set(g.productId, parseFloat((g.totalQty as string) || "0")));

    const inGroup = await db
      .select({ productId: schema.stockTransfers.productId, totalQty: sql`SUM(${schema.stockTransfers.quantity})` })
      .from(schema.stockTransfers)
      .where(and(eq(schema.stockTransfers.tenantId, tenantId), eq(schema.stockTransfers.toWarehouseId, warehouseId)))
      .groupBy(schema.stockTransfers.productId);
    inGroup.forEach(g => transferredInMap.set(g.productId, parseFloat((g.totalQty as string) || "0")));
  } else {
    allProducts.forEach(product => {
      const pid = product.id;
      restockedMap.set(pid, globalRestockedMap.get(pid) || 0);
      soldMap.set(pid, globalSoldMap.get(pid) || 0);
      returnedMap.set(pid, globalReturnedMap.get(pid) || 0);
      vendorReturnedMap.set(pid, globalVendorReturnedMap.get(pid) || 0);
      transferredOutMap.set(pid, 0);
      transferredInMap.set(pid, 0);
    });
  }

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

  const vendorReturnsPerEntry = await db
    .select({ stockEntryId: schema.vendorReturnItems.stockEntryId, totalReturned: sql`SUM(${schema.vendorReturnItems.quantity})` })
    .from(schema.vendorReturnItems)
    .where(eq(schema.vendorReturnItems.tenantId, tenantId))
    .groupBy(schema.vendorReturnItems.stockEntryId);

  const vrMap = new Map<number, number>();
  vendorReturnsPerEntry.forEach(v => {
    if (v.stockEntryId) vrMap.set(v.stockEntryId, parseFloat((v.totalReturned as string) || "0"));
  });

  const entriesMap = new Map<number, typeof allEntries>();
  allEntries.forEach(entry => {
    if (!entriesMap.has(entry.productId)) {
      entriesMap.set(entry.productId, []);
    }
    entriesMap.get(entry.productId)!.push(entry);
  });

  const metrics = new Map<number, { currentQuantity: number; totalValue: number; nextUnitCost: number; lastPurchaseDate: string | null }>();

  for (const product of allProducts) {
    const productId = product.id;

    const totalRestocked = restockedMap.get(productId) || 0;
    const totalSold = soldMap.get(productId) || 0;
    const totalReturned = returnedMap.get(productId) || 0;
    const totalVendorReturned = vendorReturnedMap.get(productId) || 0;
    const totalTransferredOut = transferredOutMap.get(productId) || 0;
    const totalTransferredIn = transferredInMap.get(productId) || 0;
    const localAdjustments = adjustmentsMap.get(productId) || 0;

    const currentQuantity = totalRestocked - totalSold + totalReturned - totalVendorReturned - totalTransferredOut + totalTransferredIn + localAdjustments;

    const gRestocked = globalRestockedMap.get(productId) || 0;
    const gSold = globalSoldMap.get(productId) || 0;
    const gReturned = globalReturnedMap.get(productId) || 0;
    const gVendorReturned = globalVendorReturnedMap.get(productId) || 0;
    const gAdjustments = globalAdjustmentsMap.get(productId) || 0;
    const globalQuantity = gRestocked - gSold + gReturned - gVendorReturned + gAdjustments;

    const productEntries = entriesMap.get(productId) || [];
    const soldAdjustment = gAdjustments < 0 ? -gAdjustments : 0;
    const netSold = Math.max(0, gSold - gReturned + soldAdjustment);

    let soldRemaining = netSold;
    let globalTotalValue = 0;
    let nextUnitCost = 0;
    let foundNextUnit = false;

    for (const entry of productEntries) {
      const vrQty = vrMap.get(entry.id) || 0;
      const adjustedQuantity = Math.max(0, entry.quantity - vrQty);
      if (adjustedQuantity === 0) continue;

      if (soldRemaining >= adjustedQuantity) {
        soldRemaining -= adjustedQuantity;
      } else {
        const qtyLeft = adjustedQuantity - soldRemaining;
        soldRemaining = 0;
        globalTotalValue += qtyLeft * entry.purchasePrice;
        if (!foundNextUnit) {
          nextUnitCost = entry.purchasePrice;
          foundNextUnit = true;
        }
      }
    }

    if (!foundNextUnit && productEntries.length > 0) {
      nextUnitCost = productEntries[productEntries.length - 1].purchasePrice;
    }

    if (gAdjustments > 0) {
      globalTotalValue += gAdjustments * nextUnitCost;
    }

    const lastPurchaseDate = productEntries.length > 0 ? productEntries[productEntries.length - 1].entryDate : null;

    let totalValue = globalTotalValue;
    if (warehouseId) {
      if (globalQuantity > 0) {
        totalValue = (currentQuantity / globalQuantity) * globalTotalValue;
      } else {
        totalValue = currentQuantity * nextUnitCost;
      }
    }

    metrics.set(productId, { currentQuantity, totalValue, nextUnitCost, lastPurchaseDate });
  }

  return { allProducts, metrics };
}
