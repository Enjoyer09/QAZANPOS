import { Router } from "express";
import { db } from "./db/index.js";
import * as schema from "./db/schema.js";
import { eq, and, lte, gte, sql, desc } from "drizzle-orm";

const router = Router();

// Middleware to verify user role is Admin
function requireAdmin(req: any, res: any, next: any) {
  const role = req.headers["x-user-role"];
  if (role !== "Admin") {
    return res.status(403).json({ message: "Bu əməliyyat üçün yalnız Administrator səlahiyyəti tələb olunur." });
  }
  next();
}

// ----------------------------------------------------
// 0. AUTH ENDPOINTS
// ----------------------------------------------------

router.post("/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: "İstifadəçi adı və şifrə daxil edilməlidir" });
    }

    const user = await db.query.users.findFirst({
      where: and(
        eq(schema.users.username, username.trim().toLowerCase()),
        eq(schema.users.password, password)
      )
    });

    if (!user) {
      return res.status(401).json({ message: "İstifadəçi adı və ya şifrə yanlışdır" });
    }

    res.json({
      id: user.id,
      username: user.username,
      role: user.role
    });
  } catch (error) {
    res.status(500).json({ message: "Giriş zamanı xəta baş verdi" });
  }
});

// Helper to get date boundaries
function getMonthBoundaries() {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
  return { firstDay, lastDay };
}

// ----------------------------------------------------
// 1. PRODUCTS ENDPOINTS
// ----------------------------------------------------

// List all products
router.get("/products", async (req, res) => {
  try {
    const list = await db.select().from(schema.products);
    res.json(list);
  } catch (error) {
    res.status(500).json({ message: "Məhsulları gətirərkən xəta baş verdi" });
  }
});

// Create product
router.post("/products", requireAdmin, async (req, res) => {
  try {
    const { name, category, unit, description } = req.body;
    if (!name) return res.status(400).json({ message: "Ad tələb olunur" });

    const newProduct = await db
      .insert(schema.products)
      .values({
        name,
        category: category || null,
        unit: unit || "ədəd",
        description: description || null,
      })
      .returning();

    res.json(newProduct[0]);
  } catch (error) {
    res.status(500).json({ message: "Məhsul yaradılarkən xəta baş verdi" });
  }
});

// Update product
router.put("/products/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, category, unit, description } = req.body;

    const updated = await db
      .update(schema.products)
      .set({
        name,
        category: category || null,
        unit: unit || "ədəd",
        description: description || null,
      })
      .where(eq(schema.products.id, id))
      .returning();

    if (updated.length === 0)
      return res.status(404).json({ message: "Məhsul tapılmadı" });

    res.json(updated[0]);
  } catch (error) {
    res.status(500).json({ message: "Məhsul yenilənərkən xəta baş verdi" });
  }
});

// Delete product
router.delete("/products/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const deleted = await db
      .delete(schema.products)
      .where(eq(schema.products.id, id))
      .returning();

    if (deleted.length === 0)
      return res.status(404).json({ message: "Məhsul tapılmadı" });

    res.json({ message: "Məhsul silindi" });
  } catch (error) {
    res.status(500).json({ message: "Məhsul silinərkən xəta baş verdi" });
  }
});

// ----------------------------------------------------
// 2. STOCK ENDPOINTS
// ----------------------------------------------------

// List all stock entries (mədaxillər)
router.get("/stock/entries", async (req, res) => {
  try {
    const entries = await db.query.stockEntries.findMany({
      with: { product: true },
      orderBy: [desc(schema.stockEntries.entryDate)],
    });

    // Format output for client mapping
    const result = entries.map((entry) => ({
      id: entry.id,
      productId: entry.productId,
      productName: entry.product.name,
      quantity: entry.quantity,
      purchasePrice: entry.purchasePrice,
      supplier: entry.supplier,
      notes: entry.notes,
      paymentType: entry.paymentType,
      creditDueDate: entry.creditDueDate,
      entryDate: entry.entryDate,
      paidStatus: entry.paidStatus,
    }));

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: "Mədaxilləri gətirərkən xəta baş verdi" });
  }
});

