import { Router } from "express";
import { db } from "../db/index.js";
import * as schema from "../db/schema.js";
import { eq, and, desc } from "drizzle-orm";
import { AuthenticatedRequest, checkUserPermission, logActivity } from "./helpers.js";

export default function expenseRoutes(): Router {
  const router = Router();

  router.get("/expenses", async (req: AuthenticatedRequest, res) => {
    try {
      const expenses = await db.select().from(schema.expenses).where(eq(schema.expenses.tenantId, req.tenantId)).orderBy(desc(schema.expenses.date));
      res.json(expenses);
    } catch (error) {
      res.status(500).json({ message: "Xərcləri gətirərkən xəta baş verdi" });
    }
  });

  router.post("/expenses", async (req: AuthenticatedRequest, res) => {
    try {
      const { amount, category, description, paymentType, date } = req.body;
      if (!amount || !category) return res.status(400).json({ message: "Məbləğ və kateqoriya mütləqdir" });
      const [expense] = await db.insert(schema.expenses).values({
        tenantId: req.tenantId, amount: parseFloat(amount), category,
        description: description || null, paymentType: paymentType || "cash",
        date: date || new Date().toISOString(),
      }).returning();
      await logActivity(req, "CREATE_EXPENSE", `Xərc əlavə edildi: ${category} (${parseFloat(amount).toFixed(2)} AZN)`);
      res.json(expense);
    } catch (error) {
      res.status(500).json({ message: "Xərc qeydə alınarkən xəta baş verdi" });
    }
  });

  router.put("/expenses/:id", async (req: AuthenticatedRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const { amount, category, description, paymentType, date } = req.body;
      const [updated] = await db.update(schema.expenses).set({
        amount: parseFloat(amount), category, description: description || null,
        paymentType: paymentType || "cash", date: date || new Date().toISOString(),
      }).where(and(eq(schema.expenses.id, id), eq(schema.expenses.tenantId, req.tenantId))).returning();
      if (!updated) return res.status(404).json({ message: "Xərc tapılmadı" });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Xərc yenilənərkən xəta baş verdi" });
    }
  });

  router.delete("/expenses/:id", async (req: AuthenticatedRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const [deleted] = await db.delete(schema.expenses).where(and(eq(schema.expenses.id, id), eq(schema.expenses.tenantId, req.tenantId))).returning();
      if (!deleted) return res.status(404).json({ message: "Xərc tapılmadı" });
      await logActivity(req, "DELETE_EXPENSE", `Xərc silindi: ${deleted.category}`);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Xərc silinərkən xəta baş verdi" });
    }
  });

  return router;
}
