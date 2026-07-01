import { pgTable, text, integer, serial, doublePrecision, uniqueIndex } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// 0. Tenants Table (Management Plane)
export const tenants = pgTable("tenants", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(), // E.g. "demo", "super", "restoran1"
  status: text("status").notNull().default("active"), // "active", "suspended"
  releaseTier: text("release_tier").notNull().default("stable"), // "stable", "beta", "canary"
  billingTier: text("billing_tier").notNull().default("free"), // "free", "mini", "pro", "enterprise"
  createdAt: text("created_at").notNull(),
});

// 0b. Warehouses Table
export const warehouses = pgTable("warehouses", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" })
    .default(1),
  name: text("name").notNull(),
  location: text("location"),
  isDefault: integer("is_default").notNull().default(0), // 1 = default, 0 = regular
  createdAt: text("created_at").notNull(),
});

// 0c. Stock Transfers Table
export const stockTransfers = pgTable("stock_transfers", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" })
    .default(1),
  fromWarehouseId: integer("from_warehouse_id")
    .notNull()
    .references(() => warehouses.id, { onDelete: "cascade" }),
  toWarehouseId: integer("to_warehouse_id")
    .notNull()
    .references(() => warehouses.id, { onDelete: "cascade" }),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  quantity: doublePrecision("quantity").notNull(),
  transferDate: text("transfer_date").notNull(),
  transferredBy: text("transferred_by").notNull(),
  notes: text("notes"),
  serialNumbers: text("serial_numbers"), // Comma-separated serial numbers or JSON string
});

// 1. Products Directory
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" })
    .default(1),
  name: text("name").notNull(),
  category: text("category"),
  unit: text("unit").notNull().default("ədəd"),
  description: text("description"),
  barcode: text("barcode"),
  trackingType: text("tracking_type").notNull().default("none"),
  warrantyMonths: integer("warranty_months"),
  isArchived: integer("is_archived").notNull().default(0), // 0 = Active, 1 = Archived
  vendorId: integer("vendor_id").references(() => vendors.id, { onDelete: "set null" }),
}, (table) => ({
  productsTenantBarcodeIdx: uniqueIndex("products_tenant_barcode_idx").on(table.tenantId, table.barcode)
}));

// 1b. Suppliers (Vendors Directory)
export const vendors = pgTable("vendors", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" })
    .default(1),
  name: text("name").notNull(),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
});

// 2. Stock Entries (Warehouse entry / restocking)
export const stockEntries = pgTable("stock_entries", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" })
    .default(1),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  vendorId: integer("vendor_id")
    .references(() => vendors.id, { onDelete: "set null" }),
  quantity: doublePrecision("quantity").notNull(),
  purchasePrice: doublePrecision("purchase_price").notNull(), // Alış qiyməti
  supplier: text("supplier"),
  notes: text("notes"),
  paymentType: text("payment_type").notNull(), // "Nəğd", "Kart", "Kart2Kart", "Köçürmə", "Nisyə"
  bankName: text("bank_name"),
  creditDueDate: text("credit_due_date"), // Borc son ödəniş tarixi
  entryDate: text("entry_date").notNull(), // ISO timestamp
  paidStatus: text("paid_status").notNull().default("paid"), // "paid" (ödənilib), "credit" (tədarükçüyə borc)
  applyEdv: integer("apply_edv").notNull().default(1),
  warehouseId: integer("warehouse_id")
    .references(() => warehouses.id, { onDelete: "set null" }),
});

// 2b. Vendor Payments (Wholesale payment history ledger)
export const vendorPayments = pgTable("vendor_payments", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" })
    .default(1),
  vendorId: integer("vendor_id")
    .notNull()
    .references(() => vendors.id, { onDelete: "cascade" }),
  amount: doublePrecision("amount").notNull(),
  paymentDate: text("payment_date").notNull(), // ISO timestamp
  paymentType: text("payment_type").notNull(), // "Nəğd", "Kart", "Kart2Kart", "Köçürmə"
  notes: text("notes"),
});

