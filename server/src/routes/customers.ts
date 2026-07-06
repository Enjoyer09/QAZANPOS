import { Router } from "express";
import { db } from "../db/index.js";
import * as schema from "../db/schema.js";
import { eq, and, desc } from "drizzle-orm";
import { AuthenticatedRequest, requireAdmin, checkUserPermission, logActivity } from "./helpers.js";

export default function customerRoutes(): Router {
  const router = Router();

  router.get("/customers", async (req: AuthenticatedRequest, res) => {
    try {
      const role = req.headers["x-user-role"] as string;
      const username = req.headers["x-user-username"] as string;
      let conditions = eq(schema.customers.tenantId, req.tenantId);
      if (role !== "Admin") {
        const normalizedUsername = username ? username.trim().toLowerCase() : "";
        conditions = and(conditions, eq(schema.customers.createdByName, normalizedUsername)) as any;
      }
      const list = await db.select().from(schema.customers).where(conditions);
      res.json(list);
    } catch (error) {
      res.status(500).json({ message: "Müştəriləri gətirərkən xəta baş verdi" });
    }
  });

  router.post("/customers", async (req: AuthenticatedRequest, res) => {
    try {
      const { name, phone, email, address, notes } = req.body;
      if (!name) return res.status(400).json({ message: "Müştəri adı tələb olunur" });
      const rawCreator = req.headers["x-user-username"] as string;
      const createdByName = rawCreator ? rawCreator.trim().toLowerCase() : (req.headers["x-user-role"] === "Admin" ? "admin" : "satici");
      const [newCustomer] = await db.insert(schema.customers).values({
        tenantId: req.tenantId, name, phone: phone || null, email: email || null,
        address: address || null, notes: notes || null, createdByName,
      }).returning();
      await logActivity(req, "CREATE_CUSTOMER", `Yeni müştəri profili yaratdı: '${name}'`);
      res.json(newCustomer);
    } catch (error) {
      res.status(500).json({ message: "Müştəri yaradılarkən xəta baş verdi" });
    }
  });

  router.put("/customers/:id", async (req: AuthenticatedRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const { name, phone, email, address, notes } = req.body;
      const customer = await db.query.customers.findFirst({ where: and(eq(schema.customers.id, id), eq(schema.customers.tenantId, req.tenantId)) });
      if (!customer) return res.status(404).json({ message: "Müştəri tapılmadı" });

      const role = req.headers["x-user-role"] as string;
      const username = req.headers["x-user-username"] as string;
      if (role !== "Admin") {
        if (customer.createdByName !== (username ? username.trim().toLowerCase() : "")) {
          return res.status(403).json({ message: "Bu müştəri profilini yeniləmək üçün səlahiyyətiniz yoxdur" });
        }
      }

      const [updated] = await db.update(schema.customers).set({
        name, phone: phone || null, email: email || null, address: address || null, notes: notes || null,
      }).where(and(eq(schema.customers.id, id), eq(schema.customers.tenantId, req.tenantId))).returning();

      await logActivity(req, "UPDATE_CUSTOMER", `'${name}' (ID: ${id}) müştərisinin məlumatlarını yenilədi`);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Müştəri yenilənərkən xəta baş verdi" });
    }
  });

  router.delete("/customers/:id", requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const [deleted] = await db.delete(schema.customers).where(and(eq(schema.customers.id, id), eq(schema.customers.tenantId, req.tenantId))).returning();
      if (!deleted) return res.status(404).json({ message: "Müştəri tapılmadı" });
      await logActivity(req, "DELETE_CUSTOMER", `'${deleted.name}' (ID: ${id}) müştəri profilini sistemdən sildi`);
      res.json({ message: "Müştəri silindi" });
    } catch (error) {
      res.status(500).json({ message: "Müştəri silinərkən xəta baş verdi" });
    }
  });

  router.get("/customers/:id/sales", async (req: AuthenticatedRequest, res) => {
    try {
      const customerId = parseInt(req.params.id);
      if (!await checkUserPermission(req, "staffCanViewCustomers") || !await checkUserPermission(req, "staffCanViewSalesHistory")) {
        return res.status(403).json({ message: "Giriş məhdudlaşdırılıb" });
      }
      let conditions = and(eq(schema.sales.customerId, customerId), eq(schema.sales.tenantId, req.tenantId));
      const role = req.headers["x-user-role"] as string;
      const username = req.headers["x-user-username"] as string;
      if (role !== "Admin") {
        conditions = and(conditions, eq(schema.sales.sellerName, username ? username.trim().toLowerCase() : "")) as any;
      }
      const customerSales = await db.query.sales.findMany({ where: conditions, with: { items: { with: { product: true } }, payments: true }, orderBy: [desc(schema.sales.saleDate)] });
      res.json(customerSales);
    } catch (error) {
      res.status(500).json({ message: "Müştəri satışlarını gətirərkən xəta baş verdi" });
    }
  });

  return router;
}
