// Progressive Client-Side Offline POS Synchronization Engine

export const CACHE_KEYS = {
  PRODUCTS: "qazan_pos_cached_products",
  CUSTOMERS: "qazan_pos_cached_customers",
  SETTINGS: "qazan_pos_cached_settings",
  OFFLINE_SALES: "qazan_pos_offline_sales_queue",
};

// 1. Caching Helpers
export function cacheProducts(products: any[]) {
  localStorage.setItem(CACHE_KEYS.PRODUCTS, JSON.stringify(products));
}

export function cacheCustomers(customers: any[]) {
  localStorage.setItem(CACHE_KEYS.CUSTOMERS, JSON.stringify(customers));
}

export function cacheSettings(settings: any) {
  localStorage.setItem(CACHE_KEYS.SETTINGS, JSON.stringify(settings));
}

export function getCachedProducts(): any[] {
  const data = localStorage.getItem(CACHE_KEYS.PRODUCTS);
  return data ? JSON.parse(data) : [];
}

export function getCachedCustomers(): any[] {
  const data = localStorage.getItem(CACHE_KEYS.CUSTOMERS);
  return data ? JSON.parse(data) : [];
}

export function getCachedSettings(): any {
  const data = localStorage.getItem(CACHE_KEYS.SETTINGS);
  return data ? JSON.parse(data) : null;
}

// 2. Offline Sales Queue Logging & Local Stock Level Deduction
export function saveOfflineSale(salePayload: any): any {
  // 1. Generate local unique ID and metadata
  const localId = `OFL-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const enrichedSale = {
    ...salePayload,
    id: localId,
    saleDate: new Date().toISOString(),
    isOfflinePending: true,
  };

  // 2. Queue the transaction in LocalStorage
  const queue = getOfflineSalesQueue();
  queue.push(enrichedSale);
  localStorage.setItem(CACHE_KEYS.OFFLINE_SALES, JSON.stringify(queue));

  // 3. Deduct stock quantities in local cache to prevent double-selling
  const cachedProducts = getCachedProducts();
  const updatedProducts = cachedProducts.map((prod) => {
    const saleItem = salePayload.items.find((item: any) => item.productId === prod.productId);
    if (saleItem) {
      const currentQty = parseFloat(prod.currentQuantity) || 0;
      const soldQty = parseFloat(saleItem.quantity) || 0;
      return {
        ...prod,
        currentQuantity: Math.max(0, currentQty - soldQty),
      };
    }
    return prod;
  });
  cacheProducts(updatedProducts);

  return enrichedSale;
}

export function getOfflineSalesQueue(): any[] {
  const data = localStorage.getItem(CACHE_KEYS.OFFLINE_SALES);
  return data ? JSON.parse(data) : [];
}

export function clearOfflineSalesQueue() {
  localStorage.removeItem(CACHE_KEYS.OFFLINE_SALES);
}

// 3. Background Synchronization Engine
let isSyncing = false;

export async function syncOfflineSalesToServer(onSuccessToast?: (count: number) => void): Promise<boolean> {
  if (isSyncing) return false;
  if (!navigator.onLine) return false;

  const queue = getOfflineSalesQueue();
  if (queue.length === 0) return false;

  isSyncing = true;
  console.log(`SyncEngine: Found ${queue.length} offline sale(s) to synchronize.`);

  const successfulIds: string[] = [];

  for (const sale of queue) {
    try {
      // Map back local sale structure to clean backend post body
      const postBody = {
        customerId: sale.customerId,
        paymentType: sale.paymentType,
        creditDueDate: sale.creditDueDate,
        notes: sale.notes,
        totalAmount: sale.totalAmount,
        totalCost: sale.totalCost,
        items: sale.items.map((item: any) => ({
          productId: item.productId,
          quantity: item.quantity,
          salePrice: item.salePrice,
          purchasePrice: item.purchasePrice,
        })),
      };

      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(postBody),
      });

      if (res.ok) {
        successfulIds.push(sale.id);
        console.log(`SyncEngine: Offline Sale ${sale.id} synced successfully.`);
      } else {
        console.warn(`SyncEngine: Server rejected offline sale ${sale.id}. Will retry later.`);
      }
    } catch (err) {
      console.error(`SyncEngine: Network error syncing sale ${sale.id}. Stopped loop.`, err);
      break; // stop loop on network failure
    }
  }

  // Remove successfully synced sales from queue
  if (successfulIds.length > 0) {
    const freshQueue = getOfflineSalesQueue().filter((sale) => !successfulIds.includes(sale.id));
    localStorage.setItem(CACHE_KEYS.OFFLINE_SALES, JSON.stringify(freshQueue));
    
    if (onSuccessToast) {
      onSuccessToast(successfulIds.length);
    }
    
    isSyncing = false;
    return true;
  }

  isSyncing = false;
  return false;
}
