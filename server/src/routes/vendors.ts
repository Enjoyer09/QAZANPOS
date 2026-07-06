import { Router } from "express";
import { db } from "../db/index.js";
import * as schema from "../db/schema.js";
import { eq, and, sql, desc } from "drizzle-orm";
import { AuthenticatedRequest, requireAdmin, logActivity } from "./helpers.js";

export default function vendorRoutes(): Router {
  const router = Router();

  // ─── Vendors CRUD ──────────────────────────────────────────────────────

  router.get("/vendors", async (req: AuthenticatedRequest, res) => {
    try {
      const list = await db.select().from(schema.vendors).where(eq(schema.vendors.tenantId, req.tenantId)).orderBy(schema.vendors.name);
      res.json(list);
    } catch (error) {
      res.status(500).json({ message: "Tədarükçüləri gətirərkən xəta baş verdi" });
    }
  });

  router.post("/vendors", async (req: AuthenticatedRequest, res) => {
    try {
      const { name, phone, email, address, notes } = req.body;
      if (!name) return res.status(400).json({ message: "Tədarükçü adı tələb olunur" });
      const [vendor] = await db.insert(schema.vendors).values({
        tenantId: req.tenantId, name, phone: phone || null, email: email || null,
        address: address || null, notes: notes || null, createdAt: new Date().toISOString(),
      }).returning();
      await logActivity(req, "CREATE_VENDOR", `Yeni tədarükçü: '${name}'`);
      res.json(vendor);
    } catch (error) {
      res.status(500).json({ message: "Tədarükçü yaradılarkən xəta baş verdi" });
    }
  });

  router.put("/vendors/:id", async (req: AuthenticatedRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const { name, phone, email, address, notes } = req.body;
      const [updated] = await db.update(schema.vendors).set({
        name, phone: phone || null, email: email || null, address: address || null, notes: notes || null,
      }).where(and(eq(schema.vendors.id, id), eq(schema.vendors.tenantId, req.tenantId))).returning();
      if (!updated) return res.status(404).json({ message: "Tədarükçü tapılmadı" });
      await logActivity(req, "UPDATE_VENDOR", `'${name}' (ID: ${id}) tədarükçü məlumatları yeniləndi`);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Tədarükçü yenilənərkən xəta baş verdi" });
    }
  });

  router.delete("/vendors/:id", requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const [deleted] = await db.delete(schema.vendors).where(and(eq(schema.vendors.id, id), eq(schema.vendors.tenantId, req.tenantId))).returning();
      if (!deleted) return res.status(404).json({ message: "Tədarükçü tapılmadı" });
      await logActivity(req, "DELETE_VENDOR", `'${deleted.name}' (ID: ${id}) tədarükçü silindi`);
      res.json({ message: "Tədarükçü silindi" });
    } catch (error) {
      res.status(500).json({ message: "Tədarükçü silinərkən xəta baş verdi" });
    }
  });

  // ─── Vendor Returns ───────────────────────────────────────────────────

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
        const defaultWarehouse = await db.query.warehouses.findFirst({ where: (w: any, { eq, and }: any) => and(eq(w.tenantId, req.tenantId), eq(w.isDefault, 1)) });
        if (defaultWarehouse) targetWarehouseId = defaultWarehouse.id;
      }

      const result = await db.transaction(async (tx) => {
        const totalReturnAmount = items.reduce((sum: number, item: any) => sum + (parseFloat(item.quantity) * parseFloat(item.purchasePrice)), 0);
        const [newReturn] = await tx.insert(schema.vendorReturns).values({
          tenantId: req.tenantId, vendorId: parseInt(vendorId), returnDate: new Date().toISOString(),
          totalAmount: totalReturnAmount, paymentType, notes: notes || null, warehouseId: targetWarehouseId,
        }).returning();

        for (const item of items) {
          await tx.insert(schema.vendorReturnItems).values({
            tenantId: req.tenantId, vendorReturnId: newReturn.id, productId: parseInt(item.productId),
            stockEntryId: item.stockEntryId ? parseInt(item.stockEntryId) : null,
            quantity: parseFloat(item.quantity), purchasePrice: parseFloat(item.purchasePrice),
            notes: item.notes || null,
          });

          if (item.serialNumbers && Array.isArray(item.serialNumbers)) {
            for (const sNum of item.serialNumbers) {
              await tx.update(schema.productSerials).set({ status: "written_off" })
                .where(and(eq(schema.productSerials.serialNumber, sNum.trim().toUpperCase()), eq(schema.productSerials.tenantId, req.tenantId)));
            }
          }
        }

        return newReturn;
      });

      const vendorName = (await db.query.vendors.findFirst({ where: eq(schema.vendors.id, parseInt(vendorId)) }))?.name || `ID: ${vendorId}`;
      await logActivity(req, "CREATE_VENDOR_RETURN", `Tədarükçüyə qaytarış: #${result.id.toString().padStart(5, "0")} (${vendorName}, Üsul: ${paymentType})`);
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

  // ─── Vendor Payments ───────────────────────────────────────────────────

  router.get("/vendor-payments", async (req: AuthenticatedRequest, res) => {
    try {
      const payments = await db.select().from(schema.vendorPayments).where(eq(schema.vendorPayments.tenantId, req.tenantId)).orderBy(desc(schema.vendorPayments.paymentDate));
      res.json(payments);
    } catch (error) {
      res.status(500).json({ message: "Tədarükçü ödənişlərini gətirərkən xəta baş verdi" });
    }
  });

  return router;
}
