// BirSaaS Isolated Ephemeral Demo Sandbox Engine
// Operates 100% inside client sessionStorage to provide multi-tab concurrent isolation and zero database pollution.

// 1. Pre-seeded Demo Dataset
const DEFAULT_PRODUCTS = [
  { productId: 1, id: 1, productName: "iPhone 15 Pro", barcode: "190198765432", category: "Telefonlar", unit: "ədəd", currentQuantity: 12, salePrice: 2200, purchasePrice: 1800, supplierName: "Apple Azerbaijan", notes: "128GB Black Titanium" },
  { productId: 2, id: 2, productName: "MacBook Air M3", barcode: "190198765449", category: "Kompüterlər", unit: "ədəd", currentQuantity: 8, salePrice: 2400, purchasePrice: 1900, supplierName: "Apple Azerbaijan", notes: "13-inch 8GB/256GB" },
  { productId: 3, id: 3, productName: "AirPods Pro 2", barcode: "190198765456", category: "Aksesuarlar", unit: "ədəd", currentQuantity: 25, salePrice: 400, purchasePrice: 280, supplierName: "Apple Azerbaijan", notes: "USB-C Case" },
  { productId: 4, id: 4, productName: "Samsung Galaxy S24 Ultra", barcode: "880609876543", category: "Telefonlar", unit: "ədəd", currentQuantity: 10, salePrice: 2100, purchasePrice: 1700, supplierName: "Samsung Baku", notes: "512GB Titanium Gray" },
  { productId: 5, id: 5, productName: "Xiaomi 14 Pro", barcode: "697060987654", category: "Telefonlar", unit: "ədəd", currentQuantity: 15, salePrice: 1450, purchasePrice: 1100, supplierName: "Mi Azerbaijan", notes: "256GB Black" },
  { productId: 6, id: 6, productName: "Barkod Oxuyucu Honeywell", barcode: "4006381333931", category: "Avadanlıq", unit: "ədəd", currentQuantity: 40, salePrice: 150, purchasePrice: 80, supplierName: "Honeywell Ltd", notes: "Simsiz 2D Scanner" },
  { productId: 7, id: 7, productName: "Termal Printer 80mm", barcode: "4006381333948", category: "Avadanlıq", unit: "ədəd", currentQuantity: 18, salePrice: 220, purchasePrice: 120, supplierName: "Epson Baku", notes: "Qəbz çapı üçün" },
  { productId: 8, id: 8, productName: "Samsung Smart Saat 6", barcode: "880609876599", category: "Aksesuarlar", unit: "ədəd", currentQuantity: 30, salePrice: 550, purchasePrice: 350, supplierName: "Samsung Baku", notes: "Classic LTE Edition" },
];

const DEFAULT_CUSTOMERS = [
  { id: 1, name: "Abbas Bağırov", phone: "+994 50 200 11 22", email: "abbas@bagirov.az", address: "Bakı, Nərimanov", notes: "Daimi VIP Müştəri" },
  { id: 2, name: "Nərmin Məmmədova", phone: "+994 70 300 44 55", email: "nermin@mammadova.az", address: "Bakı, Gənclik", notes: "Kartla ödəniş edir" },
  { id: 3, name: "Tural Əliyev", phone: "+994 55 400 77 88", email: "tural@aliyev.az", address: "Xırdalan", notes: "Nisyə limiti: 1500 AZN" },
  { id: 4, name: "Samir Qasımov", phone: "+994 50 500 99 00", email: "samir@qasimov.az", address: "Sumqayıt", notes: "Yalnız nağd" },
];

const getPastIsoDate = (daysAgo: number) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
};