// Create stock entry
router.post("/stock/entries", requireAdmin, async (req, res) => {
  try {
    const { productId, quantity, purchasePrice, supplier, notes, paymentType, creditDueDate } = req.body;

    if (!productId || !quantity || !purchasePrice || !paymentType) {
      return res.status(400).json({ message: "Məcburi sahələri doldurun" });
    }

    const isCredit = paymentType === "Nisyə";
    if (isCredit && !creditDueDate) {
      return res.status(400).json({ message: "Nisyə üçün son tarix daxil edilməlidir" });
    }

    const newEntry = await db
      .insert(schema.stockEntries)
      .values({
        productId,
        quantity: parseFloat(quantity),
        purchasePrice: parseFloat(purchasePrice),
        supplier: supplier || null,
        notes: notes || null,
        paymentType,
        creditDueDate: isCredit ? creditDueDate : null,
        entryDate: new Date().toISOString(),
        paidStatus: isCredit ? "credit" : "paid",
      })
      .returning();

    res.json(newEntry[0]);
  } catch (error) {
    res.status(500).json({ message: "Mədaxil edilərkən xəta baş verdi" });
  }
});

// Fetch stock levels (current quantities, latest purchase prices, total value)
router.get("/stock/levels", async (req, res) => {
  try {
    const allProducts = await db.select().from(schema.products);
    const stockLevels = [];

    for (const product of allProducts) {
      // 1. Calculate total restocked
      const restockedResult = await db
        .select({ total: sql`SUM(quantity)` })
        .from(schema.stockEntries)
        .where(eq(schema.stockEntries.productId, product.id));
      const totalRestocked = parseFloat((restockedResult[0]?.total as string) || "0");

      // 2. Calculate total sold
      const soldResult = await db
        .select({ total: sql`SUM(quantity)` })
        .from(schema.saleItems)
        .where(eq(schema.saleItems.productId, product.id));
      const totalSold = parseFloat((soldResult[0]?.total as string) || "0");

      const currentQuantity = totalRestocked - totalSold;

      // 3. Get latest purchase price
      const latestEntry = await db
        .select({ price: schema.stockEntries.purchasePrice })
        .from(schema.stockEntries)
        .where(eq(schema.stockEntries.productId, product.id))
        .orderBy(desc(schema.stockEntries.entryDate))
        .limit(1);
      const lastPurchasePrice = latestEntry[0]?.price || 0;

      stockLevels.push({
        productId: product.id,
        productName: product.name,
        category: product.category,
        unit: product.unit,
        currentQuantity,
        lastPurchasePrice,
        totalValue: currentQuantity * lastPurchasePrice,
      });
    }

    res.json(stockLevels);
  } catch (error) {
    res.status(500).json({ message: "Anbar qalıqlarını hesablayarkən xəta baş verdi" });
  }
});

// Get our debts to suppliers (stockEntries with credit status)
router.get("/stock/my-debts", requireAdmin, async (req, res) => {
  try {
    const debts = await db.query.stockEntries.findMany({
      where: eq(schema.stockEntries.paidStatus, "credit"),
      with: { product: true },
      orderBy: [desc(schema.stockEntries.entryDate)],
    });

    const result = debts.map((d) => ({
      id: d.id,
      productId: d.productId,
      productName: d.product.name,
      quantity: d.quantity,
      purchasePrice: d.purchasePrice,
      totalAmount: d.quantity * d.purchasePrice,
      supplier: d.supplier,
      creditDueDate: d.creditDueDate,
      entryDate: d.entryDate,
    }));

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: "Borclarımızı gətirərkən xəta baş verdi" });
  }
});

// Pay supplier debt
router.patch("/stock/entries/:id/pay", requireAdmin, async (req, res) => {

  try {
    const id = parseInt(req.params.id);
    const { paymentType, paymentFrom, notes } = req.body;

    const entry = await db.query.stockEntries.findFirst({
      where: eq(schema.stockEntries.id, id)
    });

    if (!entry) return res.status(404).json({ message: "Mədaxil tapılmadı" });

    const existingNotes = entry.notes ? `${entry.notes} | ` : "";
    const updatedNotes = `${existingNotes}Ödənildi: ${paymentFrom || "Təyin edilməyib"} (Qeyd: ${notes || "yoxdur"})`;

    const updated = await db
      .update(schema.stockEntries)
      .set({ 
        paidStatus: "paid",
        paymentType: paymentType || "Nəğd",
        notes: updatedNotes
      })
      .where(eq(schema.stockEntries.id, id))
      .returning();

    res.json({ message: "Borc ödənildi" });
  } catch (error) {
    res.status(500).json({ message: "Borc ödənilərkən xəta baş verdi" });
  }
});

// ----------------------------------------------------
// 3. CUSTOMER ENDPOINTS
// ----------------------------------------------------

// List all customers
router.get("/customers", async (req, res) => {
  try {
    const list = await db.select().from(schema.customers);
    res.json(list);
  } catch (error) {
    res.status(500).json({ message: "Müştəriləri gətirərkən xəta baş verdi" });
  }
});