// 2c. Employees (HR Directory)
export const employees = pgTable("employees", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" })
    .default(1),
  name: text("name").notNull(),
  phone: text("phone"),
  email: text("email"),
  position: text("position").notNull(), // "Kassir", "Menecer", etc.
  baseSalary: doublePrecision("base_salary").notNull(),
  hireDate: text("hire_date").notNull(), // ISO YYYY-MM-DD
  status: text("status").notNull().default("active"), // "active", "inactive"
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
});

// 2d. Payroll Records (Monthly salary log)
export const payroll = pgTable("payroll", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" })
    .default(1),
  employeeId: integer("employee_id")
    .notNull()
    .references(() => employees.id, { onDelete: "cascade" }),
  payrollMonth: text("payroll_month").notNull(), // "YYYY-MM"
  baseSalary: doublePrecision("base_salary").notNull(),
  bonuses: doublePrecision("bonuses").notNull().default(0.0),
  deductions: doublePrecision("deductions").notNull().default(0.0),
  netSalary: doublePrecision("net_salary").notNull(), // baseSalary + bonuses - deductions
  paidAmount: doublePrecision("paid_amount").notNull().default(0.0),
  paymentStatus: text("payment_status").notNull().default("unpaid"), // "unpaid", "partial", "paid"
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
});

// 2e. Salary Payments
export const salaryPayments = pgTable("salary_payments", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" })
    .default(1),
  payrollId: integer("payroll_id")
    .notNull()
    .references(() => payroll.id, { onDelete: "cascade" }),
  amount: doublePrecision("amount").notNull(),
  paymentDate: text("payment_date").notNull(), // ISO timestamp
  paymentType: text("payment_type").notNull(), // "Nəğd", "Kart", "Kart2Kart", "Köçürmə"
  notes: text("notes"),
});

// 3. Customers Directory
export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" })
    .default(1),
  name: text("name").notNull(),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  notes: text("notes"),
  createdByName: text("created_by_name").notNull().default("Sistem"),
});

// 4. Sales Table
export const sales = pgTable("sales", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" })
    .default(1),
  customerId: integer("customer_id").references(() => customers.id, {
    onDelete: "set null",
  }),
  customerName: text("customer_name"), // Snapshotted at sale time
  customerPhone: text("customer_phone"), // Snapshotted at sale time
  paymentType: text("payment_type").notNull(), // "Nəğd", "Kart", "Kart2Kart", "Köçürmə", "Nisyə"
  bankName: text("bank_name"),
  creditDueDate: text("credit_due_date"), // Borcun ödənilməli olduğu son tarix
  notes: text("notes"),
  saleDate: text("sale_date").notNull(), // ISO timestamp
  totalAmount: doublePrecision("total_amount").notNull(), // Satış cəmi
  totalCost: doublePrecision("total_cost").notNull(), // Satışın Maya dəyəri (calculating total COGS)
  paymentStatus: text("payment_status").notNull().default("paid"), // "paid" (tam ödənilib), "credit" (nisyə borc)
  offlineId: text("offline_id"),
  salesChannel: text("sales_channel").default("Mağaza").notNull(),
  marketplaceFee: doublePrecision("marketplace_fee").default(0.0).notNull(),
  sellerName: text("seller_name").default("Sistem"),
  applyEdv: integer("apply_edv").notNull().default(1),
  warehouseId: integer("warehouse_id")
    .references(() => warehouses.id, { onDelete: "set null" }),
}, (table) => ({
  salesTenantOfflineIdIdx: uniqueIndex("sales_tenant_offline_id_idx").on(table.tenantId, table.offlineId)
}));

// 5. Sale Items
export const saleItems = pgTable("sale_items", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" })
    .default(1),
  saleId: integer("sale_id")
    .notNull()
    .references(() => sales.id, { onDelete: "cascade" }),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id),
  quantity: doublePrecision("quantity").notNull(),
  salePrice: doublePrecision("sale_price").notNull(), // Satış qiyməti
  purchasePrice: doublePrecision("purchase_price").notNull(), // Maya dəyəri (snapshot of lastPurchasePrice at sale time)
});

