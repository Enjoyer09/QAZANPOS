import { Router } from "express";
import { db } from "../db/index.js";
import * as schema from "../db/schema.js";
import { eq, and, sql, desc } from "drizzle-orm";
import { hashPassword } from "../lib/auth.js";
import { AuthenticatedRequest, requireAdmin, getMonthBoundaries, logActivity } from "./helpers.js";

export default function dashboardRoutes(): Router {
  const router = Router();

  router.get("/dashboard/summary", async (req: AuthenticatedRequest, res) => {
    try {
      const { firstDay } = getMonthBoundaries();
      const todayStr = new Date().toISOString().split("T")[0];
      const tenantId = req.tenantId;

      const todaySales = await db.select().from(schema.sales)
        .where(and(eq(schema.sales.tenantId, tenantId), sql`sale_date >= ${todayStr} AND sale_date < ${todayStr + "T23:59:59.999Z"}`));
      const monthSales = await db.select().from(schema.sales)
        .where(and(eq(schema.sales.tenantId, tenantId), sql`sale_date >= ${firstDay}`));
      const allExpenses = await db.select().from(schema.expenses).where(eq(schema.expenses.tenantId, tenantId));
      const products = await db.select().from(schema.products).where(and(eq(schema.products.tenantId, tenantId), eq(schema.products.isArchived, 0)));

      const todayRevenue = todaySales.reduce((s, sale) => s + sale.totalAmount, 0);
      const todayCost = todaySales.reduce((s, sale) => s + sale.totalCost, 0);
      const todayExpenses = allExpenses.filter(e => e.date?.startsWith(todayStr)).reduce((s, e) => s + e.amount, 0);
      const monthRevenue = monthSales.reduce((s, sale) => s + sale.totalAmount, 0);
      const monthCost = monthSales.reduce((s, sale) => s + sale.totalCost, 0);
      const monthExpenses = allExpenses.filter(e => e.date >= firstDay).reduce((s, e) => s + e.amount, 0);

      const totalStockValue = products.reduce((sum, p) => sum + (0 * 0), 0); // placeholder

      // Credit debts
      const creditSales = await db.query.sales.findMany({
        where: and(eq(schema.sales.paymentStatus, "credit"), eq(schema.sales.tenantId, tenantId)),
        with: { payments: true, returns: true }
      });
      const totalCreditDebt = creditSales.reduce((sum, s) => {
        const paid = s.payments.reduce((pSum, p) => pSum + p.amount, 0);
        const returned = s.returns ? s.returns.reduce((rSum, r) => rSum + r.totalAmount, 0) : 0;
        return sum + Math.max(0, s.totalAmount - paid - returned);
      }, 0);
      const overdueCreditsCount = creditSales.filter(s => s.creditDueDate && s.creditDueDate <= todayStr).length;

      const settings = await db.query.settings.findFirst({ where: eq(schema.settings.tenantId, tenantId) });
      const threshold = settings?.lowStockAlertCount || 5;
      const lowStockCount = 0; // Would need stock metrics

      res.json({
        todayRevenue, todayCost, todayProfit: Math.max(0, todayRevenue - todayCost),
        todayExpenses, todayNetProfit: Math.max(0, todayRevenue - todayCost - todayExpenses),
        todaySales: todaySales.length,
        monthRevenue, monthProfit: Math.max(0, monthRevenue - monthCost),
        monthExpenses, monthNetProfit: Math.max(0, monthRevenue - monthCost - monthExpenses),
        totalStockValue, lowStockCount, totalCreditDebt, overdueCreditsCount, myTotalDebt: 0,
      });
    } catch (error) {
      res.status(500).json({ message: "Statistika hesablanarkən xəta baş verdi" });
    }
  });

  router.get("/dashboard/recent-sales", async (req: AuthenticatedRequest, res) => {
    try {
      const recent = await db.query.sales.findMany({
        where: eq(schema.sales.tenantId, req.tenantId),
        with: { items: true },
        orderBy: [desc(schema.sales.id)], limit: 5,
      });
      res.json(recent);
    } catch (error) {
      res.status(500).json({ message: "Son satışları gətirərkən xəta baş verdi" });
    }
  });

  router.get("/dashboard/low-stock", async (req: AuthenticatedRequest, res) => {
    try {
      const products = await db.select().from(schema.products)
        .where(and(eq(schema.products.tenantId, req.tenantId), eq(schema.products.isArchived, 0)));
      const settings = await db.query.settings.findFirst({ where: eq(schema.settings.tenantId, req.tenantId) });
      const threshold = settings?.lowStockAlertCount || 5;
      const lowStock = products.filter(p => false); // Would need stock metrics
      res.json(lowStock);
    } catch (error) {
      res.status(500).json({ message: "Az qalıqları gətirərkən xəta baş verdi" });
    }
  });

  router.get("/dashboard/balances", async (req: AuthenticatedRequest, res) => {
    try {
      const sales = await db.select().from(schema.sales).where(eq(schema.sales.tenantId, req.tenantId));
      const returns = await db.select().from(schema.returns).where(eq(schema.returns.tenantId, req.tenantId));
      const expenses = await db.select().from(schema.expenses).where(eq(schema.expenses.tenantId, req.tenantId));
      const safeTransfers = await db.select().from(schema.safeTransfers).where(eq(schema.safeTransfers.tenantId, req.tenantId));

      // Include salary payments, vendor payments for complete financial picture
      const salaryPaymentsList = await db.select().from(schema.salaryPayments).where(eq(schema.salaryPayments.tenantId, req.tenantId));
      const vendorPaymentsList = await db.select().from(schema.vendorPayments).where(eq(schema.vendorPayments.tenantId, req.tenantId));

      let kassa = 0, safe = 0, bank = 0, debt = 0;

      for (const sale of sales) {
        if (sale.paymentType === "Nəğd") kassa += sale.totalAmount;
        else if (["Kart", "Kart2Kart", "Köçürmə"].includes(sale.paymentType || "")) bank += sale.totalAmount;
        if (sale.paymentStatus === "credit") debt += sale.totalAmount;
      }
      for (const ret of returns) kassa -= ret.totalAmount;
      for (const exp of expenses) {
        if (exp.paymentType === "cash") kassa -= exp.amount;
        else if (exp.paymentType === "card") bank -= exp.amount;
      }
      for (const st of safeTransfers) {
        if (st.type === "kassa_to_safe" || st.type === "safe_deposit") safe += st.amount;
        else if (st.type === "safe_withdrawal") safe -= st.amount;
      }

      // Deduct salary payments and vendor payments from cash
      for (const sp of salaryPaymentsList) {
        if (sp.paymentType === "Nəğd") kassa -= sp.amount;
        else if (["Kart", "Kart2Kart", "Köçürmə"].includes(sp.paymentType)) bank -= sp.amount;
      }
      for (const vp of vendorPaymentsList) {
        if (vp.paymentType === "Nəğd") kassa -= vp.amount;
        else if (["Kart", "Kart2Kart", "Köçürmə"].includes(vp.paymentType)) bank -= vp.amount;
      }

      // Fetch the manually counted cash register balance (if any)
      const cashReg = await db.query.cashRegister.findFirst({
        where: eq(schema.cashRegister.tenantId, req.tenantId)
      });

      res.json({
        kassa: Math.max(0, kassa),
        safe: Math.max(0, safe),
        bank: Math.max(0, bank),
        debt: Math.max(0, debt),
        investorDebt: 0,
        cashRegisterBalance: cashReg?.balance || null,
        cashRegisterUpdatedAt: cashReg?.lastUpdated || null,
      });
    } catch (error) {
      res.status(500).json({ message: "Balans hesablanarkən xəta baş verdi" });
    }
  });

  // ─── Cash Register ──────────────────────────────────────────────────────

  router.get("/cash/register", async (req: AuthenticatedRequest, res) => {
    try {
      const reg = await db.query.cashRegister.findFirst({
        where: eq(schema.cashRegister.tenantId, req.tenantId)
      });
      res.json(reg || { balance: 0, lastUpdated: null, updatedBy: null });
    } catch (error) {
      res.status(500).json({ message: "Kassa qalığı gətirilərkən xəta" });
    }
  });

  router.post("/cash/adjust", async (req: AuthenticatedRequest, res) => {
    try {
      const { newBalance, notes } = req.body;
      if (newBalance === undefined || newBalance === null) {
        return res.status(400).json({ message: "Yeni balans daxil edilməlidir" });
      }
      const username = req.headers["x-user-username"] as string || "Sistem";
      const balance = parseFloat(newBalance);

      const existing = await db.query.cashRegister.findFirst({
        where: eq(schema.cashRegister.tenantId, req.tenantId)
      });

      if (existing) {
        await db.update(schema.cashRegister)
          .set({ balance, lastUpdated: new Date().toISOString(), updatedBy: username, notes: notes || null })
          .where(eq(schema.cashRegister.tenantId, req.tenantId));
      } else {
        await db.insert(schema.cashRegister).values({
          tenantId: req.tenantId, balance, lastUpdated: new Date().toISOString(),
          updatedBy: username, notes: notes || null,
        });
      }

      await logActivity(req, "CASH_REGISTER_ADJUST",
        `Kassa qalığı düzəliş edildi: ${balance.toFixed(2)} ₼${notes ? ` (Qeyd: ${notes})` : ""}`
      );

      res.json({ success: true, balance, message: "Kassa qalığı yeniləndi" });
    } catch (error) {
      res.status(500).json({ message: "Kassa qalığı yenilənərkən xəta" });
    }
  });

  router.get("/dashboard/analytics", async (req: AuthenticatedRequest, res) => {
    try {
      const monthlyTrend = [
        { month: "Yan", revenue: 12000, expenses: 3000, profit: 9000 },
        { month: "Fev", revenue: 15000, expenses: 4000, profit: 11000 },
        { month: "Mar", revenue: 18000, expenses: 3500, profit: 14500 },
        { month: "Apr", revenue: 22000, expenses: 5000, profit: 17000 },
        { month: "May", revenue: 25000, expenses: 6000, profit: 19000 },
        { month: "İyun", revenue: 30000, expenses: 5500, profit: 24500 },
      ];
      const totalRevenue = monthlyTrend.reduce((s, m) => s + m.revenue, 0);
      const totalCost = 0;
      const totalExpenses = monthlyTrend.reduce((s, m) => s + m.expenses, 0);
      const grossProfit = monthlyTrend.reduce((s, m) => s + m.profit, 0);

      res.json({
        monthlyTrend,
        weeklyDistribution: [
          { day: "Bazar ertəsi", sales: 15, revenue: 3500 },
          { day: "Çərşənbə axşamı", sales: 12, revenue: 2800 },
          { day: "Çərşənbə", sales: 18, revenue: 4200 },
          { day: "Cümə axşamı", sales: 14, revenue: 3100 },
          { day: "Cümə", sales: 25, revenue: 6500 },
          { day: "Şənbə", sales: 30, revenue: 8000 },
          { day: "Bazar", sales: 20, revenue: 5000 },
        ],
        topCategories: [
          { category: "Telefonlar", salesCount: 45, revenue: 99000 },
          { category: "Kompüterlər", salesCount: 22, revenue: 52800 },
          { category: "Aksesuarlar", salesCount: 80, revenue: 32000 },
        ],
        cogsAudit: {
          totalRevenue, totalCost, totalExpenses, grossProfit, netProfit: grossProfit - totalExpenses,
          grossMargin: totalRevenue > 0 ? Math.round((grossProfit / totalRevenue) * 100) : 0,
          netMargin: totalRevenue > 0 ? Math.round(((grossProfit - totalExpenses) / totalRevenue) * 100) : 0,
        },
      });
    } catch (error) {
      res.status(500).json({ message: "Analitika məlumatları gətirilərkən xəta baş verdi" });
    }
  });

  // ─── Credits ───────────────────────────────────────────────────────────

  router.get("/credits/overdue", async (req: AuthenticatedRequest, res) => {
    try {
      const todayStr = new Date().toISOString().split("T")[0];
      const sales = await db.query.sales.findMany({
        where: and(eq(schema.sales.paymentStatus, "credit"), eq(schema.sales.tenantId, req.tenantId), sql`credit_due_date <= ${todayStr}`),
        with: { payments: true },
      });
      res.json(sales);
    } catch (error) {
      res.status(500).json({ message: "Gecikmiş nisyələri gətirərkən xəta baş verdi" });
    }
  });

  router.get("/credits/pending", async (req: AuthenticatedRequest, res) => {
    try {
      const sales = await db.query.sales.findMany({
        where: and(eq(schema.sales.paymentStatus, "credit"), eq(schema.sales.tenantId, req.tenantId)),
        with: { payments: true },
      });
      res.json(sales);
    } catch (error) {
      res.status(500).json({ message: "Gözləyən nisyələri gətirərkən xəta baş verdi" });
    }
  });

  // ─── Logs ──────────────────────────────────────────────────────────────

  router.get("/logs", async (req: AuthenticatedRequest, res) => {
    try {
      const logs = await db.select().from(schema.activityLogs)
        .where(eq(schema.activityLogs.tenantId, req.tenantId))
        .orderBy(desc(schema.activityLogs.timestamp));
      res.json(logs);
    } catch (error) {
      res.status(500).json({ message: "Loqları gətirərkən xəta baş verdi" });
    }
  });

  // ─── Settings ──────────────────────────────────────────────────────────

  router.get("/settings", async (req: AuthenticatedRequest, res) => {
    try {
      const settings = await db.query.settings.findFirst({ where: eq(schema.settings.tenantId, req.tenantId) });
      res.json(settings || {});
    } catch (error) {
      res.status(500).json({ message: "Tənzimləmələri gətirərkən xəta baş verdi" });
    }
  });

  router.post("/settings", async (req: AuthenticatedRequest, res) => {
    try {
      const existing = await db.query.settings.findFirst({ where: eq(schema.settings.tenantId, req.tenantId) });
      let settings;
      if (existing) {
        [settings] = await db.update(schema.settings).set(req.body).where(eq(schema.settings.tenantId, req.tenantId)).returning();
      } else {
        [settings] = await db.insert(schema.settings).values({ tenantId: req.tenantId, ...req.body }).returning();
      }
      await logActivity(req, "UPDATE_SETTINGS", "Sistem tənzimləmələri yeniləndi");
      res.json(settings);
    } catch (error) {
      res.status(500).json({ message: "Tənzimləmələr yenilənərkən xəta baş verdi" });
    }
  });

  // ─── Super Admin Tenant Management ─────────────────────────────────────

  router.get("/tenants", requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      if (req.tenantSlug !== "super") return res.status(403).json({ message: "Yalnız Platforma Administratoru üçün" });
      const tenants = await db.select().from(schema.tenants).orderBy(schema.tenants.id);
      res.json(tenants);
    } catch (error) {
      res.status(500).json({ message: "Tenantlar gətirilərkən xəta baş verdi" });
    }
  });

  router.post("/tenants", requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      if (req.tenantSlug !== "super") return res.status(403).json({ message: "Yalnız Platforma Administratoru üçün" });
      const { name, slug, status, releaseTier, billingTier } = req.body;
      const [tenant] = await db.insert(schema.tenants).values({
        name, slug, status: status || "active", releaseTier: releaseTier || "stable",
        billingTier: billingTier || "free", createdAt: new Date().toISOString(),
      }).returning();
      res.json(tenant);
    } catch (error) {
      res.status(500).json({ message: "Tenant yaradılarkən xəta baş verdi" });
    }
  });

  router.put("/tenants/:id", requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      if (req.tenantSlug !== "super") return res.status(403).json({ message: "Yalnız Platforma Administratoru üçün" });
      const id = parseInt(req.params.id);
      const [updated] = await db.update(schema.tenants).set(req.body).where(eq(schema.tenants.id, id)).returning();
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Tenant yenilənərkən xəta baş verdi" });
    }
  });

  router.delete("/tenants/:id", requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      if (req.tenantSlug !== "super") return res.status(403).json({ message: "Yalnız Platforma Administratoru üçün" });
      const id = parseInt(req.params.id);
      await db.delete(schema.tenants).where(eq(schema.tenants.id, id));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Tenant silinərkən xəta baş verdi" });
    }
  });

  // ─── Users Management ──────────────────────────────────────────────────

  router.get("/users", async (req: AuthenticatedRequest, res) => {
    try {
      const users = await db.select().from(schema.users).where(eq(schema.users.tenantId, req.tenantId));
      res.json(users.map(u => ({ ...u, password: undefined })));
    } catch (error) {
      res.status(500).json({ message: "İstifadəçiləri gətirərkən xəta baş verdi" });
    }
  });

  router.post("/users", requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const { username, password, role } = req.body;
      if (!username || !password) return res.status(400).json({ message: "İstifadəçi adı və şifrə tələb olunur" });
      const [user] = await db.insert(schema.users).values({
        tenantId: req.tenantId, username, password: hashPassword(password),
        role: role || "Staff",
      }).returning();
      await logActivity(req, "CREATE_USER", `Yeni istifadəçi yaradıldı: '${username}' (Rol: ${role || "Staff"})`);
      res.json({ ...user, password: undefined });
    } catch (error) {
      res.status(500).json({ message: "İstifadəçi yaradılarkən xəta baş verdi" });
    }
  });

  // ─── Employees ─────────────────────────────────────────────────────────

  router.get("/employees", async (req: AuthenticatedRequest, res) => {
    try {
      const employees = await db.select().from(schema.employees).where(eq(schema.employees.tenantId, req.tenantId)).orderBy(schema.employees.name);
      res.json(employees);
    } catch (error) {
      res.status(500).json({ message: "Əməkdaşları gətirərkən xəta baş verdi" });
    }
  });

  router.post("/employees", requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const { name, phone, email, position, baseSalary, hireDate, notes } = req.body;
      const [emp] = await db.insert(schema.employees).values({
        tenantId: req.tenantId, name, phone: phone || null, email: email || null,
        position, baseSalary: parseFloat(baseSalary), hireDate, notes: notes || null,
        createdAt: new Date().toISOString(),
      }).returning();
      res.json(emp);
    } catch (error) {
      res.status(500).json({ message: "Əməkdaş yaradılarkən xəta baş verdi" });
    }
  });

  // ─── Payroll ───────────────────────────────────────────────────────────

  router.get("/payroll", async (req: AuthenticatedRequest, res) => {
    try {
      const payroll = await db.query.payroll.findMany({
        where: eq(schema.payroll.tenantId, req.tenantId),
        with: { employee: true, payments: true },
        orderBy: [desc(schema.payroll.createdAt)],
      });
      res.json(payroll);
    } catch (error) {
      res.status(500).json({ message: "Əməkhaqqı məlumatlarını gətirərkən xəta baş verdi" });
    }
  });

  router.post("/payroll", requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const { employeeId, payrollMonth, baseSalary, bonuses, deductions, notes } = req.body;
      const netSalary = parseFloat(baseSalary) + parseFloat(bonuses || 0) - parseFloat(deductions || 0);
      const [record] = await db.insert(schema.payroll).values({
        tenantId: req.tenantId, employeeId: parseInt(employeeId), payrollMonth,
        baseSalary: parseFloat(baseSalary), bonuses: parseFloat(bonuses || 0),
        deductions: parseFloat(deductions || 0), netSalary: Math.max(0, netSalary),
        paidAmount: 0, paymentStatus: "unpaid", notes: notes || null, createdAt: new Date().toISOString(),
      }).returning();
      res.json(record);
    } catch (error) {
      res.status(500).json({ message: "Əməkhaqqı qeydə alınarkən xəta baş verdi" });
    }
  });

  return router;
}
