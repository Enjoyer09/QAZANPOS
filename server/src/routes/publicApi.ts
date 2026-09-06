import { Router, Request, Response, NextFunction } from "express";
import { db } from "../db/index.js";
import * as schema from "../db/schema.js";
import { eq, and, sql, desc, asc, ilike, or } from "drizzle-orm";
import { fetchTenantStockMetrics, recordLedgerMovement } from "./helpers.js";

interface PublicApiRequest extends Request {
  tenantId: number;
  apiKeyName?: string;
  tenantSlug: string;
  tenantName?: string;
}


interface ProcessedOrderItem {
  productId: number;
  quantity: number;
  salePrice: number;
  purchasePrice: number;
  customNotes: string | null;
}

export default function publicApiRoutes(): Router {
  const router = Router();

  // Middleware: Authenticate via API Key or Tenant Slug
  const authenticatePublicApiKey = async (req: PublicApiRequest, res: Response, next: NextFunction) => {
    try {
      // 1. Try to read API Key from headers or query
      const apiKeyHeader = (req.headers["x-api-key"] || req.headers["x-auth-key"]) as string | undefined;
      const authHeader = req.headers["authorization"];
      const bearerKey = authHeader?.startsWith("Bearer qz_") ? authHeader.substring(7) : undefined;
      const queryKey = req.query.apiKey as string | undefined;

      const rawKey = apiKeyHeader || bearerKey || queryKey;

      if (rawKey) {
        const keyRecord = await db.query.apiKeys.findFirst({
          where: and(eq(schema.apiKeys.key, rawKey.trim()), eq(schema.apiKeys.isActive, 1)),
        });

        if (!keyRecord) {
          return res.status(401).json({
            error: "Unauthorized",
            message: "Təqdim edilən API açarı etibarsızdır və ya ləğv edilib.",
          });
        }

        // Check tenant status
        const tenant = await db.query.tenants.findFirst({
          where: eq(schema.tenants.id, keyRecord.tenantId),
        });

        if (!tenant || tenant.status === "suspended") {
          return res.status(403).json({
            error: "Forbidden",
            message: "Bu mağaza hesabı aktiv deyil və ya dayandırılıb.",
          });
        }

        req.tenantId = keyRecord.tenantId;
        req.apiKeyName = keyRecord.name;
        req.tenantSlug = tenant.slug;
        req.tenantName = tenant.name;

        // Async update lastUsedAt in background
        db.update(schema.apiKeys)
          .set({ lastUsedAt: new Date().toISOString() })
          .where(eq(schema.apiKeys.id, keyRecord.id))
          .catch(() => {});

        return next();
      }

      // 2. Fallback: Check if public read-only query param `?tenant=slug` is provided
      const tenantSlugQuery = (req.query.tenant || req.headers["x-tenant-slug"]) as string | undefined;
      if (tenantSlugQuery && req.method === "GET") {
        const tenant = await db.query.tenants.findFirst({
          where: eq(schema.tenants.slug, tenantSlugQuery.trim().toLowerCase()),
        });

        if (tenant && tenant.status !== "suspended") {
          req.tenantId = tenant.id;
          req.tenantSlug = tenant.slug;
          req.tenantName = tenant.name;
          return next();
        }
      }

      return res.status(401).json({
        error: "Unauthorized",
        message: "API Açarı tələb olunur. 'x-api-key' başlığı və ya '?apiKey=qz_live_...' parametri göndərin.",
      });
    } catch (err: any) {
      console.error("Public API Auth Error:", err);
      res.status(500).json({ error: "Internal Server Error", message: err.message });
    }
  };

  // Apply Public Auth Middleware to all routes in this module
  router.use(authenticatePublicApiKey);

  // --------------------------------------------------------------------------
  // 1. GET /public/catalog - Paginated catalog with live stock & search
  // --------------------------------------------------------------------------
  router.get("/public/catalog", async (req: PublicApiRequest, res: Response) => {
    try {
      const tenantId = req.tenantId!;
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 30));
      const offset = (page - 1) * limit;

      const categoryFilter = req.query.category as string | undefined;
      const searchQuery = (req.query.q || req.query.search) as string | undefined;
      const inStockOnly = req.query.inStockOnly === "true" || req.query.inStockOnly === "1";
      const sortBy = (req.query.sortBy as string) || "name_asc";

      // 1. Fetch live stock metrics
      const { allProducts, metrics } = await fetchTenantStockMetrics(tenantId);

      // Latest selling prices
      const maxSaleIds = db.select({
        productId: schema.saleItems.productId,
        maxId: sql`max(${schema.saleItems.id})`.as("max_id")
      }).from(schema.saleItems).where(eq(schema.saleItems.tenantId, tenantId))
        .groupBy(schema.saleItems.productId).as("max_sale_ids");

      const latestSales = await db.select({
        productId: schema.saleItems.productId, price: schema.saleItems.salePrice
      }).from(schema.saleItems).innerJoin(maxSaleIds, eq(schema.saleItems.id, maxSaleIds.maxId));

      const latestSalesMap = new Map<number, number>();
      latestSales.forEach(s => latestSalesMap.set(s.productId, s.price));

      // 2. Filter products
      let filtered = allProducts.filter(p => p.isArchived === 0);

      if (categoryFilter && categoryFilter.trim() !== "") {
        filtered = filtered.filter(p => p.category?.toLowerCase() === categoryFilter.trim().toLowerCase());
      }

      if (searchQuery && searchQuery.trim() !== "") {
        const term = searchQuery.trim().toLowerCase();
        filtered = filtered.filter(p => 
          p.name.toLowerCase().includes(term) ||
          (p.barcode && p.barcode.toLowerCase().includes(term)) ||
          (p.category && p.category.toLowerCase().includes(term))
        );
      }

      if (inStockOnly) {
        filtered = filtered.filter(p => {
          const m = metrics.get(p.id);
          return m && m.currentQuantity > 0;
        });
      }

      // Sort
      filtered.sort((a, b) => {
        const priceA = latestSalesMap.get(a.id) || metrics.get(a.id)?.nextUnitCost || 0;
        const priceB = latestSalesMap.get(b.id) || metrics.get(b.id)?.nextUnitCost || 0;

        if (sortBy === "price_asc") return priceA - priceB;
        if (sortBy === "price_desc") return priceB - priceA;
        if (sortBy === "name_desc") return b.name.localeCompare(a.name);
        if (sortBy === "newest") return b.id - a.id;
        return a.name.localeCompare(b.name);
      });

      const totalItems = filtered.length;
      const totalPages = Math.ceil(totalItems / limit);
      const paginatedProducts = filtered.slice(offset, offset + limit);

      // Clean, e-commerce friendly output
      const items = paginatedProducts.map(p => {
        const m = metrics.get(p.id);
        const currentStock = m ? m.currentQuantity : 0;
        const salePrice = latestSalesMap.get(p.id) || (m ? m.nextUnitCost : 0);

        return {
          id: p.id,
          name: p.name,
          category: p.category || "Ümumi",
          salePrice: salePrice,
          unit: p.unit || "ədəd",
          barcode: p.barcode || null,
          description: p.description || null,
          inStock: currentStock > 0,
          stockQuantity: Math.max(0, currentStock),
        };
      });

      res.json({
        store: {
          name: req.tenantName,
          slug: req.tenantSlug,
        },
        pagination: {
          total: totalItems,
          page,
          limit,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
        items,
      });
    } catch (error: any) {
      res.status(500).json({ error: "Kataloq gətirilərkən xəta: " + error.message });
    }
  });

  // --------------------------------------------------------------------------
  // 2. GET /public/categories - List categories with item counts
  // --------------------------------------------------------------------------
  router.get("/public/categories", async (req: PublicApiRequest, res: Response) => {
    try {
      const tenantId = req.tenantId!;
      const productsList = await db.select({
        category: schema.products.category,
      }).from(schema.products)
        .where(and(eq(schema.products.tenantId, tenantId), eq(schema.products.isArchived, 0)));

      const counts = new Map<string, number>();
      for (const p of productsList) {
        const cat = p.category?.trim() || "Ümumi";
        counts.set(cat, (counts.get(cat) || 0) + 1);
      }

      const categories = Array.from(counts.entries()).map(([name, count]) => ({
        name,
        productCount: count,
      })).sort((a, b) => a.name.localeCompare(b.name));

      res.json({
        totalCategories: categories.length,
        categories,
      });
    } catch (error: any) {
      res.status(500).json({ error: "Kateqoriyalar gətirilərkən xəta: " + error.message });
    }
  });

  // --------------------------------------------------------------------------
  // 3. GET /public/products/:id - Single product details
  // --------------------------------------------------------------------------
  router.get("/public/products/:id", async (req: PublicApiRequest, res: Response) => {
    try {
      const tenantId = req.tenantId!;
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Yanlış məhsul ID" });

      const product = await db.query.products.findFirst({
        where: and(
          eq(schema.products.id, id),
          eq(schema.products.tenantId, tenantId),
          eq(schema.products.isArchived, 0)
        ),
      });

      if (!product) {
        return res.status(404).json({ error: "Məhsul tapılmadı" });
      }

      const { metrics } = await fetchTenantStockMetrics(tenantId);
      const metric = metrics.get(product.id);
      const currentStock = metric ? metric.currentQuantity : 0;

      // Find latest sale price
      const latestSaleItem = await db.query.saleItems.findFirst({
        where: and(eq(schema.saleItems.productId, product.id), eq(schema.saleItems.tenantId, tenantId)),
        orderBy: [desc(schema.saleItems.id)],
      });

      const salePrice = latestSaleItem ? latestSaleItem.salePrice : (metric?.nextUnitCost || 0);

      res.json({
        id: product.id,
        name: product.name,
        category: product.category || "Ümumi",
        salePrice,
        unit: product.unit || "ədəd",
        barcode: product.barcode || null,
        description: product.description || null,
        inStock: currentStock > 0,
        stockQuantity: Math.max(0, currentStock),
      });
    } catch (error: any) {
      res.status(500).json({ error: "Məhsul məlumatı gətirilərkən xəta: " + error.message });
    }
  });

  // --------------------------------------------------------------------------
  // 4. POST /public/orders - Online order ingestion from company website
  // --------------------------------------------------------------------------
  router.post("/public/orders", async (req: PublicApiRequest, res: Response) => {
    try {
      const tenantId = req.tenantId!;
      const { customer, items, paymentType, notes, deliveryAddress } = req.body;

      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "Sifarişdə ən az 1 məhsul olmalıdır" });
      }

      if (!customer || !customer.name || !customer.phone) {
        return res.status(400).json({ error: "Müştəri adı və əlaqə nömrəsi tələb olunur" });
      }

      // 1. Find or create customer
      let customerRecord = await db.query.customers.findFirst({
        where: and(
          eq(schema.customers.tenantId, tenantId),
          eq(schema.customers.phone, String(customer.phone).trim())
        ),
      });

      if (!customerRecord) {
        const [newCust] = await db.insert(schema.customers).values({
          tenantId,
          name: String(customer.name).trim(),
          phone: String(customer.phone).trim(),
          email: customer.email ? String(customer.email).trim() : null,
          address: (deliveryAddress || customer.address || null),
          createdByName: "Vebsayt",
          loyaltyPoints: 0.0,
        }).returning();
        customerRecord = newCust;
      }

      // 2. Resolve default warehouse
      const defaultWarehouse = await db.query.warehouses.findFirst({
        where: and(eq(schema.warehouses.tenantId, tenantId), eq(schema.warehouses.isDefault, 1)),
      });
      const warehouseId = defaultWarehouse?.id || 1;

      // 3. Process items and calculate totals
      const { metrics } = await fetchTenantStockMetrics(tenantId);

      let calculatedTotal = 0;
      let calculatedCost = 0;
      const processedItems: ProcessedOrderItem[] = [];

      for (const item of items) {
        const pid = parseInt(item.productId);
        const qty = parseFloat(item.quantity);
        if (isNaN(pid) || isNaN(qty) || qty <= 0) {
          return res.status(400).json({ error: `Yanlış məhsul və ya miqdar: ${JSON.stringify(item)}` });
        }

        const prod = await db.query.products.findFirst({
          where: and(
            eq(schema.products.id, pid),
            eq(schema.products.tenantId, tenantId),
            eq(schema.products.isArchived, 0)
          ),
        });

        if (!prod) {
          return res.status(400).json({ error: `ID: ${pid} nömrəli məhsul tapılmadı` });
        }

        const m = metrics.get(prod.id);
        const latestSaleItem = await db.query.saleItems.findFirst({
          where: and(eq(schema.saleItems.productId, prod.id), eq(schema.saleItems.tenantId, tenantId)),
          orderBy: [desc(schema.saleItems.id)],
        });

        const defaultPrice = latestSaleItem ? latestSaleItem.salePrice : (m?.nextUnitCost || 0);
        const price = item.salePrice ? parseFloat(item.salePrice) : defaultPrice;
        const cost = m ? m.nextUnitCost : 0;

        calculatedTotal += qty * price;
        calculatedCost += qty * cost;

        processedItems.push({
          productId: prod.id,
          quantity: qty,
          salePrice: price,
          purchasePrice: cost,
          customNotes: item.notes || null,
        });
      }

      // 4. Save Sale inside transaction with inventory ledger deduction
      const orderResult = await db.transaction(async (tx) => {
        const [sale] = await tx.insert(schema.sales).values({
          tenantId,
          customerId: customerRecord!.id,
          customerName: customerRecord!.name,
          warehouseId,
          totalAmount: calculatedTotal,
          totalCost: calculatedCost,
          paymentType: paymentType || "Vebsayt Sifarişi",
          paymentStatus: "unpaid", // Online order pending fulfillment
          salesChannel: "Vebsayt",
          saleDate: new Date().toISOString(),
          notes: notes ? `[Vebsayt Sifarişi] ${notes}` : "[Vebsayt Sifarişi]",
        }).returning();

        for (const it of processedItems) {
          await tx.insert(schema.saleItems).values({
            tenantId,
            saleId: sale.id,
            productId: it.productId,
            quantity: it.quantity,
            salePrice: it.salePrice,
            purchasePrice: it.purchasePrice,
          });

          // Deduct from inventory ledger
          await recordLedgerMovement(tx, {
            tenantId,
            productId: it.productId,
            warehouseId,
            quantity: -it.quantity,
            movementType: "sale",
            referenceType: "sale",
            referenceId: sale.id,
            userId: null,
            username: `Vebsayt (${req.apiKeyName || "API"})`,
            unitPrice: it.salePrice,
            notes: `Vebsayt Sifarişi #${sale.id}`,
          });
        }

        // Activity log for store dashboard
        await tx.insert(schema.activityLogs).values({
          tenantId,
          username: "Vebsayt Botu",
          action: "ONLINE_ORDER",
          description: `🌐 Yeni Vebsayt Sifarişi qəbul edildi: #${sale.id} (${customerRecord!.name}) - Məbləğ: ${calculatedTotal.toFixed(2)} ₼`,
          timestamp: new Date().toISOString(),
        });

        return sale;
      });

      res.status(201).json({
        success: true,
        orderId: orderResult.id,
        orderNumber: `QZ-${String(orderResult.id).padStart(5, "0")}`,
        totalAmount: calculatedTotal,
        customer: {
          name: customerRecord.name,
          phone: customerRecord.phone,
        },
        status: "qəbul_edildi",
        createdAt: orderResult.saleDate,
        message: "Sifariş uğurla QAZANPOS sisteminə daxil edildi!",
      });
    } catch (error: any) {
      console.error("Public API Order Placement Error:", error);
      res.status(500).json({ error: "Sifariş qeyd edilərkən xəta: " + error.message });
    }
  });

  return router;
}