// 6. Credit Payments (Customer paying back their debt partially or fully)
export const creditPayments = pgTable("credit_payments", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" })
    .default(1),
  saleId: integer("sale_id")
    .notNull()
    .references(() => sales.id, { onDelete: "cascade" }),
  paymentDate: text("payment_date").notNull(), // ISO timestamp
  amount: doublePrecision("amount").notNull(), // Ödənilən məbləğ
  paymentType: text("payment_type").notNull().default("Nəğd"), // "Nəğd", "Kart", "Kart2Kart", "Köçürmə"
});

// 7. General Expenses
export const expenses = pgTable("expenses", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" })
    .default(1),
  amount: doublePrecision("amount").notNull(),
  category: text("category").notNull(), // "Maaş", "İcarə", "Kommunal", "Nəqliyyat", "Digər"
  description: text("description"),
  paymentType: text("payment_type").notNull().default("cash"), // "cash", "card", "investor_debt", "other"
  date: text("date").notNull(), // ISO timestamp
});

// 8. Application Settings (Business settings and limits)
export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" })
    .default(1)
    .unique(),
  storeName: text("store_name").notNull().default("Mətbəx Dünyası"),
  phone: text("phone").default("055-123-4567"),
  address: text("address").default("Yuxarı Göyçay"),
  invoiceFooter: text("invoice_footer").default("Bizi seçdiyiniz üçün təşəkkür edirik!"),
  lowStockAlertCount: integer("low_stock_alert_count").notNull().default(5),
  defaultCreditDays: integer("default_credit_days").notNull().default(30),
  receiptWidth: text("receipt_width").notNull().default("80mm"), // "80mm" or "58mm"
  showBarcode: integer("show_barcode").notNull().default(1), // 1 = true, 0 = false
  showCustomerInfo: integer("show_customer_info").notNull().default(1),
  receiptHeader: text("receipt_header").default("MƏTBƏX DÜNYASI"),
  receiptFooter: text("receipt_footer").default("Çekimizi saxlamanızı xahiş edirik!"),
  showStorePhone: integer("show_store_phone").notNull().default(1),
  showStoreAddress: integer("show_store_address").notNull().default(1),
  showReceiptHeader: integer("show_receipt_header").notNull().default(1),
  showReceiptFooter: integer("show_receipt_footer").notNull().default(1),
  showPaymentDetails: integer("show_payment_details").notNull().default(1),
  telegramBotToken: text("telegram_bot_token"),
  telegramChatId: text("telegram_chat_id"),
  telegramNotificationsEnabled: integer("telegram_notifications_enabled").notNull().default(0),
  backupTime: text("backup_time").notNull().default("23:00"),
  telegramBackupEnabled: integer("telegram_backup_enabled").notNull().default(0),
  voen: text("voen"),
  taxStatus: text("tax_status").default("sadelestirilmis"),
  edvRate: doublePrecision("edv_rate").default(18.0),
  simplifiedRate: doublePrecision("simplified_rate").default(2.0),
  showTaxOnReceipt: integer("show_tax_on_receipt").default(1),
  showTaxOnInvoice: integer("show_tax_on_invoice").default(1),
  marketplaceCommissions: text("marketplace_commissions"),
  staffCanViewSalesHistory: integer("staff_can_view_sales_history").notNull().default(1),
  staffCanViewStock: integer("staff_can_view_stock").notNull().default(1),
  staffCanViewCustomers: integer("staff_can_view_customers").notNull().default(1),
  staffCanViewVendors: integer("staff_can_view_vendors").notNull().default(1),
  staffCanViewExpenses: integer("staff_can_view_expenses").notNull().default(1),
  activeBanks: text("active_banks"),
});

