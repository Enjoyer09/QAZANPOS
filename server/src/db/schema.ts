import { pgTable, text, integer, serial, doublePrecision } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// 1. Products Directory
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category"),
  unit: text("unit").notNull().default("ədəd"),
  description: text("description"),
});

// 2. Stock Entries (Warehouse entry / restocking)
export const stockEntries = pgTable("stock_entries", {
  id: serial("id").primaryKey(),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  quantity: doublePrecision("quantity").notNull(),
  purchasePrice: doublePrecision("purchase_price").notNull(), // Alış qiyməti
  supplier: text("supplier"),
  notes: text("notes"),
  paymentType: text("payment_type").notNull(), // "Nəğd", "Kart", "Kart2Kart", "Nisyə"
  creditDueDate: text("credit_due_date"), // Borc son ödəniş tarixi
  entryDate: text("entry_date").notNull(), // ISO timestamp
  paidStatus: text("paid_status").notNull().default("paid"), // "paid" (ödənilib), "credit" (tədarükçüyə borc)
});

// 3. Customers Directory
export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  notes: text("notes"),
});

// 4. Sales Table
export const sales = pgTable("sales", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").references(() => customers.id, {
    onDelete: "set null",
  }),
  customerName: text("customer_name"), // Snapshotted at sale time
  customerPhone: text("customer_phone"), // Snapshotted at sale time
  paymentType: text("payment_type").notNull(), // "Nəğd", "Kart", "Kart2Kart", "Nisyə"
  creditDueDate: text("credit_due_date"), // Borcun ödənilməli olduğu son tarix
  notes: text("notes"),
  saleDate: text("sale_date").notNull(), // ISO timestamp
  totalAmount: doublePrecision("total_amount").notNull(), // Satış cəmi
  totalCost: doublePrecision("total_cost").notNull(), // Satışın Maya dəyəri (calculating total COGS)
  paymentStatus: text("payment_status").notNull().default("paid"), // "paid" (tam ödənilib), "credit" (nisyə borc)
});

// 5. Sale Items
export const saleItems = pgTable("sale_items", {
  id: serial("id").primaryKey(),
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
  saleId: integer("sale_id")
    .notNull()
    .references(() => sales.id, { onDelete: "cascade" }),
  paymentDate: text("payment_date").notNull(), // ISO timestamp
  amount: doublePrecision("amount").notNull(), // Ödənilən məbləğ
});

// 7. General Expenses
export const expenses = pgTable("expenses", {
  id: serial("id").primaryKey(),
  amount: doublePrecision("amount").notNull(),
  category: text("category").notNull(), // "Maaş", "İcarə", "Kommunal", "Nəqliyyat", "Digər"
  description: text("description"),
  date: text("date").notNull(), // ISO timestamp
});

// 8. Application Settings (Business settings and limits)
export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
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
});

// Relations Definitions for Drizzle ORM queries
export const productsRelations = relations(products, ({ many }) => ({
  stockEntries: many(stockEntries),
  saleItems: many(saleItems),
}));

export const stockEntriesRelations = relations(stockEntries, ({ one }) => ({
  product: one(products, {
    fields: [stockEntries.productId],
    references: [products.id],
  }),
}));

export const customersRelations = relations(customers, ({ many }) => ({
  sales: many(sales),
}));

export const salesRelations = relations(sales, ({ one, many }) => ({
  customer: one(customers, {
    fields: [sales.customerId],
    references: [customers.id],
  }),
  items: many(saleItems),
  payments: many(creditPayments),
}));

export const saleItemsRelations = relations(saleItems, ({ one }) => ({
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
  sale: one(sales, {
    fields: [creditPayments.saleId],
    references: [sales.id],
  }),
}));

// 9. Users Table for Authentication & Authorization
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("Staff"), // "Admin" or "Staff"
});