const DEFAULT_SALES = [
  {
    id: 1,
    saleDate: getPastIsoDate(2),
    customerId: 2,
    customerName: "Nərmin Məmmədova",
    paymentType: "card",
    paymentStatus: "paid",
    totalAmount: 1350,
    totalCost: 910, // 2x AirPods (560) + 1x Smart Saat (350)
    notes: "Nərmin Məmmədova üçün sürətli satış",
    items: [
      { id: 1, productId: 3, productName: "AirPods Pro 2", quantity: 2, salePrice: 400, purchasePrice: 280 },
      { id: 2, productId: 8, productName: "Samsung Smart Saat 6", quantity: 1, salePrice: 550, purchasePrice: 350 },
    ],
    payments: [{ id: 1, amount: 1350, paymentDate: getPastIsoDate(2), paymentType: "card" }]
  },
  {
    id: 2,
    saleDate: getPastIsoDate(1),
    customerId: null,
    customerName: "Anonim Müştəri",
    paymentType: "card",
    paymentStatus: "paid",
    totalAmount: 2200,
    totalCost: 1800,
    notes: "Nağdsız kassa satışı",
    items: [
      { id: 3, productId: 1, productName: "iPhone 15 Pro", quantity: 1, salePrice: 2200, purchasePrice: 1800 }
    ],
    payments: [{ id: 2, amount: 2200, paymentDate: getPastIsoDate(1), paymentType: "card" }]
  },
  {
    id: 3,
    saleDate: getPastIsoDate(5),
    customerId: 3,
    customerName: "Tural Əliyev",
    paymentType: "cash",
    paymentStatus: "unpaid",
    totalAmount: 2100,
    totalCost: 1700, // 1x Samsung S24 Ultra (1700)
    notes: "Nisyə ticarət razılaşması",
    creditDueDate: (() => {
      const d = new Date();
      d.setDate(d.getDate() + 20);
      return d.toISOString().split("T")[0];
    })(),
    items: [
      { id: 4, productId: 4, productName: "Samsung Galaxy S24 Ultra", quantity: 1, salePrice: 2100, purchasePrice: 1700 }
    ],
    payments: [{ id: 3, amount: 1250, paymentDate: getPastIsoDate(5), paymentType: "cash" }]
  },
  {
    id: 4,
    saleDate: getPastIsoDate(10),
    customerId: 1,
    customerName: "Abbas Bağırov",
    paymentType: "cash",
    paymentStatus: "unpaid",
    totalAmount: 550,
    totalCost: 360, // 1x AirPods (280) + 1x Barkod Oxuyucu (80)
    notes: "Vaxtı keçmiş nisyə sınağı",
    creditDueDate: (() => {
      const d = new Date();
      d.setDate(d.getDate() - 5);
      return d.toISOString().split("T")[0];
    })(),
    items: [
      { id: 5, productId: 3, productName: "AirPods Pro 2", quantity: 1, salePrice: 400, purchasePrice: 280 },
      { id: 6, productId: 6, productName: "Barkod Oxuyucu Honeywell", quantity: 1, salePrice: 150, purchasePrice: 80 }
    ],
    payments: [{ id: 4, amount: 100, paymentDate: getPastIsoDate(10), paymentType: "cash" }]
  }
];

const DEFAULT_RETURNS: any[] = [];

const DEFAULT_EXPENSES = [
  { id: 1, amount: 800, category: "Kira", description: "Mağaza Aylıq İcarə Haqqı", date: getPastIsoDate(10) },
  { id: 2, amount: 120, category: "Komunal", description: "Elektrik enerjisi borcu", date: getPastIsoDate(8) },
  { id: 3, amount: 30, category: "Rabitə", description: "Fiber İnternet Aylıq abunə", date: getPastIsoDate(7) }
];

const DEFAULT_SETTINGS = {
  storeName: "BirSaaS Elektronika",
  address: "Bakı şəhəri, Nizami küçəsi 45",
  phone: "+994 50 123 45 67",
  receiptHeader: "BİRSAAS ELEKTRONİKA",
  receiptFooter: "Bizi seçdiyiniz üçün təşəkkür edirik! BirSaaS 1.0 RC",
  receiptWidth: "80mm",
  showBarcode: 1,
  showCustomerInfo: 1,
  showStorePhone: 1,
  showStoreAddress: 1,
  showReceiptHeader: 1,
  showReceiptFooter: 1,
  showPaymentDetails: 1,
  lowStockAlertCount: 5,
};

const DEFAULT_LOGS = [
  { id: 1, username: "admin", action: "Sistemə giriş olundu (Demo sessiya)", timestamp: getPastIsoDate(0) },
  { id: 2, username: "admin", action: "Məhsul yaradıldı: iPhone 15 Pro", timestamp: getPastIsoDate(2) },
  { id: 3, username: "admin", action: "Yeni satış tamamlandı: #00001 (Kartla)", timestamp: getPastIsoDate(2) }
];

