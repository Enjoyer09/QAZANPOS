import { Router } from "express";
import { db } from "../db/index.js";
import * as schema from "../db/schema.js";
import { eq, and, ne, gte, lte, sql, desc } from "drizzle-orm";
import { AuthenticatedRequest, requireAdmin, checkUserPermission, logActivity, verifyTenantLimit, computeFIFOSaleCost, computeRemainingDebt, fetchTenantStockMetrics } from "./helpers.js";
import { sendTelegramNotification } from "../lib/telegram.js";

export default function salesRoutes(): Router {
  const router = Router();

  router.get("/sales", async (req: AuthenticatedRequest, res) => {
    try {
      const { from, to } = req.query;
      let conditions = eq(schema.sales.tenantId, req.tenantId);
      if (from) conditions = and(conditions, gte(schema.sales.saleDate, `${from}T00:00:00.000Z`)) as any;
      if (to) conditions = and(conditions, lte(schema.sales.saleDate, `${to}T23:59:59.999Z`)) as any;

      if (!await checkUserPermission(req, "staffCanViewSalesHistory")) {
        return res.status(403).json({ message: "Satış tarixçəsinə giriş administrator tərəfindən məhdudlaşdırılıb" });
      }

      const role = req.headers["x-user-role"] as string;
      const username = req.headers["x-user-username"] as string;
      if (role !== "Admin") {
        const normalizedUsername = username ? username.trim().toLowerCase() : "";
        conditions = and(conditions, eq(schema.sales.sellerName, normalizedUsername)) as any;
      }

      const list = await db.query.sales.findMany({
        where: conditions,
        with: { payments: true, returns: { with: { items: true } }, items: { with: { product: true } }, serials: true },
        orderBy: [desc(schema.sales.saleDate)],
      });
      res.json(list);
    } catch (error) {
      res.status(500).json({ message: "Satış tarixçəsini gətirərkən xəta baş verdi" });
    }
  });

  router.post("/sales", async (req: AuthenticatedRequest, res) => {
    try {
      const { customerId, paymentType, creditDueDate, notes, items, totalAmount, totalCost, paidAmount, offlineId, salesChannel, marketplaceFee, bankName, applyEdv, warehouseId } = req.body;

      if (!items || items.length === 0 || !paymentType) {
        return res.status(400).json({ message: "Çek məlumatları boş ola bilməz" });
      }

      if (offlineId) {
        const existingSale = await db.query.sales.findFirst({ where: and(eq(schema.sales.offlineId, offlineId), eq(schema.sales.tenantId, req.tenantId)) });
        if (existingSale) { console.warn(`Duplicate sale with offlineId ${offlineId} ignored.`); return res.json(existingSale); }
      }

      const limitCheck = await verifyTenantLimit(req.tenantId, "sales");
      if (!limitCheck.allowed) {
        return res.status(402).json({
          limitReached: true, limitType: "sales", current: limitCheck.current, max: limitCheck.max, tier: limitCheck.tier,
          message: `Satış limitinə çatdınız! Mövcud planınızda limit: ${limitCheck.max} satış.`
        });
      }

      const isCredit = paymentType === "Nisyə";
      if (isCredit && !creditDueDate) return res.status(400).json({ message: "Nisyə satış üçün ödəniş tarixi mütləqdir" });

      let targetWarehouseId = warehouseId ? parseInt(warehouseId) : null;
      if (!targetWarehouseId) {
        const defaultWarehouse = await db.query.warehouses.findFirst({ where: (w: any, { eq, and }: any) => and(eq(w.tenantId, req.tenantId), eq(w.isDefault, 1)) });
        if (defaultWarehouse) targetWarehouseId = defaultWarehouse.id;
      }

      let customerName = "Anonim Müştəri";
      let customerPhone = "";
      if (customerId) {
        const cust = await db.query.customers.findFirst({ where: and(eq(schema.customers.id, customerId), eq(schema.customers.tenantId, req.tenantId)) });
        if (cust) { customerName = cust.name; customerPhone = cust.phone || ""; }
      }

      const rawSeller = req.headers["x-user-username"] as string;
      const sellerName = rawSeller ? rawSeller.trim().toLowerCase() : (req.headers["x-user-role"] === "Admin" ? "admin" : "satici");

      const processedItems: { productId: number; quantity: number; salePrice: number; purchasePrice: number; serialNumbers?: string[] }[] = [];
      let calculatedTotalCost = 0;
      for (const item of items) {
        const qty = parseFloat(item.quantity);
        let fifoCost = await computeFIFOSaleCost(item.productId, req.tenantId, qty);
        if (fifoCost <= 0) fifoCost = parseFloat(item.salePrice) || 0;
        calculatedTotalCost += qty * fifoCost;
        processedItems.push({ productId: item.productId, quantity: qty, salePrice: parseFloat(item.salePrice), purchasePrice: fifoCost, serialNumbers: item.serialNumbers });
      }

      // ── Stok yoxlaması (Admin → bütün anbarlar, Staff → öz anbarı) ──
      const userRole = req.headers["x-user-role"] as string;
      const isAdminSale = userRole === "Admin";
      const stockCheckWarehouseId = isAdminSale ? undefined : (targetWarehouseId || undefined);
      const { allProducts: stockProducts, metrics: stockMetrics } = await fetchTenantStockMetrics(req.tenantId, stockCheckWarehouseId);
      const productNameLookup = new Map(stockProducts.map(p => [p.id, p.name]));
      const stockWarnings: { productId: number; productName: string; requested: number; available: number }[] = [];

      for (const item of items) {
        const pid = parseInt(item.productId);
        const qty = parseFloat(item.quantity);
        const stock = stockMetrics.get(pid);
        const available = stock?.currentQuantity ?? 0;

        if (available < qty) {
          const pName = productNameLookup.get(pid) || `ID: ${pid}`;
          return res.status(400).json({
            message: `❌ "${pName}" üçün anbarda kifayət qədər mal yoxdur! (Tələb: ${qty} ədəd, Mövcud: ${available} ədəd). Zəhmət olmasa əvvəlcə anbara mədaxil edin.`,
            insufficientStock: true,
            details: stockWarnings.map(w => `${w.productName}: tələb ${w.requested}, mövcud ${w.available}`),
          });
        }

        if (available === 0) {
          stockWarnings.push({ productId: pid, productName: productNameLookup.get(pid) || `ID: ${pid}`, requested: qty, available });
        }
      }

      // ── Auto-transfer (Admin üçün: çatışmayan stoku digər anbarlardan köçür) ──
      const autoTransferItems: { productId: number; fromWarehouseId: number; quantity: number; serialNumbers: string[] }[] = [];
      
      if (isAdminSale && targetWarehouseId) {
        const targetMetrics = await fetchTenantStockMetrics(req.tenantId, targetWarehouseId);
        
        for (const item of processedItems) {
          const targetStock = targetMetrics.metrics.get(item.productId)?.currentQuantity || 0;
          
          if (item.quantity > targetStock) {
            const shortfall = item.quantity - targetStock;
            let remaining = shortfall;
            
            // Digər anbarları tap (ən çox stok olandan başlayaraq)
            const otherWarehouses = await db.select().from(schema.warehouses)
              .where(and(eq(schema.warehouses.tenantId, req.tenantId), ne(schema.warehouses.id, targetWarehouseId)));
            
            for (const wh of otherWarehouses) {
              if (remaining <= 0) break;
              
              const whMetrics = await fetchTenantStockMetrics(req.tenantId, wh.id);
              const whStock = whMetrics.metrics.get(item.productId)?.currentQuantity || 0;
              
              if (whStock > 0) {
                const transferQty = Math.min(remaining, whStock);
                
                // Serial nömrələri tap (seriallı məhsuldursa)
                let serialsToTransfer: string[] = [];
                try {
                  const product = stockProducts.find(p => p.id === item.productId);
                  if (product?.trackingType === "serialized") {
                    const serials = await db.select()
                      .from(schema.productSerials)
                      .where(and(
                        eq(schema.productSerials.tenantId, req.tenantId),
                        eq(schema.productSerials.productId, item.productId),
                        eq(schema.productSerials.warehouseId, wh.id),
                        eq(schema.productSerials.status, "in_stock"),
                      ))
                      .limit(transferQty);
                    serialsToTransfer = serials.map(s => s.serialNumber);
                  }
                } catch {}
                
                autoTransferItems.push({
                  productId: item.productId,
                  fromWarehouseId: wh.id,
                  quantity: transferQty,
                  serialNumbers: serialsToTransfer,
                });
                
                remaining -= transferQty;
              }
            }
          }
        }
      }

      // Settings-ə əsasən növbə tələb olunub-olunmadığını yoxla
      const tenantSettings = await db.query.settings.findFirst({
        where: eq(schema.settings.tenantId, req.tenantId)
      });
      const requireShift = tenantSettings?.requireShift ?? 1;

      const activeShift = await db.query.shifts.findFirst({
        where: and(eq(schema.shifts.tenantId, req.tenantId), eq(schema.shifts.cashierName, sellerName), eq(schema.shifts.status, "open"))
      });
      if (requireShift && !activeShift && !offlineId) return res.status(400).json({ message: "Satış etmək üçün əvvəlcə kassa növbəsini açmalısınız!" });
      const shiftIdToLink = activeShift ? activeShift.id : null;

      let pointsEarned = 0;
      let discountPaid = parseFloat(req.body.loyaltyDiscountPaid) || 0;
      if (customerId) {
        const tenantSettings = await db.query.settings.findFirst({ where: eq(schema.settings.tenantId, req.tenantId) });
        const ruleRate = tenantSettings?.loyaltyRuleRate || 0.01;
        const netAmount = Math.max(0, parseFloat(totalAmount) - discountPaid);
        pointsEarned = parseFloat((netAmount * ruleRate).toFixed(2));
      }

      const saleResult = await db.transaction(async (tx) => {
        // Auto-transfer recordları yarat (stoku digər anbardan köçür)
        for (const tr of autoTransferItems) {
          await tx.insert(schema.stockTransfers).values({
            tenantId: req.tenantId,
            fromWarehouseId: tr.fromWarehouseId,
            toWarehouseId: targetWarehouseId as number,
            productId: tr.productId,
            quantity: tr.quantity,
            transferDate: new Date().toISOString(),
            transferredBy: sellerName || "admin",
            notes: `Avtomatik transfer (satış əməliyyatı üçün)`,
            serialNumbers: tr.serialNumbers.length > 0 ? JSON.stringify(tr.serialNumbers) : null,
          });
          
          // Serial nömrələrin warehouseId-sini yenilə
          for (const sNum of tr.serialNumbers) {
            await tx.update(schema.productSerials)
              .set({ warehouseId: targetWarehouseId })
              .where(and(
                eq(schema.productSerials.serialNumber, sNum),
                eq(schema.productSerials.tenantId, req.tenantId),
              ));
          }
        }
        
        const newSale = await tx.insert(schema.sales).values({
          tenantId: req.tenantId, customerId: customerId || null, customerName, customerPhone,
          paymentType, bankName: paymentType === "Kart" ? (bankName || null) : null,
          creditDueDate: isCredit ? creditDueDate : null, notes: notes || null,
          saleDate: new Date().toISOString(), totalAmount: parseFloat(totalAmount),
          totalCost: parseFloat(calculatedTotalCost.toFixed(2)),
          paymentStatus: isCredit ? "credit" : "paid", offlineId: offlineId || null,
          salesChannel: salesChannel || "Mağaza", marketplaceFee: marketplaceFee ? parseFloat(marketplaceFee) : 0, sellerName,
          applyEdv: applyEdv !== undefined && applyEdv !== null ? (applyEdv ? 1 : 0) : 1,
          warehouseId: targetWarehouseId, shiftId: shiftIdToLink,
          loyaltyDiscountPaid: discountPaid, loyaltyPointsEarned: pointsEarned,
        }).returning();
        const saleId = newSale[0].id;      if (customerId) {
          await tx.execute(
            sql`UPDATE customers SET loyalty_points = GREATEST(0, COALESCE(loyalty_points, 0) - ${discountPaid} + ${pointsEarned}) WHERE id = ${customerId} AND tenant_id = ${req.tenantId}`
          );
        }

        for (const item of processedItems) {
          await tx.insert(schema.saleItems).values({ tenantId: req.tenantId, saleId, productId: item.productId, quantity: item.quantity, salePrice: item.salePrice, purchasePrice: item.purchasePrice });
          if (item.serialNumbers && Array.isArray(item.serialNumbers) && item.serialNumbers.length > 0) {
            for (const sNum of item.serialNumbers) {
              const cleaned = sNum.trim().toUpperCase();
              const serialConditions = [eq(schema.productSerials.serialNumber, cleaned), eq(schema.productSerials.tenantId, req.tenantId), eq(schema.productSerials.status, "in_stock")];
              if (!isAdminSale && targetWarehouseId) serialConditions.push(eq(schema.productSerials.warehouseId, targetWarehouseId));
              await tx.update(schema.productSerials).set({ status: "sold", saleId, soldAt: new Date().toISOString() }).where(and(...serialConditions));
            }
          }
        }

        if (isCredit && paidAmount && parseFloat(paidAmount) > 0) {
          await tx.insert(schema.creditPayments).values({ tenantId: req.tenantId, saleId, paymentDate: new Date().toISOString(), amount: parseFloat(paidAmount), paymentType: req.body.downpaymentType || "Nəğd" });
        }

        if (marketplaceFee && parseFloat(marketplaceFee) > 0) {
          await tx.insert(schema.expenses).values({ tenantId: req.tenantId, amount: parseFloat(marketplaceFee), category: "Marketplace Komissiyası", description: `birmarket.az satışı üzrə platforma komissiyası (Çek № ${saleId})`, date: new Date().toISOString() });
        }

        return newSale[0];
      });

      await logActivity(req, "CHECKOUT_SALE", `POS satışı həyata keçirdi: Çek № ${saleResult.id} (Məbləğ: ${totalAmount} ₼, Müştəri: ${customerName}, Ödəniş: ${paymentType})`);
      res.json(saleResult);

      sendTelegramNotification(req.tenantId, `⚡ <b>Yeni POS Satışı!</b>\n\n<b>Çek №:</b> <code>${saleResult.id}</code>\n<b>Müştəri:</b> ${customerName}\n<b>Ödəniş Üsulu:</b> ${paymentType}\n<b>Ümumi Məbləğ:</b> <code>${parseFloat(totalAmount).toFixed(2)} ₼</code>\n<b>Maya Dəyəri:</b> <code>${parseFloat(totalCost).toFixed(2)} ₼</code>\n<b>Gəlir:</b> <code>${(parseFloat(totalAmount) - parseFloat(totalCost)).toFixed(2)} ₼</code>`).catch(() => {});
    } catch (error) {
      console.error("Sales error:", error);
      res.status(500).json({ message: "Satış tamamlanarkən xəta baş verdi" });
    }
  });

  router.get("/sales/:id", async (req: AuthenticatedRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const sale = await db.query.sales.findFirst({
        where: and(eq(schema.sales.id, id), eq(schema.sales.tenantId, req.tenantId)),
        with: { items: { with: { product: true } }, payments: true, returns: { with: { items: { with: { product: true } } } }, serials: true },
      });
      if (!sale) return res.status(404).json({ message: "Çek tapılmadı" });

      if (!await checkUserPermission(req, "staffCanViewSalesHistory")) {
        return res.status(403).json({ message: "Satış tarixçəsinə giriş administrator tərəfindən məhdudlaşdırılıb" });
      }

      const role = req.headers["x-user-role"] as string;
      const username = req.headers["x-user-username"] as string;
      if (role !== "Admin") {
        const normalizedUsername = username ? username.trim().toLowerCase() : "";
        if (sale.sellerName !== normalizedUsername) return res.status(403).json({ message: "Bu satış məlumatına baxmaq üçün səlahiyyətiniz yoxdur" });
      }
      res.json(sale);
    } catch (error) {
      res.status(500).json({ message: "Çek məlumatlarını gətirərkən xəta baş verdi" });
    }
  });

  router.patch("/sales/:id/pay-credit", async (req: AuthenticatedRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const { paymentType } = req.body;
      const payType = paymentType || "Nəğd";

      const sale = await db.query.sales.findFirst({ where: and(eq(schema.sales.id, id), eq(schema.sales.tenantId, req.tenantId)), with: { payments: true, returns: true } });
      if (!sale) return res.status(404).json({ message: "Satış tapılmadı" });

      if (!await checkUserPermission(req, "staffCanViewSalesHistory")) return res.status(403).json({ message: "Satış tarixçəsinə giriş məhdudlaşdırılıb" });

      const role = req.headers["x-user-role"] as string;
      const username = req.headers["x-user-username"] as string;
      if (role !== "Admin") {
        if (sale.sellerName !== (username ? username.trim().toLowerCase() : "")) return res.status(403).json({ message: "Bu satışın borcunu ödəmək üçün səlahiyyətiniz yoxdur" });
      }

      const remaining = computeRemainingDebt(sale, sale.payments, sale.returns || []);

      if (remaining > 0) {
        await db.insert(schema.creditPayments).values({ tenantId: req.tenantId, saleId: id, paymentDate: new Date().toISOString(), amount: remaining, paymentType: payType });
      }
      await db.update(schema.sales).set({ paymentStatus: "paid" }).where(eq(schema.sales.id, id));
      await logActivity(req, "COLLECT_CUSTOMER_DEBT", `Müştəri nisyə borcunun hamısını topladı: ${remaining.toFixed(2)} ₼ (Çek № ${id}, Müştəri: ${sale.customerName || "Anonim"})`);
      res.json({ message: "Nisyə borc tam olaraq ödənildi" });
    } catch (error) {
      res.status(500).json({ message: "Borc ödənilərkən xəta baş verdi" });
    }
  });

  router.patch("/sales/:id/add-payment", async (req: AuthenticatedRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const { amount, paymentType } = req.body;
      const paymentAmount = parseFloat(amount);
      if (!paymentAmount || paymentAmount <= 0) return res.status(400).json({ message: "Düzgün ödəniş məbləği daxil edilməlidir" });

      const sale = await db.query.sales.findFirst({ where: and(eq(schema.sales.id, id), eq(schema.sales.tenantId, req.tenantId)), with: { payments: true, returns: true } });
      if (!sale) return res.status(404).json({ message: "Satış tapılmadı" });

      await db.insert(schema.creditPayments).values({ tenantId: req.tenantId, saleId: id, paymentDate: new Date().toISOString(), amount: paymentAmount, paymentType: paymentType || "Nəğd" });

      const updatedPayments = await db.query.creditPayments.findMany({ where: and(eq(schema.creditPayments.saleId, id), eq(schema.creditPayments.tenantId, req.tenantId)) });
      const remainingDebt = computeRemainingDebt(sale, updatedPayments, sale.returns || []);
      if (remainingDebt === 0) {
        await db.update(schema.sales).set({ paymentStatus: "paid" }).where(eq(schema.sales.id, id));
      }

      await logActivity(req, "COLLECT_CUSTOMER_DEBT_PARTIAL", `Müştəri nisyə borcundan qismən ödəniş aldı: ${paymentAmount.toFixed(2)} ₼ (Çek № ${id})`);
      res.json({ message: "Qismən ödəniş uğurla qeydə alındı" });
    } catch (error) {
      res.status(500).json({ message: "Ödəniş qeydə alınarkən xəta baş verdi" });
    }
  });

  router.delete("/sales/payments/:paymentId", requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const paymentId = parseInt(req.params.paymentId);
      const payment = await db.query.creditPayments.findFirst({ where: and(eq(schema.creditPayments.id, paymentId), eq(schema.creditPayments.tenantId, req.tenantId)) });
      if (!payment) return res.status(404).json({ message: "Ödəniş qeydi tapılmadı" });
      await db.delete(schema.creditPayments).where(eq(schema.creditPayments.id, paymentId));

      const sale = await db.query.sales.findFirst({ where: and(eq(schema.sales.id, payment.saleId), eq(schema.sales.tenantId, req.tenantId)), with: { payments: true, returns: true } });
      if (sale) {
      const saleForCheck = { totalAmount: sale.totalAmount, loyaltyDiscountPaid: sale.loyaltyDiscountPaid };
      const remainingAfterDelete = computeRemainingDebt(saleForCheck, sale.payments, sale.returns || []);
      if (remainingAfterDelete > 0) {
          await db.update(schema.sales).set({ paymentStatus: "credit" }).where(eq(schema.sales.id, payment.saleId));
        }
        await logActivity(req, "ROLLBACK_CUSTOMER_DEBT_PAYMENT", `Müştəri borc ödənişi ləğv edildi: ${payment.amount.toFixed(2)} ₼ (Çek № ${payment.saleId})`);
      }
      res.json({ message: "Ödəniş ləğv edildi" });
    } catch (error) {
      res.status(500).json({ message: "Ödəniş ləğv edilərkən xəta baş verdi" });
    }
  });

  router.post("/sales/fix-past-credits", requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const creditSales = await db.query.sales.findMany({ where: and(eq(schema.sales.paymentStatus, "credit"), eq(schema.sales.tenantId, req.tenantId)), with: { payments: true, returns: true } });
      let fixCount = 0;
      for (const sale of creditSales) {
        const remaining = computeRemainingDebt(sale, sale.payments, sale.returns || []);
        if (remaining === 0) {
          await db.update(schema.sales).set({ paymentStatus: "paid" }).where(eq(schema.sales.id, sale.id));
          fixCount++;
        }
      }
      await logActivity(req, "FIX_PAST_CREDITS", `Tam ödənilmiş ${fixCount} nisyə satışın statusu 'Ödənilib' olaraq yeniləndi.`);
      res.json({ message: `${fixCount} nisyə satışın statusu uğurla 'Ödənilib' olaraq düzəldildi.`, fixedCount: fixCount });
    } catch (error) {
      res.status(500).json({ message: "Nisyə təmizləmə əməliyyatı zamanı xəta baş verdi" });
    }
  });

  // ─── Satışı Ləğv Et (Void Sale) ──────────────────────────────────────
  
  router.delete("/sales/:id", requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Yanlış qaimə ID" });

      // Satışı bütün əlaqəli məlumatlarla gətir
      const sale = await db.query.sales.findFirst({
        where: and(eq(schema.sales.id, id), eq(schema.sales.tenantId, req.tenantId)),
        with: {
          items: true,
          payments: true,
          returns: { with: { items: true } },
          serials: true,
        },
      });

      if (!sale) return res.status(404).json({ message: "Satış qaiməsi tapılmadı" });

      // Əgər qaytarış varsa, void etməyi blokla
      if (sale.returns && sale.returns.length > 0) {
        return res.status(400).json({
          message: "Bu satışa aid geri qaytarışlar mövcuddur. Əvvəlcə qaytarışları silin.",
          hasReturns: true,
          returnsCount: sale.returns.length,
        });
      }

      await db.transaction(async (tx) => {
        // 1. Serial nömrələri "in_stock" statusuna qaytar
        if (sale.serials && sale.serials.length > 0) {
          for (const serial of sale.serials) {
            await tx.update(schema.productSerials)
              .set({
                status: "in_stock",
                saleId: null,
                soldAt: null,
              })
              .where(eq(schema.productSerials.id, serial.id));
          }
        }

        // 2. Satışı sil (cascade: saleItems, creditPayments avtomatik silinir)
        await tx.delete(schema.sales).where(eq(schema.sales.id, id));
      });

      await logActivity(req, "VOID_SALE",
        `Satış ləğv edildi: Çek № ${sale.id.toString().padStart(5, "0")} (Məbləğ: ${sale.totalAmount.toFixed(2)} ₼, Müştəri: ${sale.customerName || "Anonim"}, Ödəniş: ${sale.paymentType})`
      );

      res.json({
        success: true,
        message: `Qaimə #${sale.id.toString().padStart(5, "0")} uğurla ləğv edildi. Stok bərpa olundu.`,
        restoredSerials: sale.serials?.length || 0,
      });
    } catch (error) {
      console.error("Void sale error:", error);
      res.status(500).json({ message: "Satış ləğv edilərkən xəta baş verdi" });
    }
  });

  // ─── Returns ──────────────────────────────────────────────────────────

  router.get("/returns", async (req: AuthenticatedRequest, res) => {
    try {
      const returns = await db.query.returns.findMany({ where: eq(schema.returns.tenantId, req.tenantId), with: { items: { with: { product: true } }, serials: true }, orderBy: [desc(schema.returns.returnDate)] });
      res.json(returns);
    } catch (error) {
      res.status(500).json({ message: "Qaytarışları gətirərkən xəta baş verdi" });
    }
  });

  router.post("/returns", async (req: AuthenticatedRequest, res) => {
    try {
      const { saleId, reason, items, warehouseId } = req.body;
      if (!items || items.length === 0) return res.status(400).json({ message: "Qaytarış məlumatları boş ola bilməz" });

      let targetWarehouseId = warehouseId ? parseInt(warehouseId) : null;
      if (!targetWarehouseId && saleId) {
        const sale = await db.query.sales.findFirst({ where: eq(schema.sales.id, parseInt(saleId)) });
        if (sale?.warehouseId) targetWarehouseId = sale.warehouseId;
      }
      if (!targetWarehouseId) {
        const defaultWarehouse = await db.query.warehouses.findFirst({ where: (w: any, { eq, and }: any) => and(eq(w.tenantId, req.tenantId), eq(w.isDefault, 1)) });
        if (defaultWarehouse) targetWarehouseId = defaultWarehouse.id;
      }

      const result = await db.transaction(async (tx) => {
        const totalRefunded = items.reduce((sum: number, item: any) => sum + (parseFloat(item.quantity) * parseFloat(item.salePrice)), 0);
        const [newReturn] = await tx.insert(schema.returns).values({
          tenantId: req.tenantId, saleId: saleId ? parseInt(saleId) : null,
          returnDate: new Date().toISOString(), totalAmount: totalRefunded,
          reason: reason || "Müştəri qaytarışı", warehouseId: targetWarehouseId,
        }).returning();

        for (const item of items) {
          const qty = parseFloat(item.quantity);
          const salePrice = parseFloat(item.salePrice);
          const purchasePrice = parseFloat(item.purchasePrice) || 0;
          const status = item.status || "returned_to_stock";
          await tx.insert(schema.returnItems).values({
            tenantId: req.tenantId, returnId: newReturn.id, productId: parseInt(item.productId),
            quantity: qty, salePrice, purchasePrice, status,
          });

          if (item.serialNumbers && Array.isArray(item.serialNumbers)) {
            for (const sNum of item.serialNumbers) {
              await tx.update(schema.productSerials).set({
                status: status === "returned_to_stock" ? "in_stock" : "defective",
                returnId: newReturn.id, warehouseId: targetWarehouseId,
              }).where(and(eq(schema.productSerials.serialNumber, sNum.trim().toUpperCase()), eq(schema.productSerials.tenantId, req.tenantId)));
            }
          }
        }
        return newReturn;
      });

      await logActivity(req, "CREATE_RETURN", `Qaytarış qeydə alındı: #${result.id.toString().padStart(5, "0")}`);
      res.json(result);
    } catch (error) {
      console.error("Return error:", error);
      res.status(500).json({ message: "Qaytarış qeydə alınarkən xəta baş verdi" });
    }
  });

  // ─── Shifts ─────────────────────────────────────────────────────────────

  router.get("/shifts", async (req: AuthenticatedRequest, res) => {
    try {
      const shiftsList = await db.select().from(schema.shifts).where(eq(schema.shifts.tenantId, req.tenantId)).orderBy(desc(schema.shifts.openedAt));
      res.json(shiftsList);
    } catch (error) {
      res.status(500).json({ message: "Növbə tarixçəsini gətirərkən xəta baş verdi" });
    }
  });

  router.get("/shifts/active", async (req: AuthenticatedRequest, res) => {
    try {
      const seller = (req.headers["x-user-username"] as string || "").trim().toLowerCase() || "satici";
      const active = await db.query.shifts.findFirst({
        where: and(eq(schema.shifts.tenantId, req.tenantId), eq(schema.shifts.cashierName, seller), eq(schema.shifts.status, "open"))
      });
      res.json({ activeShift: active || null });
    } catch (error) {
      res.status(500).json({ message: "Aktiv növbə yoxlanılarkən xəta baş verdi" });
    }
  });

  router.post("/shifts/open", async (req: AuthenticatedRequest, res) => {
    try {
      const seller = (req.headers["x-user-username"] as string || "").trim().toLowerCase() || "satici";
      const existing = await db.query.shifts.findFirst({ where: and(eq(schema.shifts.tenantId, req.tenantId), eq(schema.shifts.cashierName, seller), eq(schema.shifts.status, "open")) });
      if (existing) return res.status(400).json({ message: "Aktiv növbəniz artıq açıqdır" });

      const user = await db.query.users.findFirst({ where: and(eq(schema.users.username, seller), eq(schema.users.tenantId, req.tenantId)) });
      const openingCash = parseFloat(req.body.openingCash) || 0;
      const [shift] = await db.insert(schema.shifts).values({
        tenantId: req.tenantId, cashierId: user?.id || 1, cashierName: seller,
        openedAt: new Date().toISOString(), openingCash, expectedCash: openingCash,
        actualCash: 0, variance: 0, status: "open",
      }).returning();

      await logActivity(req, "SHIFT_OPEN", `Kassa növbəsi açıldı. Giriş nağd balans: ${openingCash.toFixed(2)} AZN`);
      res.json(shift);
    } catch (error) {
      res.status(500).json({ message: "Növbə açılarkən xəta baş verdi" });
    }
  });

  router.post("/shifts/close", async (req: AuthenticatedRequest, res) => {
    try {
      const seller = (req.headers["x-user-username"] as string || "").trim().toLowerCase() || "satici";
      const shift = await db.query.shifts.findFirst({ where: and(eq(schema.shifts.tenantId, req.tenantId), eq(schema.shifts.cashierName, seller), eq(schema.shifts.status, "open")) });
      if (!shift) return res.status(404).json({ message: "Aktiv növbə tapılmadı" });

      const actualCash = parseFloat(req.body.actualCash) || 0;
      const sales = await db.select().from(schema.sales).where(and(eq(schema.sales.tenantId, req.tenantId), eq(schema.sales.shiftId, shift.id)));
      let cashSalesAmount = 0;
      for (const sale of sales) {
        if (sale.paymentType === "Nəğd" && sale.paymentStatus === "paid") {
          const discount = Number(sale.loyaltyDiscountPaid) || 0;
          cashSalesAmount += (sale.totalAmount || 0) - discount;
        }
      }

      const expectedCash = shift.openingCash + cashSalesAmount;
      const variance = actualCash - expectedCash;

      const [updated] = await db.update(schema.shifts).set({
        closedAt: new Date().toISOString(), expectedCash, actualCash, variance, status: "closed",
      }).where(eq(schema.shifts.id, shift.id)).returning();

      await logActivity(req, "SHIFT_CLOSE", `Kassa növbəsi bağlandı. Gözlənilən: ${expectedCash.toFixed(2)}, Sayılan: ${actualCash.toFixed(2)}, Fərq: ${variance.toFixed(2)} AZN`);

      res.json({
        shift: updated,
        stats: { openingCash: shift.openingCash, cashSalesAmount, cashReturnsAmount: 0, cashCreditRepaymentsAmount: 0, cashExpensesAmount: 0, expectedCash, actualCash, variance }
      });
    } catch (error) {
      res.status(500).json({ message: "Növbə bağlanarkən xəta baş verdi" });
    }
  });

  return router;
}
