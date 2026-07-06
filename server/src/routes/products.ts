import { Router } from "express";
import { db } from "../db/index.js";
import * as schema from "../db/schema.js";
import { eq, and, sql, inArray } from "drizzle-orm";
import { AuthenticatedRequest, normalizeName, checkUserPermission, logActivity, verifyTenantLimit } from "./helpers.js";

export default function productRoutes(): Router {
  const router = Router();

  router.get("/products", async (req: AuthenticatedRequest, res) => {
    try {
      const list = await db.select().from(schema.products).where(eq(schema.products.tenantId, req.tenantId));

      const soldItems = await db.select({ productId: schema.saleItems.productId }).from(schema.saleItems).where(eq(schema.saleItems.tenantId, req.tenantId));
      const returnedItems = await db.select({ productId: schema.returnItems.productId }).from(schema.returnItems).where(eq(schema.returnItems.tenantId, req.tenantId));

      const historySet = new Set<number>();
      soldItems.forEach(item => historySet.add(item.productId));
      returnedItems.forEach(item => historySet.add(item.productId));

      const mapped = list.map(p => ({ ...p, hasHistory: historySet.has(p.id) }));
      res.json(mapped);
    } catch (error) {
      res.status(500).json({ message: "Məhsulları gətirərkən xəta baş verdi" });
    }
  });

  router.post("/products", async (req: AuthenticatedRequest, res) => {
    try {
      if (!await checkUserPermission(req, "staffCanManageCatalog")) {
        return res.status(403).json({ message: "Bu əməliyyat üçün səlahiyyətiniz yoxdur." });
      }
      const { name, category, unit, description, barcode, trackingType, serialNumber, warrantyMonths, vendorId } = req.body;
      if (!name) return res.status(400).json({ message: "Ad tələb olunur" });

      const normalizedNewName = normalizeName(name);
      const allProducts = await db.query.products.findMany({
        where: and(eq(schema.products.tenantId, req.tenantId), eq(schema.products.isArchived, 0))
      });

      for (const p of allProducts) {
        const existingNameNormalized = normalizeName(p.name);
        const existingKeywords = p.description ? p.description.split(/[,;]+/).map(k => normalizeName(k)).filter(Boolean) : [];
        if (existingNameNormalized === normalizedNewName) {
          return res.status(400).json({ message: `Bu adda məhsul artıq kataloqda mövcuddur: '${p.name}'.` });
        }
        if (existingKeywords.includes(normalizedNewName)) {
          return res.status(400).json({ message: `Bu məhsul artıq mövcuddur (Açar sözlər ilə eşləşdi: '${p.name}').` });
        }
      }

      if (barcode) {
        const existingProduct = await db.query.products.findFirst({ where: and(eq(schema.products.barcode, barcode), eq(schema.products.tenantId, req.tenantId)) });
        if (existingProduct) return res.status(400).json({ message: "Bu barkod artıq başqa məhsula təyin edilib" });
      }

      if (trackingType === "serialized" && serialNumber) {
        const cleaned = serialNumber.trim().toUpperCase();
        const existing = await db.query.productSerials.findFirst({
          where: and(eq(schema.productSerials.serialNumber, cleaned), eq(schema.productSerials.tenantId, req.tenantId), inArray(schema.productSerials.status, ["in_stock", "sold"])),
        });
        if (existing) return res.status(400).json({ message: `Serial nömrə (${cleaned}) artıq bazada mövcuddur (Status: ${existing.status})` });
      }

      const limitCheck = await verifyTenantLimit(req.tenantId, "products");
      if (!limitCheck.allowed) {
        return res.status(402).json({
          limitReached: true, limitType: "products", current: limitCheck.current,
          max: limitCheck.max, tier: limitCheck.tier,
          message: `Məhsul limitinə çatdınız! Mövcud planınızda limit: ${limitCheck.max} məhsul.`
        });
      }

      const createdProduct = await db.transaction(async (tx) => {
        const productRows = await tx.insert(schema.products).values({
          tenantId: req.tenantId, name, category: category || null, unit: unit || "ədəd",
          description: description || null, barcode: barcode || null,
          trackingType: trackingType || "none",
          warrantyMonths: warrantyMonths ? parseInt(String(warrantyMonths)) : null,
          vendorId: vendorId ? parseInt(String(vendorId)) : null,
        }).returning();
        const prod = productRows[0];

        if (trackingType === "serialized" && serialNumber) {
          const cleanedSerial = serialNumber.trim().toUpperCase();
          const entryRows = await tx.insert(schema.stockEntries).values({
            tenantId: req.tenantId, productId: prod.id, quantity: 1, purchasePrice: 0,
            supplier: "İlkin Mədaxil", notes: "Məhsul yaradılarkən avtomatik əlavə edilib",
            paymentType: "Nəğd", paidStatus: "paid", entryDate: new Date().toISOString(),
          }).returning();
          await tx.insert(schema.productSerials).values({
            tenantId: req.tenantId, productId: prod.id, stockEntryId: entryRows[0].id,
            serialNumber: cleanedSerial, status: "in_stock", createdAt: new Date().toISOString(),
          });
        }
        return prod;
      });

      await logActivity(req, "CREATE_PRODUCT", `Yeni məhsul yaratdı: '${name}'${serialNumber ? ` (İlkin S/N: ${serialNumber.trim().toUpperCase()})` : ""}`);
      res.json(createdProduct);
    } catch (error) {
      console.error("Product creation error:", error);
      res.status(500).json({ message: "Məhsul yaradılarkən xəta baş verdi" });
    }
  });

  router.put("/products/:id", async (req: AuthenticatedRequest, res) => {
    try {
      if (!await checkUserPermission(req, "staffCanManageCatalog")) {
        return res.status(403).json({ message: "Bu əməliyyat üçün səlahiyyətiniz yoxdur." });
      }
      const id = parseInt(req.params.id);
      const { name, category, unit, description, barcode, trackingType, warrantyMonths, isArchived, vendorId } = req.body;

      const currentProduct = await db.query.products.findFirst({ where: and(eq(schema.products.id, id), eq(schema.products.tenantId, req.tenantId)) });
      if (!currentProduct) return res.status(404).json({ message: "Məhsul tapılmadı" });

      const resolvedName = name !== undefined ? name : currentProduct.name;
      const resolvedDescription = description !== undefined ? description : currentProduct.description;

      if (resolvedName) {
        const normalizedNewName = normalizeName(resolvedName);
        const allProducts = await db.query.products.findMany({
          where: and(eq(schema.products.tenantId, req.tenantId), eq(schema.products.isArchived, 0), sql`${schema.products.id} != ${id}`)
        });
        for (const p of allProducts) {
          const existingNameNormalized = normalizeName(p.name);
          const existingKeywords = p.description ? p.description.split(/[,;]+/).map(k => normalizeName(k)).filter(Boolean) : [];
          if (existingNameNormalized === normalizedNewName) {
            return res.status(400).json({ message: `Bu adda məhsul artıq kataloqda mövcuddur: '${p.name}'. Fərqli bir ad seçin.` });
          }
          if (existingKeywords.includes(normalizedNewName)) {
            return res.status(400).json({ message: `Bu məhsul artıq mövcuddur (Açar sözlər ilə eşləşdi: '${p.name}').` });
          }
        }
      }

      if (barcode) {
        const existingProduct = await db.query.products.findFirst({
          where: and(eq(schema.products.barcode, barcode), eq(schema.products.tenantId, req.tenantId), sql`${schema.products.id} != ${id}`)
        });
        if (existingProduct) return res.status(400).json({ message: "Bu barkod artıq başqa məhsula təyin edilib" });
      }

      const updated = await db.update(schema.products).set({
        name, category: category || null, unit: unit || "ədəd", description: description || null,
        barcode: barcode || null, trackingType: trackingType || "none",
        warrantyMonths: warrantyMonths ? parseInt(String(warrantyMonths)) : null,
        isArchived: isArchived !== undefined ? parseInt(String(isArchived)) : undefined,
        vendorId: vendorId !== undefined ? (vendorId ? parseInt(String(vendorId)) : null) : undefined,
      }).where(and(eq(schema.products.id, id), eq(schema.products.tenantId, req.tenantId))).returning();

      if (updated.length === 0) return res.status(404).json({ message: "Məhsul tapılmadı" });

      if (isArchived !== undefined && parseInt(String(isArchived)) !== currentProduct.isArchived) {
        if (parseInt(String(isArchived)) === 1) {
          await logActivity(req, "ARCHIVE_PRODUCT", `'${resolvedName}' (ID: ${id}) məhsulunu arxivə göndərdi`);
        } else {
          await logActivity(req, "RESTORE_PRODUCT", `'${resolvedName}' (ID: ${id}) məhsulunu arxivdən bərpa etdi`);
        }
      } else {
        await logActivity(req, "UPDATE_PRODUCT", `'${resolvedName}' (ID: ${id}) məhsulunun məlumatlarını yenilədi`);
      }

      res.json(updated[0]);
    } catch (error) {
      console.error("Update product error:", error);
      res.status(500).json({ message: "Məhsul yenilənərkən xəta baş verdi" });
    }
  });

  router.delete("/products/:id", async (req: AuthenticatedRequest, res) => {
    try {
      if (!await checkUserPermission(req, "staffCanManageCatalog")) {
        return res.status(403).json({ message: "Bu əməliyyat üçün səlahiyyətiniz yoxdur." });
      }
      const id = parseInt(req.params.id);

      const hasSales = await db.select({ id: schema.saleItems.id }).from(schema.saleItems)
        .where(and(eq(schema.saleItems.productId, id), eq(schema.saleItems.tenantId, req.tenantId))).limit(1);
      const hasReturns = await db.select({ id: schema.returnItems.id }).from(schema.returnItems)
        .where(and(eq(schema.returnItems.productId, id), eq(schema.returnItems.tenantId, req.tenantId))).limit(1);

      if (hasSales.length > 0 || hasReturns.length > 0) {
        return res.status(400).json({ message: "Bu məhsulu silmək mümkün deyil, keçmiş satış/qaytarış məlumatları mövcuddur. Arxivləşdirin." });
      }

      const deleted = await db.delete(schema.products).where(and(eq(schema.products.id, id), eq(schema.products.tenantId, req.tenantId))).returning();
      if (deleted.length === 0) return res.status(404).json({ message: "Məhsul tapılmadı" });

      await logActivity(req, "DELETE_PRODUCT", `'${deleted[0].name}' (ID: ${id}) məhsulunu kataloqdan sildi`);
      res.json({ message: "Məhsul silindi" });
    } catch (error: any) {
      console.error("Delete product error:", error);
      res.status(500).json({ message: "Məhsul silinərkən xəta baş verdi: " + (error.message || "") });
    }
  });

  return router;
}