// 9. Users Table for Authentication & Authorization
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" })
    .default(1),
  username: text("username").notNull(),
  password: text("password").notNull(),
  role: text("role").notNull().default("Staff"), // "Admin" or "Staff"
  twoFactorSecret: text("two_factor_secret"),
  twoFactorEnabled: integer("two_factor_enabled").notNull().default(0), // 0 = disabled, 1 = enabled
  twoFactorTrustedDevices: text("two_factor_trusted_devices"), // JSON array of { deviceToken, ip, expireAt }
  staffCanViewSalesHistory: integer("staff_can_view_sales_history").notNull().default(1),
  staffCanViewStock: integer("staff_can_view_stock").notNull().default(1),
  staffCanViewCustomers: integer("staff_can_view_customers").notNull().default(1),
  staffCanViewVendors: integer("staff_can_view_vendors").notNull().default(1),
  staffCanViewExpenses: integer("staff_can_view_expenses").notNull().default(1),
  staffCanViewStockBalances: integer("staff_can_view_stock_balances").notNull().default(1),
  staffCanViewDebts: integer("staff_can_view_debts").notNull().default(1),
  staffCanManageCatalog: integer("staff_can_manage_catalog").notNull().default(1),
  warehouseId: integer("warehouse_id")
    .references(() => warehouses.id, { onDelete: "set null" }),
}, (table) => ({
  usersTenantUsernameIdx: uniqueIndex("users_tenant_username_idx").on(table.tenantId, table.username)
}));

// 10. Activity Logs Table for Auditing
export const activityLogs = pgTable("activity_logs", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" })
    .default(1),
  username: text("username").notNull(),
  action: text("action").notNull(),
  description: text("description").notNull(),
  timestamp: text("timestamp").notNull(),
  archived: integer("archived").notNull().default(0), // 0 = active, 1 = archived
});

// 11. Returns Table (Geri Qaytarışlar)
export const returns = pgTable("returns", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" })
    .default(1),
  saleId: integer("sale_id") // Can be null for loose/ad-hoc returns
    .references(() => sales.id, { onDelete: "cascade" }),
  returnDate: text("return_date").notNull(), // ISO timestamp
  totalAmount: doublePrecision("total_amount").notNull(), // Total refunded money to customer
  reason: text("reason"),
  warehouseId: integer("warehouse_id")
    .references(() => warehouses.id, { onDelete: "set null" }),
});

// 12. Return Items Table
export const returnItems = pgTable("return_items", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" })
    .default(1),
  returnId: integer("return_id")
    .notNull()
    .references(() => returns.id, { onDelete: "cascade" }),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id),
  quantity: doublePrecision("quantity").notNull(),
  salePrice: doublePrecision("sale_price").notNull(),
  purchasePrice: doublePrecision("purchase_price").notNull(),
  status: text("status").notNull(), // "returned_to_stock" or "defective"
});

// 13. Product Serial Numbers Table
export const productSerials = pgTable("product_serials", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" })
    .default(1),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  stockEntryId: integer("stock_entry_id")
    .references(() => stockEntries.id, { onDelete: "set null" }),
  saleId: integer("sale_id")
    .references(() => sales.id, { onDelete: "set null" }),
  returnId: integer("return_id")
    .references(() => returns.id, { onDelete: "set null" }),
  serialNumber: text("serial_number").notNull(),
  status: text("status").notNull().default("in_stock"), // "in_stock", "sold", "defective", "written_off"
  createdAt: text("created_at").notNull(),
  soldAt: text("sold_at"),
  warehouseId: integer("warehouse_id")
    .references(() => warehouses.id, { onDelete: "set null" }),
}, (table) => ({
  productSerialsTenantSerialIdx: uniqueIndex("product_serials_tenant_serial_idx").on(table.tenantId, table.serialNumber)
}));

// Relations Definitions for Drizzle ORM queries
export const tenantsRelations = relations(tenants, ({ many }) => ({
  products: many(products),
  stockEntries: many(stockEntries),
  customers: many(customers),
  sales: many(sales),
  expenses: many(expenses),
  users: many(users),
  returns: many(returns),
  productSerials: many(productSerials),
  warehouses: many(warehouses),
  stockTransfers: many(stockTransfers),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [products.tenantId],
    references: [tenants.id],
  }),
  stockEntries: many(stockEntries),
  saleItems: many(saleItems),
  returnItems: many(returnItems),
  serials: many(productSerials),
  stockTransfers: many(stockTransfers),
}));