// Create customer
router.post("/customers", async (req, res) => {
  try {
    const { name, phone, email, address, notes } = req.body;
    if (!name) return res.status(400).json({ message: "Ad tələb olunur" });

    const newCustomer = await db
      .insert(schema.customers)
      .values({
        name,
        phone: phone || null,
        email: email || null,
        address: address || null,
        notes: notes || null,
      })
      .returning();

    res.json(newCustomer[0]);
  } catch (error) {
    res.status(500).json({ message: "Müştəri yaradılarkən xəta baş verdi" });
  }
});

// Update customer
router.put("/customers/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, phone, email, address, notes } = req.body;

    const updated = await db
      .update(schema.customers)
      .set({
        name,
        phone: phone || null,
        email: email || null,
        address: address || null,
        notes: notes || null,
      })
      .where(eq(schema.customers.id, id))
      .returning();

    if (updated.length === 0)
      return res.status(404).json({ message: "Müştəri tapılmadı" });

    res.json(updated[0]);
  } catch (error) {
    res.status(500).json({ message: "Müştəri yenilənərkən xəta baş verdi" });
  }
});

// Delete customer
router.delete("/customers/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const deleted = await db
      .delete(schema.customers)
      .where(eq(schema.customers.id, id))
      .returning();

    if (deleted.length === 0)
      return res.status(404).json({ message: "Müştəri tapılmadı" });

    res.json({ message: "Müştəri silindi" });
  } catch (error) {
    res.status(500).json({ message: "Müştəri silinərkən xəta baş verdi" });
  }
});

// Fetch customer's sales
router.get("/customers/:id/sales", async (req, res) => {
  try {
    const customerId = parseInt(req.params.id);
    const customerSales = await db.query.sales.findMany({
      where: eq(schema.sales.customerId, customerId),
      orderBy: [desc(schema.sales.saleDate)],
    });
    res.json(customerSales);
  } catch (error) {
    res.status(500).json({ message: "Müştərinin satış tarixçəsini gətirərkən xəta baş verdi" });
  }
});

// ----------------------------------------------------
// 4. SALES & POS ENDPOINTS
// ----------------------------------------------------

// List all sales (supports date range filters)
router.get("/sales", async (req, res) => {
  try {
    const { from, to } = req.query;
    let queryFilter = undefined;

    if (from && to) {
      queryFilter = and(
        gte(schema.sales.saleDate, `${from}T00:00:00.000Z`),
        lte(schema.sales.saleDate, `${to}T23:59:59.999Z`)
      );
    } else if (from) {
      queryFilter = gte(schema.sales.saleDate, `${from}T00:00:00.000Z`);
    } else if (to) {
      queryFilter = lte(schema.sales.saleDate, `${to}T23:59:59.999Z`);
    }

    const list = await db.query.sales.findMany({
      where: queryFilter,
      orderBy: [desc(schema.sales.saleDate)],
    });

    res.json(list);
  } catch (error) {
    res.status(500).json({ message: "Satış tarixçəsini gətirərkən xəta baş verdi" });
  }
});

