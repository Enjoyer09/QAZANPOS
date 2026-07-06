import { Router } from "express";
import { db } from "../db/index.js";
import * as schema from "../db/schema.js";
import { eq, and, sql, desc, asc, inArray } from "drizzle-orm";
import { hashPassword } from "../lib/auth.js";
import { AuthenticatedRequest, requireAdmin, checkUserPermission, logActivity, fetchTenantStockMetrics, verifyTenantLimit, computeFIFOSaleCost } from "./helpers.js";
import { sendTelegramNotification } from "../lib/telegram.js";

export default function stockRoutes(): Router {
  const router = Router();

  // ─── Stock Entries ──────────────────────────────────────────────────────

  router.get("/stock/entries", async (req: AuthenticatedRequest, res) => {
    try {
      if (!await checkUserPermission(req, "staffCanViewStock")) {
        return res.status(403).json({ message: "Anbar mədaxil tarixçəsinə giriş administrator tərəfindən məhdudlaşdırılıb" });
      }
      const entries = await db.query.stockEntries.findMany({
        where: eq(schema.stockEntries.tenantId, req.tenantId),
        with: { product: true, serials: true },
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
        applyEdv: entry.applyEdv,
        warehouseId: entry.warehouseId,
        serialNumbers: entry.serials ? entry.serials.map(s => s.serialNumber) : [],
      }));

      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Mədaxilləri gətirərkən xəta baş verdi" });
    }
  });

  // Create stock entry
  router.post("/stock/entries", async (req: AuthenticatedRequest, res) => {
    try {
      if (!await checkUserPermission(req, "staffCanViewStock")) {
        return res.status(403).json({ message: "Anbara mədaxil etmək səlahiyyətiniz yoxdur" });
      }

      const { productId, quantity, purchasePrice, supplier, notes, paymentType, creditDueDate, vendorId, serialNumbers, bankName, applyEdv, warehouseId } = req.body;

      if (!productId || !quantity || !purchasePrice || !paymentType) {
        return res.status(400).json({ message: "Məcburi sahələri doldurun" });
      }

      const isCredit = paymentType === "Nisyə";
      if (isCredit && !creditDueDate) {
        return res.status(400).json({ message: "Nisyə üçün son tarix daxil edilməlidir" });
      }

      let targetWarehouseId = warehouseId ? parseInt(warehouseId) : null;
      if (!targetWarehouseId) {
        const defaultWarehouse = await db.query.warehouses.findFirst({
          where: (w: any, { eq, and }: any) => and(eq(w.tenantId, req.tenantId), eq(w.isDefault, 1))
        });
        if (defaultWarehouse) targetWarehouseId = defaultWarehouse.id;
      }

      const productList = await db.select().from(schema.products)
        .where(and(eq(schema.products.id, productId), eq(schema.products.tenantId, req.tenantId))).limit(1);
      if (productList.length === 0) return res.status(404).json({ message: "Məhsul tapılmadı" });

      const product = productList[0];
      const isSerialized = product.trackingType === "serialized";
      const isSerializedInput = (serialNumbers && Array.isArray(serialNumbers) && serialNumbers.length > 0);

      if (isSerialized || isSerializedInput) {
        if (!serialNumbers || !Array.isArray(serialNumbers) || serialNumbers.length !== parseInt(quantity)) {
          return res.status(400).json({ message: `Serial nömrəli daxiletmə üçün dəqiq ${parseInt(quantity)} ədəd serial nömrəsi daxil edilməlidir` });
        }
        const uniqueSerialsInput = new Set(serialNumbers.map((s: string) => s.trim().toUpperCase()));
        if (uniqueSerialsInput.size !== serialNumbers.length) {
          return res.status(400).json({ message: "Daxil edilən serial nömrələrində təkrarlanma var" });
        }
        for (const sNum of serialNumbers) {
          const cleaned = sNum.trim().toUpperCase();
          const existing = await db.query.productSerials.findFirst({
            where: and(eq(schema.productSerials.serialNumber, cleaned), eq(schema.productSerials.tenantId, req.tenantId), inArray(schema.productSerials.status, ["in_stock", "sold"])),
          });
          if (existing) return res.status(400).json({ message: `Serial nömrə (${cleaned}) artıq bazada mövcuddur (Status: ${existing.status})` });
        }
      }

      const newEntry = await db.transaction(async (tx) => {
        const entry = await tx.insert(schema.stockEntries).values({
          tenantId: req.tenantId, productId, vendorId: vendorId ? parseInt(vendorId) : null,
          quantity: parseFloat(quantity), purchasePrice: parseFloat(purchasePrice),
          supplier: supplier || null, notes: notes || null, paymentType,
          bankName: paymentType === "Kart" ? (bankName || null) : null,
          creditDueDate: isCredit ? creditDueDate : null,
          entryDate: new Date().toISOString(), paidStatus: isCredit ? "credit" : "paid",
          applyEdv: applyEdv !== undefined && applyEdv !== null ? (applyEdv ? 1 : 0) : 1,
          warehouseId: targetWarehouseId,
        }).returning();
        const entryId = entry[0].id;

        if ((isSerialized || isSerializedInput) && serialNumbers) {
          for (const sNum of serialNumbers) {
            await tx.insert(schema.productSerials).values({
              tenantId: req.tenantId, productId, stockEntryId: entryId,
              serialNumber: sNum.trim().toUpperCase(), status: "in_stock",
              createdAt: new Date().toISOString(), warehouseId: targetWarehouseId,
            });
          }
        }
        return entry[0];
      });

      await logActivity(req, "CREATE_STOCK_ENTRY",
        `Anbara mədaxil etdi: ${quantity} ${product.unit} '${product.name}' (Alış qiyməti: ${purchasePrice} ₼, Tədarükçü: ${supplier || "Yoxdur"}, Ödəniş: ${paymentType})`);

      res.json(newEntry);
      sendTelegramNotification(req.tenantId, `📦 <b>Yeni Mal Mədaxili!</b>\n\n<b>Məhsul:</b> ${product.name}\n<b>Miqdar:</b> ${quantity} ${product.unit}\n<b>Alış Qiyməti:</b> <code>${purchasePrice} ₼</code>\n<b>Tədarükçü:</b> ${supplier || "Yoxdur"}\n<b>Ödəniş Üsulu:</b> ${paymentType}`).catch(() => {});
    } catch (error: any) {
      console.error("Stock entry error:", error);
      res.status(500).json({ message: "Mədaxil edilərkən xəta baş verdi: " + error.message });
    }
  });

  // Stock levels
  router.get("/stock/levels", async (req: AuthenticatedRequest, res) => {
    try {
      const warehouseIdStr = req.query.warehouseId as string;
      const warehouseId = warehouseIdStr ? parseInt(warehouseIdStr) : undefined;
      const { allProducts, metrics } = await fetchTenantStockMetrics(req.tenantId, warehouseId);

      const maxSaleIds = db.select({
        productId: schema.saleItems.productId,
        maxId: sql`max(${schema.saleItems.id})`.as("max_id")
      }).from(schema.saleItems).where(eq(schema.saleItems.tenantId, req.tenantId))
        .groupBy(schema.saleItems.productId).as("max_sale_ids");

      const latestSales = await db.select({
        productId: schema.saleItems.productId, price: schema.saleItems.salePrice
      }).from(schema.saleItems).innerJoin(maxSaleIds, eq(schema.saleItems.id, maxSaleIds.maxId));

      const latestSalesMap = new Map<number, number>();
      latestSales.forEach(s => latestSalesMap.set(s.productId, s.price));

      const serialsConditions = [eq(schema.productSerials.tenantId, req.tenantId), eq(schema.productSerials.status, "in_stock")];
      if (warehouseId) serialsConditions.push(eq(schema.productSerials.warehouseId, warehouseId));

      const allSerials = await db.select({
        productId: schema.productSerials.productId, serialNumber: schema.productSerials.serialNumber
      }).from(schema.productSerials).where(and(...serialsConditions));

      const serialsMap = new Map<number, string[]>();
      allSerials.forEach(s => {
        if (!serialsMap.has(s.productId)) serialsMap.set(s.productId, []);
        serialsMap.get(s.productId)!.push(s.serialNumber);
      });

      const stockLevels = [];
      for (const product of allProducts) {
        const metric = metrics.get(product.id)!;
        const lastPurchasePrice = metric.nextUnitCost;
        const lastSalePrice = latestSalesMap.get(product.id) ?? lastPurchasePrice;
        const activeSerials = serialsMap.get(product.id) || [];

        stockLevels.push({
          productId: product.id, productName: product.name, category: product.category,
          unit: product.unit, currentQuantity: metric.currentQuantity, lastPurchasePrice,
          lastSalePrice, totalValue: metric.totalValue, trackingType: product.trackingType,
          activeSerials, lastPurchaseDate: metric.lastPurchaseDate,
          barcode: product.barcode, description: product.description,
        });
      }
      res.json(stockLevels);
    } catch (error: any) {
      console.error("Stock levels error:", error);
      res.status(500).json({ message: "Anbar qalıqlarını hesablayarkən xəta baş verdi" });
    }
  });

  // Supplier debts
  router.get("/stock/my-debts", requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const debts = await db.query.stockEntries.findMany({
        where: and(eq(schema.stockEntries.paidStatus, "credit"), eq(schema.stockEntries.tenantId, req.tenantId)),
        with: { product: true }, orderBy: [desc(schema.stockEntries.entryDate)],
      });

      const vendorReturns = await db.select({
        stockEntryId: schema.vendorReturnItems.stockEntryId,
        totalReturned: sql`SUM(${schema.vendorReturnItems.quantity})`
      }).from(schema.vendorReturnItems).where(eq(schema.vendorReturnItems.tenantId, req.tenantId))
        .groupBy(schema.vendorReturnItems.stockEntryId);

      const vrMap = new Map<number, number>();
      vendorReturns.forEach(v => { if (v.stockEntryId) vrMap.set(v.stockEntryId, parseFloat((v.totalReturned as string) || "0")); });

      const result = debts.map(d => {
        const returnedQty = vrMap.get(d.id) || 0;
        const remainingQty = Math.max(0, d.quantity - returnedQty);
        return { id: d.id, productId: d.productId, productName: d.product.name, quantity: d.quantity, purchasePrice: d.purchasePrice, totalAmount: remainingQty * d.purchasePrice, supplier: d.supplier, creditDueDate: d.creditDueDate, entryDate: d.entryDate };
      });
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Borclarımızı gətirərkən xəta baş verdi" });
    }
  });

  // Pay supplier debt
  router.patch("/stock/entries/:id/pay", requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const { paymentType, paymentFrom, notes } = req.body;

      const entry = await db.query.stockEntries.findFirst({
        where: and(eq(schema.stockEntries.id, id), eq(schema.stockEntries.tenantId, req.tenantId))
      });
      if (!entry) return res.status(404).json({ message: "Mədaxil tapılmadı" });

      await db.update(schema.stockEntries).set({ paidStatus: "paid" }).where(eq(schema.stockEntries.id, id));

      const productList = await db.select().from(schema.products)
        .where(and(eq(schema.products.id, entry.productId), eq(schema.products.tenantId, req.tenantId))).limit(1);
      const productName = productList[0] ? productList[0].name : `ID: ${entry.productId}`;

      const returnedResult = await db.select({ total: sql`SUM(quantity)` }).from(schema.vendorReturnItems)
        .where(and(eq(schema.vendorReturnItems.stockEntryId, id), eq(schema.vendorReturnItems.tenantId, req.tenantId)));
      const returnedQty = parseFloat((returnedResult[0]?.total as string) || "0");
      const debtAmount = Math.max(0, entry.quantity - returnedQty) * entry.purchasePrice;

      let vendorId = entry.vendorId;
      if (!vendorId && entry.supplier) {
        const v = await db.query.vendors.findFirst({ where: and(eq(schema.vendors.name, entry.supplier), eq(schema.vendors.tenantId, req.tenantId)) });
        if (v) vendorId = v.id;
      }

      if (vendorId) {
        await db.insert(schema.vendorPayments).values({
          tenantId: req.tenantId, vendorId, amount: debtAmount,
          paymentDate: new Date().toISOString(), paymentType: paymentType || "Nəğd",
          notes: notes || `Mədaxil №${entry.id} (${productName}) üzrə borc ödənişi (Mənbə: ${paymentFrom || "Əsas"})`,
        });
      }

      await logActivity(req, "PAY_SUPPLIER_DEBT",
        `Tədarükçüyə olan borcu ödədi: ${debtAmount.toFixed(2)} ₼ (Məhsul: '${productName}', Tədarükçü: ${entry.supplier || "Yoxdur"}, Kassadan: ${paymentFrom || "Əsas"})`);
      res.json({ message: "Borc uğurla ödənildi" });
    } catch (error) {
      res.status(500).json({ message: "Borc ödənilərkən xəta baş verdi" });
    }
  });

  // Edit stock entry
  router.put("/stock/entries/:id", async (req: AuthenticatedRequest, res) => {
    try {
      if (!await checkUserPermission(req, "staffCanViewStock")) {
        return res.status(403).json({ message: "Anbar mədaxilini redaktə etmək səlahiyyətiniz yoxdur" });
      }

      const id = parseInt(req.params.id);
      const { quantity, purchasePrice, paymentType, creditDueDate, supplier, notes, vendorId, adminPassword, bankName, applyEdv } = req.body;

      if (quantity === undefined || purchasePrice === undefined || !paymentType) {
        return res.status(400).json({ message: "Məcburi sahələri doldurun" });
      }
      if (!adminPassword) return res.status(400).json({ message: "Düzəliş üçün Admin şifrəsi tələb olunur" });

      const correctAdmin = await db.query.users.findFirst({
        where: and(eq(schema.users.tenantId, req.tenantId), eq(schema.users.role, "Admin"), eq(schema.users.password, hashPassword(adminPassword.trim())))
      });
      if (!correctAdmin) return res.status(401).json({ message: "Daxil etdiyiniz Admin şifrəsi yanlışdır" });

      const entry = await db.query.stockEntries.findFirst({
        where: and(eq(schema.stockEntries.id, id), eq(schema.stockEntries.tenantId, req.tenantId))
      });
      if (!entry) return res.status(404).json({ message: "Mədaxil tapılmadı" });

      const productList = await db.select().from(schema.products)
        .where(and(eq(schema.products.id, entry.productId), eq(schema.products.tenantId, req.tenantId))).limit(1);
      if (productList.length === 0) return res.status(404).json({ message: "Məhsul tapılmadı" });

      const product = productList[0];
      const serialCountResult = await db.select({ count: sql`count(*)` }).from(schema.productSerials)
        .where(eq(schema.productSerials.stockEntryId, id));
      const entryHasSerials = parseInt((serialCountResult[0]?.count as string) || "0") > 0;

      const parsedQty = parseFloat(quantity);
      const parsedPrice = parseFloat(purchasePrice);

      if ((product.trackingType === "serialized" || entryHasSerials) && parsedQty !== entry.quantity) {
        return res.status(400).json({ message: "Serial nömrəli məhsulun miqdarını birbaşa dəyişmək olmaz" });
      }

      if (parsedQty < entry.quantity) {
        const stockMetrics = await fetchTenantStockMetrics(req.tenantId, entry.warehouseId || undefined);
        const currentQuantity = stockMetrics.metrics.get(product.id)?.currentQuantity || 0;
        const difference = parsedQty - entry.quantity;
        if (currentQuantity + difference < 0) {
          return res.status(400).json({ message: `Düzəliş mümkün deyil: Qalıq miqdar mənfi ola bilməz (Mövcud qalıq: ${currentQuantity} ${product.unit}, Azaldılan miqdar: ${Math.abs(difference)} ${product.unit})` });
        }
      }

      let newPaidStatus = entry.paidStatus;
      if (paymentType === "Nisyə") {
        if (entry.paymentType !== "Nisyə") newPaidStatus = "credit";
      } else newPaidStatus = "paid";

      const updated = await db.update(schema.stockEntries).set({
        quantity: parsedQty, purchasePrice: parsedPrice, paymentType,
        bankName: paymentType === "Kart" ? (bankName || null) : null,
        creditDueDate: paymentType === "Nisyə" ? creditDueDate : null, paidStatus: newPaidStatus,
        supplier: supplier || null, notes: notes || null,
        vendorId: vendorId ? parseInt(vendorId) : null,
        applyEdv: applyEdv !== undefined && applyEdv !== null ? (applyEdv ? 1 : 0) : entry.applyEdv,
      }).where(eq(schema.stockEntries.id, id)).returning();

      await logActivity(req, "UPDATE_STOCK_ENTRY",
        `Mədaxil №${id} düzəliş edildi: Miqdar: ${entry.quantity} -> ${parsedQty}, Alış: ${entry.purchasePrice} -> ${parsedPrice}, Ödəniş: ${entry.paymentType} -> ${paymentType}`);
      res.json(updated[0]);
    } catch (error: any) {
      console.error("Update stock entry error:", error);
      res.status(500).json({ message: "Mədaxil düzəlişi zamanı xəta baş verdi: " + error.message });
    }
  });

  // ─── Stock Transfers ────────────────────────────────────────────────────

  router.get("/stock/transfers", async (req: AuthenticatedRequest, res) => {
    try {
      const transfers = await db.select({
        id: schema.stockTransfers.id, tenantId: schema.stockTransfers.tenantId,
        fromWarehouseId: schema.stockTransfers.fromWarehouseId, toWarehouseId: schema.stockTransfers.toWarehouseId,
        productId: schema.stockTransfers.productId, quantity: schema.stockTransfers.quantity,
        transferDate: schema.stockTransfers.transferDate, transferredBy: schema.stockTransfers.transferredBy,
        notes: schema.stockTransfers.notes, serialNumbers: schema.stockTransfers.serialNumbers,
        productName: schema.products.name,
        fromWarehouseName: sql`(SELECT name FROM warehouses WHERE id = ${schema.stockTransfers.fromWarehouseId})`,
        toWarehouseName: sql`(SELECT name FROM warehouses WHERE id = ${schema.stockTransfers.toWarehouseId})`,
      }).from(schema.stockTransfers).innerJoin(schema.products, eq(schema.stockTransfers.productId, schema.products.id))
        .where(eq(schema.stockTransfers.tenantId, req.tenantId)).orderBy(desc(schema.stockTransfers.id));
      res.json(transfers);
    } catch (error: any) {
      res.status(500).json({ message: "Yerdəyişmə tarixçəsini çəkərkən xəta: " + error.message });
    }
  });

  router.post("/stock/transfers", async (req: AuthenticatedRequest, res) => {
    try {
      const { fromWarehouseId, toWarehouseId, productId, quantity, notes, serialNumbers } = req.body;
      if (!fromWarehouseId || !toWarehouseId || !productId || !quantity) {
        return res.status(400).json({ message: "Məlumatlar tam doldurulmayıb" });
      }
      if (fromWarehouseId === toWarehouseId) {
        return res.status(400).json({ message: "Eyni anbardan eyni anbara yerdəyişmə edilə bilməz" });
      }

      const product = await db.query.products.findFirst({ where: (p: any, { eq, and }: any) => and(eq(p.tenantId, req.tenantId), eq(p.id, productId)) });
      if (!product) return res.status(404).json({ message: "Məhsul tapılmadı" });

      const sourceMetrics = await fetchTenantStockMetrics(req.tenantId, parseInt(fromWarehouseId));
      const productMetric = sourceMetrics.metrics.get(parseInt(productId));
      const currentQtyInSource = productMetric ? productMetric.currentQuantity : 0;
      if (currentQtyInSource < parseInt(quantity)) {
        return res.status(400).json({ message: `Göndərən anbarda kifayət qədər məhsul yoxdur (Mövcuddur: ${currentQtyInSource})` });
      }

      let serialsList: string[] = [];
      if (product.trackingType === "serial") {
        if (!serialNumbers || !Array.isArray(serialNumbers) || serialNumbers.length !== parseInt(quantity)) {
          return res.status(400).json({ message: `Serial nömrələri düzgün təqdim edilməyib. ${quantity} ədəd serial lazımdır.` });
        }
        serialsList = serialNumbers;
        const existingSerials = await db.select().from(schema.productSerials).where(and(eq(schema.productSerials.tenantId, req.tenantId), eq(schema.productSerials.productId, parseInt(productId)), eq(schema.productSerials.warehouseId, parseInt(fromWarehouseId)), eq(schema.productSerials.status, "in_stock")));
        const existingSerialsSet = new Set(existingSerials.map(s => s.serialNumber));
        const invalidSerials = serialsList.filter(s => !existingSerialsSet.has(s));
        if (invalidSerials.length > 0) return res.status(400).json({ message: `Konkret seriallar göndərən anbarda tapılmadı: ${invalidSerials.join(", ")}` });

        for (const s of serialsList) {
          await db.update(schema.productSerials).set({ warehouseId: parseInt(toWarehouseId) })
            .where(and(eq(schema.productSerials.tenantId, req.tenantId), eq(schema.productSerials.productId, parseInt(productId)), eq(schema.productSerials.serialNumber, s)));
        }
      }

      const [transfer] = await db.insert(schema.stockTransfers).values({
        tenantId: req.tenantId, fromWarehouseId: parseInt(fromWarehouseId), toWarehouseId: parseInt(toWarehouseId),
        productId: parseInt(productId), quantity: parseFloat(quantity),
        transferDate: new Date().toISOString(),
        transferredBy: String(req.headers["x-user-username"] || req.query.username || "Sistem"),
        notes: notes || null, serialNumbers: serialsList.length > 0 ? JSON.stringify(serialsList) : null,
      }).returning();

      await logActivity(req, "STOCK_TRANSFER", `${quantity} ədəd '${product.name}' məhsulu yerdəyişmə edildi. Anbar: ${fromWarehouseId} -> ${toWarehouseId}`);
      res.json(transfer);
    } catch (error: any) {
      res.status(500).json({ message: "Yerdəyişmə zamanı xəta baş verdi: " + error.message });
    }
  });

  // ─── Stock Adjustments (Sayım) ──────────────────────────────────────────

  router.get("/stock/adjustments", async (req: AuthenticatedRequest, res) => {
    try {
      const adjustments = await db.select().from(schema.stockAdjustments)
        .where(eq(schema.stockAdjustments.tenantId, req.tenantId))
        .orderBy(desc(schema.stockAdjustments.date));
      res.json(adjustments);
    } catch (error) {
      res.status(500).json({ message: "Sayım tənzimləmələrini gətirərkən xəta baş verdi" });
    }
  });

  router.post("/stock/adjust", async (req: AuthenticatedRequest, res) => {
    try {
      const adjustments = Array.isArray(req.body) ? req.body : [req.body];
      const created = [];

      for (const adj of adjustments) {
        const { productId, warehouseId, type, quantity, notes } = adj;
        if (!productId || !warehouseId || !type || !quantity) {
          return res.status(400).json({ message: "Məlumatlar tam doldurulmayıb" });
        }

        const [record] = await db.insert(schema.stockAdjustments).values({
          tenantId: req.tenantId, productId: parseInt(productId), warehouseId: parseInt(warehouseId),
          type, quantity: parseFloat(quantity), date: new Date().toISOString(),
          adjustedBy: String(req.headers["x-user-username"] || "Sistem"),
          notes: notes || null,
        }).returning();
        created.push(record);
      }

      await logActivity(req, "STOCK_ADJUST", `Sayım tənzimləməsi tamamlandı: ${created.length} məhsul`);
      res.json({ success: true, adjusted: created });
    } catch (error: any) {
      res.status(500).json({ message: "Sayım tənzimləməsi zamanı xəta: " + error.message });
    }
  });

  // ─── Held Sales (Cart Hold/Resume) ──────────────────────────────────────

  router.get("/held-sales", async (req: AuthenticatedRequest, res) => {
    try {
      const held = await db.select().from(schema.heldSales)
        .where(eq(schema.heldSales.tenantId, req.tenantId))
        .orderBy(desc(schema.heldSales.heldAt));
      res.json(held);
    } catch (error) {
      res.status(500).json({ message: "Saxlanmış satışları gətirərkən xəta baş verdi" });
    }
  });

  router.post("/held-sales", async (req: AuthenticatedRequest, res) => {
    try {
      const { basketJson, label, customerId, customerName, paymentType, notes, warehouseId } = req.body;
      const heldBy = String(req.headers["x-user-username"] || req.query.username || "Sistem");
      const [held] = await db.insert(schema.heldSales).values({
        tenantId: req.tenantId, basketJson, label: label || null,
        customerId: customerId || null, customerName: customerName || null,
        paymentType: paymentType || "Nəğd", notes: notes || null,
        heldBy, heldAt: new Date().toISOString(),
        warehouseId: warehouseId || null,
      }).returning();
      res.json(held);
    } catch (error) {
      res.status(500).json({ message: "Satış saxlanılarkən xəta baş verdi" });
    }
  });

  router.delete("/held-sales/:id", async (req: AuthenticatedRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      await db.delete(schema.heldSales).where(and(eq(schema.heldSales.id, id), eq(schema.heldSales.tenantId, req.tenantId)));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Saxlanmış satış silinərkən xəta baş verdi" });
    }
  });

  // ─── Safe Transfers ─────────────────────────────────────────────────────

  router.get("/safe-transfers", async (req: AuthenticatedRequest, res) => {
    try {
      const transfers = await db.select().from(schema.safeTransfers)
        .where(eq(schema.safeTransfers.tenantId, req.tenantId)).orderBy(desc(schema.safeTransfers.date));
      res.json(transfers);
    } catch (error) {
      res.status(500).json({ message: "Seyf əməliyyatlarını gətirərkən xəta baş verdi" });
    }
  });

  router.post("/safe-transfers", async (req: AuthenticatedRequest, res) => {
    try {
      const { amount, type, description } = req.body;
      const amt = parseFloat(amount);
      if (isNaN(amt) || amt <= 0) return res.status(400).json({ message: "Düzgün məbləğ daxil edin" });

      const [transfer] = await db.insert(schema.safeTransfers).values({
        tenantId: req.tenantId, amount: amt, type,
        description: description || null, date: new Date().toISOString(),
        username: String(req.headers["x-user-username"] || "Sistem"),
      }).returning();

      let actionDesc = "";
      if (type === "kassa_to_safe") actionDesc = "Kassadan Seyfə köçürmə";
      if (type === "safe_deposit") actionDesc = "Seyfə mədaxil";
      if (type === "safe_withdrawal") actionDesc = "Seyfdən məxaric";
      await logActivity(req, "SAFE_TRANSFER", `${actionDesc}: ${amt.toFixed(2)} AZN qeydə alındı`);

      res.json(transfer);
    } catch (error) {
      res.status(500).json({ message: "Seyf əməliyyatı zamanı xəta baş verdi" });
    }
  });

  // ─── Procurement Drafts ────────────────────────────────────────────────

  router.get("/stock/procurement-drafts", async (req: AuthenticatedRequest, res) => {
    try {
      const products = await db.select().from(schema.products).where(and(eq(schema.products.tenantId, req.tenantId), eq(schema.products.isArchived, 0)));
      const vendorsList = await db.select().from(schema.vendors).where(eq(schema.vendors.tenantId, req.tenantId));
      const draftMap: Record<number, { vendorName: string; items: any[] }> = {};

      for (const prod of products) {
        const currentStock = 0; // Would need stock metrics
        const minLimit = Number(prod.minStockLimit) || 0;
        if (minLimit > 0) {
          const vendorId = prod.vendorId || 0;
          let vendorName = "Təyin Edilməyib";
          if (vendorId) {
            const v = vendorsList.find(v => v.id === vendorId);
            if (v) vendorName = v.name;
          }
          if (!draftMap[vendorId]) draftMap[vendorId] = { vendorName, items: [] };
          draftMap[vendorId].items.push({
            productId: prod.id, productName: prod.name, barcode: prod.barcode,
            currentStock, minStockLimit: minLimit,
            suggestedOrderQty: Math.max(1, minLimit * 2 - currentStock),
          });
        }
      }
      res.json(Object.values(draftMap));
    } catch (error) {
      res.status(500).json({ message: "Təchizat siyahısı hazırlanarkən xəta baş verdi" });
    }
  });

  // ─── Stock Metrics per product ──────────────────────────────────────────

  router.get("/stock/metrics/:productId", async (req: AuthenticatedRequest, res) => {
    try {
      const productId = parseInt(req.params.productId);
      const metrics = await computeFIFOSaleCost(productId, req.tenantId, 1);
      res.json({ unitCost: metrics });
    } catch (error) {
      res.status(500).json({ message: "Maya dəyəri hesablanarkən xəta baş verdi" });
    }
  });

  return router;
}