export const stockEntriesRelations = relations(stockEntries, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [stockEntries.tenantId],
    references: [tenants.id],
  }),
  product: one(products, {
    fields: [stockEntries.productId],
    references: [products.id],
  }),
  serials: many(productSerials),
  warehouse: one(warehouses, {
    fields: [stockEntries.warehouseId],
    references: [warehouses.id],
  }),
}));

export const customersRelations = relations(customers, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [customers.tenantId],
    references: [tenants.id],
  }),
  sales: many(sales),
}));

export const salesRelations = relations(sales, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [sales.tenantId],
    references: [tenants.id],
  }),
  customer: one(customers, {
    fields: [sales.customerId],
    references: [customers.id],
  }),
  items: many(saleItems),
  payments: many(creditPayments),
  returns: many(returns),
  serials: many(productSerials),
  warehouse: one(warehouses, {
    fields: [sales.warehouseId],
    references: [warehouses.id],
  }),
}));

export const saleItemsRelations = relations(saleItems, ({ one }) => ({
  tenant: one(tenants, {
    fields: [saleItems.tenantId],
    references: [tenants.id],
  }),
  sale: one(sales, {
    fields: [saleItems.saleId],
    references: [sales.id],
  }),
  product: one(products, {
    fields: [saleItems.productId],
    references: [products.id],
  }),
}));

export const creditPaymentsRelations = relations(creditPayments, ({ one }) => ({
  tenant: one(tenants, {
    fields: [creditPayments.tenantId],
    references: [tenants.id],
  }),
  sale: one(sales, {
    fields: [creditPayments.saleId],
    references: [sales.id],
  }),
}));

export const expensesRelations = relations(expenses, ({ one }) => ({
  tenant: one(tenants, {
    fields: [expenses.tenantId],
    references: [tenants.id],
  }),
}));

export const settingsRelations = relations(settings, ({ one }) => ({
  tenant: one(tenants, {
    fields: [settings.tenantId],
    references: [tenants.id],
  }),
}));

export const usersRelations = relations(users, ({ one }) => ({
  tenant: one(tenants, {
    fields: [users.tenantId],
    references: [tenants.id],
  }),
  warehouse: one(warehouses, {
    fields: [users.warehouseId],
    references: [warehouses.id],
  }),
}));

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  tenant: one(tenants, {
    fields: [activityLogs.tenantId],
    references: [tenants.id],
  }),
}));

export const returnsRelations = relations(returns, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [returns.tenantId],
    references: [tenants.id],
  }),
  sale: one(sales, {
    fields: [returns.saleId],
    references: [sales.id],
  }),
  items: many(returnItems),
  serials: many(productSerials),
  warehouse: one(warehouses, {
    fields: [returns.warehouseId],
    references: [warehouses.id],
  }),
}));

export const returnItemsRelations = relations(returnItems, ({ one }) => ({
  tenant: one(tenants, {
    fields: [returnItems.tenantId],
    references: [tenants.id],
  }),
  return: one(returns, {
    fields: [returnItems.returnId],
    references: [returns.id],
  }),
  product: one(products, {
    fields: [returnItems.productId],
    references: [products.id],
  }),
}));

export const employeesRelations = relations(employees, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [employees.tenantId],
    references: [tenants.id],
  }),
  payrolls: many(payroll),
}));

export const payrollRelations = relations(payroll, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [payroll.tenantId],
    references: [tenants.id],
  }),
  employee: one(employees, {
    fields: [payroll.employeeId],
    references: [employees.id],
  }),
  payments: many(salaryPayments),
}));

export const salaryPaymentsRelations = relations(salaryPayments, ({ one }) => ({
  tenant: one(tenants, {
    fields: [salaryPayments.tenantId],
    references: [tenants.id],
  }),
  payroll: one(payroll, {
    fields: [salaryPayments.payrollId],
    references: [payroll.id],
  }),
}));

