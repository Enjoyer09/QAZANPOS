import { Router } from "express";
import { db } from "../db/index.js";
import * as schema from "../db/schema.js";
import { eq, and, desc, asc } from "drizzle-orm";
import { AuthenticatedRequest, requireAdmin, logActivity, checkUserPermission } from "./helpers.js";

export default function vendorRoutes(): Router {
  const router = Router();

  // ─── GET /vendors — List all vendors with aggregated balances ─────────────
  router.get("/vendors", async (req: AuthenticatedRequest, res) => {
    try {
      if (!await checkUserPermission(req, "staffCanViewVendors")) {
        return res.status(403).json({ message: "Tədarükçü məlumatlarına giriş administrator tərəfindən məhdudlaşdırılıb" });
      }

      const allVendors = await db.select().from(schema.vendors).where(eq(schema.vendors.tenantId, req.tenantId));
      const result = [];

      for (const vendor of allVendors) {
        const purchases = await db.select().from(schema.stockEntries).where(
          and(eq(schema.stockEntries.vendorId, vendor.id), eq(schema.stockEntries.tenantId, req.tenantId))
        );

        const totalPurchases = purchases.reduce((acc, p) => acc + (p.quantity * p.purchasePrice), 0);
        const creditPurchases = purchases.filter(p => p.paidStatus === "credit" || p.paymentType === "Nisyə");
        const totalDebtCreated = creditPurchases.reduce((acc, p) => acc + (p.quantity * p.purchasePrice), 0);

        const payments = await db.select().from(schema.vendorPayments).where(
          and(eq(schema.vendorPayments.vendorId, vendor.id), eq(schema.vendorPayments.tenantId, req.tenantId))
        );
        const totalPayments = payments.reduce((acc, pay) => acc + pay.amount, 0);

        const returnsList = await db.select().from(schema.vendorReturns).where(
          and(eq(schema.vendorReturns.vendorId, vendor.id), eq(schema.vendorReturns.tenantId, req.tenantId))
        );
        const totalReturnDeductions = returnsList
          .filter(r => r.paymentType === "Borcdan Silinmə")
          .reduce((acc, r) => acc + r.totalAmount, 0);

        const balance = totalDebtCreated - totalPayments - totalReturnDeductions;

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

  // ─── GET /vendors/payments — All vendor payments globally (ledger) ─────────
  // IMPORTANT: This route MUST be defined BEFORE /vendors/:id routes
  router.get("/vendors/payments", requireAdmin, async (req: AuthenticatedRequest, res) => {
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

  // ─── POST /vendors — Create vendor ───────────────────────────────────────
  router.post("/vendors", requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const { name, phone, email, address, notes } = req.body;
      if (!name) return res.status(400).json({ message: "Tədarükçü adı məcburidir" });

      const [newVendor] = await db.insert(schema.vendors).values({
        tenantId: req.tenantId, name,
        phone: phone || null, email: email || null,
        address: address || null, notes: notes || null,
        createdAt: new Date().toISOString(),
      }).returning();

      await logActivity(req, "CREATE_VENDOR", `Yeni tədarükçü əlavə etdi: ${name}`);
      res.json(newVendor);
    } catch (error) {
      res.status(500).json({ message: "Tədarükçü yaradılarkən xəta baş verdi" });
    }
  });

  // ─── PUT /vendors/:id — Update vendor ────────────────────────────────────
  router.put("/vendors/:id", requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const { name, phone, email, address, notes } = req.body;
      if (!name) return res.status(400).json({ message: "Tədarükçü adı məcburidir" });

      const [updated] = await db.update(schema.vendors).set({
        name, phone: phone || null, email: email || null,
        address: address || null, notes: notes || null,
      }).where(and(eq(schema.vendors.id, id), eq(schema.vendors.tenantId, req.tenantId))).returning();

      if (!updated) return res.status(404).json({ message: "Tədarükçü tapılmadı" });

      await logActivity(req, "UPDATE_VENDOR", `Tədarükçü məlumatlarını yenilədi: ${name}`);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Tədarükçü yenilənərkən xəta baş verdi" });
    }
  });

  // ─── DELETE /vendors/:id — Delete vendor ─────────────────────────────────
  router.delete("/vendors/:id", requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const [deleted] = await db.delete(schema.vendors)
        .where(and(eq(schema.vendors.id, id), eq(schema.vendors.tenantId, req.tenantId)))
        .returning();

      if (!deleted) return res.status(404).json({ message: "Tədarükçü tapılmadı" });

      await logActivity(req, "DELETE_VENDOR", `Tədarükçünü sildi: ${deleted.name}`);
      res.json({ message: "Tədarükçü uğurla silindi" });
    } catch (error) {
      res.status(500).json({ message: "Tədarükçü silinərkən xəta baş verdi" });
    }
  });

  // ─── GET /vendors/:id/payments — Payments for a specific vendor ───────────
  router.get("/vendors/:id/payments", requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const payments = await db.select().from(schema.vendorPayments).where(
        and(eq(schema.vendorPayments.vendorId, id), eq(schema.vendorPayments.tenantId, req.tenantId))
      ).orderBy(desc(schema.vendorPayments.paymentDate));

      res.json(payments);
    } catch (error) {
      res.status(500).json({ message: "Tədarükçü ödənişlərini gətirərkən xəta baş verdi" });
    }
  });

  // ─── POST /vendors/:id/payments — Create payment to vendor ───────────────
  router.post("/vendors/:id/payments", requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const { amount, paymentType, notes, paymentDate } = req.body;
      if (!amount || parseFloat(amount) <= 0 || !paymentType) {
        return res.status(400).json({ message: "Məbləğ və ödəniş növü məcburidir" });
      }

      const vendor = await db.query.vendors.findFirst({
        where: and(eq(schema.vendors.id, id), eq(schema.vendors.tenantId, req.tenantId))
      });
      if (!vendor) return res.status(404).json({ message: "Tədarükçü tapılmadı" });

      const parsedAmount = parseFloat(amount);

      const [newPayment] = await db.insert(schema.vendorPayments).values({
        tenantId: req.tenantId, vendorId: id,
        amount: parsedAmount, paymentType,
        notes: notes || null,
        paymentDate: paymentDate || new Date().toISOString(),
      }).returning();

      // FIFO: auto-mark oldest unpaid credit stock entries as paid
      const unpaidEntries = await db.query.stockEntries.findMany({
        where: and(
          eq(schema.stockEntries.vendorId, id),
          eq(schema.stockEntries.paidStatus, "credit"),
          eq(schema.stockEntries.tenantId, req.tenantId)
        ),
        orderBy: [asc(schema.stockEntries.entryDate)],
      });

      let remainingPayment = parsedAmount;
      for (const entry of unpaidEntries) {
        const debtAmount = entry.quantity * entry.purchasePrice;
        if (remainingPayment >= debtAmount) {
          await db.update(schema.stockEntries).set({ paidStatus: "paid" }).where(eq(schema.stockEntries.id, entry.id));
          remainingPayment -= debtAmount;
        } else {
          break;
        }
      }

      await logActivity(req, "CREATE_VENDOR_PAYMENT", `Tədarükçüyə ödəniş etdi: ${vendor.name} (${amount} ₼, Ödəniş: ${paymentType})`);
      res.json(newPayment);
    } catch (error) {
      res.status(500).json({ message: "Tədarükçüyə ödəniş edilərkən xəta baş verdi" });
    }
  });

  // ─── Vendor Returns ───────────────────────────────────────────────────────

  router.get("/vendor-returns", async (req: AuthenticatedRequest, res) => {
    try {
      const returns = await db.query.vendorReturns.findMany({
        where: eq(schema.vendorReturns.tenantId, req.tenantId),
        with: { vendor: true, items: { with: { product: true, stockEntry: true } } },
        orderBy: [desc(schema.vendorReturns.returnDate)],
      });
      res.json(returns);
    } catch (error) {
      res.status(500).json({ message: "Tədarükçü qaytarışlarını gətirərkən xəta baş verdi" });
    }
  });

  router.post("/vendor-returns", async (req: AuthenticatedRequest, res) => {
    try {
      const { vendorId, paymentType, notes, items, warehouseId } = req.body;
      if (!vendorId || !paymentType || !items || items.length === 0) {
        return res.status(400).json({ message: "Məlumatlar tam doldurulmayıb" });
      }

      let targetWarehouseId = warehouseId ? parseInt(warehouseId) : null;
      if (!targetWarehouseId) {
        const defaultWarehouse = await db.query.warehouses.findFirst({
          where: (w: any, { eq, and }: any) => and(eq(w.tenantId, req.tenantId), eq(w.isDefault, 1))
        });
        if (defaultWarehouse) targetWarehouseId = defaultWarehouse.id;
      }

      const result = await db.transaction(async (tx) => {
        const totalReturnAmount = items.reduce(
          (sum: number, item: any) => sum + (parseFloat(item.quantity) * parseFloat(item.purchasePrice)), 0
        );
        const [newReturn] = await tx.insert(schema.vendorReturns).values({
          tenantId: req.tenantId, vendorId: parseInt(vendorId),
          returnDate: new Date().toISOString(),
          totalAmount: totalReturnAmount, paymentType, notes: notes || null, warehouseId: targetWarehouseId,
        }).returning();

        for (const item of items) {
          await tx.insert(schema.vendorReturnItems).values({
            tenantId: req.tenantId, vendorReturnId: newReturn.id,
            productId: parseInt(item.productId),
            stockEntryId: item.stockEntryId ? parseInt(item.stockEntryId) : null,
            quantity: parseFloat(item.quantity), purchasePrice: parseFloat(item.purchasePrice),
            notes: item.notes || null,
          });

          if (item.serialNumbers && Array.isArray(item.serialNumbers)) {
            for (const sNum of item.serialNumbers) {
              await tx.update(schema.productSerials).set({ status: "written_off" })
                .where(and(
                  eq(schema.productSerials.serialNumber, sNum.trim().toUpperCase()),
                  eq(schema.productSerials.tenantId, req.tenantId)
                ));
            }
          }
        }

        return newReturn;
      });

      const vendorName = (await db.query.vendors.findFirst({
        where: eq(schema.vendors.id, parseInt(vendorId))
      }))?.name || `ID: ${vendorId}`;

      await logActivity(req, "CREATE_VENDOR_RETURN",
        `Tədarükçüyə qaytarış: #${result.id.toString().padStart(5, "0")} (${vendorName}, Üsul: ${paymentType})`);
      res.json(result);
    } catch (error) {
      console.error("Vendor return error:", error);
      res.status(500).json({ message: "Tədarükçüyə qaytarış qeydə alınarkən xəta baş verdi" });
    }
  });

  router.get("/vendor-returns/:id", async (req: AuthenticatedRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const ret = await db.query.vendorReturns.findFirst({
        where: and(eq(schema.vendorReturns.id, id), eq(schema.vendorReturns.tenantId, req.tenantId)),
        with: { vendor: true, items: { with: { product: true } } },
      });
      if (!ret) return res.status(404).json({ message: "Qaytarış tapılmadı" });
      res.json(ret);
    } catch (error) {
      res.status(500).json({ message: "Qaytarış məlumatlarını gətirərkən xəta baş verdi" });
    }
  });

  // ─── Vendor Payments (alternate path) ────────────────────────────────────
  router.get("/vendor-payments", async (req: AuthenticatedRequest, res) => {
    try {
      const payments = await db.select().from(schema.vendorPayments)
        .where(eq(schema.vendorPayments.tenantId, req.tenantId))
        .orderBy(desc(schema.vendorPayments.paymentDate));
      res.json(payments);
    } catch (error) {
      res.status(500).json({ message: "Tədarükçü ödənişlərini gətirərkən xəta baş verdi" });
    }
  });

  return router;
}