// Helper to initialize session storage database
export function initDemoDatabase() {
  if (sessionStorage.getItem("birsaas_demo_db_initialized") === "true") return;

  sessionStorage.setItem("birsaas_demo_products", JSON.stringify(DEFAULT_PRODUCTS));
  sessionStorage.setItem("birsaas_demo_customers", JSON.stringify(DEFAULT_CUSTOMERS));
  sessionStorage.setItem("birsaas_demo_sales", JSON.stringify(DEFAULT_SALES));
  sessionStorage.setItem("birsaas_demo_returns", JSON.stringify(DEFAULT_RETURNS));
  sessionStorage.setItem("birsaas_demo_expenses", JSON.stringify(DEFAULT_EXPENSES));
  sessionStorage.setItem("birsaas_demo_settings", JSON.stringify(DEFAULT_SETTINGS));
  sessionStorage.setItem("birsaas_demo_logs", JSON.stringify(DEFAULT_LOGS));
  sessionStorage.setItem("birsaas_demo_db_initialized", "true");
}

// Low-level DB helpers
const getDb = (key: string): any[] => JSON.parse(sessionStorage.getItem(`birsaas_demo_${key}`) || "[]");
const saveDb = (key: string, data: any) => sessionStorage.setItem(`birsaas_demo_${key}`, JSON.stringify(data));

// Log helper
const logActivity = (action: string) => {
  const logs = getDb("logs");
  const newLog = {
    id: logs.length + 1,
    username: "demo_admin",
    action,
    timestamp: new Date().toISOString()
  };
  logs.unshift(newLog);
  saveDb("logs", logs);
};