export const productSerialsRelations = relations(productSerials, ({ one }) => ({
  tenant: one(tenants, {
    fields: [productSerials.tenantId],
    references: [tenants.id],
  }),
  product: one(products, {
    fields: [productSerials.productId],
    references: [products.id],
  }),
  stockEntry: one(stockEntries, {
    fields: [productSerials.stockEntryId],
    references: [stockEntries.id],
  }),
  sale: one(sales, {
    fields: [productSerials.saleId],
    references: [sales.id],
  }),
  return: one(returns, {
    fields: [productSerials.returnId],
    references: [returns.id],
  }),
  warehouse: one(warehouses, {
    fields: [productSerials.warehouseId],
    references: [warehouses.id],
  }),
}));

// 14. Vendor Returns Table (Tədarükçüyə Qaytarışlar)
export const vendorReturns = pgTable("vendor_returns", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" })
    .default(1),
  vendorId: integer("vendor_id")
    .notNull()
    .references(() => vendors.id, { onDelete: "cascade" }),
  returnDate: text("return_date").notNull(), // ISO timestamp
  totalAmount: doublePrecision("total_amount").notNull(),
  paymentType: text("payment_type").notNull(), // "Nəğd", "Kart", "Borcdan Silinmə", "Köçürmə"
  notes: text("notes"),
  warehouseId: integer("warehouse_id")
    .references(() => warehouses.id, { onDelete: "set null" }),
});

// 15. Vendor Return Items Table
export const vendorReturnItems = pgTable("vendor_return_items", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" })
    .default(1),
  vendorReturnId: integer("vendor_return_id")
    .notNull()
    .references(() => vendorReturns.id, { onDelete: "cascade" }),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  stockEntryId: integer("stock_entry_id")
    .references(() => stockEntries.id, { onDelete: "set null" }),
  quantity: doublePrecision("quantity").notNull(),
  purchasePrice: doublePrecision("purchase_price").notNull(),
  notes: text("notes"),
});

export const vendorReturnsRelations = relations(vendorReturns, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [vendorReturns.tenantId],
    references: [tenants.id],
  }),
  vendor: one(vendors, {
    fields: [vendorReturns.vendorId],
    references: [vendors.id],
  }),
  items: many(vendorReturnItems),
  warehouse: one(warehouses, {
    fields: [vendorReturns.warehouseId],
    references: [warehouses.id],
  }),
}));

export const vendorReturnItemsRelations = relations(vendorReturnItems, ({ one }) => ({
  tenant: one(tenants, {
    fields: [vendorReturnItems.tenantId],
    references: [tenants.id],
  }),
  vendorReturn: one(vendorReturns, {
    fields: [vendorReturnItems.vendorReturnId],
    references: [vendorReturns.id],
  }),
  product: one(products, {
    fields: [vendorReturnItems.productId],
    references: [products.id],
  }),
  stockEntry: one(stockEntries, {
    fields: [vendorReturnItems.stockEntryId],
    references: [stockEntries.id],
  }),
}));

export const warehousesRelations = relations(warehouses, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [warehouses.tenantId],
    references: [tenants.id],
  }),
  stockEntries: many(stockEntries),
  sales: many(sales),
  returns: many(returns),
  vendorReturns: many(vendorReturns),
  serials: many(productSerials),
  users: many(users),
  transfersFrom: many(stockTransfers, { relationName: "transfersFrom" }),
  transfersTo: many(stockTransfers, { relationName: "transfersTo" }),
}));

export const stockTransfersRelations = relations(stockTransfers, ({ one }) => ({
  tenant: one(tenants, {
    fields: [stockTransfers.tenantId],
    references: [tenants.id],
  }),
  fromWarehouse: one(warehouses, {
    fields: [stockTransfers.fromWarehouseId],
    references: [warehouses.id],
    relationName: "transfersFrom",
  }),
  toWarehouse: one(warehouses, {
    fields: [stockTransfers.toWarehouseId],
    references: [warehouses.id],
    relationName: "transfersTo",
  }),
  product: one(products, {
    fields: [stockTransfers.productId],
    references: [products.id],
  }),
}));


