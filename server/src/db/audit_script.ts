import { db } from "./index.js";
import * as schema from "./schema.js";
import { eq, and, sql, isNull, notInArray, inArray } from "drizzle-orm";

async function runAudit() {
  console.log("=====================================================");
  console.log("   QAZANPOS LEAD DATA AUDIT & RECONCILIATION REPORT  ");
  console.log("=====================================================");
  console.log(`Audit Timestamp: ${new Date().toISOString()}\n`);

  // 1. Audit Tenants & Products
  const allTenants = await db.select().from(schema.tenants);
  console.log(`📌 Found ${allTenants.length} Tenants in database.`);

  const allProducts = await db.select().from(schema.products);
  console.log(`📌 Found ${allProducts.length} Total Products in database.\n`);

  // 2. Orphan Returns Check
  console.log("🔍 Checking for Orphan Returns & Return Items...");
  const orphanReturns = await db.execute(sql`
    SELECT r.id, r.tenant_id, r.sale_id, r.total_amount, r.return_date
    FROM returns r
    LEFT JOIN sales s ON r.sale_id = s.id
    WHERE r.sale_id IS NOT NULL AND s.id IS NULL;
  `);

  const orphanReturnItems = await db.execute(sql`
    SELECT ri.id, ri.return_id, ri.product_id, ri.quantity, ri.status
    FROM return_items ri
    LEFT JOIN returns r ON ri.return_id = r.id
    WHERE r.id IS NULL;
  `);

  const orphanReturnProducts = await db.execute(sql`
    SELECT ri.id, ri.return_id, ri.product_id, ri.quantity
    FROM return_items ri
    LEFT JOIN products p ON ri.product_id = p.id
    WHERE p.id IS NULL;
  `);

  const orphanReturnCount = (orphanReturns as any).rows?.length || 0;
  const orphanReturnItemsCount = (orphanReturnItems as any).rows?.length || 0;
  const orphanReturnProdCount = (orphanReturnProducts as any).rows?.length || 0;

  console.log(`   - Orphan Returns (sale_id missing): ${orphanReturnCount}`);
  console.log(`   - Orphan Return Items (return_id missing): ${orphanReturnItemsCount}`);
  console.log(`   - Orphan Return Items (product_id missing): ${orphanReturnProdCount}`);

  // 3. Missing Metadata Check (Cashier & Warehouse)
  console.log("\n🔍 Checking for Missing Cashier & Warehouse Metadata...");
  const salesMissingWarehouse = await db.execute(sql`
    SELECT COUNT(*)::int as cnt FROM sales WHERE warehouse_id IS NULL;
  `);
  const salesMissingSeller = await db.execute(sql`
    SELECT COUNT(*)::int as cnt FROM sales WHERE seller_name IS NULL OR seller_name = '';
  `);
  const entriesMissingWarehouse = await db.execute(sql`
    SELECT COUNT(*)::int as cnt FROM stock_entries WHERE warehouse_id IS NULL;
  `);

  console.log(`   - Sales missing warehouse_id: ${(salesMissingWarehouse as any).rows?.[0]?.cnt || 0}`);
  console.log(`   - Sales missing seller_name: ${(salesMissingSeller as any).rows?.[0]?.cnt || 0}`);
  console.log(`   - Stock entries missing warehouse_id: ${(entriesMissingWarehouse as any).rows?.[0]?.cnt || 0}`);

  // 4. Stock Reconciliation per Product (Formula vs Ledger)
  console.log("\n🔍 Reconciling Stock Balances (Formula vs Ledger)...");
  
  const stockDiscrepancies: Array<{
    productId: number;
    productName: string;
    tenantId: number;
    restocked: number;
    sold: number;
    returned: number;
    vendorReturned: number;
    adjustments: number;
    formulaStock: number;
    ledgerStock: number;
    diff: number;
  }> = [];

  for (const product of allProducts) {
    const pid = product.id;

    // Restocked
    const restockedRes = await db.execute(sql`
      SELECT COALESCE(SUM(quantity), 0)::float as qty FROM stock_entries WHERE product_id = ${pid};
    `);
    const restocked = (restockedRes as any).rows?.[0]?.qty || 0;

    // Sold
    const soldRes = await db.execute(sql`
      SELECT COALESCE(SUM(quantity), 0)::float as qty FROM sale_items WHERE product_id = ${pid};
    `);
    const sold = (soldRes as any).rows?.[0]?.qty || 0;

    // Returned to stock
    const returnedRes = await db.execute(sql`
      SELECT COALESCE(SUM(quantity), 0)::float as qty FROM return_items WHERE product_id = ${pid} AND status = 'returned_to_stock';
    `);
    const returned = (returnedRes as any).rows?.[0]?.qty || 0;

    // Vendor returned
    const vrRes = await db.execute(sql`
      SELECT COALESCE(SUM(quantity), 0)::float as qty FROM vendor_return_items WHERE product_id = ${pid};
    `);
    const vendorReturned = (vrRes as any).rows?.[0]?.qty || 0;

    // Adjustments
    const adjRes = await db.execute(sql`
      SELECT COALESCE(SUM(CASE WHEN type = 'found' THEN quantity ELSE -quantity END), 0)::float as qty FROM stock_adjustments WHERE product_id = ${pid};
    `);
    const adjustments = (adjRes as any).rows?.[0]?.qty || 0;

    const formulaStock = Math.max(0, restocked - sold + returned - vendorReturned + adjustments);

    // Ledger sum
    const ledgerRes = await db.execute(sql`
      SELECT COALESCE(SUM(quantity), 0)::float as qty FROM inventory_ledger WHERE product_id = ${pid};
    `);
    const ledgerStock = Math.max(0, (ledgerRes as any).rows?.[0]?.qty || 0);

    const diff = formulaStock - ledgerStock;
    if (Math.abs(diff) > 0.001) {
      stockDiscrepancies.push({
        productId: pid,
        productName: product.name,
        tenantId: product.tenantId,
        restocked,
        sold,
        returned,
        vendorReturned,
        adjustments,
        formulaStock,
        ledgerStock,
        diff,
      });
    }
  }

  console.log(`   - Total Stock Discrepancies Found: ${stockDiscrepancies.length}`);

  // 5. Cashier Operation Breakdown
  console.log("\n👤 Cashier / User Activity Audit Breakdown:");
  const cashierStats = await db.execute(sql`
    SELECT 
      COALESCE(seller_name, 'Unknown') as cashier,
      COUNT(*)::int as total_sales,
      SUM(total_amount)::float as total_revenue
    FROM sales
    GROUP BY seller_name
    ORDER BY total_sales DESC;
  `);

  console.table((cashierStats as any).rows || []);

  // 6. Execute Backfill for Ledger if needed
  console.log("\n🛠️ Backfilling Inventory Ledger for Past Transactions...");

  // Stock Entries
  await db.execute(sql`
    INSERT INTO inventory_ledger (tenant_id, product_id, warehouse_id, quantity, movement_type, reference_type, reference_id, created_at, unit_price, notes)
    SELECT se.tenant_id, se.product_id, se.warehouse_id, se.quantity, 'stock_in', 'stock_entry', se.id, se.entry_date, se.purchase_price, 'Historical stock entry backfill'
    FROM stock_entries se
    WHERE NOT EXISTS (
      SELECT 1 FROM inventory_ledger il WHERE il.reference_type = 'stock_entry' AND il.reference_id = se.id AND il.product_id = se.product_id
    );
  `);

  // Sale Items
  await db.execute(sql`
    INSERT INTO inventory_ledger (tenant_id, product_id, warehouse_id, quantity, movement_type, reference_type, reference_id, user_id, username, created_at, unit_price, notes)
    SELECT si.tenant_id, si.product_id, s.warehouse_id, -si.quantity, 'sale', 'sale', s.id, NULL, s.seller_name, s.sale_date, si.sale_price, 'Historical sale backfill'
    FROM sale_items si
    JOIN sales s ON si.sale_id = s.id
    WHERE NOT EXISTS (
      SELECT 1 FROM inventory_ledger il WHERE il.reference_type = 'sale' AND il.reference_id = s.id AND il.product_id = si.product_id
    );
  `);

  // Return Items (returned_to_stock)
  await db.execute(sql`
    INSERT INTO inventory_ledger (tenant_id, product_id, warehouse_id, quantity, movement_type, reference_type, reference_id, created_at, unit_price, notes)
    SELECT ri.tenant_id, ri.product_id, r.warehouse_id, ri.quantity, 'return', 'return', r.id, r.return_date, ri.sale_price, 'Historical return backfill'
    FROM return_items ri
    JOIN returns r ON ri.return_id = r.id
    WHERE ri.status = 'returned_to_stock' AND NOT EXISTS (
      SELECT 1 FROM inventory_ledger il WHERE il.reference_type = 'return' AND il.reference_id = r.id AND il.product_id = ri.product_id
    );
  `);

  // Stock Adjustments
  await db.execute(sql`
    INSERT INTO inventory_ledger (tenant_id, product_id, warehouse_id, quantity, movement_type, reference_type, reference_id, username, created_at, notes)
    SELECT sa.tenant_id, sa.product_id, sa.warehouse_id, (CASE WHEN sa.type = 'found' THEN sa.quantity ELSE -sa.quantity END), 'stock_adjustment', 'adjustment', sa.id, sa.adjusted_by, sa.date, 'Historical adjustment backfill'
    FROM stock_adjustments sa
    WHERE NOT EXISTS (
      SELECT 1 FROM inventory_ledger il WHERE il.reference_type = 'adjustment' AND il.reference_id = sa.id AND il.product_id = sa.product_id
    );
  `);

  // Vendor Returns
  await db.execute(sql`
    INSERT INTO inventory_ledger (tenant_id, product_id, warehouse_id, quantity, movement_type, reference_type, reference_id, created_at, unit_price, notes)
    SELECT vri.tenant_id, vri.product_id, vr.warehouse_id, -vri.quantity, 'vendor_return', 'vendor_return', vr.id, vr.return_date, vri.unit_price, 'Historical vendor return backfill'
    FROM vendor_return_items vri
    JOIN vendor_returns vr ON vri.vendor_return_id = vr.id
    WHERE NOT EXISTS (
      SELECT 1 FROM inventory_ledger il WHERE il.reference_type = 'vendor_return' AND il.reference_id = vr.id AND il.product_id = vri.product_id
    );
  `);

  console.log("✅ Inventory Ledger Backfill Completed Successfully!");

  // Re-verify after backfill
  const ledgerTotalCount = await db.execute(sql`SELECT COUNT(*)::int as cnt FROM inventory_ledger;`);
  console.log(`\n🎉 Total Ledger Entries in Database: ${(ledgerTotalCount as any).rows?.[0]?.cnt || 0}`);

  console.log("\n=====================================================");
  console.log("               AUDIT COMPLETED                       ");
  console.log("=====================================================");
  process.exit(0);
}

runAudit().catch(err => {
  console.error("Audit error:", err);
  process.exit(1);
});