// 2. Mock Fetch Interceptor
export async function mockDemoFetch(url: string | URL, options?: RequestInit): Promise<Response> {
  const urlStr = typeof url === "string" ? url : url.pathname + url.search;
  const method = options?.method?.toUpperCase() || "GET";
  
  console.log(`[Demo Sandbox Mock API] ${method} ${urlStr}`);

  // Helpers to structure mock standard JSON response
  const jsonResponse = (data: any, status = 200) => {
    return new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json" }
    });
  };

  const getBody = () => options?.body ? JSON.parse(options.body as string) : {};

  // Parse Path Segments
  const parsedUrl = new URL(urlStr, window.location.origin);
  const path = parsedUrl.pathname;

  // 1. Settings Endpoints
  if (path === "/api/settings") {
    if (method === "GET") {
      const settings = JSON.parse(sessionStorage.getItem("birsaas_demo_settings") || "{}");
      return jsonResponse(settings);
    }
    if (method === "POST" || method === "PUT") {
      const body = getBody();
      const settings = JSON.parse(sessionStorage.getItem("birsaas_demo_settings") || "{}");
      const updated = { ...settings, ...body };
      sessionStorage.setItem("birsaas_demo_settings", JSON.stringify(updated));
      logActivity("Tənzimləmələr yeniləndi");
      return jsonResponse(updated);
    }
  }

  // 2. Auth Endpoints
  if (path === "/api/auth/login") {
    const body = getBody();
    const mockUser = { id: 9999, username: body.username || "demo_admin", role: "Admin" };
    return jsonResponse(mockUser);
  }

  // 3. Products Endpoints
  if (path === "/api/products") {
    if (method === "GET") {
      return jsonResponse(getDb("products"));
    }
    if (method === "POST") {
      const body = getBody();
      const products = getDb("products");
      const nextId = products.length > 0 ? Math.max(...products.map(p => p.id)) + 1 : 1;
      const newProduct = {
        id: nextId,
        productId: nextId,
        productName: body.productName,
        barcode: body.barcode || "",
        category: body.category || "",
        unit: body.unit || "ədəd",
        currentQuantity: parseFloat(body.currentQuantity || 0),
        salePrice: parseFloat(body.salePrice || 0),
        purchasePrice: parseFloat(body.purchasePrice || 0),
        supplierName: body.supplierName || "",
        notes: body.notes || ""
      };
      products.push(newProduct);
      saveDb("products", products);
      logActivity(`Məhsul yaradıldı: ${newProduct.productName}`);
      return jsonResponse(newProduct);
    }
  }

  if (path.startsWith("/api/products/")) {
    const id = parseInt(path.split("/").pop() || "0");
    const products = getDb("products");
    
    if (method === "PUT") {
      const body = getBody();
      const idx = products.findIndex(p => p.id === id);
      if (idx !== -1) {
        products[idx] = { ...products[idx], ...body };
        saveDb("products", products);
        logActivity(`Məhsul yeniləndi: ${products[idx].productName}`);
        return jsonResponse(products[idx]);
      }
      return jsonResponse({ message: "Məhsul tapılmadı" }, 404);
    }
    if (method === "DELETE") {
      const idx = products.findIndex(p => p.id === id);
      if (idx !== -1) {
        const deleted = products.splice(idx, 1)[0];
        saveDb("products", products);
        logActivity(`Məhsul silindi: ${deleted.productName}`);
        return jsonResponse({ success: true });
      }
      return jsonResponse({ message: "Məhsul tapılmadı" }, 404);
    }
  }

  // 4. Customers Endpoints
  if (path === "/api/customers") {
    if (method === "GET") {
      return jsonResponse(getDb("customers"));
    }
    if (method === "POST") {
      const body = getBody();
      const customers = getDb("customers");
      const nextId = customers.length > 0 ? Math.max(...customers.map(c => c.id)) + 1 : 1;
      const newCustomer = {
        id: nextId,
        name: body.name,
        phone: body.phone || "",
        email: body.email || "",
        address: body.address || "",
        notes: body.notes || ""
      };
      customers.push(newCustomer);
      saveDb("customers", customers);
      logActivity(`Müştəri əlavə edildi: ${newCustomer.name}`);
      return jsonResponse(newCustomer);
    }
  }

  if (path.startsWith("/api/customers/")) {
    const id = parseInt(path.split("/").pop() || "0");
    const customers = getDb("customers");

    if (method === "PUT") {
      const body = getBody();
      const idx = customers.findIndex(c => c.id === id);
      if (idx !== -1) {
        customers[idx] = { ...customers[idx], ...body };
        saveDb("customers", customers);
        logActivity(`Müştəri yeniləndi: ${customers[idx].name}`);
        return jsonResponse(customers[idx]);
      }
      return jsonResponse({ message: "Müştəri tapılmadı" }, 404);
    }
    if (method === "DELETE") {
      const idx = customers.findIndex(c => c.id === id);
      if (idx !== -1) {
        const deleted = customers.splice(idx, 1)[0];
        saveDb("customers", customers);
        logActivity(`Müştəri silindi: ${deleted.name}`);
        return jsonResponse({ success: true });
      }
      return jsonResponse({ message: "Müştəri tapılmadı" }, 404);
    }
  }

  // 5. Sales Endpoints
  if (path === "/api/sales") {
    if (method === "GET") {
      return jsonResponse(getDb("sales"));
    }
    if (method === "POST") {
      const body = getBody();
      const sales = getDb("sales");
      const nextId = sales.length > 0 ? Math.max(...sales.map(s => s.id)) + 1 : 1;
      
      // Calculate derived variables
      const customers = getDb("customers");
      const clientCust = customers.find(c => c.id === body.customerId);
      const customerName = clientCust ? clientCust.name : "Anonim Müştəri";

      const products = getDb("products");
      const enrichedItems = body.items.map((item: any, index: number) => {
        const p = products.find(prod => prod.id === item.productId);
        const productName = p ? p.productName : "Məhsul";
        return {
          id: index + 1,
          productId: item.productId,
          productName,
          quantity: parseFloat(item.quantity || 0),
          salePrice: parseFloat(item.salePrice || 0),
          purchasePrice: parseFloat(item.purchasePrice || 0)
        };
      });

      const totalAmount = enrichedItems.reduce((acc: number, item: any) => acc + (item.quantity * item.salePrice), 0);
      const totalCost = enrichedItems.reduce((acc: number, item: any) => acc + (item.quantity * item.purchasePrice), 0);

      const newSale = {
        id: nextId,
        saleDate: new Date().toISOString(),
        customerId: body.customerId || null,
        customerName,
        paymentType: body.paymentType,
        paymentStatus: body.paymentType === "credit" ? "unpaid" : "paid",
        totalAmount,
        totalCost,
        notes: body.notes || "",
        creditDueDate: body.creditDueDate || null,
        items: enrichedItems,
        payments: body.paymentType === "credit" ? [] : [{ id: 1, amount: totalAmount, paymentDate: new Date().toISOString(), paymentType: body.paymentType }]
      };

      sales.unshift(newSale);
      saveDb("sales", sales);

      // Stock levels deduction
      const updatedProducts = products.map(prod => {
        const saleItem = enrichedItems.find((item: any) => item.productId === prod.id);
        if (saleItem) {
          return {
            ...prod,
            currentQuantity: Math.max(0, prod.currentQuantity - saleItem.quantity)
          };
        }
        return prod;
      });
      saveDb("products", updatedProducts);

      logActivity(`Yeni satış tamamlandı: #${nextId.toString().padStart(5, "0")} (${totalAmount.toFixed(2)} AZN)`);
      return jsonResponse(newSale);
    }
  }

  if (path.startsWith("/api/sales/")) {
    const id = parseInt(path.split("/").pop() || "0");
    const sales = getDb("sales");

    if (method === "GET") {
      const sale = sales.find(s => s.id === id);
      if (sale) {
        // Find associated returns
        const returns = getDb("returns").filter(r => r.saleId === id);
        return jsonResponse({ ...sale, returns });
      }
      return jsonResponse({ message: "Satış tapılmadı" }, 404);
    }
  }

  // 6. Returns Endpoints
  if (path === "/api/returns") {
    if (method === "GET") {
      return jsonResponse(getDb("returns"));
    }
    if (method === "POST") {
      const body = getBody();
      const returns = getDb("returns");
      const nextId = returns.length > 0 ? Math.max(...returns.map(r => r.id)) + 1 : 1;

      const products = getDb("products");
      const enrichedItems = body.items.map((item: any, index: number) => {
        const p = products.find(prod => prod.id === item.productId);
        const productName = p ? p.productName : "Məhsul";
        return {
          id: index + 1,
          productId: item.productId,
          productName,
          quantity: parseFloat(item.quantity || 0),
          salePrice: parseFloat(item.salePrice || 0),
          purchasePrice: parseFloat(item.purchasePrice || 0),
          status: item.status // returned_to_stock or defective
        };
      });

      const totalRefunded = enrichedItems.reduce((acc: number, item: any) => acc + (item.quantity * item.salePrice), 0);

      const newReturn = {
        id: nextId,
        returnDate: new Date().toISOString(),
        saleId: body.saleId || null,
        totalAmount: totalRefunded,
        reason: body.reason || "Müştəri qaytarışı",
        items: enrichedItems
      };

      returns.unshift(newReturn);
      saveDb("returns", returns);

      // If online / linked to a sale, update the sale details and stock levels
      if (body.saleId) {
        const sales = getDb("sales");
        const saleIdx = sales.findIndex(s => s.id === body.saleId);
        if (saleIdx !== -1) {
          // Change payment status to "partially_refunded" or "refunded"
          sales[saleIdx].paymentStatus = "refunded";
          saveDb("sales", sales);
        }
      }

      // Stock Level restoration if status is returned_to_stock
      const updatedProducts = products.map(prod => {
        const retItem = enrichedItems.find((item: any) => item.productId === prod.id && item.status === "returned_to_stock");
        if (retItem) {
          return {
            ...prod,
            currentQuantity: prod.currentQuantity + retItem.quantity
          };
        }
        return prod;
      });
      saveDb("products", updatedProducts);

      logActivity(`Qaytarış qeydə alındı: #${nextId.toString().padStart(5, "0")} (${totalRefunded.toFixed(2)} AZN)`);
      return jsonResponse(newReturn);
    }
  }

  // 7. Expenses Endpoints
  if (path === "/api/expenses") {
    if (method === "GET") {
      return jsonResponse(getDb("expenses"));
    }
    if (method === "POST") {
      const body = getBody();
      const expenses = getDb("expenses");
      const nextId = expenses.length > 0 ? Math.max(...expenses.map(e => e.id)) + 1 : 1;
      const newExpense = {
        id: nextId,
        amount: parseFloat(body.amount || 0),
        category: body.category || "Digər",
        description: body.description || "",
        date: body.date || new Date().toISOString()
      };
      expenses.push(newExpense);
      saveDb("expenses", expenses);
      logActivity(`Xərc əlavə edildi: ${newExpense.category} (${newExpense.amount.toFixed(2)} AZN)`);
      return jsonResponse(newExpense);
    }
  }

  if (path.startsWith("/api/expenses/")) {
    const id = parseInt(path.split("/").pop() || "0");
    const expenses = getDb("expenses");
    if (method === "DELETE") {
      const idx = expenses.findIndex(e => e.id === id);
      if (idx !== -1) {
        const deleted = expenses.splice(idx, 1)[0];
        saveDb("expenses", expenses);
        logActivity(`Xərc silindi: ${deleted.category}`);
        return jsonResponse({ success: true });
      }
      return jsonResponse({ message: "Xərc tapılmadı" }, 404);
    }
  }

  // 8. Logs Endpoints
  if (path === "/api/logs") {
    return jsonResponse(getDb("logs"));
  }

  // 9. Dashboard Low-Stock & Recent Sales
  if (path === "/api/dashboard/recent-sales") {
    return jsonResponse(getDb("sales").slice(0, 5));
  }

  if (path === "/api/dashboard/low-stock") {
    const products = getDb("products");
    const settings = JSON.parse(sessionStorage.getItem("birsaas_demo_settings") || "{}");
    const threshold = settings.lowStockAlertCount || 5;
    const lowStock = products.filter(p => p.currentQuantity < threshold);
    return jsonResponse(lowStock);
  }

  // 10. Dashboard Summary (Financial aggregation)
  if (path === "/api/dashboard/summary") {
    const sales = getDb("sales");
    const returns = getDb("returns");
    const expenses = getDb("expenses");
    const products = getDb("products");

    const todayStr = new Date().toISOString().split("T")[0];
    const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

    // 1. Today calculations
    const todaySalesList = sales.filter(s => s.saleDate.startsWith(todayStr));
    const rawTodayRevenue = todaySalesList.reduce((sum, s) => sum + s.totalAmount, 0);
    const rawTodayCost = todaySalesList.reduce((sum, s) => sum + s.totalCost, 0);

    const todayReturnsList = returns.filter(r => r.returnDate.startsWith(todayStr));
    const todayRefundedAmount = todayReturnsList.reduce((sum, r) => sum + r.totalAmount, 0);
    const todayRecoveredCost = todayReturnsList.reduce((sum, r) => {
      const itemCost = r.items
        .filter((item: any) => item.status === "returned_to_stock")
        .reduce((s: number, item: any) => s + (item.quantity * item.purchasePrice), 0);
      return sum + itemCost;
    }, 0);

    const todayRevenue = rawTodayRevenue - todayRefundedAmount;
    const todayCost = Math.max(0, rawTodayCost - todayRecoveredCost);
    const todayProfit = todayRevenue - todayCost;
    
    const todayExpenses = expenses
      .filter(e => e.date.startsWith(todayStr))
      .reduce((sum, e) => sum + e.amount, 0);
    const todayNetProfit = todayProfit - todayExpenses;
    const todaySales = todaySalesList.length;

    // 2. Month calculations
    const monthSalesList = sales.filter(s => s.saleDate >= firstDay);
    const rawMonthRevenue = monthSalesList.reduce((sum, s) => sum + s.totalAmount, 0);
    const rawMonthCost = monthSalesList.reduce((sum, s) => sum + s.totalCost, 0);

    const monthReturnsList = returns.filter(r => r.returnDate >= firstDay);
    const monthRefundedAmount = monthReturnsList.reduce((sum, r) => sum + r.totalAmount, 0);
    const monthRecoveredCost = monthReturnsList.reduce((sum, r) => {
      const itemCost = r.items
        .filter((item: any) => item.status === "returned_to_stock")
        .reduce((s: number, item: any) => s + (item.quantity * item.purchasePrice), 0);
      return sum + itemCost;
    }, 0);

    const monthRevenue = rawMonthRevenue - monthRefundedAmount;
    const monthCost = Math.max(0, rawMonthCost - monthRecoveredCost);
    const monthProfit = monthRevenue - monthCost;

    const monthExpenses = expenses
      .filter(e => e.date >= firstDay)
      .reduce((sum, e) => sum + e.amount, 0);
    const monthNetProfit = monthProfit - monthExpenses;

    // 3. Stock valuation
    const totalStockValue = products.reduce((sum, p) => sum + (p.currentQuantity * p.purchasePrice), 0);
    
    const settings = JSON.parse(sessionStorage.getItem("birsaas_demo_settings") || "{}");
    const threshold = settings.lowStockAlertCount || 5;
    const lowStockCount = products.filter(p => p.currentQuantity < threshold).length;

    // 4. Debts calculations
    const creditSales = sales.filter(s => s.paymentStatus === "unpaid");
    const totalCreditDebt = creditSales.reduce((sum, s) => {
      const paid = s.payments ? s.payments.reduce((pSum: number, p: any) => pSum + p.amount, 0) : 0;
      return sum + (s.totalAmount - paid);
    }, 0);

    const overdueCreditsCount = creditSales.filter(s => {
      if (!s.creditDueDate) return false;
      return s.creditDueDate <= todayStr;
    }).length;

    return jsonResponse({
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
      myTotalDebt: 0
    });
  }

  // Default Fallback
  return jsonResponse({ message: "Demo rejimində bu sorğu keçərli deyil" }, 400);
}
