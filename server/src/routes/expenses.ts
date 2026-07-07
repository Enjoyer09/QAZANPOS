import { Router } from "express";
import { db } from "../db/index.js";
import * as schema from "../db/schema.js";
import { eq, and, desc, gte, lte, sql } from "drizzle-orm";
import { AuthenticatedRequest, checkUserPermission, logActivity, requireAdmin } from "./helpers.js";

export default function expenseRoutes(): Router {
  const router = Router();

  // ── Expenses CRUD ───────────────────────────────────────────────────────

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

      const parsedAmount = parseFloat(amount);
      const expenseDate = date || new Date().toISOString();

      // ── Check monthly expense limit ──
      const limit = await db.query.expenseLimits.findFirst({
        where: and(eq(schema.expenseLimits.tenantId, req.tenantId), eq(schema.expenseLimits.category, category))
      });
      if (limit && limit.monthlyLimit > 0) {
        // Get start of current month
        const now = new Date(expenseDate);
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

        const monthExpenses = await db
          .select({ total: sql`COALESCE(SUM(amount), 0)` })
          .from(schema.expenses)
          .where(and(
            eq(schema.expenses.tenantId, req.tenantId),
            eq(schema.expenses.category, category),
            gte(schema.expenses.date, monthStart),
            lte(schema.expenses.date, monthEnd)
          ));

        const currentTotal = parseFloat((monthExpenses[0]?.total as string) || "0");
        const projectedTotal = currentTotal + parsedAmount;

        if (projectedTotal > limit.monthlyLimit) {
          return res.status(409).json({
            limitExceeded: true,
            category,
            monthlyLimit: limit.monthlyLimit,
            currentTotal,
            attemptedAmount: parsedAmount,
            message: `"${category}" kateqoriyası üzrə aylıq limit ${limit.monthlyLimit.toFixed(2)} ₼ keçilir! (Cari: ${currentTotal.toFixed(2)} ₼ + ${parsedAmount.toFixed(2)} ₼ = ${projectedTotal.toFixed(2)} ₼)`
          });
        }
      }

      const [expense] = await db.insert(schema.expenses).values({
        tenantId: req.tenantId, amount: parsedAmount, category,
        description: description || null, paymentType: paymentType || "cash",
        date: expenseDate,
      }).returning();
      await logActivity(req, "CREATE_EXPENSE", `Xərc əlavə edildi: ${category} (${parsedAmount.toFixed(2)} AZN)`);
      res.json(expense);
    } catch (error) {
      res.status(500).json({ message: "Xərc qeydə alınarkən xəta baş verdi" });
    }
  });

  router.put("/expenses/:id", async (req: AuthenticatedRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const { amount, category, description, paymentType, date } = req.body;

      // Fetch existing expense to compare amounts for limit check
      const existing = await db.query.expenses.findFirst({
        where: and(eq(schema.expenses.id, id), eq(schema.expenses.tenantId, req.tenantId))
      });
      if (!existing) return res.status(404).json({ message: "Xərc tapılmadı" });

      const newAmount = amount !== undefined ? parseFloat(amount) : existing.amount;
      const newCategory = category || existing.category;
      const amountDiff = newAmount - existing.amount;

      // If amount is increasing, check monthly limit
      if (amountDiff > 0) {
        const limit = await db.query.expenseLimits.findFirst({
          where: and(eq(schema.expenseLimits.tenantId, req.tenantId), eq(schema.expenseLimits.category, newCategory))
        });
        if (limit && limit.monthlyLimit > 0) {
          const now = new Date(date || existing.date);
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
          const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

          const monthExpenses = await db
            .select({ total: sql`COALESCE(SUM(amount), 0)` })
            .from(schema.expenses)
            .where(and(
              eq(schema.expenses.tenantId, req.tenantId),
              eq(schema.expenses.category, newCategory),
              gte(schema.expenses.date, monthStart),
              lte(schema.expenses.date, monthEnd)
            ));

          const currentTotal = parseFloat((monthExpenses[0]?.total as string) || "0");
          const projectedTotal = currentTotal + amountDiff;

          if (projectedTotal > limit.monthlyLimit) {
            return res.status(409).json({
              limitExceeded: true,
              category: newCategory,
              monthlyLimit: limit.monthlyLimit,
              currentTotal,
              attemptedAmount: newAmount,
              message: `"${newCategory}" kateqoriyası üzrə aylıq limit ${limit.monthlyLimit.toFixed(2)} ₼ keçilir! (Cari: ${currentTotal.toFixed(2)} ₼ + artım ${amountDiff.toFixed(2)} ₼)`
            });
          }
        }
      }

      const [updated] = await db.update(schema.expenses).set({
        amount: newAmount, category: newCategory, description: description || null,
        paymentType: paymentType || "cash", date: date || existing.date,
      }).where(and(eq(schema.expenses.id, id), eq(schema.expenses.tenantId, req.tenantId))).returning();
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

  // ── Expense Limit Management (Admin only) ───────────────────────────────

  // GET /expense-limits — list all limits for this tenant
  router.get("/expense-limits", async (req: AuthenticatedRequest, res) => {
    try {
      const limits = await db.select()
        .from(schema.expenseLimits)
        .where(eq(schema.expenseLimits.tenantId, req.tenantId));
      res.json(limits);
    } catch (error) {
      res.status(500).json({ message: "Limitlər gətirilərkən xəta baş verdi" });
    }
  });

  // GET /expense-limits/usage — limits with actual monthly spend
  router.get("/expense-limits/usage", async (req: AuthenticatedRequest, res) => {
    try {
      const limits = await db.select()
        .from(schema.expenseLimits)
        .where(eq(schema.expenseLimits.tenantId, req.tenantId));

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

      const result = await Promise.all(limits.map(async (limit) => {
        const spend = await db
          .select({ total: sql`COALESCE(SUM(amount), 0)` })
          .from(schema.expenses)
          .where(and(
            eq(schema.expenses.tenantId, req.tenantId),
            eq(schema.expenses.category, limit.category),
            gte(schema.expenses.date, monthStart),
            lte(schema.expenses.date, monthEnd)
          ));
        const spent = parseFloat((spend[0]?.total as string) || "0");
        return {
          ...limit,
          spent,
          remaining: Math.max(0, limit.monthlyLimit - spent),
          usagePercent: limit.monthlyLimit > 0 ? Math.min(100, (spent / limit.monthlyLimit) * 100) : 0,
        };
      }));

      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Limit istifadəsi gətirilərkən xəta baş verdi" });
    }
  });

  // POST /expense-limits — create or update a limit for a category
  router.post("/expense-limits", requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const { category, monthlyLimit } = req.body;
      if (!category || monthlyLimit === undefined) {
        return res.status(400).json({ message: "Kateqoriya və limit mütləqdir" });
      }

      const parsedLimit = parseFloat(monthlyLimit);
      if (isNaN(parsedLimit) || parsedLimit < 0) {
        return res.status(400).json({ message: "Düzgün limit daxil edin" });
      }

      // Check if limit already exists for this category
      const existing = await db.query.expenseLimits.findFirst({
        where: and(eq(schema.expenseLimits.tenantId, req.tenantId), eq(schema.expenseLimits.category, category))
      });

      const now = new Date().toISOString();

      if (existing) {
        const [updated] = await db.update(schema.expenseLimits)
          .set({ monthlyLimit: parsedLimit, updatedAt: now })
          .where(eq(schema.expenseLimits.id, existing.id))
          .returning();
        await logActivity(req, "UPDATE_EXPENSE_LIMIT", `"${category}" kateqoriyası üzrə limit yeniləndi: ${parsedLimit.toFixed(2)} ₼`);
        res.json(updated);
      } else {
        const [created] = await db.insert(schema.expenseLimits)
          .values({
            tenantId: req.tenantId,
            category,
            monthlyLimit: parsedLimit,
            createdAt: now,
            updatedAt: now,
          })
          .returning();
        await logActivity(req, "CREATE_EXPENSE_LIMIT", `"${category}" kateqoriyası üzrə limit təyin edildi: ${parsedLimit.toFixed(2)} ₼`);
        res.json(created);
      }
    } catch (error) {
      res.status(500).json({ message: "Limit təyin edilərkən xəta baş verdi" });
    }
  });

  // DELETE /expense-limits/:id — remove a limit
  router.delete("/expense-limits/:id", requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const [deleted] = await db.delete(schema.expenseLimits)
        .where(and(eq(schema.expenseLimits.id, id), eq(schema.expenseLimits.tenantId, req.tenantId)))
        .returning();
      if (!deleted) return res.status(404).json({ message: "Limit tapılmadı" });
      await logActivity(req, "DELETE_EXPENSE_LIMIT", `"${deleted.category}" kateqoriyası üzrə limit silindi`);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Limit silinərkən xəta baş verdi" });
    }
  });

  return router;
}
