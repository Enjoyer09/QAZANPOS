import { Router } from "express";
import { db } from "../db/index.js";
import * as schema from "../db/schema.js";
import { eq, and, sql, desc, asc } from "drizzle-orm";
import { hashPassword } from "../lib/auth.js";
import { AuthenticatedRequest, requireAdmin, getMonthBoundaries, logActivity, computeRemainingDebt, checkUserPermission } from "./helpers.js";
import { sendSMS, processSMSTemplate } from "../lib/sms.js";
import { sendEmail, generatePnlEmailHtml, generatePnlTextSummary } from "../lib/email.js";

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

  // ─── P&L (Profit & Loss) Report ──────────────────────────────────────┐

  router.get("/dashboard/pnl", async (req: AuthenticatedRequest, res) => {
    try {
      const tenantId = req.tenantId;
      const { from, to, revenueBudget, cogsBudget, expenseBudget } = req.query;
      const fromStr = typeof from === "string" && from ? from : new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];
      const toStr = typeof to === "string" && to ? to : new Date().toISOString().split("T")[0];

      // ── Budget targets (passed from client, stored in localStorage) ──
      const budgetRevenue = parseFloat(typeof revenueBudget === "string" && revenueBudget ? revenueBudget : "0") || 0;
      const budgetCOGS = parseFloat(typeof cogsBudget === "string" && cogsBudget ? cogsBudget : "0") || 0;
      const budgetExpenses = parseFloat(typeof expenseBudget === "string" && expenseBudget ? expenseBudget : "0") || 0;
      const budgetGrossProfit = budgetRevenue - budgetCOGS;
      const budgetNetProfit = budgetGrossProfit - budgetExpenses;
      const toEnd = toStr + "T23:59:59.999Z";

      // ── Fetch sales with items in date range ──
      const salesInPeriod = await db.query.sales.findMany({
        where: and(
          eq(schema.sales.tenantId, tenantId),
          sql`sale_date >= ${fromStr}`,
          sql`sale_date <= ${toEnd}`
        ),
        with: { items: true },
        orderBy: asc(schema.sales.saleDate),
      });

      // ── Fetch all expenses in date range ──
      const allExpenses = await db.select().from(schema.expenses)
        .where(and(
          eq(schema.expenses.tenantId, tenantId),
          sql`date >= ${fromStr}`,
          sql`date <= ${toEnd}`
        ))
        .orderBy(asc(schema.expenses.date));

      // ── Compute totals ──
      const totalRevenue = salesInPeriod.reduce((s, sale) => s + sale.totalAmount, 0);
      const totalCOGS = salesInPeriod.reduce((s, sale) => s + sale.totalCost, 0);
      const grossProfit = totalRevenue - totalCOGS;

      // Expense breakdown by category
      const expenseByCategory: Record<string, number> = {};
      let totalExpenses = 0;
      for (const exp of allExpenses) {
        const cat = exp.category || "Digər";
        expenseByCategory[cat] = (expenseByCategory[cat] || 0) + exp.amount;
        totalExpenses += exp.amount;
      }

      // Expense breakdown by payment type
      const expenseByPaymentType: Record<string, number> = {};
      for (const exp of allExpenses) {
        const pt = exp.paymentType || "cash";
        expenseByPaymentType[pt] = (expenseByPaymentType[pt] || 0) + exp.amount;
      }

      const netProfit = grossProfit - totalExpenses;

      // ── Monthly breakdown ──
      const monthMap = new Map<string, { revenue: number; cogs: number; expenses: number }>();

      for (const sale of salesInPeriod) {
        const monthKey = (sale.saleDate || "").substring(0, 7); // "YYYY-MM"
        if (!monthKey) continue;
        const m = monthMap.get(monthKey) || { revenue: 0, cogs: 0, expenses: 0 };
        m.revenue += sale.totalAmount;
        m.cogs += sale.totalCost;
        monthMap.set(monthKey, m);
      }

      for (const exp of allExpenses) {
        const monthKey = (exp.date || "").substring(0, 7);
        if (!monthKey) continue;
        const m = monthMap.get(monthKey);
        if (m) {
          m.expenses += exp.amount;
        }
      }

      // Get all months in range
      const monthLabels: string[] = [];
      const startDate = new Date(fromStr);
      const endDate = new Date(toStr);
      const azMonths = ["Yan", "Fev", "Mar", "Apr", "May", "İyn", "İyl", "Avq", "Sen", "Okt", "Noy", "Dek"];
      let current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
      while (current <= endDate) {
        const key = current.toISOString().substring(0, 7);
        monthLabels.push(key);
        current.setMonth(current.getMonth() + 1);
      }

      const monthlyTrend = monthLabels.map(key => {
        const data = monthMap.get(key) || { revenue: 0, cogs: 0, expenses: 0 };
        const monthIndex = parseInt(key.split("-")[1]) - 1;
        return {
          month: azMonths[monthIndex] || key,
          monthKey: key,
          revenue: data.revenue,
          cogs: data.cogs,
          expenses: data.expenses,
          profit: data.revenue - data.cogs - data.expenses,
        };
      });

      // ── Period comparison (previous period) ──
      const periodDays = Math.max(1, Math.round((new Date(toStr).getTime() - new Date(fromStr).getTime()) / (1000 * 60 * 60 * 24)) + 1);
      const prevTo = new Date(fromStr);
      prevTo.setDate(prevTo.getDate() - 1);
      const prevFrom = new Date(prevTo);
      prevFrom.setDate(prevFrom.getDate() - periodDays + 1);

      const prevFromStr = prevFrom.toISOString().split("T")[0];
      const prevToStr = prevTo.toISOString().split("T")[0];
      const prevToEnd = prevToStr + "T23:59:59.999Z";

      const prevSales = await db.query.sales.findMany({
        where: and(
          eq(schema.sales.tenantId, tenantId),
          sql`sale_date >= ${prevFromStr}`,
          sql`sale_date <= ${prevToEnd}`
        ),
        with: { items: true },
      });

      const prevExpenses = await db.select().from(schema.expenses)
        .where(and(
          eq(schema.expenses.tenantId, tenantId),
          sql`date >= ${prevFromStr}`,
          sql`date <= ${prevToEnd}`
        ));

      const prevRevenue = prevSales.reduce((s, sale) => s + sale.totalAmount, 0);
      const prevCOGS = prevSales.reduce((s, sale) => s + sale.totalCost, 0);
      const prevGrossProfit = prevRevenue - prevCOGS;
      const prevTotalExpenses = prevExpenses.reduce((s, e) => s + e.amount, 0);
      const prevNetProfit = prevGrossProfit - prevTotalExpenses;

      // ── Sales count and averages ──
      const salesCount = salesInPeriod.length;
      const avgTicket = salesCount > 0 ? totalRevenue / salesCount : 0;
      const avgProfitPerSale = salesCount > 0 ? grossProfit / salesCount : 0;

      // ── Budget variance ──
      const budget = {
        revenue: budgetRevenue,
        cogs: budgetCOGS,
        grossProfit: budgetGrossProfit,
        expenses: budgetExpenses,
        netProfit: budgetNetProfit,
        variance: {
          revenue: budgetRevenue > 0 ? ((totalRevenue - budgetRevenue) / budgetRevenue) * 100 : 0,
          grossProfit: budgetGrossProfit > 0 ? ((grossProfit - budgetGrossProfit) / budgetGrossProfit) * 100 : 0,
          netProfit: budgetNetProfit > 0 ? ((netProfit - budgetNetProfit) / budgetNetProfit) * 100 : 0,
          expenses: budgetExpenses > 0 ? ((totalExpenses - budgetExpenses) / budgetExpenses) * 100 : 0,
          cogs: budgetCOGS > 0 ? ((totalCOGS - budgetCOGS) / budgetCOGS) * 100 : 0,
        },
      };

      res.json({
        period: { from: fromStr, to: toStr },
        budget,
        summary: {
          totalRevenue,
          totalCOGS,
          grossProfit,
          grossMargin: totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0,
          totalExpenses,
          expenseByCategory,
          expenseByPaymentType,
          netProfit,
          netMargin: totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0,
          salesCount,
          avgTicket,
          avgProfitPerSale,
        },
        previousPeriod: {
          revenue: prevRevenue,
          cogs: prevCOGS,
          grossProfit: prevGrossProfit,
          expenses: prevTotalExpenses,
          netProfit: prevNetProfit,
          change: {
            revenue: prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0,
            grossProfit: prevGrossProfit > 0 ? ((grossProfit - prevGrossProfit) / prevGrossProfit) * 100 : 0,
            netProfit: prevNetProfit > 0 ? ((netProfit - prevNetProfit) / prevNetProfit) * 100 : 0,
            expenses: prevTotalExpenses > 0 ? ((totalExpenses - prevTotalExpenses) / prevTotalExpenses) * 100 : 0,
          },
        },
        monthlyTrend,
      });
    } catch (error) {
      console.error("P&L error:", error);
      res.status(500).json({ message: "Mənfəət/Zərər hesabatı hazırlanarkən xəta baş verdi" });
    }
  });

  // ── end P&L ────────────────────────────────────────────────────────────

  // ─── P&L Email Send ─────────────────────────────────────────────────────

  router.post("/dashboard/pnl/send-email", async (req: AuthenticatedRequest, res) => {
    try {
      const { to, from, to: emailTo } = req.body;
      const recipientEmail = to || emailTo;
      if (!recipientEmail) {
        return res.status(400).json({ message: "E-poçt ünvanı daxil edilməlidir" });
      }

      // Fetch the same data as /dashboard/pnl
      const tenantId = req.tenantId;
      const { from: fromStr, to: toStr, revenueBudget, cogsBudget, expenseBudget } = req.query;
      const fromDate = typeof fromStr === "string" && fromStr ? fromStr : new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];
      const toDate = typeof toStr === "string" && toStr ? toStr : new Date().toISOString().split("T")[0];
      const toEnd = toDate + "T23:59:59.999Z";

      const budgetRevenue = parseFloat(typeof revenueBudget === "string" && revenueBudget ? revenueBudget : "0") || 0;
      const budgetCOGS = parseFloat(typeof cogsBudget === "string" && cogsBudget ? cogsBudget : "0") || 0;
      const budgetExpenses = parseFloat(typeof expenseBudget === "string" && expenseBudget ? expenseBudget : "0") || 0;

      // Fetch sales and expenses (simplified - reusing P&L logic would be better extracted)
      const salesInPeriod = await db.query.sales.findMany({
        where: and(
          eq(schema.sales.tenantId, tenantId),
          sql`sale_date >= ${fromDate}`,
          sql`sale_date <= ${toEnd}`
        ),
        with: { items: true },
        orderBy: asc(schema.sales.saleDate),
      });

      const allExpenses = await db.select().from(schema.expenses)
        .where(and(
          eq(schema.expenses.tenantId, tenantId),
          sql`date >= ${fromDate}`,
          sql`date <= ${toEnd}`
        ))
        .orderBy(asc(schema.expenses.date));

      const totalRevenue = salesInPeriod.reduce((s, sale) => s + sale.totalAmount, 0);
      const totalCOGS = salesInPeriod.reduce((s, sale) => s + sale.totalCost, 0);
      const grossProfit = totalRevenue - totalCOGS;

      const expenseByCategory: Record<string, number> = {};
      let totalExpenses = 0;
      for (const exp of allExpenses) {
        const cat = exp.category || "Digər";
        expenseByCategory[cat] = (expenseByCategory[cat] || 0) + exp.amount;
        totalExpenses += exp.amount;
      }

      const netProfit = grossProfit - totalExpenses;
      const salesCount = salesInPeriod.length;

      // Monthly trend
      const monthMap = new Map<string, { revenue: number; cogs: number; expenses: number }>();
      for (const sale of salesInPeriod) {
        const mk = (sale.saleDate || "").substring(0, 7);
        if (!mk) continue;
        const m = monthMap.get(mk) || { revenue: 0, cogs: 0, expenses: 0 };
        m.revenue += sale.totalAmount;
        m.cogs += sale.totalCost;
        monthMap.set(mk, m);
      }
      for (const exp of allExpenses) {
        const mk = (exp.date || "").substring(0, 7);
        if (!mk) continue;
        const m = monthMap.get(mk);
        if (m) m.expenses += exp.amount;
      }

      const azMonths = ["Yan", "Fev", "Mar", "Apr", "May", "İyn", "İyl", "Avq", "Sen", "Okt", "Noy", "Dek"];
      const monthlyTrend = Array.from(monthMap.entries()).map(([key, data]) => {
        const monthIndex = parseInt(key.split("-")[1]) - 1;
        return {
          month: azMonths[monthIndex] || key,
          monthKey: key,
          revenue: data.revenue,
          cogs: data.cogs,
          expenses: data.expenses,
          profit: data.revenue - data.cogs - data.expenses,
        };
      }).sort((a, b) => a.monthKey.localeCompare(b.monthKey));

      const pnlData = {
        period: { from: fromDate, to: toDate },
        budget: {
          revenue: budgetRevenue,
          cogs: budgetCOGS,
          expenses: budgetExpenses,
          grossProfit: budgetRevenue - budgetCOGS,
          netProfit: budgetRevenue - budgetCOGS - budgetExpenses,
          variance: {
            revenue: budgetRevenue > 0 ? ((totalRevenue - budgetRevenue) / budgetRevenue) * 100 : 0,
            grossProfit: (budgetRevenue - budgetCOGS) > 0 ? ((grossProfit - (budgetRevenue - budgetCOGS)) / (budgetRevenue - budgetCOGS)) * 100 : 0,
            netProfit: (budgetRevenue - budgetCOGS - budgetExpenses) > 0 ? ((netProfit - (budgetRevenue - budgetCOGS - budgetExpenses)) / (budgetRevenue - budgetCOGS - budgetExpenses)) * 100 : 0,
            expenses: budgetExpenses > 0 ? ((totalExpenses - budgetExpenses) / budgetExpenses) * 100 : 0,
            cogs: budgetCOGS > 0 ? ((totalCOGS - budgetCOGS) / budgetCOGS) * 100 : 0,
          },
        },
        summary: {
          totalRevenue,
          totalCOGS,
          grossProfit,
          grossMargin: totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0,
          totalExpenses,
          expenseByCategory,
          netProfit,
          netMargin: totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0,
          salesCount,
          avgTicket: salesCount > 0 ? totalRevenue / salesCount : 0,
          avgProfitPerSale: salesCount > 0 ? grossProfit / salesCount : 0,
        },
        monthlyTrend,
      };

      const html = generatePnlEmailHtml(pnlData);
      const text = generatePnlTextSummary(pnlData);

      const settings = await db.query.settings.findFirst({ where: eq(schema.settings.tenantId, tenantId) });
      const storeName = settings?.storeName || "Mağaza";

      const result = await sendEmail({
        to: recipientEmail,
        subject: `${storeName} — P&L Hesabatı (${new Date(fromDate).toLocaleDateString("az-AZ")} — ${new Date(toDate).toLocaleDateString("az-AZ")})`,
        html,
        tenantId,
      });

      if (result.success) {
        await logActivity(req, "SEND_PNL_EMAIL", `P&L hesabatı e-poçtla göndərildi: ${recipientEmail}`);
        res.json({ success: true, message: "Hesabat e-poçtla göndərildi" });
      } else {
        res.status(500).json({ message: result.error || "E-poçt göndərilmədi" });
      }
    } catch (error) {
      console.error("P&L email error:", error);
      res.status(500).json({ message: "E-poçt göndərilərkən xəta baş verdi" });
    }
  });

  router.get("/dashboard/analytics", async (req: AuthenticatedRequest, res) => {
    try {
      const tenantId = req.tenantId;
      const now = new Date();
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      const sixMonthsAgoStr = sixMonthsAgo.toISOString().split("T")[0];

      // ── Monthly Trend (Son 6 ay) ──
      const recentSales = await db.select().from(schema.sales)
        .where(and(eq(schema.sales.tenantId, tenantId), sql`sale_date >= ${sixMonthsAgoStr}`))
        .orderBy(asc(schema.sales.saleDate));

      const recentExpenses = await db.select().from(schema.expenses)
        .where(and(eq(schema.expenses.tenantId, tenantId), sql`date >= ${sixMonthsAgoStr}`));

      // Group by month (YYYY-MM)
      const monthMap = new Map<string, { revenue: number; expenses: number; cogs: number }>();
      for (const sale of recentSales) {
        const monthKey = (sale.saleDate || "").substring(0, 7);
        if (!monthKey) continue;
        const m = monthMap.get(monthKey) || { revenue: 0, expenses: 0, cogs: 0 };
        m.revenue += sale.totalAmount;
        m.cogs += sale.totalCost;
        monthMap.set(monthKey, m);
      }
      for (const exp of recentExpenses) {
        const monthKey = (exp.date || "").substring(0, 7);
        if (!monthKey) continue;
        const m = monthMap.get(monthKey) || { revenue: 0, expenses: 0, cogs: 0 };
        m.expenses += exp.amount;
        monthMap.set(monthKey, m);
      }

      const azMonths = ["Yan", "Fev", "Mar", "Apr", "May", "İyn", "İyl", "Avq", "Sen", "Okt", "Noy", "Dek"];
      const monthlyTrend: { month: string; revenue: number; expenses: number; profit: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = d.toISOString().substring(0, 7);
        const data = monthMap.get(key) || { revenue: 0, expenses: 0, cogs: 0 };
        const monthIndex = parseInt(key.split("-")[1]) - 1;
        monthlyTrend.push({
          month: azMonths[monthIndex] || key,
          revenue: data.revenue,
          expenses: data.expenses,
          profit: data.revenue - data.expenses,
        });
      }

      // ── Weekly Distribution (Son 7 gün) ──
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 6);
      weekAgo.setHours(0, 0, 0, 0);
      const weekAgoStr = weekAgo.toISOString();

      const weekSales = await db.select().from(schema.sales)
        .where(and(eq(schema.sales.tenantId, tenantId), sql`sale_date >= ${weekAgoStr}`));

      const dayNames = ["Bazar", "Bazar ertəsi", "Çərşənbə axşamı", "Çərşənbə", "Cümə axşamı", "Cümə", "Şənbə"];
      const dayMap = new Map<string, { sales: number; revenue: number }>();

      for (const sale of weekSales) {
        const d = new Date(sale.saleDate || "");
        if (isNaN(d.getTime())) continue;
        const dayIndex = d.getDay(); // 0=Bazar, 1=Bazar ertəsi, ...
        const dayName = dayNames[dayIndex];
        const entry = dayMap.get(dayName) || { sales: 0, revenue: 0 };
        entry.sales += 1;
        entry.revenue += sale.totalAmount;
        dayMap.set(dayName, entry);
      }

      // Ensure all 7 days are present (even if 0 sales)
      const weeklyDistribution = dayNames.map((name) => {
        const data = dayMap.get(name) || { sales: 0, revenue: 0 };
        return { day: name, sales: data.sales, revenue: data.revenue };
      });

      // ── Top 5 Kateqoriya (məhsul kateqoriyasına görə satış) ──
      // Use raw SQL join for efficient category aggregation
      const topCatResult = await db.execute(sql`
        SELECT p.category, SUM(si.quantity)::float as "salesCount", SUM(si.sale_price * si.quantity)::float as "revenue"
        FROM sale_items si
        INNER JOIN products p ON si.product_id = p.id
        INNER JOIN sales s ON si.sale_id = s.id
        WHERE s.tenant_id = ${tenantId} AND s.sale_date >= ${sixMonthsAgoStr}
        GROUP BY p.category
        ORDER BY revenue DESC
        LIMIT 5
      `);

      // db.execute() returns { rows: [...] } in Drizzle with PostgreSQL
      const topCatRows = Array.isArray(topCatResult)
        ? topCatResult
        : ((topCatResult as any)?.rows as any[]) || [];

      const topCategories: { category: string; salesCount: number; revenue: number }[] = [];
      for (const row of topCatRows) {
        const r = row as any;
        topCategories.push({
          category: r.category || "Digər",
          salesCount: parseFloat(r.salesCount) || 0,
          revenue: parseFloat(r.revenue) || 0,
        });
      }

      // ── COGS Audit ──
      const totalRevenue = recentSales.reduce((s, sale) => s + sale.totalAmount, 0);
      const totalCost = recentSales.reduce((s, sale) => s + sale.totalCost, 0);
      const totalExpenses = recentExpenses.reduce((s, e) => s + e.amount, 0);
      const grossProfit = totalRevenue - totalCost;
      const netProfit = grossProfit - totalExpenses;

      res.json({
        monthlyTrend,
        weeklyDistribution,
        topCategories,
        cogsAudit: {
          totalRevenue,
          totalCost,
          totalExpenses,
          grossProfit,
          netProfit,
          grossMargin: totalRevenue > 0 ? Math.round((grossProfit / totalRevenue) * 100) : 0,
          netMargin: totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 100) : 0,
        },
      });
    } catch (error) {
      console.error("Analytics error:", error);
      res.status(500).json({ message: "Analitika məlumatları götürülərkən xəta baş verdi" });
    }
  });

  // ─── Credits ───────────────────────────────────────────────────────────

  router.get("/credits/overdue", async (req: AuthenticatedRequest, res) => {
    try {
      if (!await checkUserPermission(req, "staffCanViewDebts")) {
        return res.status(403).json({ message: "Nisyə & Borc bölməsinə giriş icazəniz yoxdur." });
      }
      const todayStr = new Date().toISOString().split("T")[0];
      const sales = await db.query.sales.findMany({
        where: and(eq(schema.sales.paymentStatus, "credit"), eq(schema.sales.tenantId, req.tenantId), sql`credit_due_date <= ${todayStr}`),
        with: { payments: true, returns: true },
      });
      const withDebt = sales.map(s => ({
        ...s,
        remainingDebt: computeRemainingDebt(s, s.payments, s.returns),
      }));
      res.json(withDebt);
    } catch (error) {
      res.status(500).json({ message: "Gecikmiş nisyələri gətirərkən xəta baş verdi" });
    }
  });

  router.get("/credits/pending", async (req: AuthenticatedRequest, res) => {
    try {
      if (!await checkUserPermission(req, "staffCanViewDebts")) {
        return res.status(403).json({ message: "Nisyə & Borc bölməsinə giriş icazəniz yoxdur." });
      }
      const sales = await db.query.sales.findMany({
        where: and(eq(schema.sales.paymentStatus, "credit"), eq(schema.sales.tenantId, req.tenantId)),
        with: { payments: true, returns: true },
      });
      const withDebt = sales.map(s => ({
        ...s,
        remainingDebt: computeRemainingDebt(s, s.payments, s.returns),
      }));
      res.json(withDebt);
    } catch (error) {
      res.status(500).json({ message: "Gözləyən nisyələri gətirərkən xəta baş verdi" });
    }
  });

  // ─── SMS Reminder for Overdue Credits ───────────────────────────────────

  router.post("/credits/send-sms-reminder", async (req: AuthenticatedRequest, res) => {
    try {
      const { saleIds } = req.body;
      const tenantId = req.tenantId;

      // Fetch settings for SMS config
      const settings = await db.query.settings.findFirst({
        where: eq(schema.settings.tenantId, tenantId),
      });

      if (!settings?.smsApiKey) {
        return res.status(400).json({ message: "SMS API açarı təyin edilməyib. Əvvəlcə Ayarlar səhifəsində SMS API açarını qeyd edin." });
      }

      // Fetch store name for template
      const storeName = settings.storeName || "Mağaza";

      // Get the SMS template or use default
      const defaultTemplate = "Salam [AD], [MAQAZA] mağazasına olan [BORC] ₼ məbləğində borcunuzun ödəniş müddəti ([TARIX]) çatmışdır. Xahiş edirik ən qısa zamanda ödəniş edəsiniz.";
      const template = settings.smsTemplateDebt || defaultTemplate;

      // Fetch credit sales — either by specific IDs or all overdue
      const todayStr = new Date().toISOString().split("T")[0];
      let creditSales;

      if (saleIds && Array.isArray(saleIds) && saleIds.length > 0) {
        // Fetch specific sales by IDs
        const promises = await Promise.all(
          saleIds.map((id: number) =>
            db.query.sales.findFirst({
              where: and(eq(schema.sales.id, id), eq(schema.sales.tenantId, tenantId), eq(schema.sales.paymentStatus, "credit")),
              with: { payments: true, returns: true },
            })
          )
        );
        creditSales = promises.filter((s): s is NonNullable<typeof s> => s != null);
      } else {
        // Fetch all overdue credits
        creditSales = await db.query.sales.findMany({
          where: and(
            eq(schema.sales.paymentStatus, "credit"),
            eq(schema.sales.tenantId, tenantId),
            sql`credit_due_date <= ${todayStr}`
          ),
          with: { payments: true, returns: true },
        });
      }

      // Filter to only those with phone numbers
      const withPhone = creditSales.filter(s => s.customerPhone);

      if (withPhone.length === 0) {
        return res.json({ sent: 0, failed: 0, message: "SMS göndərmək üçün telefon nömrəsi olan nisyə tapılmadı." });
      }

      // Send SMS to each customer
      let sent = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const sale of withPhone) {
        const remainingDebt = computeRemainingDebt(sale, sale.payments, sale.returns);
        if (remainingDebt <= 0) continue;

        const message = processSMSTemplate(template, {
          AD: sale.customerName || "Müştəri",
          BORC: remainingDebt.toFixed(2),
          TARIX: sale.creditDueDate ? new Date(sale.creditDueDate).toLocaleDateString("az-AZ") : "—",
          MAQAZA: storeName,
        });

        const result = await sendSMS(tenantId, sale.customerPhone!, message);
        if (result.success) {
          sent++;
        } else {
          failed++;
          errors.push(`${sale.customerName} (${sale.customerPhone}): ${result.error}`);
        }
      }

      await logActivity(req, "SEND_SMS_REMINDER", `Gecikmiş borclara ${sent} SMS xatırlatma göndərildi, ${failed} uğursuz`);

      res.json({
        sent,
        failed,
        total: withPhone.length,
        errors: errors.length > 0 ? errors : undefined,
        message: `${sent} SMS uğurla göndərildi${failed > 0 ? `, ${failed} göndərilmədi` : ""}.`,
      });
    } catch (error) {
      console.error("SMS reminder error:", error);
      res.status(500).json({ message: "SMS xatırlatma göndərilərkən xəta baş verdi" });
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

  router.put("/employees/:id", requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const { name, phone, email, position, baseSalary, hireDate, status, notes } = req.body;
      const existing = await db.query.employees.findFirst({
        where: and(eq(schema.employees.id, id), eq(schema.employees.tenantId, req.tenantId))
      });
      if (!existing) return res.status(404).json({ message: "Əməkdaş tapılmadı" });

      const updatedRows = await db.update(schema.employees).set({
        name: name || existing.name,
        phone: phone !== undefined ? phone : existing.phone,
        email: email !== undefined ? email : existing.email,
        position: position || existing.position,
        baseSalary: baseSalary ? parseFloat(baseSalary) : existing.baseSalary,
        hireDate: hireDate || existing.hireDate,
        status: status || existing.status,
        notes: notes !== undefined ? notes : existing.notes,
      }).where(and(eq(schema.employees.id, id), eq(schema.employees.tenantId, req.tenantId))).returning();
      const updated = updatedRows[0];

      await logActivity(req, "UPDATE_EMPLOYEE", `Əməkdaş məlumatları yeniləndi: '${updated?.name}' (ID: ${id})`);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Əməkdaş yenilənərkən xəta baş verdi" });
    }
  });

  router.delete("/employees/:id", requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await db.query.employees.findFirst({
        where: and(eq(schema.employees.id, id), eq(schema.employees.tenantId, req.tenantId))
      });
      if (!existing) return res.status(404).json({ message: "Əməkdaş tapılmadı" });

      await db.delete(schema.employees).where(and(eq(schema.employees.id, id), eq(schema.employees.tenantId, req.tenantId)));
      await logActivity(req, "DELETE_EMPLOYEE", `Əməkdaş silindi: '${existing.name}' (ID: ${id})`);
      res.json({ message: "Əməkdaş uğurla silindi" });
    } catch (error) {
      res.status(500).json({ message: "Əməkdaş silinərkən xəta baş verdi" });
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

  // ─── Payroll: Calculate (auto-generate for month) ──────────────────────

  router.post("/payroll/calculate", requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const { month } = req.body;
      const payrollMonth = month || new Date().toISOString().substring(0, 7);

      const activeEmployees = await db.select().from(schema.employees)
        .where(and(eq(schema.employees.tenantId, req.tenantId), eq(schema.employees.status, "active")));

      let calculated = 0;
      for (const emp of activeEmployees) {
        const existing = await db.query.payroll.findFirst({
          where: and(eq(schema.payroll.employeeId, emp.id), eq(schema.payroll.payrollMonth, payrollMonth), eq(schema.payroll.tenantId, req.tenantId))
        });
        if (!existing) {
          await db.insert(schema.payroll).values({
            tenantId: req.tenantId, employeeId: emp.id, payrollMonth,
            baseSalary: emp.baseSalary, bonuses: 0, deductions: 0,
            netSalary: emp.baseSalary, paidAmount: 0, paymentStatus: "unpaid",
            notes: null, createdAt: new Date().toISOString(),
          });
          calculated++;
        }
      }

      await logActivity(req, "CALCULATE_PAYROLL", `${payrollMonth} ayı üçün ${calculated} əməkdaşın maaş kartı yaradıldı`);
      res.json({ message: `${payrollMonth} ayı üçün maaş kartları yaradıldı`, calculated });
    } catch (error) {
      res.status(500).json({ message: "Maaş hesablanarkən xəta baş verdi" });
    }
  });

  // ─── Payroll: Update (bonuses/deductions) ──────────────────────────────

  router.put("/payroll/:id", requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const { bonuses, deductions, notes } = req.body;

      const record = await db.query.payroll.findFirst({
        where: and(eq(schema.payroll.id, id), eq(schema.payroll.tenantId, req.tenantId))
      });
      if (!record) return res.status(404).json({ message: "Maaş kartı tapılmadı" });

      const newBonuses = bonuses !== undefined ? parseFloat(bonuses) : record.bonuses;
      const newDeductions = deductions !== undefined ? parseFloat(deductions) : record.deductions;
      const newNetSalary = Math.max(0, record.baseSalary + newBonuses - newDeductions);

      const [updated] = await db.update(schema.payroll).set({
        bonuses: newBonuses, deductions: newDeductions,
        netSalary: newNetSalary, notes: notes !== undefined ? notes : record.notes,
      }).where(eq(schema.payroll.id, id)).returning();

      await logActivity(req, "ADJUST_PAYROLL", `Maaş kartı №${id} tənzimləndi: Bonus=${newBonuses}, Tutulma=${newDeductions}, Nett=${newNetSalary}`);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Maaş tənzimlənərkən xəta baş verdi" });
    }
  });

  // ─── Payroll: Get salary payments ──────────────────────────────────────

  router.get("/payroll/:id/payments", async (req: AuthenticatedRequest, res) => {
    try {
      const payrollId = parseInt(req.params.id);
      const payroll = await db.query.payroll.findFirst({
        where: and(eq(schema.payroll.id, payrollId), eq(schema.payroll.tenantId, req.tenantId))
      });
      if (!payroll) return res.status(404).json({ message: "Maaş kartı tapılmadı" });

      const payments = await db.select().from(schema.salaryPayments)
        .where(and(eq(schema.salaryPayments.payrollId, payrollId), eq(schema.salaryPayments.tenantId, req.tenantId)))
        .orderBy(desc(schema.salaryPayments.paymentDate));

      res.json(payments);
    } catch (error) {
      res.status(500).json({ message: "Ödəniş tarixçəsini gətirərkən xəta" });
    }
  });

  // ─── Payroll: Create salary payment (with cash_register update) ────────

  router.post("/payroll/:id/payments", requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const payrollId = parseInt(req.params.id);
      const { amount, paymentType, notes } = req.body;
      const paymentAmount = parseFloat(amount);

      if (!paymentAmount || paymentAmount <= 0) {
        return res.status(400).json({ message: "Düzgün ödəniş məbləği daxil edilməlidir" });
      }

      const record = await db.query.payroll.findFirst({
        where: and(eq(schema.payroll.id, payrollId), eq(schema.payroll.tenantId, req.tenantId))
      });
      if (!record) return res.status(404).json({ message: "Maaş kartı tapılmadı" });

      const payType = paymentType || "Nəğd";
      const username = req.headers["x-user-username"] as string || "Sistem";

      const result = await db.transaction(async (tx) => {
        // 1. Insert salary payment record
        const [payment] = await tx.insert(schema.salaryPayments).values({
          tenantId: req.tenantId, payrollId, amount: paymentAmount,
          paymentDate: new Date().toISOString(), paymentType: payType, notes: notes || null,
        }).returning();

        // 2. Update payroll paid amount and status
        const newPaidAmount = record.paidAmount + paymentAmount;
        const newStatus = newPaidAmount >= record.netSalary ? "paid" : "partial";
        await tx.update(schema.payroll).set({
          paidAmount: newPaidAmount, paymentStatus: newStatus,
        }).where(eq(schema.payroll.id, payrollId));

        // 3. P1.3: Update cash_register balance only for cash payments
        if (payType === "Nəğd") {
          const cashReg = await tx.query.cashRegister.findFirst({
            where: eq(schema.cashRegister.tenantId, req.tenantId)
          });
          if (cashReg) {
            const newBalance = Math.max(0, cashReg.balance - paymentAmount);
            await tx.update(schema.cashRegister).set({
              balance: newBalance, lastUpdated: new Date().toISOString(),
              updatedBy: username, notes: `Maaş ödənişi (payroll #${payrollId}): -${paymentAmount.toFixed(2)} ₼`,
            }).where(eq(schema.cashRegister.tenantId, req.tenantId));
          }
        }

        return payment;
      });

      await logActivity(req, "CREATE_SALARY_PAYMENT",
        `Maaş ödənişi: ${paymentAmount.toFixed(2)} ₼ (Payroll #${payrollId}, Ödəniş: ${payType})${notes ? ` - ${notes}` : ""}`
      );

      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Ödəniş qeydə alınarkən xəta baş verdi" });
    }
  });

  return router;
}