// Create sale (POS checkout)
router.post("/sales", async (req, res) => {
  try {
    const { 
      customerId, 
      customerName, 
      customerPhone, 
      customerEmail,
      customerAddress,
      paymentType, 
      creditDueDate, 
      notes, 
      items 
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0 || !paymentType) {
      return res.status(400).json({ message: "Səbət boşdur və ya ödəniş növü seçilməyib" });
    }

    const isCredit = paymentType === "Nisyə";
    if (isCredit && !creditDueDate) {
      return res.status(400).json({ message: "Nisyə üçün son tarix daxil edilməlidir" });
    }

    let finalCustomerId = customerId;
    
    // Dynamically insert a new persistent customer if customerId is null but customerName is provided
    if (!customerId && customerName && customerName.trim()) {
      const trimmedName = customerName.trim();
      
      // Prevent duplicates by checking if a customer with the same name exists
      const existingCust = await db.query.customers.findFirst({
        where: eq(schema.customers.name, trimmedName)
      });

      if (existingCust) {
        finalCustomerId = existingCust.id;
      } else {
        const newCust = await db
          .insert(schema.customers)
          .values({
            name: trimmedName,
            phone: customerPhone || null,
            email: customerEmail || null,
            address: customerAddress || null,
          })
          .returning();
        finalCustomerId = newCust[0].id;
      }
    }

    let totalAmount = 0;
    let totalCost = 0;
    const validatedItems = [];

    // Verify stock and fetch snapshot cost prices (purchasePrice)
    for (const item of items) {
      const { productId, quantity, salePrice } = item;

      // Calculate stock level dynamically
      const restockedResult = await db
        .select({ total: sql`SUM(quantity)` })
        .from(schema.stockEntries)
        .where(eq(schema.stockEntries.productId, productId));
      const totalRestocked = parseFloat((restockedResult[0]?.total as string) || "0");

      const soldResult = await db
        .select({ total: sql`SUM(quantity)` })
        .from(schema.saleItems)
        .where(eq(schema.saleItems.productId, productId));
      const totalSold = parseFloat((soldResult[0]?.total as string) || "0");

      const currentQuantity = totalRestocked - totalSold;

      if (currentQuantity < parseFloat(quantity)) {
        const prod = await db.select().from(schema.products).where(eq(schema.products.id, productId));
        return res.status(400).json({
          message: `Yetərsiz anbar balansı: ${prod[0]?.name || "Məhsul"} (Qalıq: ${currentQuantity})`,
        });
      }

      // Get latest purchase price
      const latestEntry = await db
        .select({ price: schema.stockEntries.purchasePrice })
        .from(schema.stockEntries)
        .where(eq(schema.stockEntries.productId, productId))
        .orderBy(desc(schema.stockEntries.entryDate))
        .limit(1);
      const purchasePrice = latestEntry[0]?.price || 0;

      const qty = parseFloat(quantity);
      const sprice = parseFloat(salePrice);

      totalAmount += qty * sprice;
      totalCost += qty * purchasePrice;

      validatedItems.push({
        productId,
        quantity: qty,
        salePrice: sprice,
        purchasePrice,
      });
    }

    // Insert Sale header
    const newSale = await db
      .insert(schema.sales)
      .values({
        customerId: finalCustomerId || null,
        customerName: customerName || null,
        customerPhone: customerPhone || null,
        paymentType,
        creditDueDate: isCredit ? creditDueDate : null,
        notes: notes || null,
        saleDate: new Date().toISOString(),
        totalAmount,
        totalCost,
        paymentStatus: isCredit ? "credit" : "paid",
      })
      .returning();

    const saleId = newSale[0].id;

    // Insert Sale items
    for (const item of validatedItems) {
      await db.insert(schema.saleItems).values({
        saleId,
        productId: item.productId,
        quantity: item.quantity,
        salePrice: item.salePrice,
        purchasePrice: item.purchasePrice,
      });
    }

    res.json({ id: saleId, message: "Satış tamamlandı" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Satış qeydə alınarkən xəta baş verdi" });
  }
});

// Get specific sale details (invoice)
router.get("/sales/:id", async (req, res) => {
  try {
    const saleId = parseInt(req.params.id);

    const sale = await db.query.sales.findFirst({
      where: eq(schema.sales.id, saleId),
      with: {
        items: {
          with: { product: true },
        },
        payments: true,
      },
    });

    if (!sale) return res.status(404).json({ message: "Satış tapılmadı" });

    // Calculate remaining debt
    const totalPaid = sale.payments.reduce((sum, p) => sum + p.amount, 0);
    const remainingDebt = sale.paymentStatus === "credit" ? sale.totalAmount - totalPaid : 0;

    const result = {
      id: sale.id,
      customerId: sale.customerId,
      customerName: sale.customerName,
      customerPhone: sale.customerPhone,
      paymentType: sale.paymentType,
      creditDueDate: sale.creditDueDate,
      notes: sale.notes,
      saleDate: sale.saleDate,
      totalAmount: sale.totalAmount,
      totalCost: sale.totalCost,
      paymentStatus: sale.paymentStatus,
      totalPaid,
      remainingDebt,
      items: sale.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        productName: item.product.name,
        unit: item.product.unit,
        quantity: item.quantity,
        salePrice: item.salePrice,
        purchasePrice: item.purchasePrice,
      })),
      payments: sale.payments,
    };

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: "Satış məlumatlarını gətirərkən xəta baş verdi" });
  }
});

// Pay customer credit fully
router.patch("/sales/:id/pay-credit", async (req, res) => {
  try {
    const saleId = parseInt(req.params.id);

    const sale = await db.query.sales.findFirst({
      where: eq(schema.sales.id, saleId),
      with: { payments: true },
    });

    if (!sale) return res.status(404).json({ message: "Satış tapılmadı" });
    if (sale.paymentStatus === "paid") {
      return res.status(400).json({ message: "Bu satışın borcu artıq tam ödənilib" });
    }

    const totalPaid = sale.payments.reduce((sum, p) => sum + p.amount, 0);
    const amountToPay = sale.totalAmount - totalPaid;

    // 1. Record credit payment
    await db.insert(schema.creditPayments).values({
      saleId,
      paymentDate: new Date().toISOString(),
      amount: amountToPay,
    });

    // 2. Mark sale as paid
    await db
      .update(schema.sales)
      .set({ paymentStatus: "paid" })
      .where(eq(schema.sales.id, saleId));

    res.json({ message: "Borc tam ödənildi" });
  } catch (error) {
    res.status(500).json({ message: "Borc ödənilərkən xəta baş verdi" });
  }
});

