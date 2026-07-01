// BirSaaS Isolated Ephemeral Demo Sandbox Engine
// Operates 100% inside client sessionStorage to provide multi-tab concurrent isolation and zero database pollution.

// 1. Pre-seeded Demo Dataset
const DEFAULT_PRODUCTS = [
  { productId: 1, id: 1, name: "iPhone 15 Pro", productName: "iPhone 15 Pro", barcode: "190198765432", category: "Telefonlar", unit: "ədəd", currentQuantity: 12, salePrice: 2200, purchasePrice: 1800, supplierName: "Apple Azerbaijan", notes: "128GB Black Titanium" },
  { productId: 2, id: 2, name: "MacBook Air M3", productName: "MacBook Air M3", barcode: "190198765449", category: "Kompüterlər", unit: "ədəd", currentQuantity: 8, salePrice: 2400, purchasePrice: 1900, supplierName: "Apple Azerbaijan", notes: "13-inch 8GB/256GB" },
  { productId: 3, id: 3, name: "AirPods Pro 2", productName: "AirPods Pro 2", barcode: "190198765456", category: "Aksesuarlar", unit: "ədəd", currentQuantity: 25, salePrice: 400, purchasePrice: 280, supplierName: "Apple Azerbaijan", notes: "USB-C Case" },
  { productId: 4, id: 4, name: "Samsung Galaxy S24 Ultra", productName: "Samsung Galaxy S24 Ultra", barcode: "880609876543", category: "Telefonlar", unit: "ədəd", currentQuantity: 10, salePrice: 2100, purchasePrice: 1700, supplierName: "Samsung Baku", notes: "512GB Titanium Gray" },
  { productId: 5, id: 5, name: "Xiaomi 14 Pro", productName: "Xiaomi 14 Pro", barcode: "697060987654", category: "Telefonlar", unit: "ədəd", currentQuantity: 15, salePrice: 1450, purchasePrice: 1100, supplierName: "Mi Azerbaijan", notes: "256GB Black" },
  { productId: 6, id: 6, name: "Barkod Oxuyucu Honeywell", productName: "Barkod Oxuyucu Honeywell", barcode: "4006381333931", category: "Avadanlıq", unit: "ədəd", currentQuantity: 40, salePrice: 150, purchasePrice: 80, supplierName: "Honeywell Ltd", notes: "Simsiz 2D Scanner" },
  { productId: 7, id: 7, name: "Termal Printer 80mm", productName: "Termal Printer 80mm", barcode: "4006381333948", category: "Avadanlıq", unit: "ədəd", currentQuantity: 18, salePrice: 220, purchasePrice: 120, supplierName: "Epson Baku", notes: "Qəbz çapı üçün" },
  { productId: 8, id: 8, name: "Samsung Smart Saat 6", productName: "Samsung Smart Saat 6", barcode: "880609876599", category: "Aksesuarlar", unit: "ədəd", currentQuantity: 30, salePrice: 550, purchasePrice: 350, supplierName: "Samsung Baku", notes: "Classic LTE Edition" },
];

const DEFAULT_CUSTOMERS = [
  { id: 1, name: "Abbas Bağırov", phone: "+994 50 200 11 22", email: "abbas@bagirov.az", address: "Bakı, Nərimanov", notes: "Daimi VIP Müştəri", createdByName: "admin", loyaltyPoints: 150 },
  { id: 2, name: "Nərmin Məmmədova", phone: "+994 70 300 44 55", email: "nermin@mammadova.az", address: "Bakı, Gənclik", notes: "Kartla ödəniş edir", createdByName: "admin", loyaltyPoints: 50 },
  { id: 3, name: "Tural Əliyev", phone: "+994 55 400 77 88", email: "tural@aliyev.az", address: "Xırdalan", notes: "Nisyə limiti: 1500 AZN", createdByName: "admin", loyaltyPoints: 0 },
  { id: 4, name: "Samir Qasımov", phone: "+994 50 500 99 00", email: "samir@qasimov.az", address: "Sumqayıt", notes: "Yalnız nağd", createdByName: "admin", loyaltyPoints: 10 },
];

const DEFAULT_VENDORS = [
  { id: 1, name: "Apple Azerbaijan", phone: "+994 50 111 22 33", email: "info@apple.az", address: "Bakı, Port Baku", notes: "Apple rəsmi distribyutoru", totalPurchases: 25000, totalPaid: 25000, balance: 0 },
  { id: 2, name: "Samsung Baku", phone: "+994 55 222 33 44", email: "sales@samsung.az", address: "Bakı, Azadlıq prospekti", notes: "Samsung məhsulları", totalPurchases: 18000, totalPaid: 15000, balance: 3000 },
  { id: 3, name: "Mi Azerbaijan", phone: "+994 70 333 44 55", email: "mi@xiaomi.az", address: "Bakı, 28 May", notes: "Xiaomi smartfonları", totalPurchases: 11000, totalPaid: 11000, balance: 0 },
];

const getPastIsoDate = (daysAgo: number) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
};

const DEFAULT_STOCK_ENTRIES = [
  { id: 1, productId: 1, productName: "iPhone 15 Pro", vendorId: 1, quantity: 10, purchasePrice: 1800, supplier: "Apple Azerbaijan", notes: "İlk partiya", paymentType: "Nəğd", creditDueDate: null, entryDate: getPastIsoDate(5), paidStatus: "paid" },
  { id: 2, productId: 4, productName: "Samsung Galaxy S24 Ultra", vendorId: 2, quantity: 5, purchasePrice: 1700, supplier: "Samsung Baku", notes: "Nisyə alış", paymentType: "Nisyə", creditDueDate: getPastIsoDate(-10), entryDate: getPastIsoDate(3), paidStatus: "credit" }
];

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

const DEFAULT_VENDOR_RETURNS: any[] = [];

const DEFAULT_EXPENSES = [
  { id: 1, amount: 800, category: "İcarə", description: "Mağaza Aylıq İcarə Haqqı", paymentType: "card", date: getPastIsoDate(10) },
  { id: 2, amount: 120, category: "Kommunal", description: "Elektrik enerjisi borcu", paymentType: "cash", date: getPastIsoDate(8) },
  { id: 3, amount: 30, category: "Digər", description: "Fiber İnternet Aylıq abunə", paymentType: "cash", date: getPastIsoDate(7) }
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
  activeBanks: JSON.stringify(["Kapital Bank", "PASHA Bank"]),
  taxStatus: "edv",
  voen: "1234567890",
  loyaltyRuleRate: 0.01,
  loyaltyMinPointsRedeem: 1.0,
};

const DEFAULT_LOGS = [
  { id: 1, username: "admin", action: "Sistemə giriş olundu (Demo sessiya)", timestamp: getPastIsoDate(0) },
  { id: 2, username: "admin", action: "Məhsul yaradıldı: iPhone 15 Pro", timestamp: getPastIsoDate(2) },
  { id: 3, username: "admin", action: "Yeni satış tamamlandı: #00001 (Kartla)", timestamp: getPastIsoDate(2) }
];

const DEFAULT_WAREHOUSES = [
  { id: 1, name: "Əsas Anbar", location: "Mərkəz", isDefault: 1, createdAt: getPastIsoDate(30) },
  { id: 2, name: "Filial Anbar", location: "Nərimanov", isDefault: 0, createdAt: getPastIsoDate(30) }
];

const DEFAULT_STOCK_TRANSFERS: any[] = [];

const DEFAULT_PRODUCT_SERIALS = [
  { id: 1, productId: 1, serialNumber: "IMEI10000000001", status: "in_stock", warehouseId: 1, createdAt: getPastIsoDate(10) },
  { id: 2, productId: 1, serialNumber: "IMEI10000000002", status: "in_stock", warehouseId: 1, createdAt: getPastIsoDate(10) },
  { id: 3, productId: 1, serialNumber: "IMEI10000000003", status: "in_stock", warehouseId: 1, createdAt: getPastIsoDate(10) },
  { id: 4, productId: 1, serialNumber: "IMEI10000000004", status: "in_stock", warehouseId: 1, createdAt: getPastIsoDate(10) },
  { id: 5, productId: 1, serialNumber: "IMEI10000000005", status: "in_stock", warehouseId: 1, createdAt: getPastIsoDate(10) },
  { id: 6, productId: 1, serialNumber: "IMEI10000000006", status: "in_stock", warehouseId: 1, createdAt: getPastIsoDate(10) },
  { id: 7, productId: 1, serialNumber: "IMEI10000000007", status: "in_stock", warehouseId: 1, createdAt: getPastIsoDate(10) },
  { id: 8, productId: 1, serialNumber: "IMEI10000000008", status: "in_stock", warehouseId: 1, createdAt: getPastIsoDate(10) },
  { id: 9, productId: 1, serialNumber: "IMEI10000000009", status: "in_stock", warehouseId: 1, createdAt: getPastIsoDate(10) },
  { id: 10, productId: 1, serialNumber: "IMEI10000000010", status: "in_stock", warehouseId: 1, createdAt: getPastIsoDate(10) },
  { id: 11, productId: 1, serialNumber: "IMEI10000000011", status: "in_stock", warehouseId: 1, createdAt: getPastIsoDate(10) },
  { id: 12, productId: 1, serialNumber: "IMEI10000000012", status: "in_stock", warehouseId: 2, createdAt: getPastIsoDate(10) },
];

