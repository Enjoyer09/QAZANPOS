import { Router } from "express";
import { db } from "../db/index.js";
import * as schema from "../db/schema.js";
import { eq, and, sql, desc, asc, inArray } from "drizzle-orm";
import { hashPassword } from "../lib/auth.js";
import { AuthenticatedRequest, requireAdmin, checkUserPermission, logActivity, fetchTenantStockMetrics, verifyTenantLimit, computeFIFOSaleCost, recordLedgerMovement } from "./helpers.js";

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

        await recordLedgerMovement(tx, {
          tenantId: req.tenantId,
          productId,
          warehouseId: targetWarehouseId,
          quantity: parseFloat(quantity),
          movementType: "stock_in",
          referenceType: "stock_entry",
          referenceId: entryId,
          userId: req.user?.userId || null,
          username: req.headers["x-user-username"] as string || null,
          unitPrice: parseFloat(purchasePrice),
          notes: `Anbara Mədaxil${supplier ? ` (Tədarükçü: ${supplier})` : ""}`,
        });

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

  // ─── Product Stock Movement History (Audit Trail) ────────────────────────
  router.get("/stock/movements", async (req: AuthenticatedRequest, res) => {
    try {
      if (!await checkUserPermission(req, "staffCanViewStock")) {
        return res.status(403).json({ message: "Anbar hərəkətlərinə baxış administrator tərəfindən məhdudlaşdırılıb" });
      }

      const productIdStr = (req.query.productId as string) || (req.query.product_id as string);
      if (!productIdStr) {
        return res.status(400).json({ message: "Məhsul ID-si tələb olunur" });
      }
      const productId = parseInt(productIdStr);
      if (isNaN(productId)) {
        return res.status(400).json({ message: "Yararsız Məhsul ID-si" });
      }

      const warehouseIdStr = req.query.warehouseId as string;
      const warehouseId = warehouseIdStr ? parseInt(warehouseIdStr) : undefined;
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;
      const filterType = req.query.type as string;

      // 1. Fetch target product details
      const productList = await db.select().from(schema.products)
        .where(and(eq(schema.products.id, productId), eq(schema.products.tenantId, req.tenantId)))
        .limit(1);

      if (productList.length === 0) {
        return res.status(404).json({ message: "Məhsul tapılmadı" });
      }
      const product = productList[0];

      // 2. Warehouses mapping
      const warehousesList = await db.select().from(schema.warehouses)
        .where(eq(schema.warehouses.tenantId, req.tenantId));
      const warehouseMap = new Map(warehousesList.map(w => [w.id, w.name]));

      const vendorList = await db.select().from(schema.vendors)
        .where(eq(schema.vendors.tenantId, req.tenantId));
      const vendorMap = new Map(vendorList.map(v => [v.id, v.name]));

      // 3. Stock Entries (Mədaxillər)
      const entryConditions = [
        eq(schema.stockEntries.productId, productId),
        eq(schema.stockEntries.tenantId, req.tenantId),
      ];
      if (warehouseId) {
        entryConditions.push(eq(schema.stockEntries.warehouseId, warehouseId));
      }
      const entries = await db.query.stockEntries.findMany({
        where: and(...entryConditions),
        with: { serials: true },
        orderBy: [asc(schema.stockEntries.entryDate), asc(schema.stockEntries.id)],
      });

      // 4. Sales Items (Satışlar)
      const salesQueryConditions = [
        eq(schema.saleItems.productId, productId),
        eq(schema.saleItems.tenantId, req.tenantId),
      ];
      if (warehouseId) {
        salesQueryConditions.push(eq(schema.sales.warehouseId, warehouseId));
      }
      const salesRows = await db
        .select({
          itemId: schema.saleItems.id,
          saleId: schema.sales.id,
          date: schema.sales.saleDate,
          quantity: schema.saleItems.quantity,
          price: schema.saleItems.salePrice,
          cost: schema.saleItems.purchasePrice,
          customerName: schema.sales.customerName,
          warehouseId: schema.sales.warehouseId,
          sellerName: schema.sales.sellerName,
          paymentType: schema.sales.paymentType,
        })
        .from(schema.saleItems)
        .innerJoin(schema.sales, eq(schema.saleItems.saleId, schema.sales.id))
        .where(and(...salesQueryConditions))
        .orderBy(asc(schema.sales.saleDate), asc(schema.saleItems.id));

      // 5. Customer Returns (Müştəri Qaytarmaları)
      const returnConditions = [
        eq(schema.returnItems.productId, productId),
        eq(schema.returnItems.tenantId, req.tenantId),
        eq(schema.returnItems.status, "returned_to_stock"),
      ];
      if (warehouseId) {
        returnConditions.push(eq(schema.returns.warehouseId, warehouseId));
      }
      const returnsRows = await db
        .select({
          itemId: schema.returnItems.id,
          returnId: schema.returns.id,
          date: schema.returns.returnDate,
          quantity: schema.returnItems.quantity,
          price: schema.returnItems.salePrice,
          reason: schema.returns.reason,
          customerName: schema.sales.customerName,
          warehouseId: schema.returns.warehouseId,
        })
        .from(schema.returnItems)
        .innerJoin(schema.returns, eq(schema.returnItems.returnId, schema.returns.id))
        .leftJoin(schema.sales, eq(schema.returns.saleId, schema.sales.id))
        .where(and(...returnConditions))
        .orderBy(asc(schema.returns.returnDate), asc(schema.returnItems.id));

      // 6. Vendor Returns (Tədarükçüyə Qaytarışlar)
      const vendorReturnConditions = [
        eq(schema.vendorReturnItems.productId, productId),
        eq(schema.vendorReturnItems.tenantId, req.tenantId),
      ];
      if (warehouseId) {
        vendorReturnConditions.push(eq(schema.vendorReturns.warehouseId, warehouseId));
      }
      const vendorReturnsRows = await db
        .select({
          itemId: schema.vendorReturnItems.id,
          vendorReturnId: schema.vendorReturns.id,
          date: schema.vendorReturns.returnDate,
          quantity: schema.vendorReturnItems.quantity,
          price: schema.vendorReturnItems.purchasePrice,
          notes: schema.vendorReturns.notes,
          supplierName: schema.vendors.name,
          warehouseId: schema.vendorReturns.warehouseId,
        })
        .from(schema.vendorReturnItems)
        .innerJoin(schema.vendorReturns, eq(schema.vendorReturnItems.vendorReturnId, schema.vendorReturns.id))
        .leftJoin(schema.vendors, eq(schema.vendorReturns.vendorId, schema.vendors.id))
        .where(and(...vendorReturnConditions))
        .orderBy(asc(schema.vendorReturns.returnDate), asc(schema.vendorReturnItems.id));

      // 7. Stock Transfers (Anbar Yerdəyişmələri)
      const transferConditions = [
        eq(schema.stockTransfers.productId, productId),
        eq(schema.stockTransfers.tenantId, req.tenantId),
      ];
      const transfersRows = await db
        .select()
        .from(schema.stockTransfers)
        .where(and(...transferConditions))
        .orderBy(asc(schema.stockTransfers.transferDate), asc(schema.stockTransfers.id));

      // 8. Stock Adjustments (Sayım / Düzəlişlər)
      const adjConditions = [
        eq(schema.stockAdjustments.productId, productId),
        eq(schema.stockAdjustments.tenantId, req.tenantId),
      ];
      if (warehouseId) {
        adjConditions.push(eq(schema.stockAdjustments.warehouseId, warehouseId));
      }
      const adjustmentsRows = await db
        .select()
        .from(schema.stockAdjustments)
        .where(and(...adjConditions))
        .orderBy(asc(schema.stockAdjustments.date), asc(schema.stockAdjustments.id));

      const allEvents: any[] = [];

      // Add Stock Entries
      for (const e of entries) {
        allEvents.push({
          id: `in-${e.id}`,
          timestamp: e.entryDate,
          type: "stock_in",
          typeLabel: "Mədaxil (Alış)",
          documentNumber: `MDX-${e.id.toString().padStart(5, "0")}`,
          documentType: "stock_entry",
          documentId: e.id,
          documentUrl: "/anbar",
          counterparty: e.supplier || (e.vendorId ? vendorMap.get(e.vendorId) : null) || "Təchizatçı",
          quantity: e.quantity,
          unitPrice: e.purchasePrice,
          totalAmount: Math.round(e.quantity * e.purchasePrice * 100) / 100,
          warehouseId: e.warehouseId,
          warehouseName: (e.warehouseId && warehouseMap.get(e.warehouseId)) || "Əsas Anbar",
          operator: "Admin",
          notes: e.notes || (e.paymentType ? `Ödəniş: ${e.paymentType}` : ""),
        });
      }

      // Add Sales
      for (const s of salesRows) {
        allEvents.push({
          id: `sale-${s.itemId}`,
          timestamp: s.date,
          type: "sale",
          typeLabel: "Satış (POS)",
          documentNumber: `POS-${s.saleId.toString().padStart(5, "0")}`,
          documentType: "sale",
          documentId: s.saleId,
          documentUrl: `/satislar/${s.saleId}`,
          counterparty: s.customerName || "Pərakəndə Müştəri",
          quantity: -s.quantity,
          unitPrice: s.price,
          totalAmount: Math.round(s.quantity * s.price * 100) / 100,
          warehouseId: s.warehouseId,
          warehouseName: (s.warehouseId && warehouseMap.get(s.warehouseId)) || "Əsas Anbar",
          operator: s.sellerName || "Kassir",
          notes: s.paymentType ? `Ödəniş: ${s.paymentType}` : "",
        });
      }

      // Add Customer Returns
      for (const r of returnsRows) {
        allEvents.push({
          id: `ret-${r.itemId}`,
          timestamp: r.date,
          type: "return",
          typeLabel: "Müştəri Qaytarması",
          documentNumber: `QYT-${r.returnId.toString().padStart(5, "0")}`,
          documentType: "return",
          documentId: r.returnId,
          documentUrl: `/qaytarislar/${r.returnId}`,
          counterparty: r.customerName || "Müştəri",
          quantity: r.quantity,
          unitPrice: r.price,
          totalAmount: Math.round(r.quantity * r.price * 100) / 100,
          warehouseId: r.warehouseId,
          warehouseName: (r.warehouseId && warehouseMap.get(r.warehouseId)) || "Əsas Anbar",
          operator: "Kassir",
          notes: r.reason ? `Səbəb: ${r.reason}` : "",
        });
      }

      // Add Vendor Returns
      for (const vr of vendorReturnsRows) {
        allEvents.push({
          id: `vret-${vr.itemId}`,
          timestamp: vr.date,
          type: "vendor_return",
          typeLabel: "Tədarükçüyə Qaytarış",
          documentNumber: `TQY-${vr.vendorReturnId.toString().padStart(5, "0")}`,
          documentType: "vendor_return",
          documentId: vr.vendorReturnId,
          documentUrl: "/anbar/qaytaris",
          counterparty: vr.supplierName || "Tədarükçü",
          quantity: -vr.quantity,
          unitPrice: vr.price,
          totalAmount: Math.round(vr.quantity * vr.price * 100) / 100,
          warehouseId: vr.warehouseId,
          warehouseName: (vr.warehouseId && warehouseMap.get(vr.warehouseId)) || "Əsas Anbar",
          operator: "Admin",
          notes: vr.notes || "",
        });
      }

      // Add Transfers
      for (const t of transfersRows) {
        const fromName = warehouseMap.get(t.fromWarehouseId) || `Anbar #${t.fromWarehouseId}`;
        const toName = warehouseMap.get(t.toWarehouseId) || `Anbar #${t.toWarehouseId}`;

        if (warehouseId) {
          if (t.fromWarehouseId === warehouseId) {
            allEvents.push({
              id: `trf-out-${t.id}`,
              timestamp: t.transferDate,
              type: "transfer",
              typeLabel: "Yerdəyişmə (Çıxış)",
              documentNumber: `TRF-${t.id.toString().padStart(5, "0")}`,
              documentType: "transfer",
              documentId: t.id,
              documentUrl: "/anbar",
              counterparty: `Qəbul edən: ${toName}`,
              quantity: -t.quantity,
              unitPrice: 0,
              totalAmount: 0,
              warehouseId: t.fromWarehouseId,
              warehouseName: fromName,
              operator: t.transferredBy || "Sistem",
              notes: t.notes || "",
            });
          }
          if (t.toWarehouseId === warehouseId) {
            allEvents.push({
              id: `trf-in-${t.id}`,
              timestamp: t.transferDate,
              type: "transfer",
              typeLabel: "Yerdəyişmə (Giriş)",
              documentNumber: `TRF-${t.id.toString().padStart(5, "0")}`,
              documentType: "transfer",
              documentId: t.id,
              documentUrl: "/anbar",
              counterparty: `Göndərən: ${fromName}`,
              quantity: t.quantity,
              unitPrice: 0,
              totalAmount: 0,
              warehouseId: t.toWarehouseId,
              warehouseName: toName,
              operator: t.transferredBy || "Sistem",
              notes: t.notes || "",
            });
          }
        } else {
          allEvents.push({
            id: `trf-${t.id}`,
            timestamp: t.transferDate,
            type: "transfer",
            typeLabel: "Anbar Yerdəyişməsi",
            documentNumber: `TRF-${t.id.toString().padStart(5, "0")}`,
            documentType: "transfer",
            documentId: t.id,
            documentUrl: "/anbar",
            counterparty: `${fromName} ➔ ${toName}`,
            quantity: 0, // In global view, internal movement doesn't alter global stock quantity
            unitPrice: 0,
            totalAmount: 0,
            warehouseId: null,
            warehouseName: `${fromName} ➔ ${toName}`,
            operator: t.transferredBy || "Sistem",
            notes: `${t.quantity} ${product.unit} köçürüldü. ${t.notes || ""}`,
          });
        }
      }

      // Add Adjustments
      for (const a of adjustmentsRows) {
        const isIncrease = ["found", "surplus", "manual_add", "add"].includes(String(a.type).toLowerCase());
        const signedQty = isIncrease ? a.quantity : -a.quantity;
        allEvents.push({
          id: `adj-${a.id}`,
          timestamp: a.date,
          type: "stock_adjustment",
          typeLabel: isIncrease ? "Sayım Artığı (Korreksiya)" : "Sayım Əskikliyi (Silinmə)",
          documentNumber: `ADJ-${a.id.toString().padStart(5, "0")}`,
          documentType: "adjustment",
          documentId: a.id,
          documentUrl: "/anbar",
          counterparty: a.adjustedBy || "Sistem",
          quantity: signedQty,
          unitPrice: 0,
          totalAmount: 0,
          warehouseId: a.warehouseId,
          warehouseName: (a.warehouseId && warehouseMap.get(a.warehouseId)) || "Əsas Anbar",
          operator: a.adjustedBy || "Sistem",
          notes: a.notes || `Sayım növü: ${a.type}`,
        });
      }

      // Sort chronologically ascending to calculate accurate running balance
      allEvents.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      let running = 0;
      for (const ev of allEvents) {
        running = Math.max(0, Math.round((running + ev.quantity) * 10000) / 10000);
        ev.balanceAfter = running;
      }

      const currentStock = running;

      // Filter events by period / type for display
      let filtered = allEvents;

      if (startDate) {
        const startTs = new Date(startDate).getTime();
        filtered = filtered.filter(e => new Date(e.timestamp).getTime() >= startTs);
      }
      if (endDate) {
        // Include full day of endDate
        const endTs = new Date(endDate).setHours(23, 59, 59, 999);
        filtered = filtered.filter(e => new Date(e.timestamp).getTime() <= endTs);
      }
      if (filterType && filterType !== "all") {
        if (filterType === "return") {
          filtered = filtered.filter(e => e.type === "return" || e.type === "vendor_return");
        } else {
          filtered = filtered.filter(e => e.type === filterType);
        }
      }

      // Calculate period summary metrics
      let totalInQty = 0;
      let totalInAmount = 0;
      let totalOutQty = 0;
      let totalOutAmount = 0;
      let totalReturnsQty = 0;
      let totalReturnsAmount = 0;

      for (const ev of filtered) {
        if (ev.type === "stock_in" || (ev.type === "transfer" && ev.quantity > 0) || (ev.type === "stock_adjustment" && ev.quantity > 0)) {
          totalInQty += Math.max(0, ev.quantity);
          totalInAmount += ev.totalAmount || 0;
        } else if (ev.type === "sale" || (ev.type === "transfer" && ev.quantity < 0) || (ev.type === "stock_adjustment" && ev.quantity < 0)) {
          totalOutQty += Math.abs(ev.quantity);
          totalOutAmount += ev.totalAmount || 0;
        } else if (ev.type === "return" || ev.type === "vendor_return") {
          totalReturnsQty += Math.abs(ev.quantity);
          totalReturnsAmount += ev.totalAmount || 0;
        }
      }

      // Display descending order (most recent first)
      const reversedFiltered = [...filtered].reverse();

      const lastPurchasePrice = entries.length > 0 ? entries[entries.length - 1].purchasePrice : 0;
      const currentStockValue = currentStock > 0 ? Math.round(currentStock * lastPurchasePrice * 100) / 100 : 0;

      res.json({
        product: {
          id: product.id,
          name: product.name,
          category: product.category,
          unit: product.unit,
          barcode: product.barcode,
          description: product.description,
          currentStock,
          lastPurchasePrice,
          currentStockValue,
        },
        summary: {
          totalInQty: Math.round(totalInQty * 100) / 100,
          totalInAmount: Math.round(totalInAmount * 100) / 100,
          totalOutQty: Math.round(totalOutQty * 100) / 100,
          totalOutAmount: Math.round(totalOutAmount * 100) / 100,
          totalReturnsQty: Math.round(totalReturnsQty * 100) / 100,
          totalReturnsAmount: Math.round(totalReturnsAmount * 100) / 100,
          currentStock: Math.round(currentStock * 100) / 100,
          currentStockValue: Math.round(currentStockValue * 100) / 100,
        },
        movements: reversedFiltered,
      });
    } catch (error: any) {
      console.error("Product movements error:", error);
      res.status(500).json({ message: "Məhsul hərəkət tarixçəsini gətirərkən xəta baş verdi" });
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

      // Ledger: Transfer Out
      await recordLedgerMovement(db, {
        tenantId: req.tenantId,
        productId: parseInt(productId),
        warehouseId: parseInt(fromWarehouseId),
        quantity: -parseFloat(quantity),
        movementType: "transfer_out",
        referenceType: "transfer",
        referenceId: transfer.id,
        userId: req.user?.userId || null,
        username: String(req.headers["x-user-username"] || "Sistem"),
        notes: `Anbar Yerdəyişməsi (Çıxış: Anbar #${fromWarehouseId} -> #${toWarehouseId})`,
      });

      // Ledger: Transfer In
      await recordLedgerMovement(db, {
        tenantId: req.tenantId,
        productId: parseInt(productId),
        warehouseId: parseInt(toWarehouseId),
        quantity: parseFloat(quantity),
        movementType: "transfer_in",
        referenceType: "transfer",
        referenceId: transfer.id,
        userId: req.user?.userId || null,
        username: String(req.headers["x-user-username"] || "Sistem"),
        notes: `Anbar Yerdəyişməsi (Mədaxil: Anbar #${fromWarehouseId} -> #${toWarehouseId})`,
      });

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

        const isIncrease = ["found", "surplus", "manual_add", "add"].includes(String(type).toLowerCase());
        const adjQty = isIncrease ? parseFloat(quantity) : -parseFloat(quantity);
        await recordLedgerMovement(db, {
          tenantId: req.tenantId,
          productId: parseInt(productId),
          warehouseId: parseInt(warehouseId),
          quantity: adjQty,
          movementType: "stock_adjustment",
          referenceType: "adjustment",
          referenceId: record.id,
          userId: req.user?.userId || null,
          username: String(req.headers["x-user-username"] || "Sistem"),
          notes: notes || `Sayım Tənzimləməsi (${isIncrease ? "Giriş/Əlavə" : "Çıxış/Azaltma"})`,
        });

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

  // ─── Warehouses CRUD ─────────────────────────────────────────────────────

  router.get("/warehouses", async (req: AuthenticatedRequest, res) => {
    try {
      const list = await db.select().from(schema.warehouses)
        .where(eq(schema.warehouses.tenantId, req.tenantId))
        .orderBy(schema.warehouses.id);
      res.json(list);
    } catch (error: any) {
      res.status(500).json({ message: "Anbarları çəkərkən xəta baş verdi: " + error.message });
    }
  });

  router.post("/warehouses", requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const { name, location, isDefault } = req.body;
      if (!name) return res.status(400).json({ message: "Anbar adı mütləqdir" });

      if (isDefault === 1 || isDefault === true) {
        await db.update(schema.warehouses)
          .set({ isDefault: 0 })
          .where(eq(schema.warehouses.tenantId, req.tenantId));
      }

      const [newWarehouse] = await db.insert(schema.warehouses).values({
        tenantId: req.tenantId, name, location: location || null,
        isDefault: isDefault ? 1 : 0, createdAt: new Date().toISOString(),
      }).returning();

      await logActivity(req, "CREATE_WAREHOUSE", `Yeni anbar yaratdı: '${name}'`);
      res.json(newWarehouse);
    } catch (error: any) {
      res.status(500).json({ message: "Anbar yaradılarkən xəta baş verdi: " + error.message });
    }
  });

  router.put("/warehouses/:id", requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const { name, location, isDefault } = req.body;

      const existing = await db.query.warehouses.findFirst({
        where: (w: any, { eq, and }: any) => and(eq(w.tenantId, req.tenantId), eq(w.id, id))
      });
      if (!existing) return res.status(404).json({ message: "Anbar tapılmadı" });

      if (isDefault === 1 || isDefault === true) {
        await db.update(schema.warehouses).set({ isDefault: 0 }).where(eq(schema.warehouses.tenantId, req.tenantId));
      }

      const [updated] = await db.update(schema.warehouses).set({
        name: name !== undefined ? name : existing.name,
        location: location !== undefined ? location : existing.location,
        isDefault: isDefault !== undefined ? (isDefault ? 1 : 0) : existing.isDefault,
      }).where(and(eq(schema.warehouses.id, id), eq(schema.warehouses.tenantId, req.tenantId))).returning();

      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: "Anbar yenilənərkən xəta baş verdi: " + error.message });
    }
  });

  router.delete("/warehouses/:id", requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const warehouse = await db.query.warehouses.findFirst({
        where: (w: any, { eq, and }: any) => and(eq(w.tenantId, req.tenantId), eq(w.id, id))
      });
      if (!warehouse) return res.status(404).json({ message: "Anbar tapılmadı" });
      if (warehouse.isDefault === 1) return res.status(400).json({ message: "Default anbar silinə bilməz. Əvvəlcə başqa anbarı default edin." });

      await db.delete(schema.warehouses).where(and(eq(schema.warehouses.id, id), eq(schema.warehouses.tenantId, req.tenantId)));
      await logActivity(req, "DELETE_WAREHOUSE", `'${warehouse.name}' (ID: ${id}) anbarını sildi`);
      res.json({ success: true, message: "Anbar uğurla silindi" });
    } catch (error: any) {
      res.status(500).json({ message: "Anbar silinərkən xəta baş verdi: " + error.message });
    }
  });

  // ─── Update Cost Price (FIFO-aware) ─────────────────────────────────────
  router.post("/stock/update-cost", requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const { productId, newCost } = req.body;
      if (productId === undefined || newCost === undefined || isNaN(parseFloat(newCost))) {
        return res.status(400).json({ message: "Məhsul və yeni qiymət düzgün göstərilməlidir" });
      }

      const costNum = parseFloat(newCost);
      if (costNum < 0) {
        return res.status(400).json({ message: "Maya dəyəri mənfi ola bilməz" });
      }

      // 1. Fetch all stock entries for this product (tenant scope)
      const productEntries = await db
        .select()
        .from(schema.stockEntries)
        .where(and(eq(schema.stockEntries.tenantId, req.tenantId), eq(schema.stockEntries.productId, productId)))
        .orderBy(schema.stockEntries.id);

      // 2. Fetch vendor returns to compute net stock per entry
      const vendorReturnsPerEntry = await db
        .select({
          stockEntryId: schema.vendorReturnItems.stockEntryId,
          totalReturned: sql`SUM(${schema.vendorReturnItems.quantity})`
        })
        .from(schema.vendorReturnItems)
        .where(eq(schema.vendorReturnItems.tenantId, req.tenantId))
        .groupBy(schema.vendorReturnItems.stockEntryId);

      const vrMap = new Map<number, number>();
      vendorReturnsPerEntry.forEach(v => {
        if (v.stockEntryId) vrMap.set(v.stockEntryId, parseFloat((v.totalReturned as string) || "0"));
      });

      // 3. Fetch sales/returns totals
      const salesSum = await db
        .select({ totalSold: sql`SUM(${schema.saleItems.quantity})` })
        .from(schema.saleItems)
        .where(and(eq(schema.saleItems.tenantId, req.tenantId), eq(schema.saleItems.productId, productId)));

      const returnsSum = await db
        .select({ totalReturned: sql`SUM(${schema.returnItems.quantity})` })
        .from(schema.returnItems)
        .where(and(
          eq(schema.returnItems.tenantId, req.tenantId),
          eq(schema.returnItems.productId, productId),
          eq(schema.returnItems.status, "returned_to_stock")
        ));

      const adjustmentsSum = await db
        .select({ totalAdjustments: sql`SUM(${schema.stockAdjustments.quantity})` })
        .from(schema.stockAdjustments)
        .where(and(eq(schema.stockAdjustments.tenantId, req.tenantId), eq(schema.stockAdjustments.productId, productId)));

      const totalSold = parseFloat((salesSum[0]?.totalSold as string) || "0");
      const totalReturned = parseFloat((returnsSum[0]?.totalReturned as string) || "0");
      const totalAdjustments = parseFloat((adjustmentsSum[0]?.totalAdjustments as string) || "0");
      const negativeAdjustments = totalAdjustments < 0 ? -totalAdjustments : 0;
      const netSold = Math.max(0, totalSold - totalReturned + negativeAdjustments);

      let soldRemaining = netSold;
      let updatedEntriesCount = 0;

      // 4. Simulate FIFO to find which entries still have remaining stock
      for (const entry of productEntries) {
        const vrQty = vrMap.get(entry.id) || 0;
        const adjustedQuantity = Math.max(0, entry.quantity - vrQty);
        if (adjustedQuantity === 0) continue;

        if (soldRemaining >= adjustedQuantity) {
          soldRemaining -= adjustedQuantity;
        } else {
          await db.update(schema.stockEntries).set({ purchasePrice: costNum }).where(eq(schema.stockEntries.id, entry.id));
          updatedEntriesCount++;
        }
      }

      // 5. No entries? Create baseline. All sold out? Update latest.
      if (productEntries.length === 0) {
        await db.insert(schema.stockEntries).values({
          tenantId: req.tenantId,
          productId,
          quantity: 0,
          purchasePrice: costNum,
          paymentType: "Nəğd",
          paidStatus: "paid",
          applyEdv: 1,
          entryDate: new Date().toISOString(),
          notes: "Sistem tərəfindən maya dəyəri düzəlişi baseline olaraq təyin edilib",
        });
        updatedEntriesCount++;
      } else if (updatedEntriesCount === 0 && productEntries.length > 0) {
        const latestEntry = productEntries[productEntries.length - 1];
        await db.update(schema.stockEntries).set({ purchasePrice: costNum }).where(eq(schema.stockEntries.id, latestEntry.id));
        updatedEntriesCount++;
      }

      await logActivity(req, "STOCK_COST_ADJUST", `Məhsul ID ${productId} üçün maya dəyəri ${costNum} ₼ olaraq yeniləndi.`);
      res.json({ success: true, updatedEntriesCount });
    } catch (error: any) {
      console.error("update-cost error:", error);
      res.status(500).json({ message: "Maya dəyərini yeniləyərkən xəta baş verdi: " + error.message });
    }
  });

  return router;
}