// Add partial credit payment
router.patch("/sales/:id/add-payment", async (req, res) => {
  try {
    const saleId = parseInt(req.params.id);
    const { amount } = req.body;

    if (!amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ message: "Düzgün ödəniş məbləği daxil edin" });
    }

    const sale = await db.query.sales.findFirst({
      where: eq(schema.sales.id, saleId),
      with: { payments: true },
    });

    if (!sale) return res.status(404).json({ message: "Satış tapılmadı" });
    if (sale.paymentStatus === "paid") {
      return res.status(400).json({ message: "Bu satışın borcu artıq tam ödənilib" });
    }

    const totalPaid = sale.payments.reduce((sum, p) => sum + p.amount, 0);
    const amountToPay = parseFloat(amount);
    const remaining = sale.totalAmount - totalPaid;

    if (amountToPay > remaining + 0.01) {
      return res.status(400).json({
        message: `Məbləğ qalıq borcdan çox ola bilməz (Qalıq borc: ${remaining.toFixed(2)} ₼)`,
      });
    }

    // 1. Record payment
    await db.insert(schema.creditPayments).values({
      saleId,
      paymentDate: new Date().toISOString(),
      amount: amountToPay,
    });

    // 2. Check if credit is fully paid now
    const newTotalPaid = totalPaid + amountToPay;
    if (Math.abs(sale.totalAmount - newTotalPaid) < 0.01 || newTotalPaid >= sale.totalAmount) {
      await db
        .update(schema.sales)
        .set({ paymentStatus: "paid" })
        .where(eq(schema.sales.id, saleId));
    }

    res.json({ message: "Ödəniş qəbul edildi" });
  } catch (error) {
    res.status(500).json({ message: "Ödəniş qeyd edilərkən xəta baş verdi" });
  }
});

// ----------------------------------------------------
// 5. CREDIT/DEBT ALERTS
// ----------------------------------------------------

// Fetch overdue customer credits
router.get("/credits/overdue", async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];

    const overdueSales = await db.query.sales.findMany({
      where: and(
        eq(schema.sales.paymentStatus, "credit"),
        lte(schema.sales.creditDueDate, today)
      ),
      with: { payments: true },
    });

    const result = overdueSales.map((sale) => {
      const paid = sale.payments.reduce((sum, p) => sum + p.amount, 0);
      return {
        id: sale.id,
        customerId: sale.customerId,
        customerName: sale.customerName,
        customerPhone: sale.customerPhone,
        saleDate: sale.saleDate,
        creditDueDate: sale.creditDueDate,
        totalAmount: sale.totalAmount - paid,
      };
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: "Gecikmiş borcları gətirərkən xəta baş verdi" });
  }
});

// Fetch pending customer credits (active debts not overdue yet)
router.get("/credits/pending", async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];

    const pendingSales = await db.query.sales.findMany({
      where: and(
        eq(schema.sales.paymentStatus, "credit"),
        gte(schema.sales.creditDueDate, today)
      ),
      with: { payments: true },
    });

    const result = pendingSales.map((sale) => {
      const paid = sale.payments.reduce((sum, p) => sum + p.amount, 0);
      return {
        id: sale.id,
        customerId: sale.customerId,
        customerName: sale.customerName,
        customerPhone: sale.customerPhone,
        saleDate: sale.saleDate,
        creditDueDate: sale.creditDueDate,
        totalAmount: sale.totalAmount - paid,
      };
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: "Aktiv nisyələri gətirərkən xəta baş verdi" });
  }
});

// ----------------------------------------------------
// 6. EXPENSES ENDPOINTS
// ----------------------------------------------------

// List all expenses
router.get("/expenses", async (req, res) => {
  try {
    const { from, to } = req.query;
    let queryFilter = undefined;

    if (from && to) {
      queryFilter = and(
        gte(schema.expenses.date, `${from}T00:00:00.000Z`),
        lte(schema.expenses.date, `${to}T23:59:59.999Z`)
      );
    } else if (from) {
      queryFilter = gte(schema.expenses.date, `${from}T00:00:00.000Z`);
    } else if (to) {
      queryFilter = lte(schema.expenses.date, `${to}T23:59:59.999Z`);
    }

    const list = await db.select().from(schema.expenses).where(queryFilter).orderBy(desc(schema.expenses.date));
    res.json(list);
  } catch (error) {
    res.status(500).json({ message: "Xərcləri gətirərkən xəta baş verdi" });
  }
});