const normalizeName = (text: string): string => {
  return text
    .trim()
    .toLowerCase()
    .replace(/ı/g, "i")
    .replace(/ə/g, "e")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g");
};

export function initDemoDatabase() {
  if (sessionStorage.getItem("birsaas_demo_db_initialized") === "true") return;

  const seededProducts = DEFAULT_PRODUCTS.map(p => ({ ...p, warehouseId: 1 }));
  const seededEntries = DEFAULT_STOCK_ENTRIES.map(e => ({ ...e, warehouseId: 1 }));
  const seededSales = DEFAULT_SALES.map(s => ({ ...s, warehouseId: 1 }));

  sessionStorage.setItem("birsaas_demo_products", JSON.stringify(seededProducts));
  sessionStorage.setItem("birsaas_demo_customers", JSON.stringify(DEFAULT_CUSTOMERS));
  sessionStorage.setItem("birsaas_demo_vendors", JSON.stringify(DEFAULT_VENDORS));
  sessionStorage.setItem("birsaas_demo_stock_entries", JSON.stringify(seededEntries));
  sessionStorage.setItem("birsaas_demo_sales", JSON.stringify(seededSales));
  sessionStorage.setItem("birsaas_demo_returns", JSON.stringify(DEFAULT_RETURNS));
  sessionStorage.setItem("birsaas_demo_vendor_returns", JSON.stringify(DEFAULT_VENDOR_RETURNS));
  sessionStorage.setItem("birsaas_demo_expenses", JSON.stringify(DEFAULT_EXPENSES));
  sessionStorage.setItem("birsaas_demo_settings", JSON.stringify(DEFAULT_SETTINGS));
  sessionStorage.setItem("birsaas_demo_logs", JSON.stringify(DEFAULT_LOGS));
  sessionStorage.setItem("birsaas_demo_warehouses", JSON.stringify(DEFAULT_WAREHOUSES));
  sessionStorage.setItem("birsaas_demo_stock_transfers", JSON.stringify(DEFAULT_STOCK_TRANSFERS));
  sessionStorage.setItem("birsaas_demo_product_serials", JSON.stringify(DEFAULT_PRODUCT_SERIALS));
  sessionStorage.setItem("birsaas_demo_safe_transfers", JSON.stringify([]));
  sessionStorage.setItem("birsaas_demo_shifts", JSON.stringify([]));
  sessionStorage.setItem("birsaas_demo_stock_adjustments", JSON.stringify([]));
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

// Helper to calculate warehouse-specific product quantity
const getWarehouseQuantity = (productId: number, warehouseId?: number): number => {
  const entries = getDb("stock_entries").filter((e: any) => e.productId === productId);
  const sales = getDb("sales");
  const returns = getDb("returns");
  const vendorReturns = getDb("vendor_returns");
  const transfers = getDb("stock_transfers").filter((t: any) => t.productId === productId);

  let restocked = entries
    .filter((e: any) => !warehouseId || e.warehouseId === warehouseId)
    .reduce((sum: number, e: any) => sum + e.quantity, 0);

  let sold = 0;
  sales.forEach((s: any) => {
    if (!warehouseId || s.warehouseId === warehouseId) {
      s.items?.forEach((item: any) => {
        if (item.productId === productId) sold += item.quantity;
      });
    }
  });

  let returned = 0;
  returns.forEach((r: any) => {
    if (!warehouseId || r.warehouseId === warehouseId) {
      r.items?.forEach((item: any) => {
        if (item.productId === productId) returned += item.quantity;
      });
    }
  });

  let vendorReturned = 0;
  vendorReturns.forEach((vr: any) => {
    if (!warehouseId || vr.warehouseId === warehouseId) {
      vr.items?.forEach((item: any) => {
        if (item.productId === productId) vendorReturned += item.quantity;
      });
    }
  });

  let transferredOut = 0;
  let transferredIn = 0;
  if (warehouseId) {
    transfers.forEach((t: any) => {
      if (t.fromWarehouseId === warehouseId) transferredOut += t.quantity;
      if (t.toWarehouseId === warehouseId) transferredIn += t.quantity;
    });
  }

  return restocked - sold + returned - vendorReturned - transferredOut + transferredIn;
};

// 2. Mock Fetch Interceptor
export async function mockDemoFetch(url: string | URL, options?: RequestInit): Promise<Response> {
  const urlStr = typeof url === "string" ? url : url.pathname + url.search;
  const method = options?.method?.toUpperCase() || "GET";

  let userRole = "Staff";
  let userUsername = "";

  if (options?.headers) {
    if (options.headers instanceof Headers) {
      userRole = options.headers.get("x-user-role") || "Staff";
      userUsername = options.headers.get("x-user-username") || "";
    } else if (Array.isArray(options.headers)) {
      const r = options.headers.find(([k]) => k.toLowerCase() === "x-user-role");
      const u = options.headers.find(([k]) => k.toLowerCase() === "x-user-username");
      if (r) userRole = r[1];
      if (u) userUsername = u[1];
    } else {
      const headersObj = options.headers as Record<string, string>;
      userRole = headersObj["x-user-role"] || headersObj["X-User-Role"] || "Staff";
      userUsername = headersObj["x-user-username"] || headersObj["X-User-Username"] || "";
    }
  }
  
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
      if (settings && settings.activeBanks === undefined) {
        settings.activeBanks = JSON.stringify(["Kapital Bank", "PASHA Bank"]);
        sessionStorage.setItem("birsaas_demo_settings", JSON.stringify(settings));
      }
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

  // 1b. Warehouses CRUD Endpoints
  if (path === "/api/warehouses") {
    const warehouses = getDb("warehouses");
    if (method === "GET") {
      return jsonResponse(warehouses);
    }
    if (method === "POST") {
      const body = getBody();
      if (!body.name) {
        return jsonResponse({ message: "Anbar adı mütləqdir" }, 400);
      }
      if (body.isDefault === 1) {
        warehouses.forEach((w: any) => w.isDefault = 0);
      }
      const newWarehouse = {
        id: warehouses.length > 0 ? Math.max(...warehouses.map((w: any) => w.id)) + 1 : 1,
        name: body.name,
        location: body.location || null,
        isDefault: body.isDefault || 0,
        createdAt: new Date().toISOString()
      };
      warehouses.push(newWarehouse);
      saveDb("warehouses", warehouses);
      logActivity(`Anbar yaradıldı: ${body.name}`);
      return jsonResponse(newWarehouse);
    }
  }

  if (path.startsWith("/api/warehouses/")) {
    const id = parseInt(path.split("/").pop() || "0");
    const warehouses = getDb("warehouses");
    const idx = warehouses.findIndex((w: any) => w.id === id);
    if (idx === -1) {
      return jsonResponse({ message: "Anbar tapılmadı" }, 404);
    }

    if (method === "PUT") {
      const body = getBody();
      if (body.isDefault === 1) {
        warehouses.forEach((w: any) => w.isDefault = 0);
      }
      warehouses[idx] = {
        ...warehouses[idx],
        name: body.name !== undefined ? body.name : warehouses[idx].name,
        location: body.location !== undefined ? body.location : warehouses[idx].location,
        isDefault: body.isDefault !== undefined ? body.isDefault : warehouses[idx].isDefault
      };
      saveDb("warehouses", warehouses);
      logActivity(`Anbar yeniləndi: ${warehouses[idx].name}`);
      return jsonResponse(warehouses[idx]);
    }

    if (method === "DELETE") {
      const warehouse = warehouses[idx];
      if (warehouse.isDefault === 1) {
        return jsonResponse({ message: "Default anbar silinə bilməz. Əvvəlcə başqa anbarı default edin." }, 400);
      }

      const stockEntries = getDb("stock_entries");
      const sales = getDb("sales");
      const returns = getDb("returns");
      const vendorReturns = getDb("vendor_returns");
      const serials = getDb("product_serials");

      const hasEntries = stockEntries.some((e: any) => e.warehouseId === id);
      const hasSales = sales.some((s: any) => s.warehouseId === id);
      const hasReturns = returns.some((r: any) => r.warehouseId === id);
      const hasVendorReturns = vendorReturns.some((vr: any) => vr.warehouseId === id);
      const hasSerials = serials.some((s: any) => s.warehouseId === id && s.status === "in_stock");

      if (hasEntries || hasSales || hasReturns || hasVendorReturns || hasSerials) {
        return jsonResponse({ message: "Bu anbarda aktiv məlumatlar mövcuddur, silmək olmaz." }, 400);
      }

      warehouses.splice(idx, 1);
      saveDb("warehouses", warehouses);
      logActivity(`Anbar silindi: ${warehouse.name}`);
      return jsonResponse({ success: true, message: "Anbar uğurla silindi" });
    }
  }

  // 1c. Transfers Endpoints
  if (path === "/api/stock/transfers") {
    if (method === "GET") {
      const transfers = getDb("stock_transfers");
      const products = getDb("products");
      const warehouses = getDb("warehouses");

      const enriched = transfers.map((t: any) => {
        const prod = products.find((p: any) => p.id === t.productId);
        const fromW = warehouses.find((w: any) => w.id === t.fromWarehouseId);
        const toW = warehouses.find((w: any) => w.id === t.toWarehouseId);
        return {
          ...t,
          productName: prod ? prod.name : `Product ID: ${t.productId}`,
          fromWarehouseName: fromW ? fromW.name : `Anbar ID: ${t.fromWarehouseId}`,
          toWarehouseName: toW ? toW.name : `Anbar ID: ${t.toWarehouseId}`,
        };
      });
      return jsonResponse(enriched);
    }

    if (method === "POST") {
      const body = getBody();
      const { fromWarehouseId, toWarehouseId, productId, quantity, notes, serialNumbers } = body;
      if (!fromWarehouseId || !toWarehouseId || !productId || !quantity) {
        return jsonResponse({ message: "Məlumatlar tam doldurulmayıb" }, 400);
      }
      if (fromWarehouseId === toWarehouseId) {
        return jsonResponse({ message: "Eyni anbardan eyni anbara yerdəyişmə edilə bilməz" }, 400);
      }

      const products = getDb("products");
      const product = products.find((p: any) => p.id === productId);
      if (!product) {
        return jsonResponse({ message: "Məhsul tapılmadı" }, 404);
      }

      const currentQty = getWarehouseQuantity(productId, fromWarehouseId);
      if (currentQty < quantity) {
        return jsonResponse({ message: `Göndərən anbarda kifayət qədər məhsul yoxdur (Mövcuddur: ${currentQty})` }, 400);
      }

      let serialsList: string[] = [];
      if (product.trackingType === "serial" || product.trackingType === "serialized") {
        if (!serialNumbers || !Array.isArray(serialNumbers) || serialNumbers.length !== quantity) {
          return jsonResponse({ message: `Serial nömrələri düzgün təqdim edilməyib. ${quantity} ədəd serial lazımdır.` }, 400);
        }
        serialsList = serialNumbers;

        const serials = getDb("product_serials");
        const matchingSerials = serials.filter(
          (s: any) => s.productId === productId && s.warehouseId === fromWarehouseId && s.status === "in_stock"
        );
        const matchingSerialsSet = new Set(matchingSerials.map((s: any) => s.serialNumber));
        const invalidSerials = serialsList.filter(s => !matchingSerialsSet.has(s));
        if (invalidSerials.length > 0) {
          return jsonResponse({ message: `Konkret seriallar göndərən anbarda tapılmadı və ya stokda deyil: ${invalidSerials.join(", ")}` }, 400);
        }

        serials.forEach((s: any) => {
          if (s.productId === productId && serialsList.includes(s.serialNumber)) {
            s.warehouseId = toWarehouseId;
          }
        });
        saveDb("product_serials", serials);
      }

      const transfers = getDb("stock_transfers");
      const newTransfer = {
        id: transfers.length > 0 ? Math.max(...transfers.map((t: any) => t.id)) + 1 : 1,
        fromWarehouseId,
        toWarehouseId,
        productId,
        quantity,
        transferDate: new Date().toISOString(),
        transferredBy: userUsername || "demo_admin",
        notes: notes || null,
        serialNumbers: serialsList.length > 0 ? JSON.stringify(serialsList) : null,
      };
      transfers.push(newTransfer);
      saveDb("stock_transfers", transfers);

      logActivity(`${quantity} ədəd '${product.name}' yerdəyişmə edildi (Anbar: ${fromWarehouseId} -> ${toWarehouseId})`);
      return jsonResponse(newTransfer);
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
      const rawProducts = getDb("products");
      const sales = getDb("sales") || [];
      const returns = getDb("returns") || [];

      // Determine product history
      const soldProductIds = new Set<number>();
      sales.forEach((s: any) => {
        (s.items || []).forEach((item: any) => {
          if (item.productId) soldProductIds.add(item.productId);
        });
      });

      const returnedProductIds = new Set<number>();
      returns.forEach((r: any) => {
        (r.items || []).forEach((item: any) => {
          if (item.productId) returnedProductIds.add(item.productId);
        });
      });

      const mapped = rawProducts.map(p => ({
        ...p,
        name: p.name || p.productName || "",
        productName: p.productName || p.name || "",
        isArchived: p.isArchived !== undefined ? p.isArchived : 0,
        hasHistory: soldProductIds.has(p.id) || returnedProductIds.has(p.id)
      }));
      return jsonResponse(mapped);
    }
    if (method === "POST") {
      const body = getBody();
      const products = getDb("products");
      const nameVal = body.name || body.productName || "";

      // Validate product name uniqueness and keyword collision (case-insensitive, normalized, active only)
      const normalizedNewName = normalizeName(nameVal);
      for (const p of products) {
        if (p.isArchived === 1) continue; // Skip archived products
        const existingNameNormalized = normalizeName(p.name || p.productName || "");
        const existingKeywords = (p.description || p.notes || "").split(/[,;]+/).map((k: string) => normalizeName(k)).filter(Boolean);

        if (existingNameNormalized === normalizedNewName) {
          return jsonResponse({ message: `Bu adda məhsul artıq kataloqda mövcuddur: '${p.productName || p.name}'. Təkrarlanmanın qarşısını almaq üçün mövcud məhsulu istifadə edin.` }, 400);
        }

        if (existingKeywords.includes(normalizedNewName)) {
          return jsonResponse({ message: `Bu məhsul artıq mövcuddur (Açar sözlər ilə eşləşdi: '${p.productName || p.name}').` }, 400);
        }
      }

      const nextId = products.length > 0 ? Math.max(...products.map(p => p.id)) + 1 : 1;
      const trackingType = body.trackingType || "none";
      const serialNumber = body.serialNumber ? body.serialNumber.trim().toUpperCase() : null;
      const warrantyMonths = body.warrantyMonths ? parseInt(String(body.warrantyMonths)) : null;

      // Auto-initialize serial list and quantity if an initial serial number is provided
      const activeSerials = (trackingType === "serialized" && serialNumber) ? [serialNumber] : [];
      const currentQuantity = activeSerials.length > 0 ? 1 : parseFloat(body.currentQuantity || 0);

      const newProduct = {
        id: nextId,
        productId: nextId,
        name: nameVal,
        productName: nameVal,
        barcode: body.barcode || "",
        category: body.category || "",
        unit: body.unit || "ədəd",
        description: body.description || "",
        trackingType: trackingType,
        activeSerials: activeSerials,
        currentQuantity: currentQuantity,
        warrantyMonths: warrantyMonths,
        salePrice: parseFloat(body.salePrice || 0),
        purchasePrice: parseFloat(body.purchasePrice || 0),
        supplierName: body.supplierName || "",
        notes: body.description || body.notes || "",
        isArchived: 0,
        vendorId: body.vendorId ? parseInt(String(body.vendorId)) : null
      };
      products.push(newProduct);
      saveDb("products", products);
      logActivity(`Məhsul yaradıldı: ${newProduct.productName}${serialNumber ? ` (İlkin S/N: ${serialNumber})` : ""}`);
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
        const resolvedName = body.name || body.productName || products[idx].productName || products[idx].name || "";
        const resolvedDescription = body.description !== undefined ? body.description : (products[idx].description || products[idx].notes || "");

        const normalizedNewName = normalizeName(resolvedName);

        for (let i = 0; i < products.length; i++) {
          if (products[i].id === id) continue;
          if (products[i].isArchived === 1) continue; // Skip archived products
          
          const p = products[i];
          const existingNameNormalized = normalizeName(p.name || p.productName || "");
          const existingKeywords = (p.description || p.notes || "").split(/[,;]+/).map((k: string) => normalizeName(k)).filter(Boolean);

          if (existingNameNormalized === normalizedNewName) {
            return jsonResponse({ message: `Bu adda məhsul artıq kataloqda mövcuddur: '${p.productName || p.name}'. Fərqli bir ad seçin.` }, 400);
          }

          if (existingKeywords.includes(normalizedNewName)) {
            return jsonResponse({ message: `Bu məhsul artıq mövcuddur (Açar sözlər ilə eşləşdi: '${p.productName || p.name}').` }, 400);
          }
        }

        const nameVal = resolvedName;
        const oldArchived = products[idx].isArchived !== undefined ? products[idx].isArchived : 0;
        const newArchived = body.isArchived !== undefined ? parseInt(String(body.isArchived)) : oldArchived;

        products[idx] = { 
          ...products[idx], 
          ...body,
          name: nameVal,
          productName: nameVal,
          description: resolvedDescription,
          notes: resolvedDescription,
          isArchived: newArchived
        };
        saveDb("products", products);

        if (newArchived !== oldArchived) {
          if (newArchived === 1) {
            logActivity(`Məhsul arxivləşdirildi: ${products[idx].productName}`);
          } else {
            logActivity(`Məhsul arxivdən bərpa edildi: ${products[idx].productName}`);
          }
        } else {
          logActivity(`Məhsul yeniləndi: ${products[idx].productName}`);
        }

        return jsonResponse(products[idx]);
      }
      return jsonResponse({ message: "Məhsul tapılmadı" }, 404);
    }
    if (method === "DELETE") {
      const idx = products.findIndex(p => p.id === id);
      if (idx !== -1) {
        // Check history
        const sales = getDb("sales") || [];
        const returns = getDb("returns") || [];
        const hasHistory = sales.some((s: any) => (s.items || []).some((item: any) => item.productId === id)) ||
                           returns.some((r: any) => (r.items || []).some((item: any) => item.productId === id));
        if (hasHistory) {
          return jsonResponse({
            message: "Bu məhsulu silmək mümkün deyil, çünki onunla bağlı keçmiş satış, qaytarış və ya mədaxil əməliyyatları mövcuddur. Tarixçənin qorunması üçün onu arxivləşdirə bilərsiniz."
          }, 400);
        }

        const deleted = products.splice(idx, 1)[0];
        saveDb("products", products);
        logActivity(`Məhsul silindi: ${deleted.productName || deleted.name}`);
        return jsonResponse({ success: true });
      }
      return jsonResponse({ message: "Məhsul tapılmadı" }, 404);
    }
  }

  // 4. Customers Endpoints
  if (path === "/api/customers") {
    if (method === "GET") {
      const customers = getDb("customers");
      if (userRole !== "Admin") {
        const normalized = userUsername ? userUsername.trim().toLowerCase() : "";
        return jsonResponse(customers.filter(c => (c.createdByName || "").trim().toLowerCase() === normalized));
      }
      return jsonResponse(customers);
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
        notes: body.notes || "",
        createdByName: userUsername ? userUsername.trim().toLowerCase() : (userRole === "Admin" ? "admin" : "satici")
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
        if (userRole !== "Admin") {
          const normalized = userUsername ? userUsername.trim().toLowerCase() : "";
          if ((customers[idx].createdByName || "").trim().toLowerCase() !== normalized) {
            return jsonResponse({ message: "Bu müştəri profilini yeniləmək üçün səlahiyyətiniz yoxdur" }, 403);
          }
        }
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

  if (path === "/api/sales") {
    if (method === "GET") {
      const rawSales = getDb("sales") || [];
      const serials = getDb("product_serials") || [];
      const returns = getDb("returns") || [];
      const mapped = rawSales.map(s => {
        const saleReturns = returns.filter((r: any) => r.saleId === s.id);
        return {
          ...s,
          serials: serials.filter((ser: any) => ser.saleId === s.id),
          returns: saleReturns
        };
      });
      if (userRole !== "Admin") {
        const normalized = userUsername ? userUsername.trim().toLowerCase() : "";
        return jsonResponse(mapped.filter(s => (s.sellerName || "").trim().toLowerCase() === normalized));
      }
      return jsonResponse(mapped);
    }
    if (method === "POST") {
      const body = getBody();
      const sales = getDb("sales");
      const nextId = sales.length > 0 ? Math.max(...sales.map(s => s.id)) + 1 : 1;
      const warehouseId = body.warehouseId ? parseInt(body.warehouseId) : 1;
      
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

      const loyaltyDiscount = body.loyaltyDiscountPaid ? parseFloat(body.loyaltyDiscountPaid) : 0;
      const finalPaidAmount = Math.max(0, totalAmount - loyaltyDiscount);
      
      const newSale = {
        id: nextId,
        saleDate: new Date().toISOString(),
        customerId: body.customerId || null,
        customerName,
        paymentType: body.paymentType,
        bankName: body.paymentType === "Kart" ? (body.bankName || null) : null,
        paymentStatus: body.paymentType === "credit" ? "unpaid" : "paid",
        totalAmount,
        totalCost,
        notes: body.notes || "",
        creditDueDate: body.creditDueDate || null,
        items: enrichedItems,
        payments: body.paymentType === "credit" ? [] : [{ id: 1, amount: finalPaidAmount, paymentDate: new Date().toISOString(), paymentType: body.paymentType }],
        sellerName: userUsername ? userUsername.trim().toLowerCase() : (userRole === "Admin" ? "admin" : "satici"),
        applyEdv: body.applyEdv !== undefined && body.applyEdv !== null ? (body.applyEdv ? 1 : 0) : 1,
        warehouseId,
        shiftId: body.shiftId || null,
        loyaltyDiscountPaid: loyaltyDiscount,
      };

      sales.unshift(newSale);
      saveDb("sales", sales);

      // Loyalty points update
      if (body.customerId) {
        const settings = JSON.parse(sessionStorage.getItem("birsaas_demo_settings") || "{}");
        const rate = settings.loyaltyRuleRate !== undefined ? settings.loyaltyRuleRate : 0.01;
        const pointsEarned = totalAmount * rate;
        const dbCusts = getDb("customers");
        const cIdx = dbCusts.findIndex((c: any) => c.id === body.customerId);
        if (cIdx !== -1) {
          dbCusts[cIdx].loyaltyPoints = Math.max(0, (dbCusts[cIdx].loyaltyPoints || 0) + pointsEarned - loyaltyDiscount);
          saveDb("customers", dbCusts);
        }
      }

      // Link and update serials to sold
      const serials = getDb("product_serials");
      body.items.forEach((item: any) => {
        if (item.serialNumbers && Array.isArray(item.serialNumbers) && item.serialNumbers.length > 0) {
          item.serialNumbers.forEach((sNum: string) => {
            const cleaned = sNum.trim().toUpperCase();
            const serialObj = serials.find((s: any) => s.productId === item.productId && s.serialNumber === cleaned && s.status === "in_stock" && s.warehouseId === warehouseId);
            if (serialObj) {
              serialObj.status = "sold";
              serialObj.saleId = nextId;
              serialObj.soldAt = new Date().toISOString();
            }
          });
        }
      });
      saveDb("product_serials", serials);

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

  if (path === "/api/sales/fix-past-credits") {
    if (method === "POST") {
      const sales = getDb("sales");
      let fixCount = 0;
      for (let i = 0; i < sales.length; i++) {
        const sale = sales[i];
        if (sale.paymentStatus === "credit") {
          const payments = sale.payments || [];
          const totalPaid = payments.reduce((acc: number, p: any) => acc + p.amount, 0);
          const returns = getDb("returns").filter((r: any) => r.saleId === sale.id);
          const returned = returns.reduce((acc: number, r: any) => acc + r.totalAmount, 0);
          
          const totalPaidCents = Math.round(totalPaid * 100);
          const remainingDebtCents = Math.round((sale.totalAmount - returned) * 100);
          
          if (totalPaidCents >= remainingDebtCents) {
            sales[i].paymentStatus = "paid";
            fixCount++;
          }
        }
      }
      if (fixCount > 0) {
        saveDb("sales", sales);
        logActivity(`Verilənlər bazasında tam ödənilmiş ${fixCount} nisyə satışın statusu 'Ödənilib' olaraq yeniləndi.`);
      }
      return jsonResponse({
        message: `${fixCount} nisyə satışın statusu uğurla 'Ödənilib' olaraq düzəldildi.`,
        fixedCount: fixCount
      });
    }
  }

  if (path.startsWith("/api/sales/")) {
    const parts = path.split("/");
    const id = parseInt(parts[3] || "0");
    const subRoute = parts[4] || "";
    const sales = getDb("sales");

    if (method === "GET" && !subRoute) {
      const sale = sales.find(s => s.id === id);
      if (sale) {
        if (userRole !== "Admin") {
          const normalized = userUsername ? userUsername.trim().toLowerCase() : "";
          if ((sale.sellerName || "").trim().toLowerCase() !== normalized) {
            return jsonResponse({ message: "Bu satış məlumatına baxmaq üçün səlahiyyətiniz yoxdur" }, 403);
          }
        }
        // Find associated returns
        const returns = getDb("returns").filter(r => r.saleId === id);
        return jsonResponse({ ...sale, returns });
      }
      return jsonResponse({ message: "Satış tapılmadı" }, 404);
    }

    if (method === "PATCH" && subRoute === "pay-credit") {
      const saleIdx = sales.findIndex(s => s.id === id);
      if (saleIdx === -1) return jsonResponse({ message: "Satış tapılmadı" }, 404);

      const sale = sales[saleIdx];
      const payments = sale.payments || [];
      const alreadyPaid = payments.reduce((acc: number, p: any) => acc + p.amount, 0);

      const returns = getDb("returns").filter(r => r.saleId === id);
      const returned = returns.reduce((acc: number, r: any) => acc + r.totalAmount, 0);

      const remaining = Math.max(0, sale.totalAmount - alreadyPaid - returned);

      if (remaining > 0) {
        const nextPayId = payments.length > 0 ? Math.max(...payments.map((p: any) => p.id)) + 1 : 1;
        const body = getBody();
        const payType = body?.paymentType || "Nəğd";
        payments.push({
          id: nextPayId,
          amount: remaining,
          paymentDate: new Date().toISOString(),
          paymentType: payType
        });
      }

      sales[saleIdx].paymentStatus = "paid";
      sales[saleIdx].payments = payments;
      saveDb("sales", sales);

      logActivity(`Müştəri nisyə borcunun hamısı toplandı: ${remaining.toFixed(2)} AZN (Çek № ${id})`);
      return jsonResponse({ message: "Nisyə borc tam olaraq ödənildi" });
    }

    if (method === "PATCH" && subRoute === "add-payment") {
      const saleIdx = sales.findIndex(s => s.id === id);
      if (saleIdx === -1) return jsonResponse({ message: "Satış tapılmadı" }, 404);

      const body = getBody();
      const paymentAmount = parseFloat(body.amount);
      if (!paymentAmount || paymentAmount <= 0) {
        return jsonResponse({ message: "Düzgün ödəniş məbləği daxil edilməlidir" }, 400);
      }

      const sale = sales[saleIdx];
      const payments = sale.payments || [];
      const nextPayId = payments.length > 0 ? Math.max(...payments.map((p: any) => p.id)) + 1 : 1;

      payments.push({
        id: nextPayId,
        amount: paymentAmount,
        paymentDate: new Date().toISOString(),
        paymentType: body?.paymentType || "Nəğd"
      });

      const totalPaid = payments.reduce((acc: number, p: any) => acc + p.amount, 0);
      const returns = getDb("returns").filter(r => r.saleId === id);
      const returned = returns.reduce((acc: number, r: any) => acc + r.totalAmount, 0);

      if (totalPaid >= (sale.totalAmount - returned)) {
        sales[saleIdx].paymentStatus = "paid";
      }

      sales[saleIdx].payments = payments;
      saveDb("sales", sales);

      logActivity(`Müştəri nisyə borcundan qismən ödəniş alındı: ${paymentAmount.toFixed(2)} AZN (Çek № ${id})`);
      return jsonResponse({ message: "Qismən ödəniş qeydə alındı" });
    }
  }

  // Delete payment in demo sandbox
  if (path.startsWith("/api/sales/payments/")) {
    const paymentId = parseInt(path.split("/").pop() || "0");
    if (method === "DELETE") {
      const sales = getDb("sales");
      let found = false;

      for (let i = 0; i < sales.length; i++) {
        const sale = sales[i];
        const payments = sale.payments || [];
        const payIdx = payments.findIndex((p: any) => p.id === paymentId);
        if (payIdx !== -1) {
          const removed = payments.splice(payIdx, 1)[0];
          sale.payments = payments;

          const totalPaid = payments.reduce((acc: number, p: any) => acc + p.amount, 0);
          const returns = getDb("returns").filter(r => r.saleId === sale.id);
          const returned = returns.reduce((acc: number, r: any) => acc + r.totalAmount, 0);

          if (totalPaid < (sale.totalAmount - returned)) {
            sale.paymentStatus = "unpaid";
          }

          sales[i] = sale;
          saveDb("sales", sales);
          found = true;
          logActivity(`Müştəri borc ödənişi ləğv edildi: ${removed.amount.toFixed(2)} AZN (Ödəniş ID: ${paymentId})`);
          break;
        }
      }

      if (found) {
        return jsonResponse({ message: "Ödəniş ləğv edildi" });
      }
      return jsonResponse({ message: "Ödəniş tapılmadı" }, 404);
    }
  }

  // 6. Returns Endpoints
  if (path === "/api/returns") {
    if (method === "GET") {
      return jsonResponse(getDb("returns"));
    }
    if (method === "POST") {
      const body = getBody();
      if (userRole !== "Admin") {
        if (!body.adminPassword) {
          return jsonResponse({ message: "Bu əməliyyat üçün Admin şifrəsi tələb olunur." }, 401);
        }
        const users = getDb("users") || [];
        const adminUser = users.find((u: any) => u.role === "Admin" && u.password === body.adminPassword.trim());
        if (!adminUser) {
          return jsonResponse({ message: "Daxil etdiyiniz Admin şifrəsi yanlışdır." }, 401);
        }
      }
      const returns = getDb("returns");
      const nextId = returns.length > 0 ? Math.max(...returns.map(r => r.id)) + 1 : 1;
      
      let warehouseId = body.warehouseId ? parseInt(body.warehouseId) : 1;
      if (!body.warehouseId && body.saleId) {
        const sales = getDb("sales");
        const sale = sales.find(s => s.id === body.saleId);
        if (sale && sale.warehouseId) warehouseId = sale.warehouseId;
      }

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
        items: enrichedItems,
        warehouseId,
      };

      returns.unshift(newReturn);
      saveDb("returns", returns);

      // Link and update returned serials to in_stock
      const serials = getDb("product_serials");
      body.items.forEach((item: any) => {
        if (item.serialNumbers && Array.isArray(item.serialNumbers) && item.serialNumbers.length > 0) {
          item.serialNumbers.forEach((sNum: string) => {
            const cleaned = sNum.trim().toUpperCase();
            const serialObj = serials.find((s: any) => s.productId === item.productId && s.serialNumber === cleaned);
            if (serialObj) {
              serialObj.status = item.status === "returned_to_stock" ? "in_stock" : "defective";
              serialObj.returnId = nextId;
              serialObj.warehouseId = warehouseId;
            }
          });
        }
      });
      saveDb("product_serials", serials);

      // If online / linked to a sale, update the sale details and stock levels
      if (body.saleId) {
        const sales = getDb("sales");
        const saleIdx = sales.findIndex(s => s.id === body.saleId);
        if (saleIdx !== -1) {
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

  // 6b. Vendor Returns Endpoints (Tədarükçüyə Qaytarışlar Mock)
  if (path === "/api/vendor-returns") {
    if (method === "GET") {
      const returns = getDb("vendor_returns");
      const vendors = getDb("vendors");
      const products = getDb("products");
      
      const list = returns.map((r: any) => {
        const v = vendors.find((vend: any) => vend.id === r.vendorId);
        const enrichedItems = r.items.map((item: any) => {
          const p = products.find((prod: any) => prod.id === item.productId);
          return {
            ...item,
            product: p || null
          };
        });
        return {
          ...r,
          vendor: v || null,
          items: enrichedItems
        };
      });
      return jsonResponse(list);
    }
    if (method === "POST") {
      const body = getBody();
      const returns = getDb("vendor_returns");
      const nextId = returns.length > 0 ? Math.max(...returns.map(r => r.id)) + 1 : 1;
      const warehouseId = body.warehouseId ? parseInt(body.warehouseId) : 1;

      const products = getDb("products");
      const enrichedItems = body.items.map((item: any, index: number) => {
        const p = products.find(prod => prod.id === item.productId);
        const productName = p ? (p.productName || p.name) : "Məhsul";
        return {
          id: index + 1,
          productId: item.productId,
          productName,
          quantity: parseFloat(item.quantity || 0),
          purchasePrice: parseFloat(item.purchasePrice || 0),
          notes: item.notes || null,
          stockEntryId: item.stockEntryId || null
        };
      });

      const totalReturnAmount = enrichedItems.reduce((acc: number, item: any) => acc + (item.quantity * item.purchasePrice), 0);

      const newReturn = {
        id: nextId,
        returnDate: new Date().toISOString(),
        vendorId: parseInt(body.vendorId),
        totalAmount: totalReturnAmount,
        paymentType: body.paymentType,
        notes: body.notes || null,
        items: enrichedItems,
        warehouseId,
      };

      returns.unshift(newReturn);
      saveDb("vendor_returns", returns);

      // Link and update returned serials to written_off
      const serials = getDb("product_serials");
      body.items.forEach((item: any) => {
        if (item.serialNumbers && Array.isArray(item.serialNumbers) && item.serialNumbers.length > 0) {
          item.serialNumbers.forEach((sNum: string) => {
            const cleaned = sNum.trim().toUpperCase();
            const serialObj = serials.find((s: any) => s.productId === item.productId && s.serialNumber === cleaned && s.status === "in_stock" && s.warehouseId === warehouseId);
            if (serialObj) {
              serialObj.status = "written_off";
            }
          });
        }
      });
      saveDb("product_serials", serials);

      // Decrease product quantities
      const updatedProducts = products.map(prod => {
        const retItem = enrichedItems.find((item: any) => item.productId === prod.id);
        if (retItem) {
          return {
            ...prod,
            currentQuantity: Math.max(0, (prod.currentQuantity || 0) - retItem.quantity)
          };
        }
        return prod;
      });
      saveDb("products", updatedProducts);

      // Adjust vendor balance if "Borcdan Silinmə" is chosen
      if (body.paymentType === "Borcdan Silinmə") {
        const vendors = getDb("vendors");
        const vIdx = vendors.findIndex(v => v.id === parseInt(body.vendorId));
        if (vIdx !== -1) {
          vendors[vIdx].balance = Math.max(0, (vendors[vIdx].balance || 0) - totalReturnAmount);
          saveDb("vendors", vendors);
        }
      }

      const vendors = getDb("vendors");
      const vendorName = vendors.find(v => v.id === parseInt(body.vendorId))?.name || `ID: ${body.vendorId}`;
      logActivity(`Tədarükçüyə qaytarış qeydə alındı: #${nextId.toString().padStart(5, "0")} (${vendorName}, ${totalReturnAmount.toFixed(2)} AZN, Üsul: ${body.paymentType})`);
      
      return jsonResponse(newReturn);
    }
  }

  if (path.startsWith("/api/vendor-returns/")) {
    const id = parseInt(path.split("/").pop() || "0");
    const returns = getDb("vendor_returns");
    const ret = returns.find(r => r.id === id);
    if (ret) {
      const vendors = getDb("vendors");
      const products = getDb("products");
      const v = vendors.find((vend: any) => vend.id === ret.vendorId);
      const enrichedItems = ret.items.map((item: any) => {
        const p = products.find((prod: any) => prod.id === item.productId);
        return {
          ...item,
          product: p || null
        };
      });
      return jsonResponse({
        ...ret,
        vendor: v || null,
        items: enrichedItems
      });
    }
    return jsonResponse({ message: "Qaytarış tapılmadı" }, 404);
  }

  // 7. Expenses Endpoints
  if (path === "/api/expenses") {
    if (method === "GET") {
      const expenses = getDb("expenses");
      const sanitized = expenses.map(e => ({
        ...e,
        paymentType: e.paymentType || "cash"
      }));
      return jsonResponse(sanitized);
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
        paymentType: body.paymentType || "cash",
        date: body.date || new Date().toISOString()
      };
      expenses.push(newExpense);
      saveDb("expenses", expenses);
      logActivity(`Xərc əlavə edildi: ${newExpense.category} (${newExpense.amount.toFixed(2)} AZN, Ödəniş: ${newExpense.paymentType})`);
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

  // Safe Transfers List
  if (path === "/api/safe-transfers" && method === "GET") {
    const safeTransfers = getDb("safe_transfers");
    const sorted = [...safeTransfers].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return jsonResponse(sorted);
  }

  // Create Safe Transfer
  if (path === "/api/safe-transfers" && method === "POST") {
    const bodyObj = getBody();
    const { amount, type, description } = bodyObj || {};
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      return jsonResponse({ message: "Düzgün məbləğ daxil edin" }, 400);
    }
    const safeTransfers = getDb("safe_transfers");
    const nextId = safeTransfers.length > 0 ? Math.max(...safeTransfers.map(t => t.id)) + 1 : 1;
    
    const userStr = localStorage.getItem("qazanpos_user");
    let currentUsername = "system";
    if (userStr) {
      try {
        const u = JSON.parse(userStr);
        currentUsername = u.username || "system";
      } catch (e) {}
    }

    const newTx = {
      id: nextId,
      amount: amt,
      type,
      description: description || null,
      date: new Date().toISOString(),
      username: currentUsername,
    };
    safeTransfers.push(newTx);
    saveDb("safe_transfers", safeTransfers);

    let actionDesc = "";
    if (type === "kassa_to_safe") actionDesc = "Kassadan Seyfə köçürmə";
    if (type === "safe_deposit") actionDesc = "Seyfə mədaxil";
    if (type === "safe_withdrawal") actionDesc = "Seyfdən məxaric";

    const logs = getDb("logs");
    const nextLogId = logs.length > 0 ? Math.max(...logs.map(l => l.id)) + 1 : 1;
    logs.push({
      id: nextLogId,
      username: currentUsername,
      action: "Maliyyə Əməliyyatı",
      description: `${actionDesc}: ${amt.toFixed(2)} AZN qeydə alındı`,
      timestamp: new Date().toISOString(),
      archived: 0
    });
    saveDb("logs", logs);

    return jsonResponse(newTx);
  }

  // Calculate Balances
  if (path === "/api/dashboard/balances" && method === "GET") {
    const sales = getDb("sales");
    const returns = getDb("returns");
    const expenses = getDb("expenses");
    const stockEntries = getDb("stock_entries");
    const safeTransfers = getDb("safe_transfers");

    let kassa = 0;
    let safe = 0;
    let bank = 0;
    let debt = 0;
    let investorDebt = 0;

    for (const sale of sales) {
      const total = sale.totalAmount || 0;
      if (sale.payments && sale.payments.length > 0) {
        for (const p of sale.payments) {
          if (p.paymentType === "Nəğd") {
            kassa += p.amount;
          } else if (["Kart", "Kart2Kart", "Köçürmə"].includes(p.paymentType)) {
            bank += p.amount;
          }
        }
      } else {
        const paid = sale.paidAmount !== undefined ? sale.paidAmount : total;
        if (sale.paymentType === "Nəğd") {
          kassa += paid;
        } else if (["Kart", "Kart2Kart", "Köçürmə"].includes(sale.paymentType)) {
          bank += paid;
        } else if (sale.paymentType === "Nisyə") {
          kassa += paid;
        }
      }

      if (sale.paymentStatus === "credit" || sale.paymentType === "Nisyə") {
        const paid = sale.payments ? sale.payments.reduce((acc: number, p: any) => acc + p.amount, 0) : (sale.paidAmount || 0);
        debt += Math.max(0, total - paid);
      }
    }

    for (const ret of returns) {
      kassa -= ret.totalAmount;
    }

    for (const exp of expenses) {
      const type = exp.paymentType || "cash";
      if (type === "cash") {
        kassa -= exp.amount;
      } else if (type === "card") {
        bank -= exp.amount;
      } else if (type === "safe") {
        safe -= exp.amount;
      } else if (type === "investor_debt") {
        investorDebt += exp.amount;
      }
    }

    for (const entry of stockEntries) {
      if (entry.paidStatus === "paid") {
        const totalCost = entry.quantity * entry.purchasePrice;
        const type = entry.paymentType || "Nəğd";
        if (type === "Nəğd") {
          kassa -= totalCost;
        } else {
          bank -= totalCost;
        }
      }
    }

    for (const st of safeTransfers) {
      if (st.type === "kassa_to_safe") {
        kassa -= st.amount;
        safe += st.amount;
      } else if (st.type === "safe_deposit") {
        safe += st.amount;
      } else if (st.type === "safe_withdrawal") {
        safe -= st.amount;
      }
    }

    return jsonResponse({
      kassa: Math.max(0, kassa),
      safe: Math.max(0, safe),
      bank: Math.max(0, bank),
      debt: Math.max(0, debt),
      investorDebt: Math.max(0, investorDebt),
    });
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

  // 11. User Profile Endpoint
  if (path === "/api/users/me") {
    return jsonResponse({
      id: 9999,
      username: userUsername || "demo_admin",
      role: userRole || "Admin",
      staffCanViewSalesHistory: 1,
      staffCanViewStock: 1,
      staffCanViewCustomers: 1,
      staffCanViewVendors: 1,
      staffCanViewExpenses: 1,
      staffCanViewStockBalances: 1,
      staffCanViewDebts: 1,
      staffCanManageCatalog: 1,
      warehouseId: 1,
    });
  }

  // 12. Vendors Endpoints
  if (path === "/api/vendors") {
    if (method === "GET") {
      return jsonResponse(getDb("vendors"));
    }
    if (method === "POST") {
      const body = getBody();
      const vendorsList = getDb("vendors");
      const nextId = vendorsList.length > 0 ? Math.max(...vendorsList.map(v => v.id)) + 1 : 1;
      const newVendor = {
        id: nextId,
        name: body.name,
        phone: body.phone || "",
        email: body.email || "",
        address: body.address || "",
        notes: body.notes || "",
        createdAt: new Date().toISOString(),
        totalPurchases: 0,
        totalPaid: 0,
        balance: 0,
      };
      vendorsList.push(newVendor);
      saveDb("vendors", vendorsList);
      logActivity(`Tədarükçü əlavə edildi: ${newVendor.name}`);
      return jsonResponse(newVendor);
    }
  }

  // 13. Stock Entries Endpoints
  if (path === "/api/stock/entries") {
    if (method === "GET") {
      return jsonResponse(getDb("stock_entries"));
    }
    if (method === "POST") {
      const body = getBody();
      const entriesList = getDb("stock_entries");
      const nextId = entriesList.length > 0 ? Math.max(...entriesList.map(e => e.id)) + 1 : 1;
      
      const productsList = getDb("products");
      const p = productsList.find(prod => prod.id === body.productId);
      const productName = p ? (p.productName || p.name) : "Məhsul";
      const warehouseId = body.warehouseId ? parseInt(body.warehouseId) : 1;
      
      const newEntry = {
        id: nextId,
        productId: body.productId,
        productName,
        vendorId: body.vendorId || null,
        quantity: parseFloat(body.quantity),
        purchasePrice: parseFloat(body.purchasePrice),
        supplier: body.supplier || "",
        notes: body.notes || "",
        paymentType: body.paymentType,
        bankName: body.paymentType === "Kart" ? (body.bankName || null) : null,
        creditDueDate: body.creditDueDate || null,
        entryDate: new Date().toISOString(),
        paidStatus: body.paymentType === "Nisyə" ? "credit" : "paid",
        applyEdv: body.applyEdv !== undefined && body.applyEdv !== null ? (body.applyEdv ? 1 : 0) : 1,
        warehouseId,
        serialNumbers: body.serialNumbers || [],
      };
      
      entriesList.unshift(newEntry);
      saveDb("stock_entries", entriesList);
      
      // Update product quantity, purchase price, and serials in DB
      if (p) {
        p.currentQuantity = (p.currentQuantity || 0) + newEntry.quantity;
        p.purchasePrice = newEntry.purchasePrice;
        if (body.serialNumbers && Array.isArray(body.serialNumbers)) {
          const serials = getDb("product_serials");
          body.serialNumbers.forEach((sNum: string) => {
            serials.push({
              id: serials.length > 0 ? Math.max(...serials.map((s: any) => s.id)) + 1 : 1,
              productId: body.productId,
              serialNumber: sNum.trim().toUpperCase(),
              status: "in_stock",
              warehouseId,
              stockEntryId: newEntry.id,
              createdAt: new Date().toISOString()
            });
          });
          saveDb("product_serials", serials);
          p.activeSerials = [...(p.activeSerials || []), ...body.serialNumbers];
        }
        saveDb("products", productsList);
      }
      
      logActivity(`Anbara mədaxil edildi: ${newEntry.productName} (${newEntry.quantity} ədəd)`);
      return jsonResponse(newEntry);
    }
  }

  if (path.startsWith("/api/stock/entries/")) {
    const parts = path.split("/");
    const id = parseInt(parts[4] || "0");
    const entriesList = getDb("stock_entries");
    const idx = entriesList.findIndex(e => e.id === id);

    if (path.endsWith("/pay")) {
      if (idx !== -1) {
        entriesList[idx].paidStatus = "paid";
        entriesList[idx].paymentType = "Nəğd";
        saveDb("stock_entries", entriesList);
        logActivity(`Tədarükçü borcu ödənildi: Mədaxil №${id}`);
        return jsonResponse({ success: true, entry: entriesList[idx] });
      }
      return jsonResponse({ message: "Mədaxil tapılmadı" }, 404);
    }

    if (method === "PUT") {
      const body = getBody();
      if (idx !== -1) {
        const entryObj = entriesList[idx];
        const oldQty = entryObj.quantity;
        const newQty = parseFloat(body.quantity);
        
        entriesList[idx] = {
          ...entryObj,
          quantity: newQty,
          purchasePrice: parseFloat(body.purchasePrice),
          paymentType: body.paymentType,
          bankName: body.paymentType === "Kart" ? (body.bankName || null) : null,
          creditDueDate: body.creditDueDate || null,
          supplier: body.supplier || "",
          notes: body.notes || "",
          vendorId: body.vendorId || null,
          applyEdv: body.applyEdv !== undefined && body.applyEdv !== null ? (body.applyEdv ? 1 : 0) : entryObj.applyEdv
        };
        saveDb("stock_entries", entriesList);
        
        const productsList = getDb("products");
        const pObj = productsList.find(p => p.id === entryObj.productId);
        if (pObj) {
          pObj.currentQuantity = (pObj.currentQuantity || 0) - oldQty + newQty;
          saveDb("products", productsList);
        }
        
        logActivity(`Mədaxil redaktə edildi: ${entryObj.productName} (ID: ${id})`);
        return jsonResponse(entriesList[idx]);
      }
      return jsonResponse({ message: "Mədaxil tapılmadı" }, 404);
    }
  }

  // 14. Stock Levels & Debts
  if (path === "/api/stock/levels") {
    const warehouseIdStr = parsedUrl.searchParams.get("warehouseId");
    const warehouseId = warehouseIdStr ? parseInt(warehouseIdStr) : undefined;

    const productsList = getDb("products");
    const entriesList = getDb("stock_entries");
    const salesList = getDb("sales");
    
    const activeProducts = productsList.filter(p => p.isArchived !== 1);
    const stockLevels = activeProducts.map(product => {
      const productEntries = entriesList.filter(e => e.productId === product.id);
      const lastPurchasePrice = productEntries.length > 0 ? productEntries[0].purchasePrice : (product.purchasePrice || 0);
      const lastPurchaseDate = productEntries.length > 0 ? productEntries[0].entryDate : null;

      let lastSalePrice = product.salePrice || 0;
      for (const sale of salesList) {
        const item = sale.items?.find((it: any) => it.productId === product.id);
        if (item) {
          lastSalePrice = item.salePrice;
          break;
        }
      }

      const currentQuantity = getWarehouseQuantity(product.id, warehouseId);

      let activeSerials = product.activeSerials || [];
      if (product.trackingType === "serial" || product.trackingType === "serialized") {
        const serials = getDb("product_serials");
        activeSerials = serials
          .filter((s: any) => s.productId === product.id && (!warehouseId || s.warehouseId === warehouseId) && s.status === "in_stock")
          .map((s: any) => s.serialNumber);
      }

      return {
        productId: product.id,
        productName: product.productName || product.name || "",
        category: product.category || "",
        unit: product.unit || "ədəd",
        currentQuantity,
        lastPurchasePrice,
        lastSalePrice,
        totalValue: currentQuantity * lastPurchasePrice,
        trackingType: product.trackingType || "none",
        activeSerials,
        lastPurchaseDate,
        barcode: product.barcode || "",
        description: product.description || product.notes || "",
      };
    });
    
    return jsonResponse(stockLevels);
  }

  if (path === "/api/stock/my-debts") {
    const entriesList = getDb("stock_entries");
    const myDebts = entriesList
      .filter(e => e.paidStatus === "credit" || e.paymentType === "Nisyə")
      .map(e => ({
        id: e.id,
        productId: e.productId,
        productName: e.productName,
        quantity: e.quantity,
        purchasePrice: e.purchasePrice,
        totalAmount: e.quantity * e.purchasePrice,
        supplier: e.supplier,
        creditDueDate: e.creditDueDate,
        entryDate: e.entryDate,
      }));
    return jsonResponse(myDebts);
  }

  // 15. Credit Sales
  if (path === "/api/credits/overdue") {
    const sales = getDb("sales");
    const todayStr = new Date().toISOString().split("T")[0];
    const overdue = sales.filter(s => s.paymentStatus === "unpaid" && s.creditDueDate && s.creditDueDate <= todayStr);
    return jsonResponse(overdue);
  }

  if (path === "/api/credits/pending") {
    const sales = getDb("sales");
    const pending = sales.filter(s => s.paymentStatus === "unpaid");
    return jsonResponse(pending);
  }

  // 16. Dashboard Analytics Mock
  if (path === "/api/dashboard/analytics") {
    return jsonResponse({
      monthlyTrend: [
        { month: "Yan", revenue: 12000, expenses: 3000, profit: 9000 },
        { month: "Fev", revenue: 15000, expenses: 4000, profit: 11000 },
        { month: "Mar", revenue: 18000, expenses: 3500, profit: 14500 },
        { month: "Apr", revenue: 22000, expenses: 5000, profit: 17000 },
        { month: "May", revenue: 25000, expenses: 6000, profit: 19000 },
        { month: "İyun", revenue: 30000, expenses: 5500, profit: 24500 }
      ],
      weeklyDistribution: [
        { day: "Bazar ertəsi", sales: 15, revenue: 3500 },
        { day: "Çərşənbə axşamı", sales: 12, revenue: 2800 },
        { day: "Çərşənbə", sales: 18, revenue: 4200 },
        { day: "Cümə axşamı", sales: 14, revenue: 3100 },
        { day: "Cümə", sales: 25, revenue: 6500 },
        { day: "Şənbə", sales: 30, revenue: 8000 },
        { day: "Bazar", sales: 20, revenue: 5000 }
      ],
      topCategories: [
        { category: "Telefonlar", salesCount: 45, revenue: 99000 },
        { category: "Kompüterlər", salesCount: 22, revenue: 52800 },
        { category: "Aksesuarlar", salesCount: 80, revenue: 32000 },
        { category: "Avadanlıq", salesCount: 58, revenue: 8700 }
      ],
      cogsAudit: {
        totalRevenue: 192500,
        totalCost: 144375,
        totalExpenses: 27000,
        grossProfit: 48125,
        netProfit: 21125,
        grossMargin: 25,
        netMargin: 11
      }
    });
  }

  // 17. HR Employees Mock
  if (path === "/api/employees") {
    return jsonResponse([]);
  }

  // 18. Shifts Management Mock
  if (path === "/api/shifts/active") {
    const shifts = getDb("shifts");
    const seller = userUsername ? userUsername.trim().toLowerCase() : "satici";
    const active = shifts.find((s: any) => s.cashierName === seller && s.status === "open");
    return jsonResponse({ activeShift: active || null });
  }

  if (path === "/api/shifts/open" && method === "POST") {
    const body = getBody();
    const shifts = getDb("shifts");
    const seller = userUsername ? userUsername.trim().toLowerCase() : "satici";
    const active = shifts.find((s: any) => s.cashierName === seller && s.status === "open");
    if (active) {
      return jsonResponse({ message: "Aktiv növbəniz artıq açıqdır" }, 400);
    }
    const openingCash = parseFloat(body.openingCash) || 0;
    const newShift = {
      id: shifts.length + 1,
      cashierId: 1,
      cashierName: seller,
      openedAt: new Date().toISOString(),
      openingCash,
      expectedCash: openingCash,
      actualCash: 0,
      variance: 0,
      status: "open",
    };
    shifts.push(newShift);
    saveDb("shifts", shifts);
    logActivity(`Kassa növbəsi açıldı. Giriş nağd balans: ${openingCash.toFixed(2)} AZN`);
    return jsonResponse(newShift);
  }

  if (path === "/api/shifts/close" && method === "POST") {
    const body = getBody();
    const shifts = getDb("shifts");
    const seller = userUsername ? userUsername.trim().toLowerCase() : "satici";
    const idx = shifts.findIndex((s: any) => s.cashierName === seller && s.status === "open");
    if (idx === -1) {
      return jsonResponse({ message: "Aktiv növbə tapılmadı" }, 404);
    }
    const shift = shifts[idx];
    const actualCash = parseFloat(body.actualCash) || 0;

    // Calculate expected cash in shifts
    const sales = getDb("sales").filter((s: any) => s.shiftId === shift.id);
    let cashSalesAmount = 0;
    for (const sale of sales) {
      if (sale.paymentType === "Nəğd" && sale.paymentStatus === "paid") {
        const discount = Number(sale.loyaltyDiscountPaid) || 0;
        cashSalesAmount += ((sale.totalAmount || 0) - discount);
      }
    }

    const returns = getDb("returns").filter((r: any) => {
      const sale = getDb("sales").find((s: any) => s.id === r.saleId);
      return sale && sale.shiftId === shift.id;
    });
    let cashReturnsAmount = 0;
    for (const r of returns) {
      cashReturnsAmount += Number(r.totalAmount) || 0;
    }

    // Since in the sandbox we may have cash expenses, let's filter cash expenses since the shift started
    const expenses = getDb("expenses").filter((e: any) => e.paymentType === "cash" && e.date >= shift.openedAt);
    let cashExpensesAmount = 0;
    for (const e of expenses) {
      cashExpensesAmount += Number(e.amount) || 0;
    }

    const expectedCash = shift.openingCash + cashSalesAmount - cashReturnsAmount - cashExpensesAmount;
    const variance = actualCash - expectedCash;

    shift.closedAt = new Date().toISOString();
    shift.expectedCash = expectedCash;
    shift.actualCash = actualCash;
    shift.variance = variance;
    shift.status = "closed";

    shifts[idx] = shift;
    saveDb("shifts", shifts);

    logActivity(`Kassa növbəsi bağlandı. Z-Hesabat: Gözlənilən: ${expectedCash.toFixed(2)}, Sayılan: ${actualCash.toFixed(2)}, Fərq: ${variance.toFixed(2)} AZN`);

    return jsonResponse({
      shift,
      stats: {
        openingCash: shift.openingCash,
        cashSalesAmount,
        cashReturnsAmount,
        cashCreditRepaymentsAmount: 0,
        cashExpensesAmount,
        expectedCash,
        actualCash,
        variance
      }
    });
  }

  if (path === "/api/shifts" && method === "GET") {
    return jsonResponse(getDb("shifts"));
  }

  // 19. Stock Adjustments Mock
  if (path === "/api/stock/adjust" && method === "POST") {
    const adjustments = getBody();
    const dbAdjustments = getDb("stock_adjustments");
    const products = getDb("products");

    const adjusted = adjustments.map((adj: any) => {
      const nextId = dbAdjustments.length + 1;
      const rec = {
        id: nextId,
        productId: parseInt(adj.productId),
        warehouseId: parseInt(adj.warehouseId),
        type: adj.type,
        quantity: parseFloat(adj.quantity),
        date: new Date().toISOString(),
        adjustedBy: userUsername || "system",
        notes: adj.notes || null,
      };
      dbAdjustments.push(rec);

      // Adjust product currentQuantity locally in sandbox
      const pIdx = products.findIndex((p: any) => p.id === rec.productId);
      if (pIdx !== -1) {
        if (rec.type === "surplus") {
          products[pIdx].currentQuantity += rec.quantity;
        } else {
          products[pIdx].currentQuantity = Math.max(0, products[pIdx].currentQuantity - rec.quantity);
        }
      }

      return rec;
    });

    saveDb("stock_adjustments", dbAdjustments);
    saveDb("products", products);
    logActivity(`Sayım tənzimləməsi tamamlandı: ${adjustments.length} məhsul`);
    return jsonResponse({ success: true, adjusted });
  }

  // 20. Auto PO drafts Mock
  if (path === "/api/stock/procurement-drafts" && method === "GET") {
    const products = getDb("products");
    const vendors = getDb("vendors");
    const draftMap: Record<number, { vendorName: string, items: any[] }> = {};

    for (const prod of products) {
      const currentStock = prod.currentQuantity || 0;
      const minLimit = Number(prod.minStockLimit) || 0;
      if (minLimit > 0 && currentStock < minLimit) {
        const vendorId = prod.vendorId || 0;
        let vendorName = "Təyin Edilməyib";
        if (vendorId) {
          const v = vendors.find((v: any) => v.id === vendorId);
          if (v) vendorName = v.name;
        }

        if (!draftMap[vendorId]) {
          draftMap[vendorId] = { vendorName, items: [] };
        }

        draftMap[vendorId].items.push({
          productId: prod.id,
          productName: prod.name,
          barcode: prod.barcode,
          currentStock,
          minStockLimit: minLimit,
          suggestedOrderQty: Math.max(1, minLimit * 2 - currentStock),
        });
      }
    }
    return jsonResponse(Object.values(draftMap));
  }

  // Default Fallback
  return jsonResponse({ message: "Demo rejimində bu sorğu keçərli deyil" }, 400);
}
