import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

const connectionString = process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/qazanpos";
const client = postgres(connectionString);
const db = drizzle(client, { schema });

async function seed() {
  console.log("Seeding database...");

  // 1. Clear existing data in correct dependency order
  await db.delete(schema.creditPayments);
  await db.delete(schema.saleItems);
  await db.delete(schema.sales);
  await db.delete(schema.stockEntries);
  await db.delete(schema.products);
  await db.delete(schema.customers);
  await db.delete(schema.expenses);
  await db.delete(schema.settings);
  await db.delete(schema.activityLogs);
  await db.delete(schema.users);
  await db.delete(schema.tenants);

  console.log("Cleared existing data.");

  // 2. Insert Tenants
  const insertedTenants = await db
    .insert(schema.tenants)
    .values([
      {
        id: 1,
        name: "Mətbəx Dünyası",
        slug: "demo",
        status: "active",
        releaseTier: "stable",
        createdAt: new Date().toISOString(),
      },
      {
        id: 2,
        name: "Super Platform Admin",
        slug: "super",
        status: "active",
        releaseTier: "stable",
        createdAt: new Date().toISOString(),
      },
    ])
    .returning();

  console.log(`Inserted ${insertedTenants.length} tenants.`);

  // 3. Insert Products under Tenant 1 (demo)
  const insertedProducts = await db
    .insert(schema.products)
    .values([
      {
        tenantId: 1,
        name: "Qazan 24sm (Korkmaz)",
        category: "Qazan",
        unit: "ədəd",
        description: "Paslanmaz polad, Korkmaz premium keyfiyyət",
      },
      {
        tenantId: 1,
        name: "Tava 28sm (Tefal)",
        category: "Tava",
        unit: "ədəd",
        description: "Tefal teflon örtüklü tava, yapışmayan",
      },
      {
        tenantId: 1,
        name: "Çaydan 3L (Tefal)",
        category: "Mətbəx",
        unit: "ədəd",
        description: "Gümüşü rəngli paslanmaz polad çaydan",
      },
      {
        tenantId: 1,
        name: "Şüşə Qab Dəsti 6-lı",
        category: "Qablar",
        unit: "dəst",
        description: "Paşabahçe şüşə salat qabları",
      },
      {
        tenantId: 1,
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

  // 4. Insert Customers under Tenant 1 (demo)
  const insertedCustomers = await db
    .insert(schema.customers)
    .values([
      {
        tenantId: 1,
        name: "Emin Məmmədov",
        phone: "055-123-45-67",
        address: "Bakı, Yasamal rayonu",
        notes: "Daimi müştəri, etibarlıdır",
      },
      {
        tenantId: 1,
        name: "Aysel Əliyeva",
        phone: "070-987-65-43",
        address: "Bakı, Nərimanov metrosu yaxınlığı",
        notes: "Gecikməyə meyillidir, zənglə xatırladılmalıdır",
      },
      {
        tenantId: 1,
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

  // 5. Insert Stock Entries (Anbar Mədaxili) under Tenant 1 (demo)
  const dayAgo = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString();
  };

  await db.insert(schema.stockEntries).values([
    {
      tenantId: 1,
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
      tenantId: 1,
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
      tenantId: 1,
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
      tenantId: 1,
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
      tenantId: 1,
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

  // 6. Insert Sales History under Tenant 1 (demo)
  // Sale 1: Cash sale to Emin
  const sale1 = await db
    .insert(schema.sales)
    .values({
      tenantId: 1,
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
    tenantId: 1,
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
      tenantId: 1,
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
      tenantId: 1,
      saleId: sale2[0].id,
      productId: caydan.id,
      quantity: 1,
      salePrice: 50.0,
      purchasePrice: 28.0,
    },
    {
      tenantId: 1,
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
      tenantId: 1,
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
      tenantId: 1,
      saleId: sale3[0].id,
      productId: qazan.id,
      quantity: 1,
      salePrice: 35.0,
      purchasePrice: 18.5,
    },
    {
      tenantId: 1,
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
      tenantId: 1,
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
    tenantId: 1,
    saleId: sale4[0].id,
    productId: bicag.id,
    quantity: 2,
    salePrice: 24.0,
    purchasePrice: 16.0,
  });

  console.log("Inserted sales and sale items.");

  // 7. Insert Expenses under Tenant 1 (demo)
  await db.insert(schema.expenses).values([
    {
      tenantId: 1,
      amount: 150.0,
      category: "İcarə",
      description: "Anbar icarə haqqı - May ayı",
      date: dayAgo(20),
    },
    {
      tenantId: 1,
      amount: 45.2,
      category: "Kommunal",
      description: "Elektrik və su xərcləri",
      date: dayAgo(12),
    },
    {
      tenantId: 1,
      amount: 80.0,
      category: "Nəqliyyat",
      description: "Mal gətirilməsi üçün nəqliyyat xərci",
      date: dayAgo(6),
    },
  ]);

  console.log("Inserted expenses.");

  // 8. Insert Settings for both tenants
  await db.insert(schema.settings).values([
    {
      tenantId: 1,
      storeName: "Mətbəx Dünyası",
      phone: "055-123-4567",
      address: "Yuxarı Göyçay",
    },
    {
      tenantId: 2,
      storeName: "SaaS Control Plane",
      phone: "010-000-0000",
      address: "Mərkəz bulud serverləri",
    },
  ]);

  console.log("Inserted business settings for both tenants.");

  // 9. Insert Users associated with Tenant IDs
  // Passwords from env vars or auto-generated if not set (avoids hardcoded credentials)
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || `admin_${Date.now()}`;
  const staffPassword = process.env.SEED_STAFF_PASSWORD || `staff_${Date.now()}`;
  const superAdminPassword = process.env.SEED_SUPER_PASSWORD || `super_${Date.now()}`;

  await db.insert(schema.users).values([
    // Tenant 1 (demo) users
    {
      tenantId: 1,
      username: "admin",
      password: adminPassword,
      role: "Admin",
    },
    {
      tenantId: 1,
      username: "satici",
      password: staffPassword,
      role: "Staff",
    },
    // Tenant 2 (super admin portal) users
    {
      tenantId: 2,
      username: "superadmin",
      password: superAdminPassword,
      role: "Admin",
    },
  ]);

  const seededPasswords = `demo: admin/${adminPassword}, satici/${staffPassword}; super: superadmin/${superAdminPassword}`;
  console.log(`Inserted default users (${seededPasswords}).`);
  console.log("Database seeded successfully!");
}

seed()
  .then(() => client.end())
  .catch(async (err) => {
    console.error("Seeding failed:", err);
    await client.end();
    process.exit(1);
  });