// Create expense
router.post("/expenses", requireAdmin, async (req, res) => {
  try {
    const { amount, category, description } = req.body;

    if (!amount || !category) {
      return res.status(400).json({ message: "Məbləğ və kateqoriya tələb olunur" });
    }

    const newExpense = await db
      .insert(schema.expenses)
      .values({
        amount: parseFloat(amount),
        category,
        description: description || null,
        date: new Date().toISOString(),
      })
      .returning();

    res.json(newExpense[0]);
  } catch (error) {
    res.status(500).json({ message: "Xərc yaradılarkən xəta baş verdi" });
  }
});

// Delete expense
router.delete("/expenses/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const deleted = await db
      .delete(schema.expenses)
      .where(eq(schema.expenses.id, id))
      .returning();

    if (deleted.length === 0)
      return res.status(404).json({ message: "Xərc tapılmadı" });

    res.json({ message: "Xərc silindi" });
  } catch (error) {
    res.status(500).json({ message: "Xərc silinərkən xəta baş verdi" });
  }
});

// ----------------------------------------------------
// 7. DASHBOARD SUMMARY ENDPOINTS
// ----------------------------------------------------

router.get("/dashboard/summary", requireAdmin, async (req, res) => {
  try {
    const { from, to } = req.query;

    // Period boundaries for the filter range (defaults to Today)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const fromDateStr = from ? `${from}T00:00:00.000Z` : todayStart.toISOString();
    const toDateStr = to ? `${to}T23:59:59.999Z` : todayEnd.toISOString();

    const rangeFilter = and(
      gte(schema.sales.saleDate, fromDateStr),
      lte(schema.sales.saleDate, toDateStr)
    );

    // 1. Period sales data
    const rangeSales = await db.select().from(schema.sales).where(rangeFilter);
    const todayRevenue = rangeSales.reduce((sum, s) => sum + s.totalAmount, 0);
    const todayCost = rangeSales.reduce((sum, s) => sum + s.totalCost, 0);
    const todayProfit = todayRevenue - todayCost;
    const todaySales = rangeSales.length;

    // 2. Period expenses data
    const rangeExpensesList = await db
      .select()
      .from(schema.expenses)
      .where(
        and(
          gte(schema.expenses.date, fromDateStr),
          lte(schema.expenses.date, toDateStr)
        )
      );
    const todayExpenses = rangeExpensesList.reduce((sum, e) => sum + e.amount, 0);
    const todayNetProfit = todayProfit - todayExpenses;

    // 3. Current calendar month data
    const { firstDay, lastDay } = getMonthBoundaries();

    const monthSales = await db
      .select()
      .from(schema.sales)
      .where(
        and(
          gte(schema.sales.saleDate, firstDay),
          lte(schema.sales.saleDate, lastDay)
        )
      );
    const monthRevenue = monthSales.reduce((sum, s) => sum + s.totalAmount, 0);
    const monthCost = monthSales.reduce((sum, s) => sum + s.totalCost, 0);
    const monthProfit = monthRevenue - monthCost;

    const monthExpensesList = await db
      .select()
      .from(schema.expenses)
      .where(
        and(
          gte(schema.expenses.date, firstDay),
          lte(schema.expenses.date, lastDay)
        )
      );
    const monthExpenses = monthExpensesList.reduce((sum, e) => sum + e.amount, 0);
    const monthNetProfit = monthProfit - monthExpenses;

    // 4. Warehouse Stock Value (Calculated dynamically)
    const allProducts = await db.select().from(schema.products);
    let totalStockValue = 0;
    let lowStockCount = 0;

    for (const product of allProducts) {
      // Sum restocked
      const restocked = await db
        .select({ total: sql`SUM(quantity)` })
        .from(schema.stockEntries)
        .where(eq(schema.stockEntries.productId, product.id));
      const totalRestocked = parseFloat((restocked[0]?.total as string) || "0");

      // Sum sold
      const sold = await db
        .select({ total: sql`SUM(quantity)` })
        .from(schema.saleItems)
        .where(eq(schema.saleItems.productId, product.id));
      const totalSold = parseFloat((sold[0]?.total as string) || "0");

      const qty = totalRestocked - totalSold;

      // Get latest price
      const latestPriceResult = await db
        .select({ price: schema.stockEntries.purchasePrice })
        .from(schema.stockEntries)
        .where(eq(schema.stockEntries.productId, product.id))
        .orderBy(desc(schema.stockEntries.entryDate))
        .limit(1);
      const lastPrice = latestPriceResult[0]?.price || 0;

      totalStockValue += qty * lastPrice;

      if (qty < 5 && qty > 0) {
        lowStockCount++;
      }
    }

    // 5. Total outstanding customer credit debts (Nisyələr)
    const activeCredits = await db.query.sales.findMany({
      where: eq(schema.sales.paymentStatus, "credit"),
      with: { payments: true },
    });

    let totalCreditDebt = 0;
    let overdueCreditsCount = 0;
    const todayStr = new Date().toISOString().split("T")[0];

    for (const sale of activeCredits) {
      const paid = sale.payments.reduce((sum, p) => sum + p.amount, 0);
      totalCreditDebt += sale.totalAmount - paid;

      if (sale.creditDueDate && sale.creditDueDate <= todayStr) {
        overdueCreditsCount++;
      }
    }

    // 6. Outstanding debts to suppliers (Mənim Borcum)
    const supplierDebts = await db
      .select({ qty: schema.stockEntries.quantity, price: schema.stockEntries.purchasePrice })
      .from(schema.stockEntries)
      .where(eq(schema.stockEntries.paidStatus, "credit"));
    const myTotalDebt = supplierDebts.reduce((sum, d) => sum + d.qty * d.price, 0);

    res.json({
      todayRevenue,
      todayCost,
      todayProfit,
      todayExpenses,
      todayNetProfit,
      todaySales,
      monthRevenue,
      monthProfit,
      monthExpenses,
      monthNetProfit,
      totalStockValue,
      lowStockCount,
      totalCreditDebt,
      overdueCreditsCount,
      myTotalDebt,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Dashboard məlumatlarını hazırlayarkən xəta baş verdi" });
  }
});

// Recent Sales (Limit 6)
router.get("/dashboard/recent-sales", async (req, res) => {
  try {
    const recent = await db.query.sales.findMany({
      orderBy: [desc(schema.sales.saleDate)],
      limit: 6,
    });
    res.json(recent);
  } catch (error) {
    res.status(500).json({ message: "Son satışları gətirərkən xəta baş verdi" });
  }
});

// Low Stock List
router.get("/dashboard/low-stock", async (req, res) => {
  try {
    const allProducts = await db.select().from(schema.products);
    const lowStock = [];

    for (const product of allProducts) {
      // Sum restocked
      const restocked = await db
        .select({ total: sql`SUM(quantity)` })
        .from(schema.stockEntries)
        .where(eq(schema.stockEntries.productId, product.id));
      const totalRestocked = parseFloat((restocked[0]?.total as string) || "0");

      // Sum sold
      const sold = await db
        .select({ total: sql`SUM(quantity)` })
        .from(schema.saleItems)
        .where(eq(schema.saleItems.productId, product.id));
      const totalSold = parseFloat((sold[0]?.total as string) || "0");

      const currentQuantity = totalRestocked - totalSold;

      if (currentQuantity < 5 && currentQuantity >= 0) {
        lowStock.push({
          productId: product.id,
          productName: product.name,
          currentQuantity,
          unit: product.unit,
        });
      }
    }

    res.json(lowStock);
  } catch (error) {
    res.status(500).json({ message: "Tükənən məhsulları gətirərkən xəta baş verdi" });
  }
});

// ----------------------------------------------------
// 8. SETTINGS & DATA EXPORT ENDPOINTS
// ----------------------------------------------------

// Get settings
router.get("/settings", async (req, res) => {
  try {
    let list = await db.select().from(schema.settings).limit(1);
    if (list.length === 0) {
      // Insert standard default row if empty
      const defaultSettings = await db
        .insert(schema.settings)
        .values({
          storeName: "Mətbəx Dünyası",
          phone: "055-123-45-67",
          address: "Yuxarı Göyçay",
          invoiceFooter: "Bizi seçdiyiniz üçün təşəkkür edirik!",
          lowStockAlertCount: 5,
          defaultCreditDays: 30,
          receiptWidth: "80mm",
          showBarcode: 1,
          showCustomerInfo: 1,
          receiptHeader: "MƏTBƏX DÜNYASI",
          receiptFooter: "Çekimizi saxlamanızı xahiş edirik!",
          showStorePhone: 1,
          showStoreAddress: 1,
          showReceiptHeader: 1,
          showReceiptFooter: 1,
          showPaymentDetails: 1,
        })
        .returning();
      return res.json(defaultSettings[0]);
    }
    res.json(list[0]);
  } catch (error) {
    res.status(500).json({ message: "Ayarları gətirərkən xəta baş verdi" });
  }
});

// Update settings
router.put("/settings", requireAdmin, async (req, res) => {
  try {
    const {
      storeName,
      phone,
      address,
      invoiceFooter,
      lowStockAlertCount,
      defaultCreditDays,
      receiptWidth,
      showBarcode,
      showCustomerInfo,
      receiptHeader,
      receiptFooter,
      showStorePhone,
      showStoreAddress,
      showReceiptHeader,
      showReceiptFooter,
      showPaymentDetails,
    } = req.body;
    
    // Check if settings row exists
    let list = await db.select().from(schema.settings).limit(1);
    
    let updated;
    if (list.length === 0) {
      updated = await db
        .insert(schema.settings)
        .values({
          storeName: storeName || "Mətbəx Dünyası",
          phone: phone || null,
          address: address || null,
          invoiceFooter: invoiceFooter || null,
          lowStockAlertCount: parseInt(lowStockAlertCount) || 5,
          defaultCreditDays: parseInt(defaultCreditDays) || 30,
          receiptWidth: receiptWidth || "80mm",
          showBarcode: showBarcode !== undefined ? parseInt(showBarcode) : 1,
          showCustomerInfo: showCustomerInfo !== undefined ? parseInt(showCustomerInfo) : 1,
          receiptHeader: receiptHeader || null,
          receiptFooter: receiptFooter || null,
          showStorePhone: showStorePhone !== undefined ? parseInt(showStorePhone) : 1,
          showStoreAddress: showStoreAddress !== undefined ? parseInt(showStoreAddress) : 1,
          showReceiptHeader: showReceiptHeader !== undefined ? parseInt(showReceiptHeader) : 1,
          showReceiptFooter: showReceiptFooter !== undefined ? parseInt(showReceiptFooter) : 1,
          showPaymentDetails: showPaymentDetails !== undefined ? parseInt(showPaymentDetails) : 1,
        })
        .returning();
    } else {
      updated = await db
        .update(schema.settings)
        .set({
          storeName: storeName || "Mətbəx Dünyası",
          phone: phone || null,
          address: address || null,
          invoiceFooter: invoiceFooter || null,
          lowStockAlertCount: parseInt(lowStockAlertCount) || 5,
          defaultCreditDays: parseInt(defaultCreditDays) || 30,
          receiptWidth: receiptWidth || "80mm",
          showBarcode: showBarcode !== undefined ? parseInt(showBarcode) : 1,
          showCustomerInfo: showCustomerInfo !== undefined ? parseInt(showCustomerInfo) : 1,
          receiptHeader: receiptHeader || null,
          receiptFooter: receiptFooter || null,
          showStorePhone: showStorePhone !== undefined ? parseInt(showStorePhone) : 1,
          showStoreAddress: showStoreAddress !== undefined ? parseInt(showStoreAddress) : 1,
          showReceiptHeader: showReceiptHeader !== undefined ? parseInt(showReceiptHeader) : 1,
          showReceiptFooter: showReceiptFooter !== undefined ? parseInt(showReceiptFooter) : 1,
          showPaymentDetails: showPaymentDetails !== undefined ? parseInt(showPaymentDetails) : 1,
        })
        .where(eq(schema.settings.id, list[0].id))
        .returning();
    }
    res.json(updated[0]);
  } catch (error) {
    res.status(500).json({ message: "Ayarları yeniləyərkən xəta baş verdi" });
  }
});


// Export database tables as CSV (Data backup & portability)
router.get("/backup/export/:table", requireAdmin, async (req, res) => {
  try {
    const table = req.params.table;
    let data: any[] = [];
    let filename = `${table}_backup.csv`;

    if (table === "products") {
      data = await db.select().from(schema.products);
    } else if (table === "customers") {
      data = await db.select().from(schema.customers);
    } else if (table === "expenses") {
      data = await db.select().from(schema.expenses);
    } else if (table === "sales") {
      data = await db.select().from(schema.sales);
    } else if (table === "stock_entries") {
      data = await db.select().from(schema.stockEntries);
    } else {
      return res.status(400).json({ message: "Yanlış cədvəl adı" });
    }

    if (data.length === 0) {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
      return res.send("No records found");
    }

    // Convert array of objects to CSV string
    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(",")];

    for (const row of data) {
      const values = headers.map((header) => {
        const val = row[header];
        if (val === null || val === undefined) return '""';
        const escaped = ("" + val).replace(/"/g, '""'); // Proper CSV quote escape
        return `"${escaped}"`;
      });
      csvRows.push(values.join(","));
    }

    const csvContent = "\uFEFF" + csvRows.join("\n"); // Add BOM for Excel UTF-8 Azerbaijani support

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
    res.status(200).send(csvContent);
  } catch (error) {
    res.status(500).json({ message: "Məlumatları ixrac edərkən xəta baş verdi" });
  }
});

export default router;
