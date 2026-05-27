import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const url = process.env.DATABASE_URL || `file:${path.resolve(__dirname, "../../../sqlite.db")}`;
const authToken = process.env.DATABASE_AUTH_TOKEN;

const client = createClient({
  url,
  authToken,
});
const db = drizzle(client, { schema });


async function seed() {
  console.log("Seeding database...");

  // 1. Clear existing data
  await client.execute("DELETE FROM credit_payments");
  await client.execute("DELETE FROM sale_items");
  await client.execute("DELETE FROM sales");
  await client.execute("DELETE FROM stock_entries");
  await client.execute("DELETE FROM products");
  await client.execute("DELETE FROM customers");
  await client.execute("DELETE FROM expenses");
  await client.execute("DELETE FROM users");

  console.log("Cleared existing data.");

  // 2. Insert Products
  const insertedProducts = await db
    .insert(schema.products)
    .values([
      {
        name: "Qazan 24sm (Korkmaz)",
        category: "Qazan",
        unit: "ədəd",
        description: "Paslanmaz polad, Korkmaz premium keyfiyyət",
      },
      {
        name: "Tava 28sm (Tefal)",
        category: "Tava",
        unit: "ədəd",
        description: "Tefal teflon örtüklü tava, yapışmayan",
      },
      {
        name: "Çaydan 3L (Tefal)",
        category: "Mətbəx",
        unit: "ədəd",
        description: "Gümüşü rəngli paslanmaz polad çaydan",
      },
      {
        name: "Şüşə Qab Dəsti 6-lı",
        category: "Qablar",
        unit: "dəst",
        description: "Paşabahçe şüşə salat qabları",
      },
      {
        name: "Bıçaq Dəsti (Solingen)",
        category: "Bıçaqlar",
        unit: "dəst",
        description: "Alman istehsalı 6 ədədli bıçaq dəsti",
      },
    ])
    .returning();

  console.log(`Inserted ${insertedProducts.length} products.`);

  const qazan = insertedProducts.find((p) => p.name.includes("Qazan"))!;
  const tava = insertedProducts.find((p) => p.name.includes("Tava"))!;
  const caydan = insertedProducts.find((p) => p.name.includes("Çaydan"))!;
  const qab = insertedProducts.find((p) => p.name.includes("Şüşə"))!;
  const bicag = insertedProducts.find((p) => p.name.includes("Bıçaq"))!;

  // 3. Insert Customers
  const insertedCustomers = await db
    .insert(schema.customers)
    .values([
      {
        name: "Emin Məmmədov",
        phone: "055-123-45-67",
        address: "Bakı, Yasamal rayonu",
        notes: "Daimi müştəri, etibarlıdır",
      },
      {
        name: "Aysel Əliyeva",
        phone: "070-987-65-43",
        address: "Bakı, Nərimanov metrosu yaxınlığı",
        notes: "Gecikməyə meyillidir, zənglə xatırladılmalıdır",
      },
      {
        name: "Orxan Vəliyev",
        phone: "050-555-44-33",
        address: "Gəncə şəhəri, Atatürk pr.",
        notes: "Nəğd alışlar edir adətən",
      },
    ])
    .returning();

  console.log(`Inserted ${insertedCustomers.length} customers.`);

  const emin = insertedCustomers.find((c) => c.name.includes("Emin"))!;
  const aysel = insertedCustomers.find((c) => c.name.includes("Aysel"))!;
  const orxan = insertedCustomers.find((c) => c.name.includes("Orxan"))!;

  // 4. Insert Stock Entries (Anbar Mədaxili)
  const dayAgo = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString();
  };

  await db.insert(schema.stockEntries).values([
    {
      productId: qazan.id,
      quantity: 25,
      purchasePrice: 18.5,
      supplier: "Grand Halal MMC",
      notes: "Açılış anbar balansı",
      paymentType: "Nəğd",
      entryDate: dayAgo(20),
      paidStatus: "paid",
    },
    {
      productId: tava.id,
      quantity: 35,
      purchasePrice: 12.0,
      supplier: "Tefal Distribütor",
      notes: "Yeni partiya teflon tavalar",
      paymentType: "Kart",
      entryDate: dayAgo(18),
      paidStatus: "paid",
    },
    {
      productId: caydan.id,
      quantity: 15,
      purchasePrice: 28.0,
      supplier: "Tefal Distribütor",
      notes: "Nisyə daxil olan çaydanlar",
      paymentType: "Nisyə",
      creditDueDate: new Date(
        Date.now() + 14 * 24 * 60 * 60 * 1000
      ).toISOString().split("T")[0],
      entryDate: dayAgo(15),
      paidStatus: "credit",
    },
    {
      productId: qab.id,
      quantity: 20,
      purchasePrice: 15.0,
      supplier: "Paşabahçe Təchizat",
      notes: "Şüşə salat qabları",
      paymentType: "Kart2Kart",
      entryDate: dayAgo(10),
      paidStatus: "paid",
    },
    {
      productId: bicag.id,
      quantity: 8,
      purchasePrice: 16.0,
      supplier: "Solingen Baku",
      notes: "Premium bıçaq dəstləri",
      paymentType: "Nəğd",
      entryDate: dayAgo(5),
      paidStatus: "paid",
    },
  ]);

  console.log("Inserted stock entries.");

  // 5. Insert Sales History (Satış Tarixçəsi)
  // Sale 1: Cash sale to Emin
  const sale1 = await db
    .insert(schema.sales)
    .values({
      customerId: emin.id,
      customerName: emin.name,
      customerPhone: emin.phone,
      paymentType: "Nəğd",
      saleDate: dayAgo(12),
      totalAmount: 60.0,
      totalCost: 37.0,
      paymentStatus: "paid",
    })
    .returning();

  await db.insert(schema.saleItems).values({
    saleId: sale1[0].id,
    productId: qazan.id,
    quantity: 2,
    salePrice: 30.0,
    purchasePrice: 18.5,
  });

  // Sale 2: Card sale to Orxan
  const sale2 = await db
    .insert(schema.sales)
    .values({
      customerId: orxan.id,
      customerName: orxan.name,
      customerPhone: orxan.phone,
      paymentType: "Kart",
      saleDate: dayAgo(8),
      totalAmount: 110.0,
      totalCost: 64.0,
      paymentStatus: "paid",
    })
    .returning();

  await db.insert(schema.saleItems).values([
    {
      saleId: sale2[0].id,
      productId: caydan.id,
      quantity: 1,
      salePrice: 50.0,
      purchasePrice: 28.0,
    },
    {
      saleId: sale2[0].id,
      productId: tava.id,
      quantity: 3,
      salePrice: 20.0,
      purchasePrice: 12.0,
    },
  ]);

  // Sale 3: Overdue Credit Sale to Aysel
  const overdueDueDate = new Date();
  overdueDueDate.setDate(overdueDueDate.getDate() - 5);
  const sale3 = await db
    .insert(schema.sales)
    .values({
      customerId: aysel.id,
      customerName: aysel.name,
      customerPhone: aysel.phone,
      paymentType: "Nəğd",
      creditDueDate: overdueDueDate.toISOString().split("T")[0],
      saleDate: dayAgo(10),
      totalAmount: 95.0,
      totalCost: 48.5,
      paymentStatus: "credit",
    })
    .returning();

  await db.insert(schema.saleItems).values([
    {
      saleId: sale3[0].id,
      productId: qazan.id,
      quantity: 1,
      salePrice: 35.0,
      purchasePrice: 18.5,
    },
    {
      saleId: sale3[0].id,
      productId: qab.id,
      quantity: 2,
      salePrice: 30.0,
      purchasePrice: 15.0,
    },
  ]);

  // Sale 4: Pending Credit Sale to Emin
  const pendingDueDate = new Date();
  pendingDueDate.setDate(pendingDueDate.getDate() + 15);
  const sale4 = await db
    .insert(schema.sales)
    .values({
      customerId: emin.id,
      customerName: emin.name,
      customerPhone: emin.phone,
      paymentType: "Nəğd",
      creditDueDate: pendingDueDate.toISOString().split("T")[0],
      saleDate: dayAgo(2),
      totalAmount: 48.0,
      totalCost: 32.0,
      paymentStatus: "credit",
    })
    .returning();

  await db.insert(schema.saleItems).values({
    saleId: sale4[0].id,
    productId: bicag.id,
    quantity: 2,
    salePrice: 24.0,
    purchasePrice: 16.0,
  });

  console.log("Inserted sales and sale items.");

  // 6. Insert Expenses (Xərclər)
  await db.insert(schema.expenses).values([
    {
      amount: 150.0,
      category: "İcarə",
      description: "Anbar icarə haqqı - May ayı",
      date: dayAgo(20),
    },
    {
      amount: 45.2,
      category: "Kommunal",
      description: "Elektrik və su xərcləri",
      date: dayAgo(12),
    },
    {
      amount: 80.0,
      category: "Nəqliyyat",
      description: "Mal gətirilməsi üçün nəqliyyat xərci",
      date: dayAgo(6),
    },
  ]);

  console.log("Inserted expenses.");

  // 7. Insert Users
  await db.insert(schema.users).values([
    {
      username: "admin",
      password: "admin123",
      role: "Admin",
    },
    {
      username: "satici",
      password: "satici123",
      role: "Staff",
    },
  ]);

  console.log("Inserted default users (admin/admin123, satici/satici123).");
  console.log("Database seeded successfully!");
}

seed()
  .then(() => client.close())
  .catch(async (err) => {
    console.error("Seeding failed:", err);
    await client.close();
    process.exit(1);
  });
